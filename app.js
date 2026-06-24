const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyvwd182AyNTAfrViy88ZV5DS_wnHl1HYaPR2kM3DsE0posqX0v3eckW3-zDQg1V2h_sA/exec';
const SESSION_KEY = 'transbankSession';

const form = document.querySelector('#moneyForm');
const totalEntregado = document.querySelector('#totalEntregado');
const valorLetras = document.querySelector('#valorLetras');
const currentStatus = document.querySelector('#currentStatus');
const recordCount = document.querySelector('#recordCount');
const recordsList = document.querySelector('#recordsList');
const recordTemplate = document.querySelector('#recordTemplate');
const onlineStatus = document.querySelector('#onlineStatus');
const appShell = document.querySelector('.app-shell');
const sessionPeaje = document.querySelector('#sessionPeaje');
const logoutButton = document.querySelector('#logoutButton');

let activeRecordId = null;
let recordsCache = [];
let configuredScriptUrl = DEFAULT_SCRIPT_URL;
let currentUser = null;

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function onlyDigits(value) {
  return Number(String(value || '').replace(/[^\d]/g, '')) || 0;
}

function formatMoney(value) {
  return currency.format(onlyDigits(value));
}

function normalizeMoneyInput(input) {
  const value = onlyDigits(input.value);
  input.value = value ? formatMoney(value) : '';
}

function getRecords() {
  return recordsCache;
}

function setRecords(records) {
  recordsCache = Array.isArray(records) ? records : [];
  renderRecords();
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.efectivo = onlyDigits(data.efectivo);
  data.valorTula = onlyDigits(data.valorTula);
  data.valorBilletes = onlyDigits(data.valorBilletes);
  data.total = data.efectivo;
  data.valorLetras = valorLetras.value;
  if (currentUser) data.peaje = currentUser.peaje;
  return data;
}

function fillForm(record) {
  Object.entries(record).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;
    if (field.classList.contains('money-input')) {
      field.value = value ? formatMoney(value) : '';
    } else {
      field.value = value ?? '';
    }
  });
  activeRecordId = record.id || null;
  recalculate();
  currentStatus.textContent = activeRecordId ? 'Abierto' : 'Sin guardar';
}

function clearForm() {
  form.reset();
  form.elements.fecha.value = today();
  form.elements.peaje.value = currentUser?.peaje || 'PEAJE ZARAGOZA';
  activeRecordId = null;
  recalculate();
  currentStatus.textContent = 'Sin guardar';
}

function recalculate() {
  const data = formData();
  totalEntregado.value = formatMoney(data.total);
  valorLetras.value = data.total ? `${numeroALetras(data.total)} PESOS M/CTE` : '';
}

async function saveRecord() {
  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesion.');
    return;
  }

  if (!form.reportValidity()) return;
  const data = formData();
  const now = new Date().toISOString();
  const existing = activeRecordId ? getRecords().find((item) => item.id === activeRecordId) : null;
  const record = {
    ...data,
    id: activeRecordId || crypto.randomUUID(),
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };

  currentStatus.textContent = 'Guardando...';

  try {
    const saved = await saveRecordOnline(record);
    const records = getRecords();
    const index = records.findIndex((item) => item.id === saved.id);

    if (index >= 0) records[index] = saved;
    else records.unshift(saved);

    activeRecordId = saved.id;
    setRecords(records);
    currentStatus.textContent = 'Guardado';
  } catch (error) {
    currentStatus.textContent = 'No guardado';
    setOnlineStatus(`No se pudo guardar en Excel: ${error.message}`);
  }
}

