const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwIzkDqI3wQgOoYL17TG_5Zg1JE_TV4tTWw8EJ2twZJq0mp0PoFXrQHQ3qZMg3701LwDg/exec';
const SESSION_KEY = 'transbankSession';

const JSONP_TIMEOUT = 8000; // ms

// Offline helpers with Web Crypto AES-GCM encryption.
const OFFLINE_USERS_KEY = 'zima_offline_users_encrypted';
const CRYPTO_DB = 'zima_meta';
const CRYPTO_STORE = 'kv';
const CRYPTO_KEY_NAME = 'masterKey';

// Minimal IndexedDB helper for storing the raw master key
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CRYPTO_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CRYPTO_STORE)) db.createObjectStore(CRYPTO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRYPTO_STORE, 'readonly');
    const store = tx.objectStore(CRYPTO_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CRYPTO_STORE, 'readwrite');
    const store = tx.objectStore(CRYPTO_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let _masterCryptoKey = null;
async function ensureMasterKey() {
  if (_masterCryptoKey) return _masterCryptoKey;
  try {
    const existing = await idbGet(CRYPTO_KEY_NAME);
    if (existing) {
      const raw = existing; // ArrayBuffer stored
      _masterCryptoKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      return _masterCryptoKey;
    }
  } catch (e) {
    // proceed to generate
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  try { await idbSet(CRYPTO_KEY_NAME, exported); } catch (e) { /* ignore */ }
  _masterCryptoKey = key;
  return _masterCryptoKey;
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function encryptData(text) {
  const key = await ensureMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(String(text));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  // store iv + cipher
  const ivArr = new Uint8Array(iv.buffer);
  const cipherArr = new Uint8Array(cipher);
  const out = new Uint8Array(ivArr.length + cipherArr.length);
  out.set(ivArr, 0);
  out.set(cipherArr, ivArr.length);
  return bufToBase64(out.buffer);
}

async function decryptData(b64) {
  try {
    const buf = base64ToBuf(b64);
    const arr = new Uint8Array(buf);
    const iv = arr.slice(0, 12);
    const data = arr.slice(12);
    const key = await ensureMasterKey();
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch (e) {
    return null;
  }
}

async function getStoredUsers() {
  try {
    const encrypted = localStorage.getItem(OFFLINE_USERS_KEY);
    if (!encrypted) return {};
    const json = await decryptData(encrypted);
    if (json) return JSON.parse(json || '{}');
    // Fallback: maybe it's stored as plaintext JSON (older fallback). Try parse.
    try {
      return JSON.parse(encrypted);
    } catch (e) {
      return {};
    }
  } catch (error) {
    return {};
  }
}

async function saveStoredUsers(users) {
  try {
    const json = JSON.stringify(users || {});
    const encrypted = await encryptData(json);
    localStorage.setItem(OFFLINE_USERS_KEY, encrypted);
  } catch (e) {
    // fallback: store plaintext (shouldn't happen)
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(users || {}));
  }
}

async function findStoredUser(peaje, password) {
  const users = await getStoredUsers();
  const key = String(peaje || '').trim().toUpperCase();
  const stored = users[key];
  if (!stored || !stored.password) return null;
  // stored.password is still base64-encoded password string for compatibility
  const encoded = (() => {
    try { return window.btoa(unescape(encodeURIComponent(String(password || '')))); } catch (e) { return String(password || ''); }
  })();
  return stored.password === encoded ? stored : null;
}

async function cacheLoginUser(requestParams, payload) {
  if (!payload || !payload.ok || !payload.user || !requestParams.peaje || !requestParams.password) {
    return;
  }
  const users = await getStoredUsers();
  users[String(requestParams.peaje).trim().toUpperCase()] = {
    peaje: requestParams.peaje,
    nombre: payload.user.nombre || requestParams.peaje,
    rol: payload.user.rol || payload.user.role || 'PEAJE',
    password: (function (v) { try { return window.btoa(unescape(encodeURIComponent(String(v || '')))); } catch (e) { return String(v || ''); } })(requestParams.password)
  };
  await saveStoredUsers(users);
}

const loginForm = document.querySelector('#loginForm');
const loginStatus = document.querySelector('#loginStatus');
const loginLoadingOverlay = document.querySelector('#loginLoadingOverlay');
const loginSubmitButton = loginForm?.querySelector('.login-submit');

function showLoginLoading() {
  if (loginLoadingOverlay) {
    loginLoadingOverlay.classList.remove('is-hidden');
    loginLoadingOverlay.setAttribute('aria-hidden', 'false');
  }
  if (loginSubmitButton) {
    loginSubmitButton.disabled = true;
    loginSubmitButton.textContent = 'Validando...';
  }
}

function hideLoginLoading() {
  if (loginLoadingOverlay) {
    loginLoadingOverlay.classList.add('is-hidden');
    loginLoadingOverlay.setAttribute('aria-hidden', 'true');
  }
  if (loginSubmitButton) {
    loginSubmitButton.disabled = false;
    loginSubmitButton.textContent = 'Ingresar al sistema';
  }
}

function setLoginStatus(message, tone = 'info') {
  if (!loginStatus) return;
  const titles = {
    info: 'Validando acceso',
    success: 'Acceso confirmado',
    error: 'No fue posible ingresar'
  };

  loginStatus.className = `login-status status-${tone}`;
  loginStatus.replaceChildren();

  const copy = document.createElement('span');
  copy.className = 'status-copy';
  const heading = document.createElement('strong');
  heading.className = 'status-title';
  heading.textContent = titles[tone] || 'Mensaje del sistema';
  const detail = document.createElement('span');
  detail.className = 'status-message';
  detail.textContent = message;
  copy.append(heading, detail);
  loginStatus.append(copy);
}

function getScriptUrl() {
  return DEFAULT_SCRIPT_URL;
}

function saveSession(user, password) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    ...user,
    password
  }));
}

