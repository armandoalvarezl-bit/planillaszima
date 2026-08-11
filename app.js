const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbxzCm3a-hwrEPAz_vYxHljDwFAftI2CI0mQa4omIK2qO5rxWYTec17zjDOG2Lxu1mB2nQ/exec';
const SESSION_KEY = 'transbankSession';
const PEAJE_DEFAULTS = {
  'PEAJE ZARAGOZA': {
    centro: 'ZIMA SEGURIDAD',
    moneda: 'COP',
    lugarEntrega: 'CENTRO EFECTIVO',
    responsableRecibe: 'TransBanck',
    ciudad: 'ZARAGOZA',
    lugarRecibo: 'PEAJE ZARAGOZA'
  },
  'PEAJE FRAGUA': {
    centro: 'ZIMA SEGURIDAD',
    moneda: 'COP',
    lugarEntrega: 'CENTRO EFECTIVO',
    responsableRecibe: 'TransBanck',
    ciudad: 'FRAGUA',
    lugarRecibo: 'PEAJE FRAGUA'
  }
};
const AUTO_FILLED_FIELDS = ['centro', 'moneda', 'lugarEntrega', 'responsableRecibe', 'ciudad', 'lugarRecibo'];

// Elementos del DOM - se inicializaran en DOMContentLoaded
let form;
let totalEntregado;
let valorLetras;
let currentStatus;
let recordCount;
let recordsList;
let recordTemplate;
let recordsSearch;
let recordsDateFrom;
let recordsDateTo;
let recordsShowAll;
let recordsClearQuery;
let recordsQueryStatus;
let onlineStatus;
let appShell;
let sessionPeaje;
let logoutButton;
let saveButton;
let printButton;
let pdfModal;
let pdfIframe;
let closePdfModal;
let clearFormButton;
let welcomeModalOverlay;
let welcomeModalCloseButton;
let dashboardButton;
let dashboardRefresh;
let auditViewButton;
let adminViewButton;
let alertsViewButton;
let auditSearch;
let auditFilterPeaje;
let auditFilterDateFrom;
let auditFilterDateTo;
let auditFilterApply;
let auditFilterClear;
let auditRecordsList;
let auditReportMonth;
let printMonthlyAudit;
let adminUsersList;
let adminUserSearch;
let adminUserName;
let adminUserDisplayName;
let adminUserPassword;
let adminUserRole;
let adminSaveUser;
let adminRefreshUsers;
let adminNotifyMissing;
let adminAlertPeaje;
let adminAlertMessage;
let adminAlertImages;
let adminSendAlert;
let adminAlertStatus;
let adminAlertsList;
let adminUserCount;
let adminQuickAction;
let adminPasswordOverlay;
let adminPasswordTitle;
let adminPasswordInput;
let changePasswordCodeGroup;
let changePasswordCodeInput;
let sendPasswordCodeButton;
let adminPasswordCancel;
let adminPasswordSave;
let adminPasswordTarget;
let auditTotalRecords;
let auditTotalAmount;
let auditByPeaje;
let exportCsvAudit;
let exportJsonAudit;
let loadingOverlay;
let homeWelcome;
let homePeaje;
let homeTotalRecords;
let homeTotalAmount;
let homeLastRecord;
let homeWeekRecords;
let homeCurrentTime;
let homeLastLogin;
let toolbarEyebrow;
let toolbarTitle;
let formToolbarActions;
let currentTimeInterval = null;

let auditFiltered = [];

let activeRecordId = null;
let recordsCache = [];
let configuredScriptUrl = API_BASE_URL;
let currentUser = null;
let shouldClearAfterPrint = false;
let autoSaveTimer = null;
let inactivityTimer = null;
let recordsShowAllMode = false;
let passwordChangeNeedsCode = false;
const AUTO_SAVE_DELAY_MS = 2000;
const RECENT_RECORD_LIMIT = 10;
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ['click', 'input', 'keydown', 'mousemove', 'mousedown', 'touchstart', 'scroll'];
const OFFLINE_RECORDS_KEY = 'zima_offline_records';

function getOfflineRecords() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_RECORDS_KEY) || '[]');
  } catch (error) {
    console.warn('No se pudo leer registros offline:', error);
    return [];
  }
}

function getOfflineRecordsForCurrentUser() {
  const offlineRecords = getOfflineRecords();
  if (!currentUser) return [];
  if (isAdminUser() || isAuditUser()) return offlineRecords;
  return offlineRecords.filter((record) => String(record.peaje || '').trim() === String(currentUser.peaje || '').trim());
}

function saveOfflineRecords(records) {
  try {
    localStorage.setItem(OFFLINE_RECORDS_KEY, JSON.stringify(Array.isArray(records) ? records : []));
  } catch (error) {
    console.warn('No se pudo guardar registros offline:', error);
  }
}

function addOrUpdateOfflineRecord(record, pendingSync = true) {
  const records = getOfflineRecords();
  const existingIndex = records.findIndex((item) => item.id === record.id);
  const copy = {
    ...record,
    pendingSync: Boolean(pendingSync),
    updatedAt: record.updatedAt || new Date().toISOString(),
    createdAt: record.createdAt || new Date().toISOString()
  };
  if (existingIndex >= 0) {
    records[existingIndex] = copy;
  } else {
    records.unshift(copy);
  }
  saveOfflineRecords(records);
  return copy;
}

function removeOfflineRecord(recordId) {
  const records = getOfflineRecords().filter((item) => item.id !== recordId);
  saveOfflineRecords(records);
}

function setOfflineRecordSynced(recordId) {
  const records = getOfflineRecords();
  const index = records.findIndex((item) => item.id === recordId);
  if (index >= 0) {
    records[index].pendingSync = false;
    saveOfflineRecords(records);
  }
}

function mergeRecords(onlineRecords, localRecords) {
  const merged = [...onlineRecords];
  const onlineIds = new Set(onlineRecords.map((record) => record.id));
  localRecords.forEach((record) => {
    if (!onlineIds.has(record.id)) {
      merged.push(record);
    }
  });
  return merged;
}

function loadLocalRecords() {
  const offlineRecords = getOfflineRecordsForCurrentUser();
  if (offlineRecords.length) {
    setRecords(offlineRecords);
    setOnlineStatus(`Se cargaron ${offlineRecords.filter((r) => r.pendingSync).length} registro(s) guardados localmente.`);
  }
}

async function syncPendingRecords() {
  if (!currentUser || !navigator.onLine) return;

  const pendingRecords = getOfflineRecordsForCurrentUser().filter((record) => record.pendingSync);
  if (!pendingRecords.length) return;

  setOnlineStatus(`Sincronizando ${pendingRecords.length} planilla(s) pendientes...`);
  for (const record of pendingRecords) {
    try {
      const recordToSend = { ...record };
      delete recordToSend.pendingSync;
      const saved = await saveRecordOnline(recordToSend, true);
      setOfflineRecordSynced(record.id);
      const current = getRecords();
      const index = current.findIndex((item) => item.id === saved.id);
      if (index >= 0) {
        current[index] = saved;
      } else {
        current.unshift(saved);
      }
      setRecords(current);
    } catch (error) {
      console.warn('No se pudo sincronizar planilla offline:', record.id, error);
    }
  }
  setOnlineStatus('Sincronización offline completada.');
}

const currency = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
});

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const normalized = normalizeDateInputValue(dateString);
  if (!normalized) return '-';

  try {
    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return normalized;
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

function formatTime(dateString) {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return String(dateString) || '-';
  }
}

function monthLabel(monthKey) {
  if (!monthKey) return '-';
  const [year, month] = String(monthKey).split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
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

function normalizeDateInputValue(value) {
  if (!value) return '';

  // Si es un Date valido
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return dateKeyFromDate(value);
  }

  const text = String(value).trim();
  
  // Formato ISO: YYYY-MM-DD...
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Formato DD/MM/YYYY (comun en America Latina)
  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  // Formato DD-MM-YYYY
  const dashMatch = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const day = dashMatch[1].padStart(2, '0');
    const month = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Intenta parsear como Date (fallback)
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) {
    return dateKeyFromDate(parsed);
  }
  
  console.warn('No se pudo normalizar fecha:', value);
  return '';
}

function recordDateKey(value) {
  if (!value) return '';
  return normalizeDateInputValue(value);
}

