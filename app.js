const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxY9EylfC-Aw0XLRQ2BYTE7IpQEbknsd0BF-cBbNmVnNBUtvZ3jDl92Gg40LW9aPY_2PQ/exec';
const SESSION_KEY = 'transbankSession';
const LOCAL_RECORDS_KEY = 'transbankLocalRecords';

// Elementos del DOM - se inicializarán en DOMContentLoaded
let form;
let totalEntregado;
let valorLetras;
let currentStatus;
let recordCount;
let recordsList;
let recordTemplate;
let onlineStatus;
let appShell;
let sessionPeaje;
let logoutButton;
let saveButton;
let printButton;
let dashboardButton;
let dashboardRefresh;
let auditViewButton;
let auditSearch;
let auditFilterPeaje;
let auditFilterDateFrom;
let auditFilterDateTo;
let auditFilterApply;
let auditFilterClear;
let auditRecordsList;
let auditTotalRecords;
let auditTotalAmount;
let auditByPeaje;
let exportCsvAudit;
let exportJsonAudit;
let loadingOverlay;

let auditFiltered = [];

let activeRecordId = null;
let recordsCache = [];
let configuredScriptUrl = DEFAULT_SCRIPT_URL;
let currentUser = null;
let shouldClearAfterPrint = false;

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return String(dateString).slice(0, 10) || '-';
  }
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('es-CO', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(dateString) || '-';
  }
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

function getLocalRecords() {
  try {
    const stored = localStorage.getItem(LOCAL_RECORDS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('No se pudieron leer los registros locales:', error);
    return [];
  }
}

function persistLocalRecords(records) {
  try {
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('No se pudieron guardar los registros locales:', error);
  }
}

function setRecords(records) {
  recordsCache = Array.isArray(records) ? records : [];
  console.log('setRecords:', recordsCache.length, 'elementos');
  try {
    renderRecords();
  } catch (e) {
    console.error('Error en renderRecords:', e);
  }
  if (isAuditUser()) {
    try {
      updateDashboard();
    } catch (e) {
      console.error('Error en updateDashboard:', e);
    }
  }
}

function isAuditUser() {
  return Boolean(
    currentUser?.isAuditoria ||
    currentUser?.peaje === 'AUDITORIA DE OPERACIONES' ||
    String(currentUser?.nombre || '').toUpperCase().includes('AUDITORIA')
  );
}

function formData() {
  const data = Object.fromEntries(new FormData(form).entries());
  data.efectivo = onlyDigits(data.efectivo);
  data.valorTula = onlyDigits(data.valorTula);
  data.valorBilletes = onlyDigits(data.valorBilletes);
  data.total = data.efectivo;
  data.valorLetras = valorLetras.value;
  if (currentUser) {
    data.peaje = isAuditUser() ? (data.peaje || currentUser.peaje) : currentUser.peaje;
  }
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
  currentStatus.textContent = activeRecordId ? 'Editando registro' : 'Sin guardar';
  updateSaveButtonLabel();
}

function updateSaveButtonLabel() {
  if (!saveButton) return;
  saveButton.textContent = activeRecordId ? 'Actualizar' : 'Guardar';
}

function showLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('is-hidden');
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('is-hidden');
  }
}

function showConfirmationDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
        <div class="confirm-icon ${danger ? 'is-danger' : ''}">${danger ? '!' : 'OK'}</div>
        <div class="confirm-copy">
          <h3 id="confirmTitle"></h3>
          <p></p>
        </div>
        <div class="confirm-actions">
          <button class="secondary-button confirm-cancel" type="button"></button>
          <button class="${danger ? 'danger-button' : 'primary-button'} confirm-accept" type="button"></button>
        </div>
      </section>
    `;

    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    overlay.querySelector('.confirm-cancel').textContent = cancelText;
    overlay.querySelector('.confirm-accept').textContent = confirmText;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.confirm-accept').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(false);
    });

    document.body.append(overlay);
    overlay.querySelector('.confirm-accept').focus();
  });
}

function clearForm() {
  form.reset();
  form.elements.fecha.value = today();
  form.elements.peaje.value = isAuditUser() ? 'PEAJE ZARAGOZA' : (currentUser?.peaje || 'PEAJE ZARAGOZA');
  activeRecordId = null;
  recalculate();
  currentStatus.textContent = 'Sin guardar';
  updateSaveButtonLabel();
}

function recalculate() {
  const data = formData();
  totalEntregado.value = formatMoney(data.total);
  valorLetras.value = data.total ? `${numeroALetras(data.total)} PESOS M/CTE` : '';
}

async function saveRecord() {
  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesión.');
    return null;
  }

  if (!form.reportValidity()) return null;
  const data = formData();
  const now = new Date().toISOString();
  const existing = activeRecordId ? getRecords().find((item) => item.id === activeRecordId) : null;
  const record = {
    ...data,
    id: activeRecordId || crypto.randomUUID(),
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };

  showLoading();
  currentStatus.textContent = activeRecordId ? 'Actualizando...' : 'Guardando...';

  try {
    const saved = await saveRecordOnline(record);
    const records = getRecords();
    const index = records.findIndex((item) => item.id === saved.id);

    if (index >= 0) records[index] = saved;
    else records.unshift(saved);

    activeRecordId = saved.id;
    setRecords(records);
    currentStatus.textContent = 'Guardado';
    updateSaveButtonLabel();
    
    // Limpiar formulario después de guardar exitosamente
    setTimeout(() => {
      hideLoading();
      clearForm();
      setOnlineStatus('Planilla guardada con éxito. El formulario quedó listo para registrar una nueva entrega.');
    }, 1000);
    
    return saved;
  } catch (error) {
    const localRecords = getLocalRecords();
    const localIndex = localRecords.findIndex((item) => item.id === record.id);
    const fallbackRecord = { ...record, updatedAt: record.updatedAt, createdAt: record.createdAt };

    if (localIndex >= 0) localRecords[localIndex] = fallbackRecord;
    else localRecords.unshift(fallbackRecord);

    persistLocalRecords(localRecords);
    activeRecordId = fallbackRecord.id;
    setRecords(localRecords);
    hideLoading();
    currentStatus.textContent = 'Guardado local';
    updateSaveButtonLabel();

    setTimeout(() => {
      clearForm();
      setOnlineStatus('La planilla se guardó localmente porque no fue posible sincronizar con la base online.');
    }, 1000);

    return fallbackRecord;
  }
}

async function printRecordSafely() {
  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesión.');
    return;
  }

  if (!form.reportValidity()) return;

  const originalText = printButton.textContent;
  printButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  printButton.textContent = 'Guardando...';
  currentStatus.textContent = 'Guardando antes de imprimir...';

  const saved = await saveRecord();

  if (!saved) {
    printButton.textContent = originalText;
    printButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
    setOnlineStatus('Impresión detenida. Primero debe guardarse correctamente el registro.');
    return;
  }

  printButton.textContent = 'Imprimiendo...';
  setOnlineStatus('Registro guardado. Preparando la ventana de impresión...');
  window.print();

  window.setTimeout(() => {
    printButton.textContent = originalText;
    printButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
  }, 500);
}

window.addEventListener('afterprint', () => {
  shouldClearAfterPrint = false;
  setOnlineStatus('Planilla impresa correctamente.');
});

function downloadRecordPdf(record) {
  const element = document.querySelector('.paper');
  if (!element) {
    setOnlineStatus('Error: No se pudo encontrar el contenido de la planilla para descargar.');
    return;
  }

  const filename = `Planilla_${record.peaje}_${record.codigoSello}_${record.fecha}.pdf`;
  const options = {
    margin: [10, 10, 10, 10],
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'letter' }
  };

  fillForm(record);
  switchView('form');

  setTimeout(() => {
    html2pdf().set(options).from(element).save();
    setOnlineStatus(`PDF descargado: ${filename}`);
  }, 300);
}

async function deleteRecord(id) {
  const confirmed = await showConfirmationDialog({
    title: 'Anular registro',
    message: 'Esta acción marcará el registro como anulado y actualizará la información en la base online.',
    confirmText: 'Anular registro',
    cancelText: 'Conservar',
    danger: true
  });
  if (!confirmed) return;

  try {
    await deleteRecordOnline(id);
    const records = getRecords().filter((item) => item.id !== id);
    if (activeRecordId === id) clearForm();
    setRecords(records);
    setOnlineStatus('Registro anulado correctamente. La lista ya fue actualizada.');
  } catch (error) {
    setOnlineStatus(`No fue posible anular el registro. Detalle: ${error.message}`);
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
  form.elements.peaje.disabled = !isAuditUser();
  
  if (isAuditUser() && auditViewButton) {
    auditViewButton.style.display = 'block';
  }
  
  if (isAuditUser() && dashboardButton) {
    dashboardButton.style.display = 'block';
  }
  
  clearForm();
  const localRecords = getLocalRecords();
  if (localRecords.length) {
    setRecords(localRecords);
  }
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
  // Si recordsList no está inicializado, intentar buscarlo ahora
  if (!recordsList) {
    recordsList = document.querySelector('#recordsList');
  }
  if (!recordTemplate) {
    recordTemplate = document.querySelector('#recordTemplate');
  }
  if (!recordCount) {
    recordCount = document.querySelector('#recordCount');
  }
  
  if (!recordsList || !recordTemplate || !recordCount) {
    console.error('Elementos del DOM no inicializados');
    return;
  }

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

  records.forEach((record, index) => {
    try {
      // Crear el card manualmente en lugar de usar el template
      const article = document.createElement('article');
      article.className = 'record-card';
      article.innerHTML = `
        <div>
          <strong class="record-title">${record.peaje || 'Peaje'} - ${record.codigoSello || 'Sin código'}</strong>
          <span class="record-meta">${formatDate(record.fecha)} · ${record.centro || 'Sin centro'} · ${record.responsableRecibe || 'Sin responsable'}</span>
        </div>
        <output class="record-total">${formatMoney(record.total)}</output>
        <div class="record-actions">
          <button class="secondary-button load-record" type="button">Editar</button>
          <button class="secondary-button download-pdf" type="button" title="Descargar como PDF">PDF</button>
          <button class="danger-button delete-record" type="button">Anular</button>
        </div>
      `;
      
      article.querySelector('.load-record').addEventListener('click', () => {
        fillForm(record);
        switchView('form');
      });
      article.querySelector('.download-pdf').addEventListener('click', () => {
        downloadRecordPdf(record);
      });
      article.querySelector('.delete-record').addEventListener('click', () => deleteRecord(record.id));
      recordsList.append(article);
    } catch (e) {
      console.error(`Error renderizando registro ${index}:`, e);
    }
  });
}

function getScriptUrl() {
  return configuredScriptUrl;
}

function setOnlineStatus(message) {
  if (!onlineStatus) return;
  const text = String(message || '');
  const normalized = text.toLowerCase();
  let tone = 'info';
  let title = 'Información del sistema';

  if (/(correctamente|guardad|lista|limpio|impresa|base de datos)/i.test(text)) {
    tone = 'success';
    title = 'Operación confirmada';
  }

  if (/(no se pudo|falta|debe iniciar|error|invalida|inválida|no se imprimio|no se imprimió)/i.test(text)) {
    tone = 'error';
    title = 'Revisión requerida';
  }

  if (/(consultando|enviando|eliminando|abriendo|primero|validando)/i.test(text) || normalized.endsWith('...')) {
    tone = 'info';
    title = 'Proceso en curso';
  }

  onlineStatus.className = `online-status status-${tone}`;
  onlineStatus.replaceChildren();

  const copy = document.createElement('span');
  copy.className = 'status-copy';
  const heading = document.createElement('strong');
  heading.className = 'status-title';
  heading.textContent = title;
  const detail = document.createElement('span');
  detail.className = 'status-message';
  detail.textContent = text;
  copy.append(heading, detail);
  onlineStatus.append(copy);
}

async function saveRecordOnline(record) {
  const url = getScriptUrl();
  if (!url) {
    throw new Error('Falta URL online');
  }
  if (!currentUser) throw new Error('Debe iniciar sesión');

  setOnlineStatus('Guardando la planilla en la base online...');

  try {
    const payload = await requestJsonp(url, {
      action: 'save',
      peaje: currentUser.peaje,
      password: currentUser.password,
      record: JSON.stringify(record)
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : 'Respuesta online inválida');
    }

    setOnlineStatus('La planilla fue registrada en la base de datos online.');
    return payload.record;
  } catch (error) {
    throw error;
  }
}

async function deleteRecordOnline(id) {
  const url = getScriptUrl();
  if (!url) throw new Error('Falta URL online');
  if (!currentUser) throw new Error('Debe iniciar sesión');

  setOnlineStatus('Anulando el registro en la base online...');

  const payload = await requestJsonp(url, {
    action: 'delete',
    peaje: currentUser.peaje,
    password: currentUser.password,
    id
  });

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Respuesta online inválida');
  }
}

function loadOnlineRecords() {
  if (!currentUser) return;

  const url = getScriptUrl();
  if (!url) {
    setOnlineStatus('Falta configurar la URL del Apps Script para conectar la base online.');
    return;
  }

  setOnlineStatus('Consultando registros en la base online...');

  requestJsonp(url, {
    action: 'list',
    peaje: currentUser.peaje,
    password: currentUser.password
  })
    .then((payload) => {
      if (!payload || !payload.ok) {
        setOnlineStatus(payload && payload.error ? payload.error : 'No fue posible consultar los registros online.');
        return;
      }

      const onlineRecords = Array.isArray(payload.records) ? payload.records : [];
      setRecords(onlineRecords);
      setOnlineStatus(`Consulta completada. Se encontraron ${onlineRecords.length} registros online.`);
      // Mostrar la vista de registros después de cargar
      switchView('records');
    })
    .catch((error) => {
      const localRecords = getLocalRecords();
      if (localRecords.length) {
        setRecords(localRecords);
        setOnlineStatus(`No fue posible conectar con la base online. Se muestran ${localRecords.length} registros guardados localmente. Detalle: ${error.message}`);
      } else {
        setOnlineStatus(`No fue posible conectar con la base online. Detalle: ${error.message}`);
      }
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
  const rows = getRecords().map((record) => headers.map((header) => {
    if (header === 'fecha') return csvCell(formatDate(record[header]));
    return csvCell(record[header]);
  }).join(','));
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

function applyAuditFilters() {
  const search = (auditSearch?.value || '').toUpperCase();
  const peaje = auditFilterPeaje?.value || '';
  const dateFrom = auditFilterDateFrom?.value || '';
  const dateTo = auditFilterDateTo?.value || '';

  auditFiltered = getRecords().filter((record) => {
    const matchSearch = !search || 
      String(record.codigoSello || '').toUpperCase().includes(search) ||
      String(record.centro || '').toUpperCase().includes(search) ||
      String(record.responsableRecibe || '').toUpperCase().includes(search);

    const matchPeaje = !peaje || String(record.peaje || '').toUpperCase() === peaje.toUpperCase();
    
    const matchDateFrom = !dateFrom || String(record.fecha || '') >= dateFrom;
    const matchDateTo = !dateTo || String(record.fecha || '') <= dateTo;

    return matchSearch && matchPeaje && matchDateFrom && matchDateTo;
  });

  renderAuditRecords();
  updateAuditSummary();
}

function updateAuditSummary() {
  const records = auditFiltered;
  const totalRecords = records.length;
  const totalAmount = records.reduce((sum, r) => sum + onlyDigits(r.total), 0);

  if (auditTotalRecords) auditTotalRecords.textContent = totalRecords;
  if (auditTotalAmount) auditTotalAmount.textContent = formatMoney(totalAmount);

  const byPeaje = {};
  records.forEach((r) => {
    const p = r.peaje || 'Sin peaje';
    byPeaje[p] = (byPeaje[p] || 0) + 1;
  });

  if (auditByPeaje) {
    auditByPeaje.textContent = Object.entries(byPeaje)
      .map(([p, count]) => `${p}: ${count}`)
      .join(' | ') || '-';
  }
}

function renderAuditRecords() {
  const records = auditFiltered;
  if (!auditRecordsList) return;

  auditRecordsList.replaceChildren();

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay registros que coincidan con los filtros.';
    auditRecordsList.append(empty);
    return;
  }

  records.forEach((record) => {
    const node = recordTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.record-title').textContent = `${record.peaje || 'Peaje'} - ${record.codigoSello || 'Sin código'} (${record.centro || 'Sin centro'})`;
    node.querySelector('.record-meta').textContent = `${formatDate(record.fecha)} · ${record.responsableRecibe || 'Sin responsable'} · Modificado: ${formatDateTime(record.updatedAt)}`;

    node.querySelector('.record-total').textContent = formatMoney(record.total);
    node.querySelector('.load-record').textContent = 'Ver';
    node.querySelector('.load-record').addEventListener('click', () => {
      fillForm(record);
      switchView('form');
    });
    node.querySelector('.delete-record').textContent = 'Anular';
    node.querySelector('.delete-record').addEventListener('click', () => deleteRecord(record.id));
    auditRecordsList.append(node);
  });
}

function exportAuditJson() {
  downloadFile('registros-auditoria.json', JSON.stringify(auditFiltered, null, 2), 'application/json');
}

function exportAuditCsv() {
  const headers = ['fecha', 'peaje', 'centro', 'codigoSello', 'responsableRecibe', 'ciudad', 'efectivo', 'valorTula', 'valorBilletes', 'total', 'valorLetras', 'Modificado'];
  const rows = auditFiltered.map((record) => {
    const rowData = headers.map((header) => {
      if (header === 'fecha') return csvCell(formatDate(record.fecha));
      if (header === 'Modificado') return csvCell(formatDateTime(record.updatedAt));
      return csvCell(record[header]);
    }).join(',');
    return rowData;
  });
  downloadFile('registros-auditoria.csv', [headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8');
}

function updateDashboard() {
  if (!document.querySelector('#dashTotalRecords')) return; // Dashboard not in DOM
  
  const records = getRecords();
  const today_ = new Date();
  const sevenDaysAgo = new Date(today_.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thisMonth = today_.toISOString().slice(0, 7);

  const totalRecords = records.length;
  const totalAmount = records.reduce((sum, r) => sum + onlyDigits(r.total), 0);
  const weekRecords = records.filter(r => (r.fecha || '') >= sevenDaysAgo).length;
  const weekAmount = records.filter(r => (r.fecha || '') >= sevenDaysAgo).reduce((sum, r) => sum + onlyDigits(r.total), 0);
  const monthRecords = records.filter(r => (r.fecha || '').startsWith(thisMonth)).length;
  const monthAmount = records.filter(r => (r.fecha || '').startsWith(thisMonth)).reduce((sum, r) => sum + onlyDigits(r.total), 0);
  const avgAmount = totalRecords > 0 ? Math.floor(totalAmount / totalRecords) : 0;

  const setText = (selector, text) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  };
  
  setText('#dashTotalRecords', totalRecords);
  setText('#dashTotalRecordsChange', `+${weekRecords} esta semana`);
  setText('#dashTotalMoney', formatMoney(totalAmount));
  setText('#dashTotalMoneyChange', `+${formatMoney(weekAmount)} esta semana`);
  setText('#dashAverageAmount', formatMoney(avgAmount));
  setText('#dashMonthRecords', monthRecords);
  setText('#dashMonthAmount', formatMoney(monthAmount));

  renderPeajeSummary(records);
  renderDailyChart(records);
  renderTopCenters(records);
}

function renderPeajeSummary(records) {
  const container = document.querySelector('#peajeSummary');
  if (!container) return;
  
  const peajeData = {};
  records.forEach(r => {
    const p = r.peaje || 'Sin peaje';
    if (!peajeData[p]) peajeData[p] = { count: 0, total: 0 };
    peajeData[p].count += 1;
    peajeData[p].total += onlyDigits(r.total);
  });

  container.innerHTML = '';

  Object.entries(peajeData).forEach(([peaje, data]) => {
    const card = document.createElement('div');
    card.className = 'peaje-card';
    card.innerHTML = `
      <strong>${peaje}</strong>
      <div>${data.count} registros</div>
      <div class="amount">${formatMoney(data.total)}</div>
    `;
    container.append(card);
  });
}

function renderDailyChart(records) {
  const dailyData = {};
  const today_ = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today_.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    dailyData[date] = 0;
  }

  records.forEach(r => {
    const fecha = r.fecha || '';
    if (dailyData.hasOwnProperty(fecha)) {
      dailyData[fecha] += onlyDigits(r.total);
    }
  });

  const container = document.querySelector('#dashDailyChart');
  if (!container) return;
  container.innerHTML = '';

  const maxAmount = Math.max(...Object.values(dailyData), 1);

  Object.entries(dailyData).forEach(([date, amount]) => {
    const percentage = (amount / maxAmount) * 100;
    const bar = document.createElement('div');
    bar.className = 'daily-bar';
    bar.innerHTML = `
      <div class="bar-chart" style="height: ${Math.max(percentage, 5)}%"></div>
      <div class="bar-label">${date.slice(5)}</div>
      <div class="bar-amount">${formatMoney(amount)}</div>
    `;
    container.append(bar);
  });
}

function renderTopCenters(records) {
  const container = document.querySelector('#topCenters');
  if (!container) return;
  
  const centerData = {};
  records.forEach(r => {
    const c = r.centro || 'Sin centro';
    if (!centerData[c]) centerData[c] = 0;
    centerData[c] += onlyDigits(r.total);
  });

  const sorted = Object.entries(centerData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  container.innerHTML = '';

  const maxAmount = Math.max(...sorted.map(([, a]) => a), 1);

  sorted.forEach(([center, amount]) => {
    const percentage = (amount / maxAmount) * 100;
    const item = document.createElement('div');
    item.className = 'top-center-item';
    item.innerHTML = `
      <div class="item-name">${center}</div>
      <div class="item-bar">
        <div class="bar-fill" style="width: ${percentage}%"></div>
      </div>
      <div class="item-amount">${formatMoney(amount)}</div>
    `;
    container.append(item);
  });
}

// Agregar event listeners cuando el DOM esté completamente listo
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar referencias a elementos del DOM
  form = document.querySelector('#moneyForm');
  totalEntregado = document.querySelector('#totalEntregado');
  valorLetras = document.querySelector('#valorLetras');
  currentStatus = document.querySelector('#currentStatus');
  recordCount = document.querySelector('#recordCount');
  recordsList = document.querySelector('#recordsList');
  recordTemplate = document.querySelector('#recordTemplate');
  onlineStatus = document.querySelector('#onlineStatus');
  appShell = document.querySelector('.app-shell');
  sessionPeaje = document.querySelector('#sessionPeaje');
  logoutButton = document.querySelector('#logoutButton');
  saveButton = document.querySelector('#saveRecord');
  printButton = document.querySelector('#printRecord');
  dashboardButton = document.querySelector('#dashboardButton');
  dashboardRefresh = document.querySelector('#dashboardRefresh');
  auditViewButton = document.querySelector('#auditViewButton');
  auditSearch = document.querySelector('#auditSearch');
  auditFilterPeaje = document.querySelector('#auditFilterPeaje');
  auditFilterDateFrom = document.querySelector('#auditFilterDateFrom');
  auditFilterDateTo = document.querySelector('#auditFilterDateTo');
  auditFilterApply = document.querySelector('#auditFilterApply');
  auditFilterClear = document.querySelector('#auditFilterClear');
  auditRecordsList = document.querySelector('#auditRecordsList');
  auditTotalRecords = document.querySelector('#auditTotalRecords');
  auditTotalAmount = document.querySelector('#auditTotalAmount');
  auditByPeaje = document.querySelector('#auditByPeaje');
  exportCsvAudit = document.querySelector('#exportCsvAudit');
  exportJsonAudit = document.querySelector('#exportJsonAudit');
  loadingOverlay = document.querySelector('#loadingOverlay');

  // Money inputs
  document.querySelectorAll('.money-input').forEach((input) => {
    input.addEventListener('input', recalculate);
    input.addEventListener('blur', () => {
      normalizeMoneyInput(input);
      recalculate();
    });
  });

  // Form
  if (form) {
    form.addEventListener('input', () => {
      if (currentStatus && currentStatus.textContent === 'Guardado') {
        currentStatus.textContent = 'Con cambios';
      }
    });
  }

  // Buttons
  const newRecordBtn = document.querySelector('#newRecord');
  if (newRecordBtn) newRecordBtn.addEventListener('click', clearForm);
  
  if (saveButton) saveButton.addEventListener('click', saveRecord);
  if (printButton) printButton.addEventListener('click', printRecordSafely);
  
  const exportJsonBtn = document.querySelector('#exportJson');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJson);
  
  const exportCsvBtn = document.querySelector('#exportCsv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);
  
  const syncOnlineBtn = document.querySelector('#syncOnline');
  if (syncOnlineBtn) syncOnlineBtn.addEventListener('click', loadOnlineRecords);
  
  if (logoutButton) logoutButton.addEventListener('click', clearSession);

  if (dashboardRefresh) {
    dashboardRefresh.addEventListener('click', updateDashboard);
  }

  if (auditFilterApply) auditFilterApply.addEventListener('click', applyAuditFilters);
  if (auditFilterClear) auditFilterClear.addEventListener('click', () => {
    if (auditSearch) auditSearch.value = '';
    if (auditFilterPeaje) auditFilterPeaje.value = '';
    if (auditFilterDateFrom) auditFilterDateFrom.value = '';
    if (auditFilterDateTo) auditFilterDateTo.value = '';
    applyAuditFilters();
  });
  if (exportJsonAudit) exportJsonAudit.addEventListener('click', exportAuditJson);
  if (exportCsvAudit) exportCsvAudit.addEventListener('click', exportAuditCsv);

  // Agregar listeners para vista y navbar
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  // Inicializar sesión
  const storedSession = getStoredSession();

  if (!storedSession || !storedSession.peaje || !storedSession.password) {
    window.location.href = 'login.html';
  } else {
    startSession(storedSession);
  }
});