async function deleteRecord(id) {
  try {
    await deleteRecordOnline(id);
    const records = getRecords().filter((item) => item.id !== id);
    if (activeRecordId === id) clearForm();
    setRecords(records);
    setOnlineStatus('Registro eliminado del Excel.');
  } catch (error) {
    setOnlineStatus(`No se pudo eliminar en Excel: ${error.message}`);
  }
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${viewName}View`));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
}

function getStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (error) {
    return null;
  }
}

function startSession(user) {
  currentUser = user;
  appShell.classList.remove('is-hidden');
  sessionPeaje.textContent = currentUser.nombre;
  form.elements.peaje.disabled = true;
  clearForm();
  loadOnlineRecords();
}

function clearSession() {
  currentUser = null;
  recordsCache = [];
  activeRecordId = null;
  form.elements.peaje.disabled = false;
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
}

function renderRecords() {
  const records = getRecords();
  recordCount.textContent = records.length;
  recordsList.replaceChildren();

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay registros guardados todavía.';
    recordsList.append(empty);
    return;
  }

  records.forEach((record) => {
    const node = recordTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.record-title').textContent = `${record.peaje || 'Peaje'} - ${record.codigoSello || 'Sin código'}`;
    node.querySelector('.record-meta').textContent = `${record.fecha || 'Sin fecha'} · ${record.centro || 'Sin centro'} · ${record.responsableRecibe || 'Sin responsable'}`;
    node.querySelector('.record-total').textContent = formatMoney(record.total);
    node.querySelector('.load-record').addEventListener('click', () => {
      fillForm(record);
      switchView('form');
    });
    node.querySelector('.delete-record').addEventListener('click', () => deleteRecord(record.id));
    recordsList.append(node);
  });
}

function getScriptUrl() {
  return configuredScriptUrl;
}

function setOnlineStatus(message) {
  if (onlineStatus) onlineStatus.textContent = message;
}

async function saveRecordOnline(record) {
  const url = getScriptUrl();
  if (!url) {
    throw new Error('Falta URL online');
  }
  if (!currentUser) throw new Error('Debe iniciar sesion');

  setOnlineStatus('Enviando a Excel online...');

  try {
    const payload = await requestJsonp(url, {
      action: 'save',
      peaje: currentUser.peaje,
      password: currentUser.password,
      record: JSON.stringify(record)
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : 'Respuesta online invalida');
    }

    setOnlineStatus('Guardado en BASE DE DATOS PLANILLAS');
    return payload.record;
  } catch (error) {
    throw error;
  }
}

async function deleteRecordOnline(id) {
  const url = getScriptUrl();
  if (!url) throw new Error('Falta URL online');
  if (!currentUser) throw new Error('Debe iniciar sesion');

  setOnlineStatus('Eliminando en Excel online...');

  const payload = await requestJsonp(url, {
    action: 'delete',
    peaje: currentUser.peaje,
    password: currentUser.password,
    id
  });

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Respuesta online invalida');
  }
}

function loadOnlineRecords() {
  if (!currentUser) return;

  const url = getScriptUrl();
  if (!url) {
    setOnlineStatus('Primero pega la URL del Apps Script.');
    return;
  }

  setOnlineStatus('Consultando Excel online...');

  requestJsonp(url, {
    action: 'list',
    peaje: currentUser.peaje,
    password: currentUser.password
  })
    .then((payload) => {
      if (!payload || !payload.ok) {
        setOnlineStatus(payload && payload.error ? payload.error : 'No se pudo consultar online.');
        return;
      }

      const onlineRecords = Array.isArray(payload.records) ? payload.records : [];
      setRecords(onlineRecords);
      setOnlineStatus(`Consulta lista: ${onlineRecords.length} registros online.`);
    })
    .catch((error) => {
      setOnlineStatus(`No se pudo conectar: ${error.message}`);
    });
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

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  downloadFile('registros-transbank.json', JSON.stringify(getRecords(), null, 2), 'application/json');
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  const headers = ['fecha', 'peaje', 'centro', 'codigoSello', 'responsableRecibe', 'ciudad', 'efectivo', 'valorTula', 'valorBilletes', 'total', 'valorLetras'];
  const rows = getRecords().map((record) => headers.map((header) => csvCell(record[header])).join(','));
  downloadFile('registros-transbank.csv', [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
}

function numeroALetras(numero) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function menoresMil(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    if (n < 10) return unidades[n];
    if (n < 20) return especiales[n - 10];
    if (n < 30) return n === 20 ? 'VEINTE' : `VEINTI${unidades[n - 20].toLowerCase()}`.toUpperCase();
    if (n < 100) {
      const unidad = n % 10;
      return unidad ? `${decenas[Math.floor(n / 10)]} Y ${unidades[unidad]}` : decenas[Math.floor(n / 10)];
    }
    const resto = n % 100;
    return `${centenas[Math.floor(n / 100)]}${resto ? ` ${menoresMil(resto)}` : ''}`;
  }

  function tramo(n, singular, plural) {
    if (n === 0) return '';
    if (n === 1) return singular;
    return `${numeroALetras(n)} ${plural}`;
  }

  numero = Math.floor(Number(numero) || 0);
  if (numero === 0) return 'CERO';
  if (numero < 1000) return menoresMil(numero);
  if (numero < 1000000) {
    const miles = Math.floor(numero / 1000);
    const resto = numero % 1000;
    const textoMiles = miles === 1 ? 'MIL' : `${menoresMil(miles)} MIL`;
    return `${textoMiles}${resto ? ` ${menoresMil(resto)}` : ''}`;
  }
  if (numero < 1000000000000) {
    const millones = Math.floor(numero / 1000000);
    const resto = numero % 1000000;
    return `${tramo(millones, 'UN MILLON', 'MILLONES')}${resto ? ` ${numeroALetras(resto)}` : ''}`;
  }
  return String(numero);
}

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

document.querySelectorAll('.money-input').forEach((input) => {
  input.addEventListener('input', recalculate);
  input.addEventListener('blur', () => {
    normalizeMoneyInput(input);
    recalculate();
  });
});

form.addEventListener('input', () => {
  if (currentStatus.textContent === 'Guardado') currentStatus.textContent = 'Con cambios';
});

document.querySelector('#newRecord').addEventListener('click', clearForm);
document.querySelector('#saveRecord').addEventListener('click', saveRecord);
document.querySelector('#printRecord').addEventListener('click', () => window.print());
document.querySelector('#exportJson').addEventListener('click', exportJson);
document.querySelector('#exportCsv').addEventListener('click', exportCsv);
document.querySelector('#syncOnline')?.addEventListener('click', loadOnlineRecords);
logoutButton.addEventListener('click', clearSession);

const storedSession = getStoredSession();

if (!storedSession || !storedSession.peaje || !storedSession.password) {
  window.location.href = 'login.html';
} else {
  startSession(storedSession);
  renderRecords();
}