function dateFromKey(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKeyFromRecord(record) {
  const key = recordDateKey(record && record.fecha);
  return key ? key.slice(0, 7) : '';
}

function getLatestRecordDateKey(records) {
  return records
    .map((record) => recordDateKey(record.fecha))
    .filter(Boolean)
    .sort()
    .at(-1) || today();
}

function getLatestRecordMonthKey(records) {
  return getLatestRecordDateKey(records).slice(0, 7);
}

function syncCodigoSelloConsecutivo() {
  if (!form) return;

  const codigoSello = form.elements.codigoSello;
  const consecutivo = form.elements.consecutivo;
  if (!codigoSello || !consecutivo) return;

  const update = () => {
    consecutivo.value = codigoSello.value || '';
  };

  codigoSello.addEventListener('input', update);
  update();
}

function getRecords() {
  return recordsCache;
}

function setRecords(records) {
  recordsCache = Array.isArray(records) ? records : [];
  console.log('setRecords:', recordsCache.length, 'elementos');
  setDefaultAuditReportMonth();
  updateHome();
  try {
    renderRecords();
  } catch (e) {
    console.error('Error en renderRecords:', e);
  }
  try {
    updateDashboard();
  } catch (e) {
    console.error('Error en updateDashboard:', e);
  }
  try {
    applyAuditFilters();
  } catch (e) {
    console.error('Error en applyAuditFilters:', e);
  }
}

function getSelectedPeaje() {
  return String(form?.elements.peaje?.value || currentUser?.peaje || 'PEAJE ZARAGOZA').trim().toUpperCase();
}

function getPeajeDefaults(peaje = getSelectedPeaje()) {
  const key = String(peaje || '').trim().toUpperCase();
  return PEAJE_DEFAULTS[key] || {
    centro: 'ZIMA SEGURIDAD',
    moneda: 'COP',
    lugarEntrega: 'CENTRO EFECTIVO',
    responsableRecibe: 'TransBanck',
    ciudad: key.replace(/^PEAJE\s+/, '') || '',
    lugarRecibo: key || ''
  };
}

function setAutoFilledFieldsLocked(locked = true) {
  if (!form) return;

  AUTO_FILLED_FIELDS.forEach((name) => {
    const field = form.elements[name];
    if (!field) return;

    if (field.tagName === 'SELECT') {
      field.disabled = locked;
      return;
    }

    field.readOnly = locked;
    field.classList.toggle('auto-filled-field', locked);
  });
}

function applyPeajeDefaults({ onlyBlank = false } = {}) {
  if (!form) return;

  const defaults = getPeajeDefaults();
  Object.entries(defaults).forEach(([name, value]) => {
    const field = form.elements[name];
    if (!field) return;
    if (onlyBlank && String(field.value || '').trim()) return;
    field.value = value;
  });
}

function isAuditUser() {
  return Boolean(
    currentUser?.isAuditoria ||
    currentUser?.peaje === 'AUDITORIA DE OPERACIONES' ||
    String(currentUser?.nombre || '').toUpperCase().includes('AUDITORIA')
  );
}

function clearAutoSaveTimer() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

function scheduleAutoSave() {
  if (!form || !currentUser) return;
  clearAutoSaveTimer();

  autoSaveTimer = window.setTimeout(async () => {
    autoSaveTimer = null;
    if (!form.checkValidity()) return;
    if (!currentStatus || currentStatus.textContent !== 'Con cambios') return;

    setOnlineStatus('Guardando automáticamente la planilla...');
    const saved = await saveRecord({ clearAfterSave: false, promptEmail: false, isAutoSave: true });
    if (saved) {
      setOnlineStatus('Planilla guardada automáticamente.');
    }
  }, AUTO_SAVE_DELAY_MS);
}

function formData() {
  applyPeajeDefaults({ onlyBlank: true });
  const data = Object.fromEntries(new FormData(form).entries());
  data.efectivo = onlyDigits(data.efectivo);
  data.valorTula = onlyDigits(data.valorTula);
  data.valorBilletes = onlyDigits(data.valorBilletes);
  data.total = data.efectivo;
  data.valorLetras = valorLetras.value;
  if (currentUser) {
    data.peaje = isAuditUser() ? (data.peaje || currentUser.peaje) : currentUser.peaje;
  }
  Object.assign(data, getPeajeDefaults(data.peaje));
  data.consecutivo = data.codigoSello || data.consecutivo || '';
  return data;
}

function recordIdentityKey(record) {
  const dateKey = recordDateKey(record.fecha);
  const peaje = String(record.peaje || '').trim().toUpperCase();
  const codigo = String(record.codigoSello || record.consecutivo || '').trim().toUpperCase();
  
  // Debug: log para identificar duplicados
  if (record.id) {
    console.log(`recordIdentityKey: fecha=${dateKey}, peaje=${peaje}, codigo=${codigo}, id=${record.id}`);
  }
  
  return [dateKey, peaje, codigo].join('|');
}

function findExistingRecordFor(data) {
  if (!String(data.codigoSello || data.consecutivo || '').trim()) return null;

  const key = recordIdentityKey(data);
  console.log('findExistingRecordFor: buscando clave:', key);
  
  const matches = getRecords().filter((record) => {
    const recordKey = recordIdentityKey(record);
    const match = recordKey === key;
    if (match) {
      console.log('Encontrado registro existente:', record.id, recordKey);
    }
    return match;
  });
  
  if (matches.length > 1) {
    console.warn(`Multiples registros coinciden con la identidad ${key}:`, matches.map(r => r.id));
  }
  
  return matches[0] || null;
}

async function withPdfExportMode(element, task) {
  element.classList.add('pdf-export');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    return await task();
  } finally {
    element.classList.remove('pdf-export');
  }
}

function pdfOptions(filename) {
  const options = {
    margin: [8, 8, 8, 8],
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, scrollX: 0, scrollY: 0 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'letter' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  if (filename) options.filename = filename;
  return options;
}

function fillForm(record) {
  Object.entries(record).forEach(([key, value]) => {
    const field = form.elements[key];
    if (!field) return;

    if (field.classList.contains('money-input')) {
      field.value = value ? formatMoney(value) : '';
      return;
    }

    if (field.type === 'date') {
      field.value = normalizeDateInputValue(value);
      return;
    }

    field.value = value ?? '';
  });

  applyPeajeDefaults({ onlyBlank: true });

  const codigoSelloValue = record.codigoSello || '';
  const consecutivoField = form.elements.consecutivo;
  if (consecutivoField && !consecutivoField.value && codigoSelloValue) {
    consecutivoField.value = codigoSelloValue;
  }

  activeRecordId = record.id || null;
  recalculate();
  currentStatus.textContent = activeRecordId ? 'Editando registro' : 'Sin guardar';
  updateSaveButtonLabel();

  if (!String(record.responsableRecibe || '').trim()) {
    setOnlineStatus('Advertencia: esta planilla no tiene responsable de recibido. Debe completarlo antes de actualizar o imprimir.');
  }
}

function updateSaveButtonLabel() {
  if (!saveButton) return;
  saveButton.textContent = activeRecordId ? 'Actualizar' : 'Guardar';
}

function showLoading(options = {}) {
  // options: { title, message, overlayId }
  const overlay = options.overlayId ? document.querySelector(`#${options.overlayId}`) : loadingOverlay;
  if (!overlay) return;

  const titleEl = overlay.querySelector('.loading-copy strong');
  const messageEl = overlay.querySelector('.loading-copy p');
  if (options.title && titleEl) titleEl.textContent = options.title;
  if (options.message && messageEl) messageEl.textContent = options.message;

  overlay.classList.remove('is-hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function hideLoading(overlayId) {
  const overlay = overlayId ? document.querySelector(`#${overlayId}`) : loadingOverlay;
  if (!overlay) return;
  overlay.classList.add('is-hidden');
  overlay.setAttribute('aria-hidden', 'true');
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

function showReasonDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <section class="confirm-dialog reason-dialog" role="dialog" aria-modal="true" aria-labelledby="reasonTitle">
        <div class="confirm-icon is-danger">!</div>
        <div class="confirm-copy">
          <h3 id="reasonTitle"></h3>
          <p></p>
        </div>
        <label class="reason-field">
          Razon de anulacion
          <textarea rows="4" maxlength="500" placeholder="Explique brevemente por que se anula esta transaccion"></textarea>
          <small class="reason-error" aria-live="polite"></small>
        </label>
        <div class="confirm-actions">
          <button class="secondary-button confirm-cancel" type="button"></button>
          <button class="danger-button confirm-accept" type="button"></button>
        </div>
      </section>
    `;

    const textarea = overlay.querySelector('textarea');
    const error = overlay.querySelector('.reason-error');
    overlay.querySelector('h3').textContent = title;
    overlay.querySelector('p').textContent = message;
    overlay.querySelector('.confirm-cancel').textContent = cancelText;
    overlay.querySelector('.confirm-accept').textContent = confirmText;

    const close = (result) => {
      overlay.remove();
      resolve(result);
    };

    overlay.querySelector('.confirm-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('.confirm-accept').addEventListener('click', () => {
      const reason = textarea.value.trim();
      if (reason.length < 1) {
        error.textContent = 'Ingrese una razon antes de anular.';
        textarea.focus();
        return;
      }
      close(reason);
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(null);
    });

    document.body.append(overlay);
    textarea.focus();
  });
}

function closePdfPreview() {
  if (!pdfModal || !pdfIframe) return;

  if (pdfIframe.dataset.objectUrl) {
    URL.revokeObjectURL(pdfIframe.dataset.objectUrl);
    delete pdfIframe.dataset.objectUrl;
  }

  pdfIframe.removeAttribute('src');
  pdfModal.classList.add('is-hidden');
  pdfModal.setAttribute('aria-hidden', 'true');
}

async function withRenderablePaper(task) {
  const formView = document.querySelector('#formView');
  if (!formView) return task();

  const wasActive = formView.classList.contains('active');
  const previousStyle = formView.getAttribute('style');

  if (!wasActive) {
    formView.style.display = 'block';
    formView.style.position = 'fixed';
    formView.style.left = '0';
    formView.style.top = '0';
    formView.style.width = '100%';
    formView.style.zIndex = '-1';
    formView.style.pointerEvents = 'none';
  }

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return await task();
  } finally {
    if (!wasActive) {
      if (previousStyle == null) formView.removeAttribute('style');
      else formView.setAttribute('style', previousStyle);
    }
  }
}

async function showPdfPreview(record) {
  const element = document.querySelector('.paper');
  if (!element || !pdfModal || !pdfIframe) return;

  fillForm(record);

  const pdfBlob = await withRenderablePaper(() => {
    return withPdfExportMode(element, async () => {
      const worker = html2pdf().set(pdfOptions()).from(element);
      return worker.outputPdf('blob');
    });
  });
  const objectUrl = URL.createObjectURL(pdfBlob);

  if (pdfIframe.dataset.objectUrl) {
    URL.revokeObjectURL(pdfIframe.dataset.objectUrl);
  }

  pdfIframe.dataset.objectUrl = objectUrl;
  pdfIframe.src = objectUrl;
  pdfModal.classList.remove('is-hidden');
  pdfModal.setAttribute('aria-hidden', 'false');
}

function clearForm() {
  form.reset();
  form.elements.fecha.value = today();
  form.elements.peaje.value = isAuditUser() ? 'PEAJE ZARAGOZA' : (currentUser?.peaje || 'PEAJE ZARAGOZA');
  applyPeajeDefaults();
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

async function saveRecord(options = {}) {
  const { clearAfterSave = true, promptEmail = true, isAutoSave = false } = options;

  clearAutoSaveTimer();

  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesion.');
    return null;
  }

  if (!form.reportValidity()) return null;
  const data = formData();
  if (!String(data.responsableRecibe || '').trim()) {
    setOnlineStatus('Falta el responsable que recibe Transbank. Complete ese campo antes de guardar la planilla.');
    form.elements.responsableRecibe?.focus();
    return null;
  }
  const now = new Date().toISOString();
  const existing = activeRecordId ? getRecords().find((item) => item.id === activeRecordId) : findExistingRecordFor(data);
  const record = {
    ...data,
    id: activeRecordId || existing?.id || crypto.randomUUID(),
    updatedAt: now,
    createdAt: existing?.createdAt || now
  };

  showLoading();
  currentStatus.textContent = activeRecordId ? 'Actualizando...' : 'Guardando...';

  try {
    let saved = null;
    if (navigator.onLine) {
      saved = await saveRecordOnline(record, true);
      setOfflineRecordSynced(record.id);
    } else {
      saved = addOrUpdateOfflineRecord(record, true);
      setOnlineStatus('Sin conexion. La planilla se guardo localmente y se sincronizara cuando vuelva internet.');
    }

    const records = getRecords();
    const index = records.findIndex((item) => item.id === saved.id);
    const didSaveOffline = Boolean(!navigator.onLine || saved.pendingSync);

    if (index >= 0) records[index] = saved;
    else records.unshift(saved);

    activeRecordId = saved.id;
    setRecords(records);
    currentStatus.textContent = 'Guardado';
    updateSaveButtonLabel();

    hideLoading();

    if (promptEmail && !didSaveOffline) {
      const sendCopy = await showConfirmationDialog({
        title: 'Enviar copia por correo',
        message: 'La planilla ya fue guardada. Desea enviar una copia en PDF por correo?',
        confirmText: 'Enviar copia',
        cancelText: 'No enviar',
        danger: false
      });

      if (sendCopy) {
        showLoading();
        try {
          await sendRecordCopyEmailOnline(saved);
        } catch (emailError) {
          console.warn('No se pudo enviar la copia por correo:', emailError);
          setOnlineStatus(`Planilla guardada. No se pudo enviar la copia por correo automaticamente: ${emailError.message}`);
          try {
            await saveRecordOnline(saved, false);
            setOnlineStatus('Planilla guardada y copia por correo enviada desde el servidor.');
          } catch (fallbackError) {
            console.warn('Fallo el respaldo de correo del servidor:', fallbackError);
            setOnlineStatus(`Planilla guardada. No se pudo enviar la copia por correo: ${fallbackError.message}`);
          }
        } finally {
          hideLoading();
        }
      } else {
        setOnlineStatus('Planilla guardada. No se envio copia por correo.');
      }
    } else if (!isAutoSave) {
      setOnlineStatus('Planilla guardada.');
    }
    if (clearAfterSave) {
      setTimeout(() => {
        clearForm();
        if (currentStatus.textContent === 'Guardado') {
          setOnlineStatus('Planilla guardada con exito. El formulario quedo listo para registrar una nueva entrega.');
        }
      }, 1000);
    }

    
    return saved;
  } catch (error) {
    hideLoading();
    currentStatus.textContent = 'Error de guardado';
    updateSaveButtonLabel();
    const offlineSaved = addOrUpdateOfflineRecord(record, true);
    setRecords([offlineSaved, ...getRecords().filter((item) => item.id !== offlineSaved.id)]);
    currentStatus.textContent = 'Guardado localmente';
    setOnlineStatus(`No se pudo guardar la planilla online. Se guardo localmente y se sincronizara cuando vuelva internet. ${error.message}`);
    return offlineSaved;
  }
}

async function printRecordSafely() {
  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesion.');
    return;
  }

  if (!form.reportValidity()) return;

  const originalText = printButton.textContent;
  printButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  printButton.textContent = 'Guardando...';
  currentStatus.textContent = 'Guardando antes de imprimir...';

  try {
    const saved = await saveRecord({ clearAfterSave: false, promptEmail: false });

    if (!saved) {
      setOnlineStatus('Impresion detenida. Primero debe guardarse correctamente el registro.');
      return;
    }

    printButton.textContent = 'Imprimiendo...';
    setOnlineStatus('Registro guardado. Generando vista previa del PDF...');

    try {
      await showPdfPreview(saved);
      setOnlineStatus('Revise la vista previa del PDF. Luego imprima desde el visor o use Ctrl+P.');
    } catch (error) {
      console.warn('No se pudo generar la vista previa del PDF:', error);
      fillForm(saved);
      switchView('form');
      await withRenderablePaper(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        setOnlineStatus(`No se pudo mostrar la vista previa del PDF: ${error.message}. Abriendo impresion normal.`);
        window.print();
      });
    }
  } finally {
    printButton.textContent = originalText;
    printButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
  }
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

  setTimeout(async () => {
    fillForm(record);
    await withRenderablePaper(() => withPdfExportMode(element, () => html2pdf().set(pdfOptions(filename)).from(element).save()));
    setOnlineStatus(`PDF descargado: ${filename}`);
  }, 300);
}

async function deleteRecord(id) {
  const reason = await showReasonDialog({
    title: 'Anular registro',
    message: 'Esta accion anulara el registro, actualizara la base online y notificara por correo la razon.',
    confirmText: 'Anular registro',
    cancelText: 'Conservar'
  });
  if (!reason) return;

  try {
    await deleteRecordOnline(id, reason);
    const records = getRecords().filter((item) => item.id !== id);
    if (activeRecordId === id) clearForm();
    setRecords(records);
    setOnlineStatus('Registro anulado correctamente. Se notifico la anulacion por correo.');
  } catch (error) {
    setOnlineStatus(`No fue posible anular el registro. Detalle: ${error.message}`);
  }
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${viewName}View`));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
  updateToolbar(viewName);
  if (viewName === 'admin' || viewName === 'alerts') {
    void loadAdminAlerts();
  }
}

