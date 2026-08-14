const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyOzgAT7R-qjRk_Cwmyw0Q4Gcq6_C6wFJWHnNs7OziUQljjdXgV8sWmWPYgOAnDTh5ZHg/exec';
const SESSION_KEY = 'transbankSession';

const loginForm = document.querySelector('#loginForm');
const loginStatus = document.querySelector('#loginStatus');
const loginLoadingOverlay = document.querySelector('#loginLoadingOverlay');
const loginSubmitButton = loginForm?.querySelector('.login-submit');
const loginSubmitLabel = loginSubmitButton?.querySelector('span');

function showLoginLoading() {
  if (loginLoadingOverlay) {
    loginLoadingOverlay.classList.remove('is-hidden');
    loginLoadingOverlay.setAttribute('aria-hidden', 'false');
  }
  if (loginSubmitButton) {
    loginSubmitButton.disabled = true;
    if (loginSubmitLabel) loginSubmitLabel.textContent = 'Validando...';
  }
}

function hideLoginLoading() {
  if (loginLoadingOverlay) {
    loginLoadingOverlay.classList.add('is-hidden');
    loginLoadingOverlay.setAttribute('aria-hidden', 'true');
  }
  if (loginSubmitButton) {
    loginSubmitButton.disabled = false;
    if (loginSubmitLabel) loginSubmitLabel.textContent = 'Ingresar al sistema';
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
  const peaje = loginForm.elements.peaje.value.trim();
  const password = loginForm.elements.password.value.trim();

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

function requestJsonp(url, params, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const callbackName = `onlinePlanillas_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    const query = new URLSearchParams({ ...params, callback: callbackName, _: Date.now() });
    let timeoutId;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo cargar Apps Script. Revise la conexion, la URL publicada o actualice la pagina con Ctrl + F5.'));
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Apps Script no respondio a tiempo. Revise la conexion o la URL publicada.'));
    }, timeoutMs);

    const src = `${url}${separator}${query.toString()}`;
    console.debug('requestJsonp -> src', src);
    script.async = true;
    script.src = src;
    document.body.append(script);
  });
}

if (sessionStorage.getItem(SESSION_KEY)) {
  window.location.href = 'index.html';
}

loginForm.addEventListener('submit', login);
