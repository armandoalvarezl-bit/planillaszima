const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { spawn } = require('node:child_process');
const fixture = require('./offline-fixture.cjs');
const root = path.resolve(__dirname, '..'), f = fixture();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let dropResponse = false, writes = 0, frames = 0, listReads = 0;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/mock-api') {
    let data = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      data = req.headers['content-type']?.includes('application/x-www-form-urlencoded') ? JSON.parse(new URLSearchParams(body).get('zimaOfflinePayload')) : JSON.parse(body);
    }
    let value;
    if (data.action === 'list') listReads++;
    if (data.action === 'login') value = data.usuario === 'operador' && data.password === 'ClavePrueba' ? { ok: true, ...f.profile } : { ok: false, mensaje: 'Credenciales incorrectas' };
    else value = req.method === 'GET' ? f.context.doGet({ parameter: data }) : f.api(data.action, data);
    if (data.action === 'offlinemutate') {
      writes++;
      if (dropResponse) { dropResponse = false; res.writeHead(503); res.end('Simulated lost acknowledgement'); return; }
    }
    if (value.html) { frames++; res.setHeader('Content-Type', 'text/html'); res.end(value.html); return; }
    res.setHeader('Content-Type', data.callback ? 'application/javascript' : 'application/json');
    res.end(data.callback ? data.callback + '(' + JSON.stringify(value) + ');' : JSON.stringify(value)); return;
  }
  if (url.pathname === '/offline-test.html') {
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><script src="zima-offline.js"></script></head><body>Offline integration test</body></html>'); return;
  }
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', ({ '.js': 'application/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
let browser, socket;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const port = 9469;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zima-offline-browser-'));
  browser = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless', '--no-sandbox', '--disable-gpu', '--no-first-run', '--disable-background-networking',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await fetch('http://127.0.0.1:' + port + '/json').then(r => r.json()); if (tabs.length) break; } catch (_) {}
    await pause(250);
  }
  assert.ok(tabs?.length, 'Headless Edge did not start');
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let seq = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data); if (!result.id) return;
    const promise = pending.get(result.id); pending.delete(result.id);
    if (result.error) promise.reject(Error(JSON.stringify(result.error))); else promise.resolve(result.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  async function waitFor(expression, message) {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); }
    throw Error(message || 'Timed out: ' + expression);
  }
  await call('Page.enable'); await call('Network.enable');
  // Todas las llamadas de Apps Script se dirigen a la simulación local, incluidas las de JSONP.
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `{
    const original = window.fetch;
    const translate = value => String(value).startsWith('https://script.google.com/macros/s/') ? '${origin}/mock-api' + (String(value).includes('?') ? '?' + String(value).split('?')[1] : '') : value;
    window.fetch = (url, options) => original(translate(url), options);
    const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
    Object.defineProperty(HTMLScriptElement.prototype, 'src', { get: descriptor.get, set(value) { descriptor.set.call(this, translate(value)); } });
    const formAction = Object.getOwnPropertyDescriptor(HTMLFormElement.prototype, 'action');
    Object.defineProperty(HTMLFormElement.prototype, 'action', { get: formAction.get, set(value) { formAction.set.call(this, translate(value)); } });
  }` });
  await call('Page.navigate', { url: origin + '/offline-test.html' });
  await waitFor('!!window.ZimaOffline');
  const prepared = await evaluate(`ZimaOffline.login('operador','ClavePrueba',()=>Promise.resolve(${JSON.stringify({ ok: true, ...f.profile })}))`);
  assert.equal(prepared.offlineReady, true, JSON.stringify({ prepared, status: await evaluate('ZimaOffline.status()') }));
  await evaluate('navigator.serviceWorker.ready.then(()=>true)');
  await waitFor('!!navigator.serviceWorker.controller');
  assert.equal(await evaluate('document.getElementById("zimaOfflineStatus").hidden'), true, 'Healthy online preparation must be silent');
  console.log('OK: account prepared with encrypted IndexedDB and complete service worker shell');
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await waitFor('document.getElementById("zimaOfflineStatus").hidden === false');
  await evaluate('ZimaUI?.clearSession?.()').catch(() => evaluate('ZimaOffline.lock()'));
  await call('Page.navigate', { url: origin + '/login.html' });
  await waitFor('!!(window.ZimaUI && window.ZimaOffline && document.getElementById("loginForm"))');
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const loginArtifacts = path.join(root, 'tests/artifacts'); fs.mkdirSync(loginArtifacts, { recursive: true });
  for (const [width, height] of [[1366, 768], [1280, 720], [1024, 600], [390, 844], [320, 640]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const metrics = await evaluate(`(()=>{
      limpiarMensaje(); mostrarCarga(loginButton,loginForm,false,'');
      const footer=document.querySelector('.made-in-colombia');
      const before=footer.getBoundingClientRect();
      mostrarCarga(loginButton,loginForm,true,'Verificando sus credenciales. Espere un momento…');
      const after=footer.getBoundingClientRect(),button=loginButton.getBoundingClientRect();
      return {before:before.top,after:after.top,bottom:after.bottom,left:after.left,right:after.right,button:button.bottom,scroll:document.documentElement.scrollWidth};
    })()`);
    assert.ok(Math.abs(metrics.before - metrics.after) < 1, 'Login footer shifts on submit: ' + JSON.stringify({width,height,...metrics}));
    assert.ok(metrics.bottom <= height && metrics.left >= 0 && metrics.right <= width && metrics.button <= height && metrics.scroll <= width, 'Login footer or button clipped: ' + JSON.stringify({width,height,...metrics}));
    if (width === 1366 || width === 390) {
      const shot=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(loginArtifacts,'login-loading-'+(width===1366?'desktop':'mobile')+'.png'),Buffer.from(shot.data,'base64'));
    }
    await evaluate('mostrarCarga(loginButton,loginForm,false,""); true');
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  console.log('OK: login loading leaves footer and Colombia flag stationary and fully visible at desktop/mobile sizes');
  assert.equal(await evaluate(`ZimaOffline.login('operador','incorrecta',()=>{throw Error('Must not call network')}).then(()=>false,()=>true)`), true);
  await evaluate(`document.getElementById('usuario').value='operador'; document.getElementById('password').value='ClavePrueba'; document.getElementById('loginForm').requestSubmit(); true`);
  await waitFor(`location.pathname.endsWith('/dashboard.html') && !!window.ZimaUI`, 'Offline login did not reach dashboard');
  assert.equal(await evaluate('ZimaOffline.status().unlocked'), true);
  console.log('OK: real login form rejects wrong local password and opens cached dashboard offline');
  await evaluate('cerrarBienvenidaIngreso(); true');
  await waitFor('!!document.querySelector("dialog.zima-offline-tutorial[open]")', 'The introductory offline tutorial did not open');
  await waitFor('[...document.querySelectorAll(".ot-brand img")].length === 2 && [...document.querySelectorAll(".ot-brand img")].every(img=>img.complete && img.naturalWidth > 0)', 'Existing institutional logos must load offline');
  const artifactRoot = path.join(root, 'tests/artifacts'); fs.mkdirSync(artifactRoot, { recursive: true });
  for (const [width, height, label] of [[1440, 1000, 'desktop'], [375, 900, 'mobile'], [320, 800, 'small-mobile']]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    const metrics = await evaluate(`(()=>{const d=document.querySelector('.zima-offline-tutorial'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth+1};})()`);
    assert.ok(metrics.left >= 0 && metrics.right <= width && metrics.top >= 0 && metrics.bottom <= height && !metrics.overflow, JSON.stringify(metrics));
    if (label !== 'small-mobile') {
      const shot = await call('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(artifactRoot, 'offline-tutorial-' + label + '.png'), Buffer.from(shot.data, 'base64'));
    }
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  for (let i = 1; i <= 5; i++) {
    assert.equal(await evaluate('document.querySelector(".zima-offline-tutorial").dataset.step'), String(i));
    await evaluate('document.querySelector(".ot-next").click(); true');
  }
  await waitFor('!document.querySelector("dialog.zima-offline-tutorial")');
  assert.equal(await evaluate(`ZimaOfflineTutorial.showOnce('operador')`), false, 'Completed tutorial must not repeat');
  await evaluate(`ZimaOfflineTutorial.showOnce('otra-cuenta'); true`);
  assert.equal(await evaluate('!!document.querySelector("dialog.zima-offline-tutorial[open]")'), true, 'Another account gets its own introduction');
  await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor('!document.querySelector("dialog.zima-offline-tutorial")');
  assert.equal(await evaluate(`ZimaOfflineTutorial.showOnce('otra-cuenta')`), false, 'Dismissed tutorial must not repeat');
  console.log('OK: five-step tutorial, desktop/mobile layouts, finish/skip, Escape and independent once-per-user display');
  await call('Page.navigate', { url: origin + '/planilla.html' });
  await waitFor('!!window.ZimaUI && typeof guardar === "function"');
  const saved = await evaluate(`(async()=>{
    imprimirDesdeVistaPrevia=async()=>{}; ZimaUI.confirm=async()=>false;
    document.getElementById('codigo').value='OFFLINE-TEST-1'; document.getElementById('total').value='120000';
    await guardar(); return (await apiGet('list')).rows[0];
  })()`);
  assert.ok(saved?.id?.startsWith('OFF-'), JSON.stringify(saved));
  assert.equal(saved.pending, true);
  assert.equal(await evaluate('construirDocumentoImpresion().textContent.includes("PENDIENTE DE SINCRONIZACIÓN")'), true);
  const id = saved.id;
  await call('Page.navigate', { url: origin + '/planilla.html?id=' + id });
  await waitFor(`document.getElementById('codigo')?.value === 'OFFLINE-TEST-1'`);
  const edited = await evaluate(`(async()=>{const row=(await apiGet('get',{id:${JSON.stringify(id)}})).row;return apiPost({...row,action:'update',total:130000});})()`);
  assert.equal(edited.row.total, 130000);
  assert.equal(await evaluate('ZimaOffline.status().pending'), 2);
  console.log('OK: create, reload, query and edit a planilla offline with a persistent operation queue');
  await evaluate('ZimaUI.clearSession(); true');
  assert.equal(await evaluate('ZimaOffline.status().unlocked'), false);
  const relogin = await evaluate(`ZimaOffline.login('operador','ClavePrueba',()=>{throw Error('Offline')})`);
  assert.equal(relogin.ok, true);
  assert.equal(await evaluate('ZimaOffline.status().pending'), 2);
  // Simular la pérdida de la respuesta después de que el servidor haya guardado.
  dropResponse = true;
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate('ZimaOffline.sync()');
  await waitFor('ZimaOffline.status().pending === 0', 'Queue did not synchronize: ' + JSON.stringify(await evaluate('ZimaOffline.status()')));
  assert.equal(f.sheets.get('PLANILLAS').rows.length, 2, 'Retry must not duplicate the planilla');
  assert.equal(f.sheets.get('PLANILLAS').rows[1][f.context.headerIndex_('total') - 1], 130000);
  assert.ok(writes >= 3, 'Expected the create retry and the update');
  assert.ok(frames >= 1, 'Expected a confirmed POST frame retry');
  await waitFor('document.getElementById("zimaOfflineStatus").hidden === true', 'Online status must hide after all pending changes are confirmed');
  console.log('OK: automatic reconnect, renewed server session, ordered sync and lost-response retry without duplicates');
  const current = (await evaluate(`apiGet('get',{id:${JSON.stringify(id)}})`)).row;
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await evaluate(`apiPost({...${JSON.stringify(current)},action:'update',total:140000})`);
  f.advance(500);
  f.sheets.get('PLANILLAS').rows[1][f.context.headerIndex_('total') - 1] = 160000;
  f.sheets.get('PLANILLAS').rows[1][f.context.headerIndex_('updatedAt') - 1] = new Date(Date.now() + 500);
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate('ZimaOffline.sync()');
  await waitFor('document.getElementById("zimaOfflineStatus").textContent.includes("por revisar")');
  assert.equal(f.sheets.get('PLANILLAS').rows[1][f.context.headerIndex_('total') - 1], 160000);
  assert.equal(await evaluate('ZimaOffline.status().pending'), 1);
  console.log('OK: concurrent server change stays intact and local conflict remains available for review');
  const ciphertext = await evaluate(`(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('zima-offline-v1');q.onsuccess=()=>r(q.result);q.onerror=j});return new Promise(r=>{const q=db.transaction('accounts').objectStore('accounts').get('operador');q.onsuccess=()=>r(q.result)})})()`);
  assert.equal(JSON.stringify(ciphertext).includes('OFFLINE-TEST-1'), false);
  assert.equal(JSON.stringify(ciphertext).includes('ClavePrueba'), false);
  console.log('OK: stored database contains ciphertext, not password or plain planilla data');
  const previousDownload = await evaluate('ZimaOffline.status().downloadedAt');
  await evaluate(`(async()=>{
    const decode=v=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
    const encode=v=>btoa(Array.from(new Uint8Array(v),c=>String.fromCharCode(c)).join(''));
    const unlocked=JSON.parse(sessionStorage.getItem('ZIMA_OFFLINE_UNLOCK'));
    const key=await crypto.subtle.importKey('raw',decode(unlocked.key),'AES-GCM',false,['encrypt','decrypt']);
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('zima-offline-v1');q.onsuccess=()=>resolve(q.result);q.onerror=reject;});
    const saved=await new Promise(resolve=>{const q=db.transaction('accounts').objectStore('accounts').get(unlocked.user);q.onsuccess=()=>resolve(q.result);});
    const aad=new TextEncoder().encode(unlocked.user);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(saved.iv),additionalData:aad},key,decode(saved.cipher));
    const data=JSON.parse(new TextDecoder().decode(plain));data.dailyPreparedDay='2000-01-01';data.downloadedAt=0;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    saved.cipher=encode(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad},key,new TextEncoder().encode(JSON.stringify(data))));saved.iv=encode(iv);
    await new Promise((resolve,reject)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put(saved);tx.oncomplete=resolve;tx.onerror=reject;});
    window.dispatchEvent(new Event('focus'));return true;
  })()`);
  await waitFor(`ZimaOffline.status().downloadedAt > ${previousDownload}`, 'Opening the app on a new day should refresh the encrypted local copy');
  assert.equal(await evaluate('ZimaOffline.status().pending'), 1, 'Daily download must preserve the local conflict');
  assert.equal((await evaluate(`apiGet('get',{id:${JSON.stringify(id)}})`)).row.total, 140000, 'Daily download must not overwrite local edits with the server version');
  const readCount = listReads;
  await evaluate(`window.dispatchEvent(new Event('focus')); true`); await pause(200);
  assert.equal(listReads, readCount, 'No duplicate full download on repeated focus the same day');
  console.log('OK: silent daily refresh on opening, once per day, preserves queued edits and conflicts');
  const unlockedKey = await evaluate('sessionStorage.getItem("ZIMA_OFFLINE_UNLOCK")');
  const preparedAgain = await evaluate(`ZimaOffline.login('operador','ClavePrueba',()=>Promise.resolve(${JSON.stringify({ ok: true, ...f.profile })}))`);
  assert.equal(preparedAgain.offlineReady, true);
  assert.equal(await evaluate('sessionStorage.getItem("ZIMA_OFFLINE_UNLOCK")'), unlockedKey, 'Same-account preparation must not invalidate keys held by another tab');
  assert.equal(await evaluate('ZimaOffline.status().pending'), 1, 'Online login must preserve local conflicts');
  console.log('OK: repeated online login preserves pending changes and the key shared by existing tabs');
  await evaluate(`document.querySelector('#zimaOfflineStatus button').click(); true`);
  await waitFor('!!document.querySelector("dialog.zima-offline-dialog")');
  await evaluate(`window.confirm=()=>true; Array.from(document.querySelectorAll('dialog.zima-offline-dialog button')).find(button=>button.textContent.startsWith('Enviar mi versión')).click(); true`);
  await waitFor('ZimaOffline.status().pending === 0');
  assert.equal(f.sheets.get('PLANILLAS').rows[1][f.context.headerIndex_('total') - 1], 140000);
  console.log('OK: explicit conflict review can resubmit the local version with a fresh immutable operation');
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  const provisional = await evaluate(`apiPost({action:'save',peaje:'FRAGUA',fecha:'2026-10-26',total:5000})`);
  assert.ok(provisional.row.codigo.startsWith('LOCAL-'));
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate('ZimaOffline.sync()');
  await waitFor('ZimaOffline.status().pending === 0');
  const definitive = await evaluate(`apiGet('get',{id:${JSON.stringify(provisional.row.id)}})`);
  assert.ok(definitive.row.codigo.startsWith('P20261026'), definitive.row.codigo);
  console.log('OK: provisional offline code becomes the normal server-generated code on synchronization');
  f.expireSessions();
  const renewed = await evaluate(`apiGet('list')`);
  assert.equal(renewed.ok, true, 'An evicted Apps Script session must renew automatically');
  assert.equal(renewed.rows.length, 2);
  console.log('OK: early Apps Script cache eviction renews the session without losing local access');
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await call('Page.navigate', { url: origin + '/historial.html' });
  await waitFor('typeof alternarMenu === "function" && !!document.getElementById("menuToggle")');
  for (const width of [390, 768]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    if (width < 701) {
      assert.equal(await evaluate('!!document.querySelector("#menuToggle svg")'), true);
      await evaluate('document.getElementById("menuToggle").click(); true');
      await pause(250);
    }
    const menuIcons = await evaluate(`Array.from(document.querySelectorAll('.sidebar .nav-item')).map(link=>{const icon=link.querySelector('.nav-icon'),svg=icon.querySelector('svg'),r=svg.getBoundingClientRect();return {text:link.textContent.trim(),hasSvg:!!svg,display:getComputedStyle(icon).display,width:r.width,height:r.height,iconColor:getComputedStyle(svg).color,linkColor:getComputedStyle(link).color};})`);
    assert.equal(menuIcons.length, 5);
    for (const icon of menuIcons) {
      assert.ok(icon.hasSvg && icon.display !== 'none' && icon.width > 0 && icon.height > 0, JSON.stringify({ width, icon }));
      if (width < 701) assert.equal(icon.iconColor, icon.linkColor, 'Mobile menu icons must contrast with white menu background');
    }
    if (width < 701) {
      assert.equal(await evaluate(`(()=>{const link=document.querySelector('.sidebar .nav-item'),r=link.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.nav-item')===link;})()`), true, 'Menu links must remain above the backdrop and receive taps');
      const shot=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(root,'tests/artifacts/history-menu-mobile.png'),Buffer.from(shot.data,'base64'));
      await evaluate('cerrarMenu(); true');
      assert.equal(await evaluate('!!document.querySelector("#menuToggle svg")'), true);
    }
  }
  console.log('OK: Historial menu icons remain visible on mobile/tablet, with correct contrast and no internet');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (socket) socket.close(); if (browser) browser.kill(); server.closeAllConnections(); server.close();
});