function updateHome() {
  if (!homeWelcome || !homePeaje || !homeTotalRecords || !homeTotalAmount || !homeLastRecord || !homeWeekRecords || !homeCurrentTime || !homeLastLogin) {
    return;
  }

  const records = getRecords();
  const userName = currentUser?.nombre || 'usuario';
  const peajeName = currentUser?.peaje || 'tu peaje';
  const today_ = new Date();
  const sevenDaysAgo = new Date(today_.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const latest = records[0];
  const weekRecords = records.filter((record) => recordDateKey(record.fecha) >= sevenDaysAgo).length;
  const totalAmount = records.reduce((sum, record) => sum + onlyDigits(record.total), 0);
  const loginTime = currentUser?.loginAt || currentUser?.lastLogin || new Date().toISOString();

  homeWelcome.textContent = `Bienvenido, ${userName}`;
  homePeaje.textContent = `Sesion activa para ${peajeName}. Desde aqui puedes crear planillas, consultar registros y mantener el control diario.`;
  homeTotalRecords.textContent = records.length;
  homeTotalAmount.textContent = formatMoney(totalAmount);
  homeLastRecord.textContent = latest ? formatDate(latest.fecha) : 'Sin datos';
  homeWeekRecords.textContent = weekRecords;
  homeCurrentTime.textContent = formatTime(today_.toISOString());
  homeLastLogin.textContent = formatDateTime(loginTime);
}

function updateCurrentTimeTicker() {
  if (!homeCurrentTime) return;
  if (currentTimeInterval) {
    window.clearInterval(currentTimeInterval);
  }
  homeCurrentTime.textContent = formatTime(new Date().toISOString());
  currentTimeInterval = window.setInterval(() => {
    if (homeCurrentTime) {
      homeCurrentTime.textContent = formatTime(new Date().toISOString());
    }
  }, 1000);
}

function updateToolbar(viewName) {
  const labels = {
    home: ['Formato digital', 'Entrega de efectivo a Transbank'],
    form: ['Formato digital', 'Entrega de efectivo a Transbank'],
    records: ['Historial online', 'Registros guardados'],
    audit: ['Control y analisis', 'Panel de auditoria'],
    admin: ['Administración', 'Administrador general / soporte virtual'],
    alerts: ['Alertas', 'Panel de alertas y seguimiento']
  };
  const [eyebrow, title] = labels[viewName] || labels.home;

  if (toolbarEyebrow) toolbarEyebrow.textContent = eyebrow;
  if (toolbarTitle) toolbarTitle.textContent = title;
  if (formToolbarActions) formToolbarActions.hidden = viewName !== 'home' && viewName !== 'form';
}

function showWelcomeModal() {
  if (!welcomeModalOverlay) return;
  welcomeModalOverlay.classList.remove('is-hidden');
  welcomeModalOverlay.setAttribute('aria-hidden', 'false');
}

function hideWelcomeModal() {
  if (!welcomeModalOverlay) return;
  welcomeModalOverlay.classList.add('is-hidden');
  welcomeModalOverlay.setAttribute('aria-hidden', 'true');
}

function getStoredSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch (error) {
    return null;
  }
}

function resetInactivityTimer() {
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }

  if (!currentUser) return;

  inactivityTimer = window.setTimeout(() => {
    clearSession();
  }, INACTIVITY_TIMEOUT_MS);
}

