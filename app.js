const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzw3ZUEioJjxv8FHfTD0VDrsMtdBwIG-OLLukQ9mBffZzKWw73nf910QoMp7KgoUkffsQ/exec';
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
let pdfModal;
let pdfIframe;
let closePdfModal;
let clearFormButton;
let welcomeModalOverlay;
let welcomeModalCloseButton;
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
let homeWelcome;
let homePeaje;
let homeTotalRecords;
let homeTotalAmount;
let homeLastRecord;
let homeWeekRecords;
let toolbarEyebrow;
let toolbarTitle;
let formToolbarActions;

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

  // Si es un Date válido
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return dateKeyFromDate(value);
  }

  const text = String(value).trim();
  
  // Formato ISO: YYYY-MM-DD...
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Formato DD/MM/YYYY (común en América Latina)
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

function getLatestRecordDateKey(records) {
  return records
    .map((record) => recordDateKey(record.fecha))
    .filter(Boolean)
    .sort()
    .at(-1) || today();
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
    console.warn(`Múltiples registros coinciden con la identidad ${key}:`, matches.map(r => r.id));
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
    margin: [6, 6, 6, 6],
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

  const codigoSelloValue = record.codigoSello || '';
  const consecutivoField = form.elements.consecutivo;
  if (consecutivoField && !consecutivoField.value && codigoSelloValue) {
    consecutivoField.value = codigoSelloValue;
  }

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
          Razón de anulación
          <textarea rows="4" maxlength="500" placeholder="Explique brevemente por qué se anula esta transacción"></textarea>
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
      if (reason.length < 6) {
        error.textContent = 'Ingrese una razón clara antes de anular.';
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

async function showPdfPreview(record) {
  const element = document.querySelector('.paper');
  if (!element || !pdfModal || !pdfIframe) return;

  fillForm(record);
  switchView('form');
  await new Promise((resolve) => setTimeout(resolve, 250));

  const pdfBlob = await withPdfExportMode(element, async () => {
    const worker = html2pdf().set(pdfOptions()).from(element);
    return worker.outputPdf('blob');
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

function getUnsyncedLocalRecords() {
  const localRecords = getLocalRecords();
  const onlineIds = new Set(getRecords().map(r => r.id));
  return localRecords.filter(r => !onlineIds.has(r.id));
}

function hasUnsyncedRecords() {
  return getUnsyncedLocalRecords().length > 0;
}

async function showUnsyncedWarning() {
  const unsynced = getUnsyncedLocalRecords();
  if (unsynced.length === 0) return false;

  const count = unsynced.length;
  const detail = unsynced.slice(0, 3).map(r => 
    `${formatDate(r.fecha)} - ${r.codigoSello || 'sin código'}: $${onlyDigits(r.total)}`
  ).join('\n');
  
  const moreText = count > 3 ? `\n...y ${count - 3} más` : '';

  const result = await showConfirmationDialog({
    title: 'Registro pendiente de sincronización',
    message: `Hay ${count} planilla(s) guardada(s) localmente que no se sincronizó(sincronizaron) con la base online:\n\n${detail}${moreText}\n\n¿Desea recuperarla(s) y reintentar?`,
    confirmText: 'Recuperar y reintentar',
    cancelText: 'Descartar',
    danger: true
  });

  if (!result) {
    const localRecords = getLocalRecords();
    const toKeep = localRecords.filter(r => !unsynced.find(u => u.id === r.id));
    persistLocalRecords(toKeep);
    setOnlineStatus('Registros pendientes descartados.');
    return false;
  }

  // Intentar sincronizar
  setOnlineStatus('Reintentando sincronizar registros pendientes...');
  let successCount = 0;
  let failCount = 0;

  for (const record of unsynced) {
    try {
      await saveRecordOnline(record, true);
      successCount++;
    } catch (error) {
      console.warn('No se pudo sincronizar:', record.id, error);
      failCount++;
    }
  }

  if (successCount > 0) {
    await loadOnlineRecords();
    setOnlineStatus(`${successCount} planilla(s) sincronizada(s) correctamente.`);
  }
  if (failCount > 0) {
    setOnlineStatus(`Se sincronizaron ${successCount}. No se pudo sincronizar ${failCount} planilla(s). Reintente más tarde.`);
  }

  return successCount > 0;
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

async function saveRecord(options = {}) {
  const { clearAfterSave = true } = options;

  if (!currentUser) {
    setOnlineStatus('Debe iniciar sesión.');
    return null;
  }

  // Verificar si hay registros pendientes sin sincronizar
  if (hasUnsyncedRecords()) {
    const recovered = await showUnsyncedWarning();
    if (!recovered) {
      // El usuario decidió descartar, continúa normalmente
      return null;
    }
    // El usuario intentó recuperar, bloquea nueva entrada
    setOnlineStatus('Primero resuelva los registros pendientes.');
    return null;
  }

  if (!form.reportValidity()) return null;
  const data = formData();
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
    const saved = await saveRecordOnline(record, true);
    const records = getRecords();
    const index = records.findIndex((item) => item.id === saved.id);

    if (index >= 0) records[index] = saved;
    else records.unshift(saved);

    activeRecordId = saved.id;
    setRecords(records);
    currentStatus.textContent = 'Guardado';
    updateSaveButtonLabel();

    hideLoading();

    const sendCopy = await showConfirmationDialog({
      title: 'Enviar copia por correo',
      message: 'La planilla ya fue guardada. ¿Desea enviar una copia en PDF por correo?',
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
        setOnlineStatus(`Planilla guardada. No se pudo enviar la copia por correo automáticamente: ${emailError.message}`);
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
      setOnlineStatus('Planilla guardada. No se envió copia por correo.');
    }
    if (clearAfterSave) {
      setTimeout(() => {
        clearForm();
        if (currentStatus.textContent === 'Guardado') {
          setOnlineStatus('Planilla guardada con éxito. El formulario quedó listo para registrar una nueva entrega.');
        }
      }, 1000);
    }

    
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

  const saved = await saveRecord({ clearAfterSave: false });

  if (!saved) {
    printButton.textContent = originalText;
    printButton.disabled = false;
    if (saveButton) saveButton.disabled = false;
    setOnlineStatus('Impresión detenida. Primero debe guardarse correctamente el registro.');
    return;
  }

  printButton.textContent = 'Imprimiendo...';
  setOnlineStatus('Registro guardado. Generando vista previa del PDF...');

  try {
    await showPdfPreview(saved);
    setOnlineStatus('Revise la vista previa del PDF. Luego imprima desde el visor o use Ctrl+P.');
  } catch (error) {
    console.warn('No se pudo generar la vista previa del PDF:', error);
    setOnlineStatus(`No se pudo mostrar la vista previa del PDF: ${error.message}. Abriendo impresión normal.`);
    window.print();
  }

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

  fillForm(record);
  switchView('form');

  setTimeout(async () => {
    await withPdfExportMode(element, () => html2pdf().set(pdfOptions(filename)).from(element).save());
    setOnlineStatus(`PDF descargado: ${filename}`);
  }, 300);
}

async function deleteRecord(id) {
  const reason = await showReasonDialog({
    title: 'Anular registro',
    message: 'Esta acción anulará el registro, actualizará la base online y notificará por correo la razón.',
    confirmText: 'Anular registro',
    cancelText: 'Conservar'
  });
  if (!reason) return;

  try {
    await deleteRecordOnline(id, reason);
    const records = getRecords().filter((item) => item.id !== id);
    if (activeRecordId === id) clearForm();
    setRecords(records);
    setOnlineStatus('Registro anulado correctamente. Se notificó la anulación por correo.');
  } catch (error) {
    setOnlineStatus(`No fue posible anular el registro. Detalle: ${error.message}`);
  }
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === `${viewName}View`));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === viewName));
  updateToolbar(viewName);
}

function updateHome() {
  if (!homeWelcome || !homePeaje || !homeTotalRecords || !homeTotalAmount || !homeLastRecord || !homeWeekRecords) {
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

  homeWelcome.textContent = `Bienvenido, ${userName}`;
  homePeaje.textContent = `Sesion activa para ${peajeName}. Desde aqui puedes crear planillas, consultar registros y mantener el control diario.`;
  homeTotalRecords.textContent = records.length;
  homeTotalAmount.textContent = formatMoney(totalAmount);
  homeLastRecord.textContent = latest ? formatDate(latest.fecha) : 'Sin datos';
  homeWeekRecords.textContent = weekRecords;
}

function updateToolbar(viewName) {
  const labels = {
    home: ['Formato digital', 'Entrega de efectivo a Transbank'],
    form: ['Formato digital', 'Entrega de efectivo a Transbank'],
    records: ['Historial online', 'Registros guardados'],
    audit: ['Control y analisis', 'Panel de auditoria']
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

async function startSession(user) {
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
  updateHome();
  updateDashboard();
  switchView('home');
  showWelcomeModal();
  
  const localRecords = getLocalRecords();
  if (localRecords.length) {
    setRecords(localRecords);
    // Mostrar alerta si hay registros pendientes
    if (hasUnsyncedRecords()) {
      setTimeout(() => showUnsyncedWarning(), 500);
    }
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

async function saveRecordOnline(record, skipEmail = true) {
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
      skipEmail: skipEmail ? 'true' : 'false',
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

async function sendRecordCopyEmailOnline(record) {
  if (!currentUser) throw new Error('Debe iniciar sesión');
  const url = getScriptUrl();
  if (!url) throw new Error('Falta URL online');

  setOnlineStatus('Generando PDF exacto para envío de copia por correo...');

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
      'Content-Type': 'application/json'
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
    throw new Error(payload && payload.error ? payload.error : 'Respuesta inválida del servicio de correo.');
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
  if (!currentUser) throw new Error('Debe iniciar sesión');

  setOnlineStatus('Anulando el registro en la base online y enviando notificación...');

  const payload = await requestJsonp(url, {
    action: 'delete',
    peaje: currentUser.peaje,
    password: currentUser.password,
    id,
    reason
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
      
      // Debug: log todas las fechas recibidas
      const fechasByDay = {};
      onlineRecords.forEach(r => {
        const dayKey = recordDateKey(r.fecha);
        if (!fechasByDay[dayKey]) fechasByDay[dayKey] = [];
        fechasByDay[dayKey].push(r.id || 'sin-id');
      });
      console.log('Registros cargados por día:', fechasByDay);
      console.log('Total de fechas únicas:', Object.keys(fechasByDay).length);
      console.log('Total de registros:', onlineRecords.length);
      
      setRecords(onlineRecords);
      setOnlineStatus(`Consulta completada. Se encontraron ${onlineRecords.length} registros online.`);
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
  pdfModal = document.querySelector('#pdfModal');
  pdfIframe = document.querySelector('#pdfIframe');
  closePdfModal = document.querySelector('#closePdfModal');
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
  clearFormButton = document.querySelector('#clearFormButton');
  auditTotalRecords = document.querySelector('#auditTotalRecords');
  auditTotalAmount = document.querySelector('#auditTotalAmount');
  auditByPeaje = document.querySelector('#auditByPeaje');
  exportCsvAudit = document.querySelector('#exportCsvAudit');
  exportJsonAudit = document.querySelector('#exportJsonAudit');
  loadingOverlay = document.querySelector('#loadingOverlay');
  homeWelcome = document.querySelector('#homeWelcome');
  homePeaje = document.querySelector('#homePeaje');
  homeTotalRecords = document.querySelector('#homeTotalRecords');
  homeTotalAmount = document.querySelector('#homeTotalAmount');
  homeLastRecord = document.querySelector('#homeLastRecord');
  homeWeekRecords = document.querySelector('#homeWeekRecords');
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
  
  const syncOnlineBtn = document.querySelector('#syncOnline');
  if (syncOnlineBtn) syncOnlineBtn.addEventListener('click', loadOnlineRecords);
  
  if (logoutButton) logoutButton.addEventListener('click', clearSession);

  if (dashboardRefresh) {
    dashboardRefresh.addEventListener('click', loadOnlineRecords);
  }

  syncCodigoSelloConsecutivo();

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