async function login(event) {
  event.preventDefault();
  const peaje = loginForm.elements.peaje.value;
  const password = loginForm.elements.password.value;

  showLoginLoading();
  setLoginStatus('Estamos verificando sus credenciales de forma segura.', 'info');

  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'login',
      peaje,
      password
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : 'No se pudo iniciar sesión');
    }

    setLoginStatus('Credenciales aceptadas. Abriendo el sistema de planillas.', 'success');
    // Cache the user locally (minimal, encoded password) so the device
    // can authenticate without internet if needed later.
    try { await cacheLoginUser({ peaje, password }, payload); } catch (e) { /* ignore */ }
    saveSession(payload.user, password);
    window.location.href = 'index.html';
  } catch (error) {
    console.debug('login error:', error);
    hideLoginLoading();
    // If the error is a network/Apps Script load failure, try local fallback
    try {
      const offlineUser = await findStoredUser(peaje, password);
      if (offlineUser) {
        setLoginStatus('Modo offline: credenciales verificadas localmente.', 'success');
        saveSession(offlineUser, password);
        // small delay so the user sees the status
        setTimeout(() => { window.location.href = 'index.html'; }, 400);
        return;
      }
    } catch (e) {
      // ignore
    }

    setLoginStatus(error.message, 'error');
  }
}

function requestJsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `onlinePlanillas_${Date.now()}`;
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    const query = new URLSearchParams({ ...params, callback: callbackName });
    let timeoutId = null;

    const src = `${url}${separator}${query.toString()}`;
    window[callbackName] = (payload) => {
      if (timeoutId) clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
      resolve(payload);
    };

    script.onerror = () => {
      if (timeoutId) clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
      const src = `${srcBase}${separator}${query.toString()}`;
      console.warn('JSONP load error for', src);
      (async () => {
        try {
          const resp = await fetch(src, { method: 'GET' });
          const text = await resp.text();
          console.warn('Fetch diagnostic response', resp.status, text.slice(0,300));

          const marker = `${callbackName}(`;
          const idx = text.indexOf(marker);
          if (idx !== -1) {
            try {
              const start = text.indexOf('(', idx);
              const end = text.lastIndexOf(')');
              const jsonText = text.substring(start + 1, end);
              const payload = JSON.parse(jsonText);
              resolve(payload);
              return;
            } catch (pex) {
              console.warn('Fallback parse failed:', pex);
            }
          }

          const box = document.querySelector('#jsErrorBox') || document.querySelector('#loginStatus');
          const msg = `No se pudo cargar Apps Script (status: ${resp.status}). URL: ${src}`;
          if (box) {
            const short = text.replace(/\s+/g, ' ').slice(0, 400);
            box.textContent = `${msg} Respuesta: ${short}`;
          }

          reject(new Error(`No se pudo cargar Apps Script (status: ${resp.status}). URL: ${src}`));
        } catch (fe) {
          reject(new Error(`No se pudo cargar Apps Script. URL: ${src}. Detalle fetch: ${fe && fe.message ? fe.message : String(fe)}`));
        }
      })();
    };

    console.debug('requestJsonp -> src', src);
    script.src = src;
    document.body.append(script);

    timeoutId = setTimeout(() => {
      // cleanup and reject so callers can fallback to offline
      try { delete window[callbackName]; } catch (e) {}
      try { script.remove(); } catch (e) {}
      reject(new Error('Timeout cargando Apps Script'));
    }, JSONP_TIMEOUT);
  });
}

if (sessionStorage.getItem(SESSION_KEY)) {
  window.location.href = 'index.html';
}

loginForm.addEventListener('submit', login);