function registerInactivityWatcher() {
  ACTIVITY_EVENTS.forEach((eventName) => {
    window.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
}

async function startSession(user) {
  currentUser = user;
  resetInactivityTimer();
  appShell.classList.remove('is-hidden');
  sessionPeaje.textContent = currentUser.nombre;
  const canAuditPanel = isAuditUser() || isAdminUser();
  form.elements.peaje.disabled = !canAuditPanel;
  setAutoFilledFieldsLocked(true);
  
  if (canAuditPanel && auditViewButton) {
    auditViewButton.style.display = 'block';
  }

  if (isAdminUser() && adminViewButton) {
    adminViewButton.style.display = 'block';
  }
  if (isAdminUser() && alertsViewButton) {
    alertsViewButton.style.display = 'block';
  }
  loadLocalRecords();
  const selfChangePasswordButton = document.querySelector('#selfChangePasswordButton');
  if (selfChangePasswordButton) {
    selfChangePasswordButton.hidden = isAdminUser();
  }
  
  if (canAuditPanel && dashboardButton) {
    dashboardButton.style.display = 'block';
  }
  
  clearForm();
  updateHome();
  updateDashboard();
  switchView('home');
  showWelcomeModal();
  updateCurrentTimeTicker();
  if (navigator.onLine) {
    await syncPendingRecords();
  }
  loadOnlineRecords();
}

function clearSession() {
  if (currentTimeInterval) {
    window.clearInterval(currentTimeInterval);
    currentTimeInterval = null;
  }
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
  currentUser = null;
  recordsCache = [];
  activeRecordId = null;
  form.elements.peaje.disabled = false;
  sessionStorage.removeItem(SESSION_KEY);
  window.location.href = 'login.html';
}

function isAdminUser() {
  const user = currentUser || {};
  const role = String(user.role || user.rol || '').toUpperCase();
  const peaje = String(user.peaje || '').toUpperCase();
  const nombre = String(user.nombre || '').toUpperCase();
  return role === 'ADMIN' || peaje.includes('ADMIN') || nombre.includes('ADMIN') || peaje.includes('SOPORTE') || nombre.includes('SOPORTE');
}

function getSortedRecords(records) {
  return [...records].sort((a, b) => {
    const dateCompare = recordDateKey(b.fecha).localeCompare(recordDateKey(a.fecha));
    if (dateCompare) return dateCompare;
    return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
  });
}

function hasRecordsQuery() {
  return Boolean(
    recordsShowAllMode ||
    String(recordsSearch?.value || '').trim() ||
    recordsDateFrom?.value ||
    recordsDateTo?.value
  );
}

function getRecordsForList() {
  const query = String(recordsSearch?.value || '').trim().toUpperCase();
  const dateFrom = recordsDateFrom?.value || '';
  const dateTo = recordsDateTo?.value || '';
  const sorted = getSortedRecords(getRecords());

  if (!hasRecordsQuery()) {
    return sorted.slice(0, RECENT_RECORD_LIMIT);
  }

  if (recordsShowAllMode) {
    return sorted;
  }

  return sorted.filter((record) => {
    const recordDate = recordDateKey(record.fecha);
    const text = [
      record.codigoSello,
      record.consecutivo,
      record.peaje,
      record.centro,
      record.responsableRecibe,
      record.ciudad
    ].join(' ').toUpperCase();
    const matchText = !query || text.includes(query);
    const matchDateFrom = !dateFrom || recordDate >= dateFrom;
    const matchDateTo = !dateTo || recordDate <= dateTo;
    return matchText && matchDateFrom && matchDateTo;
  });
}

function renderRecords() {
  // Si recordsList no esta inicializado, intentar buscarlo ahora
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

  const totalRecords = getRecords().length;
  const records = getRecordsForList();
  recordCount.textContent = records.length;
  recordsList.replaceChildren();

  if (recordsQueryStatus) {
    recordsQueryStatus.textContent = hasRecordsQuery()
      ? `Consulta aplicada: ${records.length} de ${totalRecords} registros.`
      : `Mostrando los ${Math.min(RECENT_RECORD_LIMIT, totalRecords)} registros mas recientes. Usa la consulta para ver anteriores.`;
  }

  if (!totalRecords) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay registros guardados todavia.';
    recordsList.append(empty);
    return;
  }

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No se encontraron registros con esa consulta.';
    recordsList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  records.forEach((record, index) => {
    try {
      // Crear el card manualmente en lugar de usar el template
      const article = document.createElement('article');
      article.className = 'record-card';
      const hasResponsible = Boolean(String(record.responsableRecibe || '').trim());
      const responsibleText = hasResponsible ? record.responsableRecibe : 'Sin responsable';
      article.innerHTML = `
        <div>
          <strong class="record-title">${record.peaje || 'Peaje'} - ${record.codigoSello || 'Sin codigo'}</strong>
          <span class="record-meta">${formatDate(record.fecha)} - ${record.centro || 'Sin centro'} - ${responsibleText}</span>
          ${hasResponsible ? '' : '<span class="record-warning">Advertencia: falta responsable de recibido</span>'}
        </div>
        <output class="record-total">${formatMoney(record.total)}</output>
        <div class="record-actions">
          <button class="secondary-button load-record" type="button">Editar</button>
          <button class="secondary-button download-pdf" type="button" title="Ver PDF">PDF</button>
          <button class="danger-button delete-record" type="button">Anular</button>
        </div>
      `;
      
      article.querySelector('.load-record').addEventListener('click', () => {
        fillForm(record);
        switchView('form');
      });
      article.querySelector('.download-pdf').addEventListener('click', () => {
        showPdfPreview(record);
      });
      article.querySelector('.delete-record').addEventListener('click', () => deleteRecord(record.id));
      fragment.append(article);
    } catch (e) {
      console.error(`Error renderizando registro ${index}:`, e);
    }
  });
  recordsList.append(fragment);
}

function getScriptUrl() {
  return configuredScriptUrl;
}

function setOnlineStatus(message) {
  if (!onlineStatus) return;
  const text = String(message || '');
  const normalized = text.toLowerCase();
  let tone = 'info';
  let title = 'Informacion del sistema';

  if (/(correctamente|guardad|lista|limpio|impresa|base de datos)/i.test(text)) {
    tone = 'success';
    title = 'Operacion confirmada';
  }

  if (/(advertencia|pendiente|revisar)/i.test(text)) {
    tone = 'warning';
    title = 'Advertencia';
  }

  if (/(no se pudo|falta|debe iniciar|error|invalida|no se imprimio)/i.test(text)) {
    tone = 'error';
    title = 'Revision requerida';
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

async function saveRecordOnline(record, skipEmail = true) {
  const url = getScriptUrl();
  if (!url) {
    throw new Error('Falta URL online');
  }
  if (!currentUser) throw new Error('Debe iniciar sesion');

  setOnlineStatus('Guardando la planilla en la base online...');

  try {
    const payload = await requestPostJson(url, {
      action: 'save',
      peaje: currentUser.peaje,
      password: currentUser.password,
      skipEmail: skipEmail ? 'true' : 'false',
      record
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : 'Respuesta online invalida');
    }

    setOnlineStatus('La planilla fue registrada en la base de datos online.');
    return payload.record;
  } catch (error) {
    console.warn('Fallo guardado por POST, reintentando por JSONP:', error);
    const payload = await requestJsonp(url, {
      action: 'save',
      peaje: currentUser.peaje,
      password: currentUser.password,
      skipEmail: skipEmail ? 'true' : 'false',
      record: JSON.stringify(record)
    });

    if (!payload || !payload.ok) {
      throw new Error(payload && payload.error ? payload.error : error.message || 'Respuesta online invalida');
    }

    setOnlineStatus('La planilla fue registrada en la base de datos online.');
    return payload.record;
  }
}

async function sendRecordCopyEmailOnline(record) {
  if (!currentUser) throw new Error('Debe iniciar sesion');
  const url = getScriptUrl();
  if (!url) throw new Error('Falta URL online');

  setOnlineStatus('Generando PDF exacto para envio de copia por correo...');

  const element = document.querySelector('.paper');
  if (!element) {
    throw new Error('No se pudo encontrar el contenido de la planilla para generar el PDF.');
  }

  // Asegura que el formulario se vea reflejado correctamente antes de generar PDF.
  fillForm(record);
  switchView('form');

  await new Promise((resolve) => setTimeout(resolve, 250));

  const pdfBlob = await withPdfExportMode(element, async () => {
    const worker = html2pdf().set(pdfOptions()).from(element);
    return worker.outputPdf('blob');
  });
  const pdfBase64 = await blobToBase64(pdfBlob);

  setOnlineStatus('Enviando copia de correo con el PDF generado por el sistema...');

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'emailcopy',
      peaje: currentUser.peaje,
      password: currentUser.password,
      record,
      pdfBase64
    })
  });

  if (!response.ok) {
    throw new Error(`No se pudo enviar la copia por correo (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Respuesta invalida del servicio de correo.');
  }

  setOnlineStatus('Copia por correo enviada correctamente.');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      const commaIndex = dataUrl.indexOf(',');
      resolve(commaIndex > -1 ? dataUrl.slice(commaIndex + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function deleteRecordOnline(id, reason) {
  const url = getScriptUrl();
  if (!url) throw new Error('Falta URL online');
  if (!currentUser) throw new Error('Debe iniciar sesion');

  setOnlineStatus('Anulando el registro en la base online y enviando notificacion...');

  const payload = await requestJsonp(url, {
    action: 'delete',
    peaje: currentUser.peaje,
    password: currentUser.password,
    id,
    reason
  });

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'Respuesta online invalida');
  }
}

async function loadOnlineRecords() {
  if (!currentUser) return;
  if (!navigator.onLine) {
    setOnlineStatus('No hay conexión de red. Cargando registros guardados localmente.');
    loadLocalRecords();
    return;
  }

  const url = getScriptUrl();
  if (!url) {
    setOnlineStatus('Falta configurar la URL del Apps Script para conectar la base online.');
    return;
  }

  setOnlineStatus('Consultando registros en la base online...');

  const params = {
    action: 'list',
    peaje: currentUser.peaje,
    password: currentUser.password
  };

  const timeouts = [8000, 15000, 30000];
  let lastError = null;
  for (let attempt = 0; attempt < timeouts.length; attempt++) {
    try {
      const payload = await requestJsonp(url, params, timeouts[attempt]);
      if (!payload || !payload.ok) {
        lastError = new Error(payload && payload.error ? payload.error : 'Respuesta invalida del servicio online');
        // intentar siguiente
        await new Promise((r) => setTimeout(r, 700));
        continue;
      }

      const onlineRecords = Array.isArray(payload.records) ? payload.records : [];
      const merged = mergeRecords(onlineRecords, getOfflineRecordsForCurrentUser());
      setRecords(merged);
      setOnlineStatus(`Consulta completada. Se encontraron ${onlineRecords.length} registros online.`);
      notifyMissingRecordsIfNeeded();
      return;
    } catch (error) {
      console.warn(`Intento ${attempt + 1} fallo:`, error);
      lastError = error;
      // esperar un poco antes del siguiente intento
      await new Promise((r) => setTimeout(r, 800 + attempt * 500));
    }
  }

  // Si llegamos aqui, todos los intentos fallaron
  loadLocalRecords();
  setOnlineStatus(`No fue posible conectar con la base online. Se cargaron registros locales si existen. Detalle: ${lastError && lastError.message ? lastError.message : 'Sin respuesta'}`);
}

function notifyMissingRecordsIfNeeded() {
  if (!currentUser || !isAuditUser()) return;

  const url = getScriptUrl();
  if (!url) return;

  requestJsonp(url, {
    action: 'notifymissing',
    peaje: currentUser.peaje,
    password: currentUser.password,
    days: '10'
  })
    .then((payload) => {
      if (!payload || !payload.ok) {
        console.warn('No fue posible revisar faltantes:', payload && payload.error);
        return;
      }

      const sent = payload.missing && Array.isArray(payload.missing.sent) ? payload.missing.sent : [];
      const checkedFrom = payload.missing?.checkedFrom || '';
      const checkedTo = payload.missing?.checkedTo || '';

      if (sent.length) {
        setOnlineStatus(`Se notificaron ${sent.length} faltante(s) de planillas entre ${checkedFrom} y ${checkedTo}.`);
      }
    })
    .catch((error) => {
      console.warn('No fue posible notificar faltantes de planillas:', error);
    });
}

async function requestPostJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`No se pudo conectar con Apps Script (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  return payload;
}

function requestJsonp(url, params, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const callbackName = `onlinePlanillas_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    const query = new URLSearchParams({ ...params, callback: callbackName });
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

    script.onerror = async () => {
      cleanup();
      const src = `${url}${separator}${query.toString()}`;
      console.warn('JSONP script error for', src);
      // Intentar diagnostico con fetch para obtener mas detalle si es posible
      try {
        const resp = await fetch(src, { method: 'GET' });
        const text = await resp.text();
        console.warn('Fetch diagnostic response:', resp.status, text.slice(0, 300));

        // Intentar extraer payload JSONP dentro del body si existe
        const marker = `${callbackName}(`;
        const idx = text.indexOf(marker);
        if (idx !== -1) {
          try {
            const start = text.indexOf('(', idx);
            const end = text.lastIndexOf(')');
            const jsonText = text.substring(start + 1, end);
            const payload = JSON.parse(jsonText);
            console.info('Parsed JSONP payload from fetched body, using fallback.');
            resolve(payload);
            return;
          } catch (pex) {
            console.warn('Fallback parse failed:', pex);
          }
        }

        // Mostrar diagnostico corto en la UI si existe
        const box = document.querySelector('#jsErrorBox') || document.querySelector('#onlineStatus');
        const msg = `No se pudo cargar Apps Script (status: ${resp.status}). URL: ${src}`;
        if (box) {
          const short = text.replace(/\s+/g, ' ').slice(0, 400);
          box.textContent = `${msg} Respuesta: ${short}`;
        }

        reject(new Error(msg));
      } catch (ferr) {
        reject(new Error(`No se pudo cargar Apps Script. URL: ${src}. Detalle fetch: ${ferr && ferr.message ? ferr.message : String(ferr)}`));
      }
    };

    timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('Apps Script no respondio a tiempo'));
    }, timeoutMs);

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
    const recordDate = recordDateKey(record.fecha);
    
    const matchDateFrom = !dateFrom || recordDate >= dateFrom;
    const matchDateTo = !dateTo || recordDate <= dateTo;

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
    node.querySelector('.record-title').textContent = `${record.peaje || 'Peaje'} - ${record.codigoSello || 'Sin codigo'} (${record.centro || 'Sin centro'})`;
    const hasResponsible = Boolean(String(record.responsableRecibe || '').trim());
    node.querySelector('.record-meta').textContent = `${formatDate(record.fecha)} - ${record.responsableRecibe || 'Sin responsable'} - Modificado: ${formatDateTime(record.updatedAt)}`;
    if (!hasResponsible) {
      const warning = document.createElement('span');
      warning.className = 'record-warning';
      warning.textContent = 'Advertencia: falta responsable de recibido';
      node.querySelector('.record-meta').after(warning);
    }

    node.querySelector('.record-total').textContent = formatMoney(record.total);
    node.querySelector('.load-record').textContent = 'Ver PDF';
    node.querySelector('.load-record').addEventListener('click', () => {
      showPdfPreview(record);
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

function setDefaultAuditReportMonth() {
  if (!auditReportMonth || auditReportMonth.value) return;
  auditReportMonth.value = getLatestRecordMonthKey(getRecords());
}

function recordsForMonthlyAuditReport() {
  setDefaultAuditReportMonth();
  const monthKey = auditReportMonth?.value || getLatestRecordMonthKey(getRecords());
  const selectedPeaje = auditFilterPeaje?.value || '';

  return getRecords()
    .filter((record) => monthKeyFromRecord(record) === monthKey)
    .filter((record) => !selectedPeaje || String(record.peaje || '').toUpperCase() === selectedPeaje.toUpperCase())
    .sort((a, b) => {
      const dateCompare = recordDateKey(a.fecha).localeCompare(recordDateKey(b.fecha));
      if (dateCompare) return dateCompare;
      return String(a.peaje || '').localeCompare(String(b.peaje || ''));
    });
}

function buildMonthlyAuditReportHtml(records, monthKey) {
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const totalAmount = records.reduce((sum, record) => sum + onlyDigits(record.total), 0);
  const byDate = {};

  records.forEach((record) => {
    const key = recordDateKey(record.fecha) || 'Sin fecha';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(record);
  });

  const [year, month] = String(monthKey || '').split('-').map(Number);
  const lastDay = year && month ? new Date(year, month, 0).getDate() : 0;
  const dateKeys = lastDay
    ? Array.from({ length: lastDay }, (_, index) => `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`)
    : Object.keys(byDate).sort();

  const daySections = dateKeys.map((dateKey) => {
    const dayRecords = byDate[dateKey] || [];
    const dayTotal = dayRecords.reduce((sum, record) => sum + onlyDigits(record.total), 0);
    const rows = dayRecords.length
      ? dayRecords.map((record, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(record.peaje || '')}</td>
            <td>${escapeHtml(record.codigoSello || record.consecutivo || '')}</td>
            <td>${escapeHtml(record.centro || '')}</td>
            <td>${escapeHtml(record.responsableRecibe || '')}</td>
            <td class="money">${escapeHtml(formatMoney(record.total || record.efectivo || 0))}</td>
            <td>${escapeHtml(formatDateTime(record.updatedAt))}</td>
          </tr>
        `).join('')
      : '<tr class="empty-row"><td colspan="7">Sin planillas registradas para este dia.</td></tr>';

    return `
      <section class="day-block">
        <div class="day-title">
          <strong>${escapeHtml(formatDate(dateKey))}</strong>
          <span>${dayRecords.length} registro(s) - ${escapeHtml(formatMoney(dayTotal))}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Peaje</th>
              <th>Codigo/Sello</th>
              <th>Centro</th>
              <th>Responsable recibe</th>
              <th>Total enviado</th>
              <th>Modificado</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
  }).join('');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <base href="${escapeHtml(window.location.href)}">
  <title>Informe mensual auditoria - ${escapeHtml(monthLabel(monthKey))}</title>
  <style>
    @page { size: letter portrait; margin: 10mm; }
    * { box-sizing: border-box; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 10px; background: #fff; }
    .report { width: 100%; }
    .header { display: grid; grid-template-columns: 120px 1fr 120px; border: 1px solid #111827; }
    .logo { display: grid; min-height: 74px; place-items: center; padding: 8px; border-right: 1px solid #111827; font-weight: 800; text-align: center; }
    .logo:last-child { border-right: 0; border-left: 1px solid #111827; }
    .logo img { max-width: 96px; max-height: 52px; object-fit: contain; }
    .title { display: grid; align-content: center; justify-items: center; padding: 10px; text-align: center; }
    .title h1 { margin: 0; font-size: 16px; letter-spacing: 0; text-transform: uppercase; }
    .title p { margin: 5px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #111827; border-top: 0; }
    .meta div { min-height: 42px; padding: 7px 8px; border-right: 1px solid #111827; }
    .meta div:last-child { border-right: 0; }
    .meta span { display: block; color: #374151; font-size: 8px; font-weight: 800; text-transform: uppercase; }
    .meta strong { display: block; margin-top: 4px; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
    .summary div { padding: 8px; border: 1px solid #9ca3af; background: #f3f4f6; }
    .summary span { display: block; color: #374151; font-size: 8px; font-weight: 800; text-transform: uppercase; }
    .summary strong { display: block; margin-top: 4px; font-size: 13px; }
    .day-block { page-break-inside: avoid; margin-top: 10px; }
    .day-title { display: flex; justify-content: space-between; gap: 12px; padding: 6px 8px; border: 1px solid #111827; background: #e5e7eb; font-size: 10px; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 5px 4px; border: 1px solid #9ca3af; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #f3f4f6; font-size: 8px; text-transform: uppercase; }
    th:nth-child(1), td:nth-child(1) { width: 28px; text-align: center; }
    th:nth-child(2), td:nth-child(2) { width: 92px; }
    th:nth-child(3), td:nth-child(3) { width: 72px; }
    th:nth-child(6), td:nth-child(6) { width: 80px; }
    th:nth-child(7), td:nth-child(7) { width: 94px; }
    .money { text-align: right; font-weight: 700; }
    .empty-row td { color: #6b7280; font-style: italic; text-align: center; }
    .footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #9ca3af; color: #4b5563; font-size: 9px; }
    @media screen { body { padding: 18px; background: #e5e7eb; } .report { max-width: 860px; margin: 0 auto; padding: 18px; background: #fff; box-shadow: 0 20px 60px rgba(0,0,0,.18); } }
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      <div class="logo"><img src="assets/logo-zima.png" alt="ZIMA"></div>
      <div class="title">
        <h1>Recaudo auditado</h1>
        <p>Informe mensual de planillas enviadas dia por dia</p>
      </div>
      <div class="logo"><img src="assets/logo-ani.png" alt="ANI"></div>
    </header>
    <section class="meta">
      <div><span>Periodo</span><strong>${escapeHtml(monthLabel(monthKey))}</strong></div>
      <div><span>Peaje</span><strong>${escapeHtml(auditFilterPeaje?.value || 'Todos')}</strong></div>
      <div><span>Generado por</span><strong>${escapeHtml(currentUser?.nombre || currentUser?.peaje || 'Sistema')}</strong></div>
      <div><span>Fecha generacion</span><strong>${escapeHtml(formatDateTime(new Date().toISOString()))}</strong></div>
    </section>
    <section class="summary">
      <div><span>Total registros</span><strong>${records.length}</strong></div>
      <div><span>Total enviado</span><strong>${escapeHtml(formatMoney(totalAmount))}</strong></div>
      <div><span>Dias con envio</span><strong>${Object.keys(byDate).length}</strong></div>
    </section>
    ${daySections}
    <p class="footer">Documento generado desde el panel de auditoria del sistema de planillas ZIMA.</p>
  </main>
</body>
</html>`;
}

async function saveMonthlyAuditReportPdf(html, monthKey) {
  if (typeof html2pdf !== 'function') {
    throw new Error('El generador PDF no esta disponible.');
  }

  const container = document.createElement('div');
  container.className = 'monthly-report-render';
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '216mm';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.append(container);

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const report = container.querySelector('.report') || container;
    await html2pdf()
      .set({
        filename: `RECAUDOAUDITADO_${monthKey}.pdf`,
        margin: [10, 10, 10, 10],
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollX: 0, scrollY: 0 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'letter' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      })
      .from(report)
      .save();
  } finally {
    container.remove();
  }
}

function printMonthlyAuditReport() {
  const monthKey = auditReportMonth?.value || getLatestRecordMonthKey(getRecords());
  if (!monthKey) {
    setOnlineStatus('No hay registros disponibles para generar el informe mensual.');
    return;
  }

  const records = recordsForMonthlyAuditReport();
  const html = buildMonthlyAuditReportHtml(records, monthKey);
  setOnlineStatus(`Generando PDF del informe mensual de ${monthLabel(monthKey)}...`);

  saveMonthlyAuditReportPdf(html, monthKey)
    .then(() => {
      setOnlineStatus(`PDF del informe mensual de ${monthLabel(monthKey)} generado correctamente.`);
    })
    .catch((error) => {
      console.warn('No se pudo generar el PDF mensual, usando impresion del navegador:', error);
      openMonthlyAuditPrintWindow(html, monthKey);
    });
}

function openMonthlyAuditPrintWindow(html, monthKey) {
  const reportWindow = window.open('', '_blank', 'width=980,height=720');
  if (!reportWindow) {
    downloadFile(`informe-auditoria-${monthKey}.html`, html, 'text/html;charset=utf-8');
    setOnlineStatus('El navegador bloqueo la ventana de impresion. Se descargo el informe HTML para abrirlo e imprimirlo.');
    return;
  }

  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.setTimeout(() => {
    reportWindow.print();
  }, 500);
  setOnlineStatus(`Informe mensual de ${monthLabel(monthKey)} listo para imprimir.`);
}

function renderAdminUsers(users) {
  if (!adminUsersList) return;

  adminUsersList.replaceChildren();
  const filtered = (users || []).filter((user) => {
    const search = (adminUserSearch?.value || '').trim().toUpperCase();
    if (!search) return true;
    return [user.peaje, user.username, user.nombre, user.rol].join(' ').toUpperCase().includes(search);
  });

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay usuarios para mostrar.';
    adminUsersList.append(empty);
    return;
  }

  filtered.forEach((user) => {
    const isInactive = String(user.activo || '').toUpperCase() === 'NO';
    const article = document.createElement('article');
    article.className = 'record-card admin-user-card';
    const activeText = isInactive ? 'Inactivo' : 'Activo';
    article.innerHTML = `
      <div class="record-content">
        <strong class="record-title">${user.username || user.peaje || 'Sin usuario'}</strong>
        <span class="record-meta">
          ${user.peaje ? `${user.peaje} · ` : ''}
          ${user.nombre || 'Sin nombre'} · ${user.rol || 'PEAJE'} · ${activeText}
        </span>
      </div>
      <div class="record-actions admin-actions">
        <button class="secondary-button reset-password" type="button">Cambiar clave</button>
        <button class="${isInactive ? 'primary-button reactivate-user' : 'secondary-button deactivate-user'}" type="button">
          ${isInactive ? 'Reactivar' : 'Desactivar'}
        </button>
      </div>
    `;
    article.querySelector('.reset-password').addEventListener('click', (event) => {
      event.preventDefault();
      openChangePasswordModal(user.username || user.peaje, user.nombre || user.peaje);
    });

    if (isInactive) {
      article.querySelector('.reactivate-user').addEventListener('click', async () => {
        try {
          await reactivateUserOnline(user);
          setOnlineStatus(`Usuario ${user.username || user.peaje} reactivado correctamente.`);
          await loadAdminUsers();
        } catch (error) {
          setOnlineStatus(`No fue posible reactivar el usuario: ${error.message}`);
        }
      });
    } else {
      article.querySelector('.deactivate-user').addEventListener('click', async () => {
        try {
          await deleteUserOnline(user.username || user.peaje);
          setOnlineStatus(`Usuario ${user.username || user.peaje} desactivado.`);
          await loadAdminUsers();
        } catch (error) {
          setOnlineStatus(`No fue posible desactivar el usuario: ${error.message}`);
        }
      });
    }

    adminUsersList.append(article);
  });
}

