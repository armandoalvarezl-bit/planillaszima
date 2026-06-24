const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyvwd182AyNTAfrViy88ZV5DS_wnHl1HYaPR2kM3DsE0posqX0v3eckW3-zDQg1V2h_sA/exec';
const SESSION_KEY = 'transbankSession';

const loginForm = document.querySelector('#loginForm');
const loginStatus = document.querySelector('#loginStatus');

function getScriptUrl() {
  return DEFAULT_SCRIPT_URL;
}

function saveSession(user, password) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    peaje: user.peaje,
    nombre: user.nombre || user.peaje,
    password
  }));
}

async function login(event) {
  event.preventDefault();
  const peaje = loginForm.elements.peaje.value;
  const password = loginForm.elements.password.value;

  loginStatus.textContent = 'Validando ingreso...';

  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'login',
      peaje,
      password
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : 'No se pudo iniciar sesion');
    }

    saveSession(payload.user, password);
    window.location.href = 'index.html';
  } catch (error) {
    loginStatus.textContent = error.message;
  }
}

function requestJsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `onlinePlanillas_${Date.now()}`;
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    const query = new URLSearchParams({ ...params, callback: callbackName });

    window[callbackName] = (payload) => {
      delete window[callbackName];
      script.remove();
      resolve(payload);
    };

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error('No se pudo cargar Apps Script'));
    };

    script.src = `${url}${separator}${query.toString()}`;
    document.body.append(script);
  });
}

if (sessionStorage.getItem(SESSION_KEY)) {
  window.location.href = 'index.html';
}

loginForm.addEventListener('submit', login);
