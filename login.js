const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmZtAdVD5E5PzkQmH8XGi0hmybCgbSGTktKUyYxocxlr8Eofm0fDYuIdIYi18PVfsZ4Q/exec';
const SESSION_KEY = 'transbankSession';

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
    saveSession(payload.user, password);
    window.location.href = 'index.html';
  } catch (error) {
    hideLoginLoading();
    setLoginStatus(error.message, 'error');
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