async function loadAdminUsers() {
  if (!isAdminUser()) return;
  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'users',
      peaje: currentUser.peaje,
      password: currentUser.password
    });
    if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'No se pudo cargar usuarios');
    const users = Array.isArray(payload.users) ? payload.users : [];
    renderAdminUsers(users);
    if (adminUserCount) adminUserCount.textContent = users.filter((user) => user.activo !== 'NO').length;
    if (adminQuickAction) adminQuickAction.textContent = `Usuarios online: ${users.length}`;
  } catch (error) {
    setOnlineStatus(`No fue posible consultar usuarios: ${error.message}`);
  }
}

async function saveAdminUser() {
  if (!isAdminUser()) {
    setOnlineStatus('Solo el administrador general puede crear usuarios.');
    return;
  }
  const peaje = (adminUserName?.value || '').trim();
  const nombre = (adminUserDisplayName?.value || peaje).trim();
  const password = (adminUserPassword?.value || '').trim();
  const role = (adminUserRole?.value || 'PEAJE').trim().toUpperCase();
  if (!peaje || !nombre || !password) {
    setOnlineStatus('Complete el usuario, el nombre visible y la clave inicial.');
    return;
  }

  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'saveuser',
      peaje: currentUser.peaje,
      password: currentUser.password,
      user: JSON.stringify({ peaje, nombre, password, activo: 'SI', rol: role })
    });
    if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'No se pudo crear el usuario');
    setOnlineStatus(`Usuario ${peaje} creado correctamente.`);
    if (adminUserPassword) adminUserPassword.value = '';
    if (adminUserName) adminUserName.value = '';
    if (adminUserDisplayName) adminUserDisplayName.value = '';
    await loadAdminUsers();
  } catch (error) {
    setOnlineStatus(`No fue posible crear el usuario: ${error.message}`);
  }
}

