(function () {
  'use strict';
  const API = 'https://script.google.com/macros/s/AKfycbwcCMhxYhF3uMmzpAmGL2uK02UHkHP1gyikRSsW5OfLxTofSjnT821hgqAuWX9TyrWXZg/exec';
  const SESSION = 'ZIMA_OFFLINE_UNLOCK';
  const supported = !!(window.isSecureContext && window.crypto && crypto.subtle && window.indexedDB && navigator.locks);
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  let key, user = '', syncing = false, serverUntil = 0, token = '', warning = '', lastState;
  const normalize = value => String(value || '').trim().toLowerCase();
  const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const b64 = value => btoa(Array.from(new Uint8Array(value), b => String.fromCharCode(b)).join(''));
  const uid = () => crypto.randomUUID();
  let database;
  let shellReady = false;
  function localDay() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function db() {
    if (!database) database = new Promise((resolve, reject) => {
      const open = indexedDB.open('zima-offline-v1', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('accounts', { keyPath: 'user' });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(Error('Cierre las otras pestañas para preparar el almacenamiento local.'));
    });
    return database;
  }
  async function record(id, value) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('accounts', value ? 'readwrite' : 'readonly');
      const store = tx.objectStore('accounts');
      const request = value ? store.put(value) : store.get(id);
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || Error('No se pudo guardar en este dispositivo.'));
      tx.onabort = () => reject(tx.error || Error('No se confirmó el guardado local.'));
    });
  }
  async function derive(password, salt) {
    const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: bytes(salt), iterations: 210000, hash: 'SHA-256' }, material,
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }
  async function decrypt(saved, secretKey) {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(saved.iv), additionalData: encoder.encode(saved.user) }, secretKey, bytes(saved.cipher));
    return JSON.parse(decoder.decode(plain));
  }
  async function persist(state, salt, secretKey = key, id = user) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(id) }, secretKey, encoder.encode(JSON.stringify(state)));
    await record(id, { user: id, salt, iv: b64(iv), cipher: b64(cipher), pendingCount: state.queue.length });
    try { localStorage.setItem('ZIMA_OFFLINE_CHANGED', JSON.stringify({ user: id, at: Date.now(), nonce: uid() })); } catch (_) {}
    lastState = state;
    render();
  }
  async function state() {
    if (!key || !user) throw Error('Ingrese de nuevo para desbloquear los datos de este equipo.');
    const saved = await record(user);
    if (!saved) throw Error('Este dispositivo todavía no está preparado para trabajar sin internet.');
    return decrypt(saved, key);
  }
  function active() {
    const activity = Number(localStorage.getItem('ZIMA_LAST_ACTIVITY'));
    let account;
    try { account = JSON.parse(localStorage.getItem('ZIMA360_SESION') || 'null'); } catch (_) {}
    return key && user && (!account || normalize(account.usuario) === user) && activity > 0 && Date.now() - activity < 15 * 60000;
  }
  async function change(fn) {
    const id = user, secretKey = key;
    if (!active()) throw Error('La sesión venció. Ingrese nuevamente; sus pendientes se conservan.');
    return navigator.locks.request('zima-data-' + id, async () => {
      if (id !== user || key !== secretKey) throw Error('La sesión cambió.');
      const saved = await record(id), data = await decrypt(saved, secretKey);
      const result = await fn(data);
      await persist(data, saved.salt, secretKey, id);
      return result;
    });
  }
  async function transport(action, data = {}, write = false) {
    if (navigator.onLine === false) throw Error('Sin internet');
    const payload = { ...data, action };
    if (window.google && window.google.script && window.google.script.run) {
      return new Promise((resolve, reject) => google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[write ? 'apiPost' : 'apiGet'](payload));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(write ? API : API + '?' + new URLSearchParams(payload), {
        method: write ? 'POST' : 'GET', cache: 'no-store', redirect: 'follow', signal: controller.signal,
        ...(write ? { headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) } : {})
      });
      if (!response.ok) throw Error('HTTP ' + response.status);
      return await response.json();
    } catch (error) {
      if (navigator.onLine === false) throw error;
      // Confirmación por POST: no poner permisos duraderos ni planillas en la URL.
      if (write) {
        if (['offlinegrant', 'offlineresume', 'offlinemutate', 'crearticket'].includes(action)) return await frameTransport(payload);
        throw error;
      }
      const query = new URLSearchParams(Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : v])));
      if (query.toString().length > 6500) throw error;
      return await new Promise((resolve, reject) => {
        const callback = '__zima_offline_' + uid().replaceAll('-', '');
        const script = document.createElement('script');
        const cleanup = () => { clearTimeout(timer); delete window[callback]; script.remove(); };
        const timer = setTimeout(() => { cleanup(); reject(Error('No se pudo confirmar la conexión. Los pendientes se conservan.')); }, 10000);
        window[callback] = response => { cleanup(); resolve(response); };
        script.onerror = () => { cleanup(); reject(Error('No se pudo conectar con el servidor.')); };
        query.set('callback', callback); script.src = API + '?' + query;
        document.head.appendChild(script);
      });
    } finally { clearTimeout(timeout); }
  }
  function frameTransport(payload) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe'), form = document.createElement('form');
      const nonce = uid();
      const name = 'zimaOfflinePost_' + nonce.replaceAll('-', '');
      iframe.name = name; iframe.hidden = true; form.hidden = true;
      form.method = 'POST'; form.action = API; form.target = name;
      let replyWindow = window;
      try { if (window.top.location.origin === window.location.origin) replyWindow = window.top; } catch (_) {}
      const field = document.createElement('input'); field.type = 'hidden'; field.name = 'zimaOfflinePayload';
      field.value = JSON.stringify({ ...payload, offlineFrame: nonce, replyOrigin: replyWindow.location.origin });
      form.appendChild(field);
      const cleanup = () => { clearTimeout(timer); replyWindow.removeEventListener('message', receive); form.remove(); iframe.remove(); };
      const receive = event => {
        if (!event.data || event.data.source !== 'zima-offline-reply' || event.data.nonce !== nonce) return;
        const googleOrigin = /^https:\/\/(?:[a-z0-9-]+\.)*googleusercontent\.com$/.test(event.origin);
        if (event.source !== iframe.contentWindow && !googleOrigin) return;
        cleanup(); resolve(event.data.result);
      };
      const timer = setTimeout(() => { cleanup(); reject(Error('El servidor no confirmó el envío. Su copia local se conserva para reintentar.')); }, 20000);
      replyWindow.addEventListener('message', receive);
      document.body.append(iframe, form); form.submit();
    });
  }
  function storeSession(profile, newToken) {
    token = newToken || token;
    ['ZIMA360_SESION', 'ZIMA_SESION', 'ZIMA_SESSION', 'ZIMA_USUARIO'].forEach(name => {
      const value = JSON.stringify({ ...profile, token, sessionToken: token });
      localStorage.setItem(name, value);
      sessionStorage.setItem(name, value);
    });
    ['ZIMA_SESSION_TOKEN', 'ZIMA360_SESSION_TOKEN', 'ZIMA_TOKEN'].forEach(name => localStorage.setItem(name, token));
  }
  async function unlock(id, secretKey) {
    user = id; key = secretKey;
    const raw = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(SESSION, JSON.stringify({ user, key: b64(raw) }));
    lastState = await state();
    token = lastState.profile.token || '';
    render();
  }
  function lock() {
    sessionStorage.removeItem(SESSION);
    key = null; user = ''; token = ''; serverUntil = 0; lastState = null;
    render();
  }
  async function restore() {
    if (!supported) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION) || 'null');
      const activity = Number(localStorage.getItem('ZIMA_LAST_ACTIVITY'));
      if (!saved || !activity || Date.now() - activity >= 15 * 60000) return lock();
      const imported = await crypto.subtle.importKey('raw', bytes(saved.key), 'AES-GCM', true, ['encrypt', 'decrypt']);
      await unlock(saved.user, imported);
    } catch (_) { lock(); }
  }
  const ready = restore();
  async function login(id, password, remote) {
    await ready;
    let result;
    if (navigator.onLine !== false) {
      try { result = await remote(); } catch (error) {
        warning = 'Servidor no disponible. Se intentará el acceso local de este equipo.';
      }
      if (result && !result.ok) return result; // Nunca ignorar una denegación del servidor.
    }
    if (!supported) {
      if (result) return result;
      throw Error('El modo sin internet necesita HTTPS o localhost y un navegador actualizado.');
    }
    const account = normalize(id);
    if (user && user !== account) lock();
    if (!result) {
      const saved = await record(account);
      if (!saved) throw Error('Ingrese una vez con internet en este dispositivo para habilitar el acceso sin conexión.');
      let local;
      const secretKey = await derive(password, saved.salt);
      try { local = await decrypt(saved, secretKey); } catch (_) { throw Error('Usuario o contraseña local incorrectos.'); }
      if (Date.now() >= local.grant.expiresAt) throw Error('El acceso sin internet venció. Ingrese con internet; sus planillas pendientes se conservan.');
      localStorage.setItem('ZIMA_LAST_ACTIVITY', String(Date.now()));
      await unlock(account, secretKey);
      return { ok: true, ...local.profile, offline: true, offlineReady: true };
    }
    // Preparar una copia cifrada solamente después de una autenticación remota correcta.
    try {
      let device = localStorage.getItem('ZIMA_OFFLINE_DEVICE');
      if (!device) { device = uid(); localStorage.setItem('ZIMA_OFFLINE_DEVICE', device); }
      const grant = await transport('offlinegrant', { token: result.token, device }, true);
      if (!grant.ok) throw Error(grant.error || 'El servidor aún no habilita el modo sin internet.');
      const rows = await transport('list', { token: result.token });
      if (!rows.ok) throw Error(rows.error || 'No fue posible descargar las planillas.');
      const extraActions = ['peajes', 'tickets'];
      if (['ADMIN', 'ADMINISTRADOR'].includes(result.rol)) extraActions.push('usuarios');
      const extra = await Promise.allSettled(extraActions.map(action => transport(action, { token: result.token })));
      await navigator.locks.request('zima-data-' + account, async () => {
        const saved = await record(account);
        let previous, existingKey;
        if (saved) {
          try { existingKey = await derive(password, saved.salt); previous = await decrypt(saved, existingKey); }
          catch (_) {
            existingKey = null;
            if (user === account && key) previous = await decrypt(saved, key);
            else if (saved.pendingCount) throw Error('Hay pendientes cifrados con la contraseña anterior. Desbloquéelos con esa contraseña antes de preparar el acceso nuevo.');
          }
        }
        const salt = existingKey ? saved.salt : b64(crypto.getRandomValues(new Uint8Array(16)));
        const secretKey = existingKey || await derive(password, salt);
        const profile = { ...result }; delete profile.usuarioData;
        const local = { profile, grant, rows: rows.rows || [], queue: previous ? previous.queue : [], tickets: previous ? previous.tickets : [], cache: {}, downloadedAt: Date.now(), dailyPreparedDay: localDay() };
        if (previous && (previous.profile.rol !== profile.rol || previous.profile.peaje !== profile.peaje)) {
          local.queue.forEach(op => {
            op.status = 'blocked'; op.code = 'OFFLINE_SCOPE_CHANGED';
            op.error = 'Su rol o peaje cambió. Descargue estos pendientes y solicite revisión al administrador antes de trasladarlos.';
          });
        }
        extra.forEach((response, index) => {
          if (response.status !== 'fulfilled' || !response.value.ok) return;
          if (extraActions[index] === 'tickets') local.tickets = response.value.rows.concat(local.tickets.filter(row => row.pending));
          else local.cache[extraActions[index]] = response.value;
        });
        // Conservar las versiones locales de registros que aún tienen cambios pendientes.
        if (previous) {
          const dirty = new Set(local.queue.filter(op => op.action !== 'crearticket').map(op => op.data.id));
          local.rows = local.rows.filter(row => !dirty.has(row.id)).concat(previous.rows.filter(row => dirty.has(row.id)));
        }
        localStorage.setItem('ZIMA_LAST_ACTIVITY', String(Date.now()));
        await persist(local, salt, secretKey, account);
        await unlock(account, secretKey);
        serverUntil = Date.now() + 10 * 60000;
      });
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      warning = '';
      result.offlineReady = true;
    } catch (error) {
      warning = 'Acceso con internet correcto. Modo sin internet pendiente: ' + error.message;
      result.offlineReady = false;
      lock();
      // No sobrescribir el almacén anterior si la preparación falla.
    }
    render();
    return result;
  }
  async function authorize() {
    if (!active()) throw Error('Ingrese nuevamente para sincronizar. Los pendientes se conservan.');
    if (serverUntil > Date.now() && token) return;
    const data = await state();
    const response = await transport('offlineresume', data.grant, true);
    if (!response.ok) {
      warning = response.error || 'Ingrese de nuevo con internet.';
      await change(local => { local.grant.expiresAt = Math.min(local.grant.expiresAt, Date.now()); });
      const error = Error(warning); error.denied = true; throw error;
    }
    token = response.token;
    serverUntil = Date.now() + 10 * 60000;
    storeSession(response, token);
  }
  const version = row => row ? String(new Date(row.updatedAt || row.createdAt).getTime()) : '';
  function mergedRows(local, incoming) {
    const dirty = new Set(local.queue.filter(op => op.action !== 'crearticket').map(op => op.data.id));
    return incoming.filter(row => !dirty.has(row.id)).concat(local.rows.filter(row => dirty.has(row.id)));
  }
  async function refreshDaily() {
    await ready;
    if (!supported || !active() || navigator.onLine === false) return;
    const account = user;
    try {
      await navigator.locks.request('zima-daily-' + account, async () => {
        if (!active() || user !== account || navigator.onLine === false) return;
        const before = await state();
        const day = localDay();
        if (before.dailyPreparedDay === day) return;
        await authorize();
        const [rows, profile] = await Promise.all([
          transport('list', { token }), transport('perfil', { token })
        ]);
        if (!rows.ok || !profile.ok) throw Error(rows.error || profile.error || 'No fue posible actualizar la copia local.');
        const actions = ['peajes', 'tickets'];
        if (['ADMIN', 'ADMINISTRADOR'].includes(profile.rol)) actions.push('usuarios');
        const extra = await Promise.allSettled(actions.map(action => transport(action, { token })));
        if (!active() || user !== account) return;
        const grant = await transport('offlinegrant', { token, device: before.grant.device }, true);
        if (!grant.ok) throw Error(grant.error || 'No fue posible renovar el acceso sin internet.');
        await change(local => {
          if (profile.rol !== local.profile.rol || profile.peaje !== local.profile.peaje) {
            local.queue.forEach(op => {
              op.status = 'blocked'; op.code = 'OFFLINE_SCOPE_CHANGED';
              op.error = 'Su rol o peaje cambió. Descargue estos pendientes y solicite revisión al administrador.';
            });
          }
          local.rows = mergedRows(local, rows.rows || []);
          local.profile = { ...local.profile, ...profile, token };
          local.grant = grant;
          extra.forEach((response, i) => {
            if (response.status !== 'fulfilled' || !response.value.ok) return;
            if (actions[i] === 'tickets') local.tickets = response.value.rows.concat(local.tickets.filter(row => row.pending));
            else local.cache[actions[i]] = response.value;
          });
          local.downloadedAt = Date.now(); local.dailyPreparedDay = day;
        });
        warning = ''; render();
      });
    } catch (error) {
      if (active() && user === account) {
        warning = 'No se pudo actualizar la copia local. Se conserva la anterior. ' + error.message;
        render();
      }
    }
  }
  async function backgroundCycle() {
    await sync();
    await refreshDaily();
  }
  function localRead(local, action, params) {
    if (action === 'list') return { ok: true, offline: true, rows: local.rows.filter(row =>
      (!params.estado || row.estado === params.estado) && (!params.fecha || String(row.fecha).slice(0, 10) === params.fecha) &&
      (!params.q || JSON.stringify(row).toLowerCase().includes(String(params.q).toLowerCase()))) };
    if (action === 'get') {
      const row = local.rows.find(row => String(row.id) === String(params.id));
      return row ? { ok: true, row, offline: true } : { ok: false, error: 'Esta planilla no está descargada en este equipo.' };
    }
    if (action === 'perfil' || action === 'sesion') return { ...local.profile, ok: true, offline: true };
    if (action === 'peajes') return local.cache.peajes || { ok: true, peajes: [...new Set([local.profile.peaje, ...local.rows.map(row => row.peaje)].filter(Boolean))], offline: true };
    if (action === 'tickets') return { ok: true, rows: local.tickets, admin: ['ADMIN', 'ADMINISTRADOR'].includes(local.profile.rol), offline: true };
    if (local.cache[action]) return { ...local.cache[action], offline: true };
    throw Error('Esta consulta requiere internet o una descarga previa en este dispositivo.');
  }
  async function enqueue(action, params) {
    return change(local => {
      if (Date.now() >= local.grant.expiresAt) throw Error('Valide su cuenta con internet antes de guardar nuevos cambios.');
      let operationId = uid();
      let data = { ...params };
      const autoCode = action === 'save' && !String(data.codigo || '').trim();
      ['token', 'sessionToken', 'sesion', 'usuario', 'rol'].forEach(k => delete data[k]);
      if (action === 'crearticket') {
        if (!data.requestId) data.requestId = uid();
        const id = 'ZT-LOCAL-' + data.requestId;
        const row = { ...data, id, usuario: local.profile.usuario, nombre: local.profile.nombre, peaje: local.profile.peaje, estado: 'ABIERTO', fecha: new Date().toISOString(), pending: true };
        if (!local.queue.some(op => op.action === action && op.data.requestId === data.requestId)) {
          local.queue.push({ operationId, action, data, status: 'pending', createdAt: Date.now() });
          local.tickets.unshift(row);
        }
        return { ok: true, pending: true, id, correoEnviado: false, mensaje: 'Ticket guardado en este equipo; el aviso se enviará al sincronizar.' };
      }
      if (!['ADMIN', 'ADMINISTRADOR', 'PEAJE'].includes(local.profile.rol)) throw Error('Su rol no permite modificar planillas.');
      if (action === 'save') data.id = 'OFF-' + operationId;
      const current = local.rows.find(row => row.id === data.id);
      if (action !== 'save' && !current) throw Error('Descargue esta planilla antes de editarla sin internet.');
      const global = ['ADMIN', 'ADMINISTRADOR', 'INTERVENTORIA'].includes(local.profile.rol) || ['TODOS', 'ADMINISTRACION CENTRAL', 'ADMINISTRACIÓN CENTRAL'].includes(local.profile.peaje);
      if (!global) data.peaje = current ? current.peaje : local.profile.peaje;
      if (action !== 'delete') {
        if (!data.peaje || !data.fecha || !(Number(data.total) > 0)) throw Error('Complete Peaje, Fecha y Total entregado.');
        const duplicate = local.rows.find(row => row.id !== data.id && data.codigo && String(row.codigo).trim().toUpperCase() === String(data.codigo).trim().toUpperCase());
        if (duplicate) return { ok: false, code: 'CODIGO_DUPLICADO', existingId: duplicate.id, error: 'Ya existe una planilla con ese código en este equipo.' };
      }
      const prior = local.queue.filter(op => op.action !== 'crearticket' && op.data.id === data.id).at(-1);
      const now = new Date().toISOString();
      const row = action === 'delete' ? { ...current, estado: 'ANULADA', updatedAt: now, pending: true }
        : { ...current, ...data, codigo: data.codigo || (current && current.codigo) || 'LOCAL-' + operationId.slice(0, 8).toUpperCase(),
            estado: data.estado || 'APROBADO', tula: Number(data.total), billetes: 0, createdAt: current ? current.createdAt : now, updatedAt: now, usuario: local.profile.usuario, pending: true };
      data = { ...row }; delete data.pending;
      // Un conflicto de código puede corregirse editando la misma planilla local.
      if (prior && prior.status === 'blocked' && prior.code === 'CODIGO_DUPLICADO') {
        const previousId = prior.operationId;
        prior.operationId = operationId;
        prior.data = data; prior.status = 'pending'; prior.error = ''; delete prior.code;
        local.queue.forEach(op => { if (op.dependsOn === previousId) op.dependsOn = operationId; });
      } else {
        local.queue.push({ operationId, action, data, autoCode, baseVersion: prior ? '' : version(current), dependsOn: prior ? prior.operationId : '', status: 'pending', createdAt: Date.now() });
      }
      local.rows = local.rows.filter(item => item.id !== row.id).concat(row);
      return { ok: true, row, pending: true, local: true, operationId };
    });
  }
  async function sync() {
    await ready;
    if (!supported || !active() || navigator.onLine === false || syncing) return;
    syncing = true; render();
    try {
      await navigator.locks.request('zima-sync-' + user, async () => {
        let local = await state();
        if (!local.queue.some(op => op.status === 'pending' && !op.dependsOn)) return;
        await authorize();
        let sessionRetried = false;
        while (active() && navigator.onLine !== false) {
          local = await state();
          const op = local.queue.find(op => op.status === 'pending' && !op.dependsOn);
          if (!op) break;
          const response = await transport(op.action === 'crearticket' ? op.action : 'offlinemutate',
            op.action === 'crearticket' ? { ...op.data, token } : { operation: JSON.stringify({ operationId: op.operationId, action: op.action, data: op.data, baseVersion: op.baseVersion, autoCode: op.autoCode === true }), token }, true);
          if (!active()) break;
          if (!response.ok && (response.code === 'OFFLINE_AUTH_REQUIRED' || /sesión|sesi[oó]n|contraseña|inactivo/i.test(response.error || ''))) {
            serverUntil = 0;
            if (!sessionRetried && /sesi[oó]n/i.test(response.error || '')) {
              sessionRetried = true; await authorize(); continue;
            }
            warning = response.error; break;
          }
          await change(latest => {
            const pending = latest.queue.find(item => item.operationId === op.operationId);
            if (!pending) return;
            if (!response.ok) {
              pending.status = 'blocked'; pending.error = response.error || 'El servidor rechazó el cambio.';
              pending.code = response.code || ''; pending.remote = response.current || null;
              return;
            }
            latest.queue = latest.queue.filter(item => item.operationId !== op.operationId);
        if (op.action === 'crearticket') {
              latest.tickets = latest.tickets.map(row => row.id === 'ZT-LOCAL-' + op.data.requestId ? { ...row, id: response.id, pending: false } : row);
            } else {
              latest.queue.forEach(item => {
                if (item.dependsOn === op.operationId) {
                  item.dependsOn = ''; item.baseVersion = version(response.row);
                  if (op.autoCode && item.data.codigo === op.data.codigo) item.data.codigo = response.row.codigo;
                }
              });
              if (op.autoCode) {
                latest.queue.forEach(item => { if (item.data.id === op.data.id && item.data.codigo === op.data.codigo) item.data.codigo = response.row.codigo; });
                latest.rows.forEach(row => { if (row.id === op.data.id && row.codigo === op.data.codigo) row.codigo = response.row.codigo; });
              }
              if (!latest.queue.some(item => item.data.id === op.data.id)) {
                latest.rows = latest.rows.filter(row => row.id !== op.data.id).concat(response.row);
              }
            }
          });
          warning = '';
        }
      });
    } catch (error) { warning = error.message; }
    finally { syncing = false; if (key) lastState = await state().catch(() => lastState); render(); }
  }
  async function request(action, params, write, fallback) {
    await ready;
    if (!supported || !key) {
      if (navigator.onLine === false) throw Error('Ingrese con una cuenta preparada para trabajar sin internet en este equipo.');
      return fallback();
    }
    if (!active()) throw Error('Su sesión venció. Ingrese de nuevo; los cambios pendientes se conservan.');
    if (write && ['save', 'create', 'update', 'delete', 'crearticket'].includes(action)) {
      const result = await enqueue(action === 'create' ? 'save' : action, params);
      if (result.ok && navigator.onLine !== false) {
        await sync();
        const local = await state();
        const pending = local.queue.find(op => op.operationId === result.operationId);
        if (pending && pending.status === 'blocked') result.syncError = pending.error + ' Abra «Pendientes» para revisar el envío; su copia local sigue guardada.';
        if (result.row && !local.queue.some(op => op.data.id === result.row.id)) {
          result.row = local.rows.find(row => row.id === result.row.id) || result.row;
          result.pending = false; result.local = false;
        }
      }
      render(); return result;
    }
    if (write && navigator.onLine === false) throw Error('Los cambios de usuarios, perfil, contraseñas y seguimiento de tickets requieren internet.');
    if (navigator.onLine !== false) {
      try {
        await authorize();
        let response = await transport(action, { ...params, token, sessionToken: token, sesion: token }, write);
        if (!response.ok && /sesi[oó]n/i.test(response.error || '')) {
          serverUntil = 0; await authorize();
          response = await transport(action, { ...params, token, sessionToken: token, sesion: token }, write);
        }
        if (!response.ok) return response;
        warning = '';
        if (!write) {
          await change(local => {
            if (action === 'list' && !params.q && !params.estado && !params.fecha) local.rows = mergedRows(local, response.rows || []);
            else if (action === 'get' && response.row && !local.queue.some(op => op.data.id === response.row.id)) local.rows = local.rows.filter(row => row.id !== response.row.id).concat(response.row);
            else if (action === 'tickets') local.tickets = (response.rows || []).concat(local.tickets.filter(row => row.pending));
            else if (action === 'perfil' || action === 'sesion') local.profile = { ...local.profile, ...response, token };
            else local.cache[action] = response;
          });
          // Mostrar también los cambios locales todavía no confirmados.
          if (['list', 'get', 'tickets'].includes(action)) return localRead(await state(), action, params);
        }
        return response;
      } catch (error) {
        if (write || error.denied) throw error;
        warning = 'Sin conexión con el servidor. Mostrando la copia de este equipo.';
      }
    }
    const local = await state();
    if (Date.now() >= local.grant.expiresAt) throw Error('Valide su cuenta con internet para seguir consultando datos locales.');
    lastState = local; render();
    return localRead(local, action, params);
  }
  function render() {
    if (!document.body) return;
    let box = document.getElementById('zimaOfflineStatus');
    if (!box) {
      box = document.createElement('div'); box.id = 'zimaOfflineStatus';
      box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9500;max-width:min(440px,calc(100vw - 24px));padding:10px 14px;border:1px solid #bed1dc;border-radius:12px;background:#fff;color:#143b48;box-shadow:0 4px 20px #001b3022;font:12px/1.5 Segoe UI,Arial,sans-serif';
      document.body.appendChild(box);
      const style = document.createElement('style'); style.textContent = '@media print{#zimaOfflineStatus,.zima-offline-dialog{display:none!important}}'; document.head.appendChild(style);
    }
    box.replaceChildren();
    const pending = lastState ? lastState.queue.length : 0;
    const blocked = lastState ? lastState.queue.filter(op => op.status === 'blocked').length : 0;
    const label = document.createElement('span');
    label.textContent = warning || (syncing ? 'Sincronizando…' : navigator.onLine === false ? 'Sin internet · trabajando en este equipo' : key ? (shellReady ? 'Conexión disponible · copia local preparada' : 'Datos preparados · descargando pantallas para uso sin internet…') : 'Ingrese con internet para preparar este equipo');
    if (!warning && !syncing && key && shellReady && navigator.onLine !== false && pending === 0) label.textContent += ' · 0 pendientes';
    box.appendChild(label);
    if (pending) {
      const button = document.createElement('button'); button.type = 'button';
      button.style.cssText = 'margin-left:10px;padding:5px 8px;border:1px solid #8faeba;border-radius:6px;background:#f2f7f9;color:#143b48;cursor:pointer';
      button.textContent = pending + ' pendientes' + (blocked ? ' · ' + blocked + ' por revisar' : '');
      button.onclick = showPending; box.appendChild(button);
    }
    // Con internet todo funciona en segundo plano. Mostrar solo pérdidas de red,
    // pendientes reales o problemas que necesiten atención.
    box.hidden = navigator.onLine !== false && pending === 0 && !warning;
  }
  async function showPending() {
    const local = await state();
    const dialog = document.createElement('dialog'); dialog.className = 'zima-offline-dialog';
    dialog.style.cssText = 'max-width:660px;width:calc(100% - 40px);max-height:80vh;overflow:auto;border:1px solid #bed1dc;border-radius:16px;padding:24px;font:14px/1.5 Segoe UI,Arial,sans-serif;color:#143b48';
    const title = document.createElement('h2'); title.textContent = 'Cambios guardados en este equipo'; dialog.appendChild(title);
    const help = document.createElement('p'); help.textContent = 'Se enviarán al recuperar internet y validar su cuenta. Los cambios en conflicto se conservan hasta que los revise.'; dialog.appendChild(help);
    for (const op of local.queue) {
      const item = document.createElement('div'); item.style.cssText = 'padding:12px 0;border-top:1px solid #ddd';
      const text = document.createElement('p'); text.textContent = (op.data.codigo || op.data.titulo || op.data.id) + ' · ' + op.action + ' · ' + (op.error || (op.dependsOn ? 'Esperando un cambio anterior' : 'Pendiente de envío')); item.appendChild(text);
      if (op.action !== 'crearticket') {
        const link = document.createElement('a'); link.href = 'planilla.html?id=' + encodeURIComponent(op.data.id); link.textContent = 'Abrir mi copia'; item.appendChild(link);
      }
      if (op.status === 'blocked' && !op.remote && !['CODIGO_DUPLICADO', 'OFFLINE_SCOPE_CHANGED'].includes(op.code)) {
        const retry = document.createElement('button'); retry.textContent = 'Reintentar este envío';
        retry.onclick = async () => {
          await change(latest => { const found = latest.queue.find(item => item.operationId === op.operationId); if (found) { found.status = 'pending'; found.error = ''; } });
          dialog.close(); dialog.remove(); await sync();
        }; item.appendChild(retry);
      }
      if (op.remote && op.status === 'blocked') {
        const pre = document.createElement('pre'); pre.style.cssText = 'white-space:pre-wrap;max-height:180px;overflow:auto'; pre.textContent = 'Versión del servidor:\n' + JSON.stringify(op.remote, null, 2); item.appendChild(pre);
        const apply = document.createElement('button'); apply.textContent = 'Enviar mi versión sobre esta versión del servidor';
        apply.onclick = async () => {
          if (!window.confirm('Se intentará aplicar su versión local. Si el servidor cambió otra vez, se solicitará una nueva revisión.')) return;
          await change(latest => {
            const found = latest.queue.find(item => item.operationId === op.operationId);
            if (found) {
              const previousId = found.operationId;
              found.operationId = uid();
              if (found.action === 'save') found.action = 'update';
              found.baseVersion = version(op.remote); found.status = 'pending'; found.error = '';
              latest.queue.forEach(item => { if (item.dependsOn === previousId) item.dependsOn = found.operationId; });
            }
          });
          dialog.close(); dialog.remove(); await sync();
        }; item.appendChild(apply);
      }
      dialog.appendChild(item);
    }
    const download = document.createElement('button'); download.textContent = 'Descargar copia de mis pendientes';
    download.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ usuario: local.profile.usuario, fecha: new Date().toISOString(), pendientes: local.queue }, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'ZIMA-pendientes-' + user + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }; dialog.appendChild(download);
    const retry = document.createElement('button'); retry.textContent = 'Sincronizar ahora'; retry.onclick = async () => { dialog.close(); dialog.remove(); await sync(); }; dialog.appendChild(retry);
    const close = document.createElement('button'); close.textContent = 'Cerrar'; close.onclick = () => { dialog.close(); dialog.remove(); }; dialog.appendChild(close);
    dialog.addEventListener('close', () => dialog.remove()); document.body.appendChild(dialog); dialog.showModal();
  }
  window.ZimaOffline = { login, request, sync, lock, ready, status: () => ({ supported, unlocked: !!key, prepared: !!key && shellReady, warning, pending: lastState ? lastState.queue.length : 0, dailyPreparedDay: lastState ? lastState.dailyPreparedDay : '', downloadedAt: lastState ? lastState.downloadedAt : 0 }) };
  window.addEventListener('online', () => { warning = ''; render(); backgroundCycle(); });
  window.addEventListener('focus', backgroundCycle);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') backgroundCycle(); });
  window.addEventListener('offline', render);
  window.addEventListener('storage', async event => {
    if (event.key === 'ZIMA_LAST_ACTIVITY' && !event.newValue) lock();
    if (event.key === 'ZIMA360_SESION' && key) {
      try { if (normalize(JSON.parse(event.newValue || 'null')?.usuario) !== user) lock(); } catch (_) { lock(); }
    }
    if (event.key === 'ZIMA_OFFLINE_CHANGED' && key) {
      try {
        const change = JSON.parse(event.newValue || 'null');
        if (change && change.user === user) { lastState = await state(); render(); }
      } catch (_) { lock(); }
    }
  });
  document.addEventListener('DOMContentLoaded', async () => {
    render(); await ready;
    if (!document.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = 'manifest.json'; document.head.appendChild(manifest);
    }
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('service-worker.js').then(registration => new Promise((resolve, reject) => {
        const worker = registration.installing || registration.waiting || registration.active;
        if (!worker) return reject(Error('No se pudo instalar la copia de las pantallas.'));
        const check = () => {
          if (worker.state === 'activated') resolve();
          else if (worker.state === 'redundant') reject(Error('La descarga no se completó. Recargue con internet.'));
        };
        worker.addEventListener('statechange', check); check();
      })).then(() => { shellReady = true; render(); }).catch(error => { warning = 'No se pudo preparar la apertura sin internet: ' + error.message; render(); });
    }
    if (key) backgroundCycle();
  });
  setInterval(() => { if (key) backgroundCycle(); }, 30000);
})();
