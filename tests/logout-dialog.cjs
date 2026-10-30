const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run',
  '--disable-background-networking','--remote-debugging-port=9352',
  '--user-data-dir='+path.resolve(root,'../edge-logout-check'),'about:blank'
],{stdio:'ignore',windowsHide:true});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let tabs;
  for(let i=0;i<40;i++){
    try{tabs=await fetch('http://127.0.0.1:9352/json').then(r=>r.json());if(tabs.length)break;}catch{}
    await pause(250);
  }
  assert(tabs?.length,'Edge no inició');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let seq=0;const pending=new Map();
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  await call('Page.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs',{urls:['*cdn.jsdelivr.net*','*fonts.googleapis.com*','*fonts.gstatic.com*']});
  const fixture=path.join(root,'.tmp','logout-layout.html');
  fs.mkdirSync(path.dirname(fixture),{recursive:true});
  fs.writeFileSync(fixture,'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;background:#edf3f6}</style></head><body><button id="logout">Cerrar sesión</button><script src="../zima-ui.js"></script></body></html>');
  await call('Page.navigate',{url:pathToFileURL(fixture).href});
  await pause(300);
  await call('Runtime.evaluate',{expression:'ZimaUI.clearSession();'});
  await call('Page.reload');
  await pause(300);
  const guest=await call('Runtime.evaluate',{expression:`!document.getElementById('zimaSupportLauncher')`,returnByValue:true});
  assert.equal(guest.result.value,true,'Sin sesión no se instala soporte');
  await call('Runtime.evaluate',{expression:`localStorage.setItem('ZIMA_SESSION',JSON.stringify({usuario:'prueba',nombre:'Equipo ZIMA',token:'token-local',rol:'PEAJE'}))`});
  await call('Page.reload');
  await pause(300);
  const authenticated=await call('Runtime.evaluate',{expression:`!!document.querySelector('#zimaSupportLauncher .support-fab svg')`,returnByValue:true});
  assert.equal(authenticated.result.value,true,'Soporte disponible con sesión');
  for(const width of [1440,390,320]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    await call('Runtime.evaluate',{expression:`document.getElementById('logout').focus();window.result=null;ZimaUI.confirmLogout({detail:'Equipo ZIMA · Peaje de prueba'}).then(value=>window.result=value);`});
    await pause(400);
    const result=await call('Runtime.evaluate',{expression:`(()=>{const card=document.querySelector('.logout .zima-confirm-card'),r=card.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,cancelFocused:document.activeElement.dataset.zimaConfirm==='cancel'};})()`,returnByValue:true});
    const r=result.result.value;
    assert(r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=900,JSON.stringify(r));
    assert.equal(r.cancelFocused,true,'Foco inicial en seguir aquí');
    if(width!==320){
      const shot=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(root,'.tmp','logout-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    const cancelled=await call('Runtime.evaluate',{expression:`(async()=>{document.querySelector('[data-zima-confirm="cancel"]').click();await new Promise(r=>setTimeout(r,0));return {result:window.result,saved:!!localStorage.getItem('ZIMA_SESSION'),focus:document.activeElement.id};})()`,awaitPromise:true,returnByValue:true});
    assert.deepEqual(cancelled.result.value,{result:false,saved:true,focus:'logout'});
  }
  const escape=await call('Runtime.evaluate',{expression:`(async()=>{let outcome;ZimaUI.confirmLogout().then(v=>outcome=v);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await new Promise(r=>setTimeout(r,0));return outcome;})()`,awaitPromise:true,returnByValue:true});
  assert.equal(escape.result.value,false);
  const confirmed=await call('Runtime.evaluate',{expression:`(async()=>{let outcome;window.serverCalled=false;ZimaUI.confirmLogout({redirect:'#logged-out',beforeClear:async()=>{window.serverCalled=true;}}).then(v=>outcome=v);document.querySelector('[data-zima-confirm="ok"]').click();await new Promise(r=>setTimeout(r,100));return {outcome,serverCalled:window.serverCalled,cleared:!localStorage.getItem('ZIMA_SESSION'),redirect:location.hash};})()`,awaitPromise:true,returnByValue:true});
  assert.deepEqual(confirmed.result.value,{outcome:true,serverCalled:true,cleared:true,redirect:'#logged-out'});
  await call('Page.navigate',{url:pathToFileURL(path.join(root,'login.html')).href});
  await pause(300);
  const login=await call('Runtime.evaluate',{expression:`!document.querySelector('#zimaSupportLauncher,.support-fab')`,returnByValue:true});
  assert.equal(login.result.value,true);
  fs.unlinkSync(fixture);
  console.log('OK: modal en móvil y escritorio, cancelar y Escape conservan sesión, confirmar limpia y redirige; soporte solo con sesión.');
  await call('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill();});