async function changePasswordOnline(targetPeaje, passwordValue) {
  try {
    console.debug('changePasswordOnline -> params', { peaje: currentUser && currentUser.peaje, targetPeaje, passwordLength: (passwordValue || '').length });
    const payload = await requestPostJson(getScriptUrl(), {
      action: 'changepassword',
      peaje: currentUser.peaje,
      password: currentUser.password,
      targetPeaje,
      passwordValue
    });
    console.debug('changePasswordOnline -> response', payload);
    if (!payload || !payload.ok) {
      console.error('changePasswordOnline failed', payload);
      throw new Error(payload && payload.error ? payload.error : 'No se pudo cambiar la clave');
    }
    return payload.user;
  } catch (err) {
    console.error('changePasswordOnline exception', err && err.message ? err.message : err);
    throw err;
  }
}

async function requestPasswordCodeOnline(targetPeaje) {
  const payload = await requestJsonp(getScriptUrl(), {
    action: 'passwordcode',
    peaje: currentUser.peaje,
    password: currentUser.password,
    targetPeaje
  });
  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'No se pudo enviar el codigo de verificacion');
  }
  return payload;
}

async function changeOwnPasswordWithCodeOnline(targetPeaje, passwordValue, verificationCode) {
  const payload = await requestPostJson(getScriptUrl(), {
    action: 'changepassword',
    peaje: currentUser.peaje,
    password: currentUser.password,
    targetPeaje,
    passwordValue,
    verificationCode
  });
  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'No se pudo cambiar la clave');
  }
  return payload.user;
}

async function deleteUserOnline(targetPeaje) {
  const payload = await requestPostJson(getScriptUrl(), {
    action: 'deleteuser',
    peaje: currentUser.peaje,
    password: currentUser.password,
    targetPeaje
  });
  if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'No se pudo desactivar el usuario');
  return payload.user;
}

function openChangePasswordModal(peaje, nombre, options = {}) {
  if (!adminPasswordOverlay || !adminPasswordTitle || !adminPasswordInput) return;
  adminPasswordTarget = peaje;
  passwordChangeNeedsCode = Boolean(options.requireCode);
  adminPasswordTitle.textContent = `Nueva clave para ${nombre}`;
  adminPasswordInput.value = '';
  if (adminPasswordStatus) adminPasswordStatus.textContent = '';
  if (changePasswordCodeInput) changePasswordCodeInput.value = '';
  if (changePasswordCodeGroup) changePasswordCodeGroup.hidden = !passwordChangeNeedsCode;
  if (sendPasswordCodeButton) sendPasswordCodeButton.hidden = !passwordChangeNeedsCode;
  adminPasswordOverlay.classList.remove('is-hidden');
  adminPasswordOverlay.setAttribute('aria-hidden', 'false');
  if (passwordChangeNeedsCode && sendPasswordCodeButton) sendPasswordCodeButton.focus();
  else adminPasswordInput.focus();
}

function closeChangePasswordModal() {
  if (!adminPasswordOverlay) return;
  adminPasswordTarget = null;
  passwordChangeNeedsCode = false;
  if (adminPasswordStatus) adminPasswordStatus.textContent = '';
  adminPasswordOverlay.classList.add('is-hidden');
  adminPasswordOverlay.setAttribute('aria-hidden', 'true');
}

async function notifyAdminMissingPlanillas() {
  if (!isAdminUser()) {
    setOnlineStatus('Solo el administrador general puede enviar alertas.');
    return;
  }

  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'notifymissing',
      peaje: currentUser.peaje,
      password: currentUser.password,
      days: '10'
    });
    if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'No se pudieron enviar alertas');
    const sent = payload.missing && Array.isArray(payload.missing.sent) ? payload.missing.sent : [];
    setOnlineStatus(sent.length ? `Alertas enviadas para ${sent.length} fecha(s).` : 'No se encontraron faltantes para notificar.');
  } catch (error) {
    setOnlineStatus(`No fue posible enviar las alertas: ${error.message}`);
  }
}

async function encodeFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      const base64 = content.split(',')[1] || '';
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', data: base64 });
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

async function sendAdminAlertOnline(targetPeaje, message, files = []) {
  const attachments = await Promise.all(files.map((file) => encodeFileAsBase64(file)));
  const payload = await requestPostJson(getScriptUrl(), {
    action: 'sendalert',
    peaje: currentUser.peaje,
    password: currentUser.password,
    targetPeaje,
    message,
    attachments: JSON.stringify(attachments)
  });

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'No fue posible enviar la alerta');
  }

  return payload;
}

async function loadAdminAlerts() {
  if (!isAdminUser()) return;

  try {
    const payload = await requestJsonp(getScriptUrl(), {
      action: 'alerts',
      peaje: currentUser.peaje,
      password: currentUser.password
    });
    if (!payload || !payload.ok) throw new Error(payload && payload.error ? payload.error : 'No se pudo cargar el historial de alertas');
    const alerts = Array.isArray(payload.alerts) ? payload.alerts : [];
    renderAdminAlerts(alerts);
  } catch (error) {
    console.error('No fue posible cargar el historial de alertas:', error);
  }
}

function renderAdminAlerts(alerts) {
  if (!adminAlertsList) return;
  adminAlertsList.replaceChildren();

  if (!alerts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No hay alertas enviadas aún.';
    adminAlertsList.append(empty);
    return;
  }

  alerts.forEach((alert) => {
    const article = document.createElement('article');
    article.className = 'record-card admin-user-card';
    const sentAt = alert.sentAt ? formatDateTime(alert.sentAt) : 'Fecha desconocida';
    const attachmentCount = alert.attachmentNames ? alert.attachmentNames.split('|').filter(Boolean).length : 0;
    article.innerHTML = `
      <div class="record-content">
        <strong class="record-title">${alert.targetPeaje || 'Peaje desconocido'}</strong>
        <span class="record-meta">Enviado por ${alert.sentBy || 'Administrador'} · ${sentAt}</span>
        <p class="record-note">${String(alert.message || '').slice(0, 180)}</p>
      </div>
      <div class="record-actions admin-actions">
        <span class="record-note">Adjuntos: ${attachmentCount}</span>
      </div>
    `;
    adminAlertsList.append(article);
  });
}

function updateDashboard() {
  if (!document.querySelector('#dashTotalRecords')) return; // Dashboard not in DOM
  
  const records = getRecords();
  const latestDateKey = getLatestRecordDateKey(records);
  const anchorDate = dateFromKey(latestDateKey);
  const sevenDaysAgo = dateKeyFromDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - 6));
  const thisMonth = latestDateKey.slice(0, 7);

  const totalRecords = records.length;
  const totalAmount = records.reduce((sum, r) => sum + onlyDigits(r.total), 0);
  const weekRecords = records.filter(r => recordDateKey(r.fecha) >= sevenDaysAgo).length;
  const weekAmount = records.filter(r => recordDateKey(r.fecha) >= sevenDaysAgo).reduce((sum, r) => sum + onlyDigits(r.total), 0);
  const monthRecords = records.filter(r => recordDateKey(r.fecha).startsWith(thisMonth)).length;
  const monthAmount = records.filter(r => recordDateKey(r.fecha).startsWith(thisMonth)).reduce((sum, r) => sum + onlyDigits(r.total), 0);
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
  renderLatestRecordSummary(records);
  renderRecentActivity(records);
  renderTopCenters(records);
}

function getRecordsByRecentDate(records) {
  return [...records].sort((a, b) => {
    const dateA = recordDateKey(a.fecha) || '';
    const dateB = recordDateKey(b.fecha) || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return String(b.updatedAt || b.createdAt || b.id || '').localeCompare(String(a.updatedAt || a.createdAt || a.id || ''));
  });
}

function appendSummaryRow(container, label, value) {
  const row = document.createElement('div');
  const labelEl = document.createElement('span');
  const valueEl = document.createElement('strong');
  labelEl.textContent = label;
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  container.append(row);
}

function renderLatestRecordSummary(records) {
  const container = document.querySelector('#latestRecordSummary');
  if (!container) return;

  container.replaceChildren();
  const latest = getRecordsByRecentDate(records)[0];

  if (!latest) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'Sin planillas registradas.';
    container.append(empty);
    return;
  }

  appendSummaryRow(container, 'Fecha', formatDate(latest.fecha));
  appendSummaryRow(container, 'Hora', latest.updatedAt ? formatDateTime(latest.updatedAt).split(',').at(-1).trim() : '-');
  appendSummaryRow(container, 'Operador', latest.operador || latest.responsableRecibe || currentUser?.nombre || '-');
  appendSummaryRow(container, 'Peaje', String(latest.peaje || '-').replace(/^PEAJE\s+/i, ''));
  appendSummaryRow(container, 'Valor entregado', formatMoney(latest.total || latest.efectivo || 0));

  const button = document.createElement('button');
  button.className = 'secondary-button latest-detail-button';
  button.type = 'button';
  button.textContent = 'Ver detalle';
  button.addEventListener('click', () => switchView('records'));
  container.append(button);
}

function renderRecentActivity(records) {
  const container = document.querySelector('#recentActivityList');
  if (!container) return;

  container.replaceChildren();
  const recent = getRecordsByRecentDate(records).slice(0, 5);

  if (!recent.length) {
    const empty = document.createElement('p');
    empty.className = 'dashboard-empty';
    empty.textContent = 'Sin actividad reciente.';
    container.append(empty);
    return;
  }

  recent.forEach((record, index) => {
    const item = document.createElement('div');
    item.className = 'recent-activity-item';

    const icon = document.createElement('span');
    icon.className = 'activity-icon';
    icon.textContent = index === 0 ? '+' : '✓';

    const title = document.createElement('strong');
    title.textContent = index === 0 ? 'Nueva planilla creada' : 'Registro actualizado';

    const time = document.createElement('span');
    time.textContent = record.updatedAt ? formatDateTime(record.updatedAt).split(',').at(-1).trim() : formatDate(record.fecha);

    item.append(icon, title, time);
    container.append(item);
  });
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
  const latestDateKey = getLatestRecordDateKey(records);
  const anchorDate = dateFromKey(latestDateKey);

  for (let i = 6; i >= 0; i--) {
    const date = dateKeyFromDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate() - i));
    dailyData[date] = 0;
  }

  records.forEach(r => {
    const fecha = recordDateKey(r.fecha);
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

// Agregar event listeners cuando el DOM esta completamente listo
document.addEventListener('DOMContentLoaded', function() {
  registerInactivityWatcher();

  // Inicializar referencias a elementos del DOM
  form = document.querySelector('#moneyForm');
  totalEntregado = document.querySelector('#totalEntregado');
  valorLetras = document.querySelector('#valorLetras');
  currentStatus = document.querySelector('#currentStatus');
  recordCount = document.querySelector('#recordCount');
  recordsList = document.querySelector('#recordsList');
  recordTemplate = document.querySelector('#recordTemplate');
  recordsSearch = document.querySelector('#recordsSearch');
  recordsDateFrom = document.querySelector('#recordsDateFrom');
  recordsDateTo = document.querySelector('#recordsDateTo');
  recordsShowAll = document.querySelector('#recordsShowAll');
  recordsClearQuery = document.querySelector('#recordsClearQuery');
  recordsQueryStatus = document.querySelector('#recordsQueryStatus');
  onlineStatus = document.querySelector('#onlineStatus');
  appShell = document.querySelector('.app-shell');
  sessionPeaje = document.querySelector('#sessionPeaje');
  logoutButton = document.querySelector('#logoutButton');
  saveButton = document.querySelector('#saveRecord');
  printButton = document.querySelector('#printRecord');
  pdfModal = document.querySelector('#pdfModal');
  pdfIframe = document.querySelector('#pdfIframe');
  closePdfModal = document.querySelector('#closePdfModal');
  dashboardButton = document.querySelector('#dashboardButton');
  dashboardRefresh = document.querySelector('#dashboardRefresh');
  auditViewButton = document.querySelector('#auditViewButton');
  adminViewButton = document.querySelector('#adminViewButton');
  alertsViewButton = document.querySelector('#alertsViewButton');
  auditSearch = document.querySelector('#auditSearch');
  auditFilterPeaje = document.querySelector('#auditFilterPeaje');
  auditFilterDateFrom = document.querySelector('#auditFilterDateFrom');
  auditFilterDateTo = document.querySelector('#auditFilterDateTo');
  auditFilterApply = document.querySelector('#auditFilterApply');
  auditFilterClear = document.querySelector('#auditFilterClear');
  auditRecordsList = document.querySelector('#auditRecordsList');
  auditReportMonth = document.querySelector('#auditReportMonth');
  printMonthlyAudit = document.querySelector('#printMonthlyAudit');
  clearFormButton = document.querySelector('#clearFormButton');
  auditTotalRecords = document.querySelector('#auditTotalRecords');
  auditTotalAmount = document.querySelector('#auditTotalAmount');
  auditByPeaje = document.querySelector('#auditByPeaje');
  exportCsvAudit = document.querySelector('#exportCsvAudit');
  exportJsonAudit = document.querySelector('#exportJsonAudit');
  adminUsersList = document.querySelector('#adminUsersList');
  adminUserSearch = document.querySelector('#adminUserSearch');
  adminUserName = document.querySelector('#adminUserName');
  adminUserDisplayName = document.querySelector('#adminUserDisplayName');
  adminUserPassword = document.querySelector('#adminUserPassword');
  adminUserRole = document.querySelector('#adminUserRole');
  adminSaveUser = document.querySelector('#adminSaveUser');
  adminRefreshUsers = document.querySelector('#adminRefreshUsers');
  adminNotifyMissing = document.querySelector('#adminNotifyMissing');
  adminAlertPeaje = document.querySelector('#adminAlertPeaje');
  adminAlertMessage = document.querySelector('#adminAlertMessage');
  adminAlertImages = document.querySelector('#adminAlertImages');
  adminSendAlert = document.querySelector('#adminSendAlert');
  adminAlertStatus = document.querySelector('#adminAlertStatus');
  adminAlertsList = document.querySelector('#adminAlertsList');
  adminUserCount = document.querySelector('#adminUserCount');
  adminQuickAction = document.querySelector('#adminQuickAction');
  adminPasswordOverlay = document.querySelector('#changePasswordOverlay');
  adminPasswordTitle = document.querySelector('#changePasswordTitle');
  adminPasswordInput = document.querySelector('#changePasswordInput');
  changePasswordCodeGroup = document.querySelector('#changePasswordCodeGroup');
  changePasswordCodeInput = document.querySelector('#changePasswordCodeInput');
  sendPasswordCodeButton = document.querySelector('#sendPasswordCodeButton');
  adminPasswordCancel = document.querySelector('#changePasswordCancel');
  adminPasswordSave = document.querySelector('#changePasswordSave');
  adminPasswordStatus = document.querySelector('#changePasswordStatus');
  loadingOverlay = document.querySelector('#loadingOverlay');
  homeWelcome = document.querySelector('#homeWelcome');
  homePeaje = document.querySelector('#homePeaje');
  homeTotalRecords = document.querySelector('#homeTotalRecords');
  homeTotalAmount = document.querySelector('#homeTotalAmount');
  homeLastRecord = document.querySelector('#homeLastRecord');
  homeWeekRecords = document.querySelector('#homeWeekRecords');
  homeCurrentTime = document.querySelector('#homeCurrentTime');
  homeLastLogin = document.querySelector('#homeLastLogin');
  toolbarEyebrow = document.querySelector('#toolbarEyebrow');
  toolbarTitle = document.querySelector('#toolbarTitle');
  formToolbarActions = document.querySelector('#formToolbarActions');
  welcomeModalOverlay = document.querySelector('#welcomeModalOverlay');
  welcomeModalCloseButton = document.querySelector('#welcomeModalClose');

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
      if (currentStatus && currentStatus.textContent === 'Con cambios') {
        scheduleAutoSave();
      }
    });
  }

  // Buttons
  const newRecordBtn = document.querySelector('#newRecord');
  if (newRecordBtn) {
    newRecordBtn.addEventListener('click', () => {
      clearForm();
      switchView('form');
    });
  }

  const homeNewRecordBtn = document.querySelector('#homeNewRecord');
  if (homeNewRecordBtn) {
    homeNewRecordBtn.addEventListener('click', () => {
      clearForm();
      switchView('form');
    });
  }

  if (clearFormButton) {
    clearFormButton.addEventListener('click', () => {
      clearForm();
      switchView('form');
    });
  }

  if (welcomeModalCloseButton) {
    welcomeModalCloseButton.addEventListener('click', hideWelcomeModal);
  }

  if (closePdfModal) closePdfModal.addEventListener('click', closePdfPreview);
  if (pdfModal) {
    pdfModal.addEventListener('click', (event) => {
      if (event.target === pdfModal) closePdfPreview();
    });
  }

  const homeRecordsBtn = document.querySelector('#homeRecords');
  if (homeRecordsBtn) homeRecordsBtn.addEventListener('click', () => switchView('records'));
  
  if (saveButton) saveButton.addEventListener('click', saveRecord);
  if (printButton) printButton.addEventListener('click', printRecordSafely);
  
  const exportJsonBtn = document.querySelector('#exportJson');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJson);
  
  const exportCsvBtn = document.querySelector('#exportCsv');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

  if (recordsSearch) recordsSearch.addEventListener('input', () => {
    recordsShowAllMode = false;
    renderRecords();
  });
  if (recordsDateFrom) recordsDateFrom.addEventListener('change', () => {
    recordsShowAllMode = false;
    renderRecords();
  });
  if (recordsDateTo) recordsDateTo.addEventListener('change', () => {
    recordsShowAllMode = false;
    renderRecords();
  });
  if (recordsShowAll) {
    recordsShowAll.addEventListener('click', () => {
      recordsShowAllMode = true;
      if (recordsSearch) recordsSearch.value = '';
      if (recordsDateFrom) recordsDateFrom.value = '';
      if (recordsDateTo) recordsDateTo.value = '';
      renderRecords();
    });
  }
  if (recordsClearQuery) {
    recordsClearQuery.addEventListener('click', () => {
      recordsShowAllMode = false;
      if (recordsSearch) recordsSearch.value = '';
      if (recordsDateFrom) recordsDateFrom.value = '';
      if (recordsDateTo) recordsDateTo.value = '';
      renderRecords();
    });
  }
  
  const syncOnlineBtn = document.querySelector('#syncOnline');
  if (syncOnlineBtn) syncOnlineBtn.addEventListener('click', loadOnlineRecords);
  
  if (logoutButton) logoutButton.addEventListener('click', clearSession);

  if (dashboardRefresh) {
    dashboardRefresh.addEventListener('click', loadOnlineRecords);
  }

  window.addEventListener('online', () => {
    setOnlineStatus('Conexion restablecida. Intentando sincronizar registros pendientes...');
    syncPendingRecords();
    loadOnlineRecords();
  });

  window.addEventListener('offline', () => {
    setOnlineStatus('Conexion perdida. Las planillas se guardaran localmente hasta reconexion.');
  });

  syncCodigoSelloConsecutivo();

  if (form?.elements.peaje) {
    form.elements.peaje.addEventListener('change', () => {
      applyPeajeDefaults();
      recalculate();
    });
  }

  if (auditFilterApply) auditFilterApply.addEventListener('click', applyAuditFilters);
  if (auditFilterClear) auditFilterClear.addEventListener('click', () => {
    if (auditSearch) auditSearch.value = '';
    if (auditFilterPeaje) auditFilterPeaje.value = '';
    if (auditFilterDateFrom) auditFilterDateFrom.value = '';
    if (auditFilterDateTo) auditFilterDateTo.value = '';
    applyAuditFilters();
  });
  if (printMonthlyAudit) printMonthlyAudit.addEventListener('click', printMonthlyAuditReport);
  if (exportJsonAudit) exportJsonAudit.addEventListener('click', exportAuditJson);
  if (exportCsvAudit) exportCsvAudit.addEventListener('click', exportAuditCsv);
  if (adminSaveUser) adminSaveUser.addEventListener('click', saveAdminUser);
  if (adminRefreshUsers) adminRefreshUsers.addEventListener('click', async () => {
    await loadAdminUsers();
    await loadAdminAlerts();
  });
  if (adminNotifyMissing) adminNotifyMissing.addEventListener('click', notifyAdminMissingPlanillas);
  if (alertsViewButton) alertsViewButton.addEventListener('click', () => switchView('alerts'));
  if (adminSendAlert) adminSendAlert.addEventListener('click', async () => {
    if (!isAdminUser()) {
      if (adminAlertStatus) adminAlertStatus.textContent = 'Solo el administrador general puede enviar alertas.';
      return;
    }

    const targetPeaje = (adminAlertPeaje?.value || '').trim();
    const message = (adminAlertMessage?.value || '').trim();
    const files = adminAlertImages ? Array.from(adminAlertImages.files) : [];

    if (!targetPeaje || !message) {
      if (adminAlertStatus) adminAlertStatus.textContent = 'Complete el peaje destino y el mensaje antes de enviar.';
      return;
    }

    try {
      if (adminAlertStatus) adminAlertStatus.textContent = 'Enviando alerta...';
      await sendAdminAlertOnline(targetPeaje, message, files);
      if (adminAlertStatus) adminAlertStatus.textContent = `Alerta enviada a ${targetPeaje}. Copia enviada a auditoría.`;
      if (adminAlertMessage) adminAlertMessage.value = '';
      if (adminAlertPeaje) adminAlertPeaje.value = '';
      if (adminAlertImages) adminAlertImages.value = '';
      await loadAdminAlerts();
    } catch (error) {
      if (adminAlertStatus) adminAlertStatus.textContent = `No fue posible enviar la alerta: ${error.message}`;
    }
  });
  if (adminUserSearch) adminUserSearch.addEventListener('input', () => {
    if (currentUser && isAdminUser()) {
      loadAdminUsers();
    }
  });
  if (adminPasswordCancel) adminPasswordCancel.addEventListener('click', closeChangePasswordModal);
  const selfChangePasswordButton = document.querySelector('#selfChangePasswordButton');
  if (selfChangePasswordButton) {
    selfChangePasswordButton.addEventListener('click', () => {
      if (!currentUser) return;
      openChangePasswordModal(currentUser.peaje, currentUser.nombre || currentUser.peaje);
    });
  }
  if (sendPasswordCodeButton) {
    sendPasswordCodeButton.addEventListener('click', async () => {
      if (!adminPasswordTarget) return;
      try {
        sendPasswordCodeButton.disabled = true;
        if (adminPasswordStatus) adminPasswordStatus.textContent = 'Enviando codigo de verificacion...';
        await requestPasswordCodeOnline(adminPasswordTarget);
        if (adminPasswordStatus) adminPasswordStatus.textContent = 'Codigo enviado al correo registrado del peaje. Revise la bandeja de entrada.';
        if (changePasswordCodeInput) changePasswordCodeInput.focus();
      } catch (error) {
        if (adminPasswordStatus) adminPasswordStatus.textContent = `No fue posible enviar el codigo: ${error.message}`;
      } finally {
        sendPasswordCodeButton.disabled = false;
      }
    });
  }
  if (adminPasswordSave) adminPasswordSave.addEventListener('click', async () => {
    const nextPassword = (adminPasswordInput?.value || '').trim();
    if (!nextPassword || !adminPasswordTarget) {
      if (adminPasswordStatus) adminPasswordStatus.textContent = 'Ingrese una nueva contraseña para continuar.';
      return;
    }
    const verificationCode = (changePasswordCodeInput?.value || '').trim();
    if (passwordChangeNeedsCode && !verificationCode) {
      if (adminPasswordStatus) adminPasswordStatus.textContent = 'Ingrese el codigo enviado al correo antes de continuar.';
      if (changePasswordCodeInput) changePasswordCodeInput.focus();
      return;
    }

    try {
      // disable controls while request is in flight
      adminPasswordSave.disabled = true;
      adminPasswordCancel.disabled = true;
      if (adminPasswordStatus) adminPasswordStatus.textContent = 'Cambiando contraseña...';

      const passwordResult = await changePasswordOnline(adminPasswordTarget, nextPassword);
      if (currentUser?.peaje === adminPasswordTarget) {
        closeChangePasswordModal();
        if (adminPasswordInput) adminPasswordInput.value = '';
        clearSession();
        return;
      }
      if (adminPasswordStatus) {
        adminPasswordStatus.textContent = passwordResult?.notificationError
          ? `Contraseña actualizada. No se pudo enviar la notificacion: ${passwordResult.notificationError}`
          : 'Contraseña actualizada correctamente. Notificacion enviada por correo.';
      }
      closeChangePasswordModal();
      if (adminPasswordInput) adminPasswordInput.value = '';
      await loadAdminUsers();
    } catch (error) {
      if (adminPasswordStatus) adminPasswordStatus.textContent = `No fue posible cambiar la clave: ${error.message}`;
    } finally {
      adminPasswordSave.disabled = false;
      adminPasswordCancel.disabled = false;
    }
  });

  // Agregar listeners para vista y navbar
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.addEventListener('click', () => switchView(button.dataset.view));
  });

  // Inicializar sesion
  const storedSession = getStoredSession();

  if (!storedSession || !storedSession.peaje || !storedSession.password) {
    window.location.href = 'login.html';
  } else {
    startSession(storedSession);
  }
});

async function reactivateUserOnline(user) {
  const payload = await requestPostJson(getScriptUrl(), {
    action: 'saveuser',
    peaje: currentUser.peaje,
    password: currentUser.password,
    user: JSON.stringify({
      peaje: user.peaje,
      nombre: user.nombre || user.peaje,
      activo: 'SI',
      rol: user.rol || 'PEAJE'
    })
  });

  if (!payload || !payload.ok) {
    throw new Error(payload && payload.error ? payload.error : 'No se pudo reactivar el usuario');
  }

  return payload.user;
}
