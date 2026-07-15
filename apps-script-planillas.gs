const SHEET_NAME = 'BASE DE DATOS PLANILLAS';
const USERS_SHEET_NAME = 'USUARIOS PLANILLAS';
const SPREADSHEET_NAME = 'BASE DE DATOS PLANILLAS';
const SPREADSHEET_ID_PROPERTY = 'PLANILLAS_SPREADSHEET_ID';
const SPREADSHEET_ID = '';

const USER_HEADERS = ['peaje', 'nombre', 'password', 'activo'];
const DEFAULT_USERS = [
  ['PEAJE ZARAGOZA', 'Peaje Zaragoza', 'zaragoza123', 'SI'],
  ['PEAJE FRAGUA', 'Peaje Fragua', 'fragua123', 'SI'],
  ['AUDITORIA DE OPERACIONES', 'Auditoría de la Jefa Beatriz', 'auditoria123', 'SI']
];

const HEADERS = [
  'id',
  'createdAt',
  'updatedAt',
  'fecha',
  'peaje',
  'centro',
  'moneda',
  'lugarEntrega',
  'responsableRecibe',
  'ciudad',
  'lugarRecibo',
  'codigoSello',
  'consecutivo',
  'efectivo',
  'observacionesEfectivo',
  'valorTula',
  'valorBilletes',
  'total',
  'valorLetras',
  'observacionesGenerales',
  'entregadoNombre',
  'entregadoFirma',
  'revisadoNombre',
  'revisadoFirma'
];

const PEAJE_EMAILS = {
  'PEAJE FRAGUA': 'peajefragua@zimaseguridad.com.co',
  'PEAJE ZARAGOZA': 'peajezaragoza@zimaseguridad.com.co'
};

function doGet(e) {
  const action = String((e.parameter.action || e.parameter.mode || 'list')).toLowerCase();
  const callback = e.parameter.callback;

  try {
    const sheet = getDatabaseSheet_();
    const usersSheet = getUsersSheet_();
    let payload;

    if (action === 'ping') {
      payload = { ok: true, sheet: SHEET_NAME, rows: Math.max(sheet.getLastRow() - 1, 0) };
    } else if (action === 'login') {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      payload = { ok: true, user: publicUser_(user) };
    } else if (action === 'save') {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      const record = parseRecordFromGet_(e);
      const skipEmail = e.parameter.skipEmail;
      payload = { ok: true, record: saveRecord_(sheet, record, user, skipEmail) };
    } else if (action === 'delete') {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      payload = { ok: true, deleted: deleteRecord_(sheet, e.parameter.id, user, e.parameter.reason) };
    } else {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      payload = { ok: true, records: readRecords_(sheet, user.peaje, user) };
    }

    return jsonResponse_(payload, callback);
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) }, callback);
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const record = body.record || body;
    const sheet = getDatabaseSheet_();
    const usersSheet = getUsersSheet_();

    if (String(body.action || '').toLowerCase() === 'emailcopy') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      sendRecordCopyEmail_(record, body.pdfBase64);
      return jsonResponse_({ ok: true });
    }

    const user = authenticateUser_(usersSheet, body.peaje, body.password);
    const saved = saveRecord_(sheet, record, user, body.skipEmail);

    return jsonResponse_({ ok: true, record: saved });
  } catch (error) {
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function getDatabaseSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function getUsersSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
  }

  ensureUserHeaders_(sheet);
  seedDefaultUsers_(sheet);
  return sheet;
}

function getSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredId = String(SPREADSHEET_ID || '').trim();

  if (configuredId) {
    properties.setProperty(SPREADSHEET_ID_PROPERTY, configuredId);
    return SpreadsheetApp.openById(configuredId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty(SPREADSHEET_ID_PROPERTY, active.getId());
    return active;
  }

  const savedId = properties.getProperty(SPREADSHEET_ID_PROPERTY);

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      properties.deleteProperty(SPREADSHEET_ID_PROPERTY);
    }
  }

  const files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    const spreadsheet = SpreadsheetApp.openById(files.next().getId());
    properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
    return spreadsheet;
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty(SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
  return spreadsheet;
}

function ensureHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeaders = HEADERS.some((header, index) => current[index] !== header);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
  }
}

function ensureUserHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, USER_HEADERS.length).getValues()[0];
  const needsHeaders = USER_HEADERS.some((header, index) => current[index] !== header);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, USER_HEADERS.length);
  }
}

function seedDefaultUsers_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    ensureDefaultUsers_(sheet);
    return;
  }

  sheet.getRange(2, 1, DEFAULT_USERS.length, USER_HEADERS.length).setValues(DEFAULT_USERS);
}

function ensureDefaultUsers_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const existingUsers = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => normalizeText_(row[0]));

  DEFAULT_USERS.forEach((defaultUser) => {
    const normalizedPeaje = normalizeText_(defaultUser[0]);
    if (!existingUsers.includes(normalizedPeaje)) {
      sheet.appendRow(defaultUser);
    }
  });
}

function authenticateUser_(sheet, peaje, password) {
  const normalizedPeaje = normalizeText_(peaje);
  const incomingPassword = String(password || '');
  const lastRow = sheet.getLastRow();

  if (!normalizedPeaje || !incomingPassword) {
    throw new Error('Debe iniciar sesion.');
  }

  if (lastRow < 2) {
    throw new Error('No hay usuarios configurados.');
  }

  const values = sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
  for (let index = 0; index < values.length; index += 1) {
    const row = values[index];
    const user = {
      peaje: String(row[0] || ''),
      nombre: String(row[1] || ''),
      password: String(row[2] || ''),
      activo: String(row[3] || '')
    };

    if (normalizeText_(user.peaje) === normalizedPeaje && normalizeText_(user.activo) !== 'NO') {
      if (user.password !== incomingPassword) {
        throw new Error('Clave incorrecta.');
      }

      return user;
    }
  }

  throw new Error('Usuario de peaje no encontrado.');
}

function isAuditUser_(user) {
  const peaje = normalizeText_(user && user.peaje);
  const nombre = normalizeText_(user && user.nombre);
  return peaje === 'AUDITORIA DE OPERACIONES' || nombre.includes('AUDITORIA');
}

function publicUser_(user) {
  return {
    peaje: user.peaje,
    nombre: user.nombre || user.peaje,
    isAuditoria: isAuditUser_(user)
  };
}

function normalizeText_(value) {
  return String(value || '').trim().toUpperCase();
}

function readRecords_(sheet, peaje, user) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const normalizedPeaje = normalizeText_(peaje);
  const isAudit = isAuditUser_(user);

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();

  return values
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const record = {};
      HEADERS.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    })
    .filter((record) => isAudit || normalizeText_(record.peaje) === normalizedPeaje)
    .reverse();
}

function saveRecord_(sheet, incoming, user, skipEmail = false) {
  const now = new Date().toISOString();
  const record = {};

  HEADERS.forEach((header) => {
    record[header] = incoming[header] == null ? '' : incoming[header];
  });

  record.id = record.id || Utilities.getUuid();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  const incomingPeaje = normalizeText_(incoming.peaje || '');
  record.peaje = isAuditUser_(user) && incomingPeaje ? incomingPeaje : user.peaje;

  const rowValues = HEADERS.map((header) => record[header]);
  const existingRow = findRowById_(sheet, record.id);

  if (existingRow) {
    const existingRecord = getRecordAtRow_(sheet, existingRow);
    if (!isAuditUser_(user) && normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
      throw new Error('No tiene permiso para modificar registros de otro peaje.');
    }

    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  const shouldSkipEmail = skipEmail === true || String(skipEmail).toLowerCase() === 'true';
  if (!shouldSkipEmail) {
    try {
      sendRecordCopyEmail_(record);
    } catch (error) {
      Logger.log('No se pudo enviar copia por correo de la planilla: %s', error.message || error);
    }
  }

  return record;
}

function getPeajeEmail_(peaje) {
  if (!peaje) return null;
  return PEAJE_EMAILS[normalizeText_(peaje)] || null;
}

function sendRecordCopyEmail_(record, pdfBase64) {
  const recipient = getPeajeEmail_(record.peaje);
  if (!recipient) {
    Logger.log('No se encontró correo para el peaje: %s', record.peaje);
    return;
  }

  let pdf;
  if (pdfBase64) {
    const cleanBase64 = String(pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
    const documentName = `Planilla_${record.peaje || 'SinPeaje'}_${record.codigoSello || 'SinCodigo'}_${record.fecha || today()}.pdf`;
    pdf = Utilities.newBlob(Utilities.base64Decode(cleanBase64), MimeType.PDF, documentName);
  } else {
    pdf = buildRecordPdf_(record);
  }

  const subject = `Copia Planilla Transbank - ${record.peaje || 'Sin Peaje'} ${record.codigoSello || ''}`.trim();
  const body = [
    'Adjunto encontrarás una copia en PDF de la planilla.',
    '',
    `Peaje: ${record.peaje || 'No definido'}`,
    `Fecha: ${record.fecha || 'No definida'}`,
    `Código/Sello: ${record.codigoSello || 'No definido'}`,
    `Centro: ${record.centro || 'No definido'}`,
    `Responsable recibe: ${record.responsableRecibe || 'No definido'}`,
    `Total entregado: ${record.total || 0}`,
    '',
    'Este correo se envía automáticamente como copia de la planilla registrada en el sistema.'
  ].join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject,
    body,
    attachments: [pdf]
  });
}

function sendCancellationEmail_(record, reason, user) {
  const recipient = getPeajeEmail_(record.peaje);
  if (!recipient) {
    Logger.log('No se encontró correo para notificar anulación del peaje: %s', record.peaje);
    return;
  }

  const subject = `Anulación Planilla Transbank - ${record.peaje || 'Sin Peaje'} ${record.codigoSello || ''}`.trim();
  const body = [
    'Se anuló una transacción registrada en el sistema de planillas ZIMA.',
    '',
    `Peaje: ${record.peaje || 'No definido'}`,
    `Fecha: ${record.fecha || 'No definida'}`,
    `Código/Sello: ${record.codigoSello || 'No definido'}`,
    `Centro: ${record.centro || 'No definido'}`,
    `Responsable recibe: ${record.responsableRecibe || 'No definido'}`,
    `Total entregado: ${formatMoney_(record.total || record.efectivo || 0, record.moneda)}`,
    '',
    `Anulado por: ${(user && user.nombre) || (user && user.peaje) || 'Usuario del sistema'}`,
    `Fecha de anulación: ${new Date().toLocaleString('es-CO')}`,
    '',
    'Razón de anulación:',
    String(reason || 'No informada'),
    '',
    'Este correo se envía automáticamente como constancia de la anulación.'
  ].join('\n');

  MailApp.sendEmail({
    to: recipient,
    subject,
    body
  });
}

function formatMoney_(value, currency) {
  if (value == null || value === '') return '';
  const numberValue = Number(String(value).replace(/[^0-9\-\.]/g, ''));
  if (Number.isNaN(numberValue)) return String(value);

  const currencyCode = String(currency || 'COP').trim().toUpperCase();
  const options = {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  };

  try {
    return numberValue.toLocaleString('es-CO', options);
  } catch (error) {
    return `${currencyCode} ${numberValue.toFixed(0)}`;
  }
}

function buildRecordPdf_(record) {
  const documentName = `Planilla_${record.peaje || 'SinPeaje'}_${record.codigoSello || 'SinCodigo'}_${record.fecha || today()}`;
  const field = (value) => String(value || '');
  const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const formattedEfectivo = formatMoney_(record.efectivo, record.moneda);
  const formattedValorTula = formatMoney_(record.valorTula, record.moneda);
  const formattedValorBilletes = formatMoney_(record.valorBilletes, record.moneda);
  const formattedTotal = formatMoney_(record.total, record.moneda);

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(documentName)}</title>
  <style>
    body { margin: 0; padding: 24px; font-family: Arial, Helvetica, sans-serif; color: #1f2937; background: #f3f6fb; }
    .paper { max-width: 900px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; }
    .paper-header { display: grid; grid-template-columns: 132px minmax(0, 1fr) 145px; gap: 0; align-items: stretch; padding: 0; border-bottom: 2px solid #0f172a; background: #ffffff; }
    .logo-box { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 98px; place-items: center; padding: 10px; border-right: 1px solid #cbd5e1; background: #ffffff; text-align: center; }
    .logo-box img { display: block; width: 100%; max-width: 126px; max-height: 68px; object-fit: contain; }
    .logo-box span { display: none; color: #2d2a49; font-size: 28px; font-weight: 800; line-height: 1; overflow-wrap: anywhere; }
    .logo-box small { font-size: 9px; font-weight: 700; letter-spacing: 0; }
    .document-title { display: grid; align-content: center; justify-items: center; padding: 14px 18px; border-right: 1px solid #cbd5e1; background: linear-gradient(180deg, #ffffff, #f6f9fc); }
    .document-title p { max-width: 520px; margin: 0 0 6px; color: #0f172a; font-size: 17px; font-weight: 800; line-height: 1.25; text-align: center; overflow-wrap: anywhere; }
    .document-title span { color: #475569; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .document-code { display: grid; gap: 5px; width: 100%; align-self: end; padding-top: 10px; border-top: 1px solid #cbd5e1; }
    .document-code label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; }
    .document-code div { font-size: 12px; font-weight: 700; color: #0f172a; }
    .section-title { padding: 7px 14px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; background: #edf2f7; color: #263246; font-size: 12px; font-weight: 800; letter-spacing: 0; text-transform: uppercase; }
    .field-grid { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    .field-grid td { padding: 10px 14px; vertical-align: top; border: 1px solid #cbd5e1; font-size: 12px; line-height: 1.4; }
    .field-grid td.label { width: 28%; background: #f2f4f7; font-weight: 700; text-transform: uppercase; color: #334155; }
    .field-grid td.value { color: #0f172a; }
    .signatures { width: 100%; border-collapse: collapse; margin-top: 24px; }
    .signatures td { width: 50%; padding: 14px 10px; border: 1px solid #cbd5e1; min-height: 64px; font-size: 12px; }
    .signatures strong { display: block; margin-bottom: 8px; }
    .footer { margin: 24px 14px 18px; font-size: 10px; color: #475569; }
  </style>
</head>
<body>
  <div class="paper">
    <div class="paper-header">
      <div class="logo-box">
        <img src="https://via.placeholder.com/126x68?text=ZIMA" alt="Logo ZIMA">
        <span>ZIMA<br><small>SEGURIDAD LTDA</small></span>
      </div>
      <div class="document-title">
        <p>MANEJO DE DINEROS ENTREGADOS A TRANSBANK</p>
        <span>Planilla general de control</span>
      </div>
      <div class="logo-box document-code">
        <label>Código/Sello</label>
        <div>${escapeHtml(field(record.codigoSello))}</div>
      </div>
    </div>
    <div class="section-title">Datos generales</div>
    <table class="field-grid">
      <tr><td class="label">Peaje</td><td class="value">${escapeHtml(field(record.peaje))}</td></tr>
      <tr><td class="label">Centro o razón social</td><td class="value">${escapeHtml(field(record.centro))}</td></tr>
      <tr><td class="label">Tipo moneda</td><td class="value">${escapeHtml(field(record.moneda))}</td></tr>
      <tr><td class="label">Lugar de entrega</td><td class="value">${escapeHtml(field(record.lugarEntrega))}</td></tr>
      <tr><td class="label">Responsable recibe Transbank</td><td class="value">${escapeHtml(field(record.responsableRecibe))}</td></tr>
      <tr><td class="label">Ciudad</td><td class="value">${escapeHtml(field(record.ciudad))}</td></tr>
      <tr><td class="label">Lugar de recibo</td><td class="value">${escapeHtml(field(record.lugarRecibo))}</td></tr>
      <tr><td class="label">Fecha</td><td class="value">${escapeHtml(field(record.fecha))}</td></tr>
      <tr><td class="label">Consecutivo</td><td class="value">${escapeHtml(field(record.consecutivo))}</td></tr>
    </table>
    <div class="section-title">Valores entregados</div>
    <table class="field-grid">
      <tr><td class="label">Efectivo</td><td class="value">${escapeHtml(formattedEfectivo)}</td></tr>
      <tr><td class="label">Observaciones efectivo</td><td class="value">${escapeHtml(field(record.observacionesEfectivo))}</td></tr>
      <tr><td class="label">Valor declarado en tula y/o bolsa</td><td class="value">${escapeHtml(formattedValorTula)}</td></tr>
      <tr><td class="label">Valor declarado billetes</td><td class="value">${escapeHtml(formattedValorBilletes)}</td></tr>
      <tr><td class="label">Total entregado</td><td class="value">${escapeHtml(formattedTotal)}</td></tr>
      <tr><td class="label">Valor en letras</td><td class="value">${escapeHtml(field(record.valorLetras))}</td></tr>
      <tr><td class="label">Observaciones generales</td><td class="value">${escapeHtml(field(record.observacionesGenerales))}</td></tr>
    </table>
    <div class="section-title">Firmas</div>
    <table class="signatures">
      <tr>
        <td><strong>Entregado por</strong>${escapeHtml(field(record.entregadoNombre))}<br>${escapeHtml(field(record.entregadoFirma))}</td>
        <td><strong>Revisado por</strong>${escapeHtml(field(record.revisadoNombre))}<br>${escapeHtml(field(record.revisadoFirma))}</td>
      </tr>
    </table>
    <div class="footer">Documento generado automáticamente por el sistema de planillas ZIMA.</div>
  </div>
</body>
</html>`;

  const htmlBlob = Utilities.newBlob(html, 'text/html', `${documentName}.html`);
  const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(`${documentName}.pdf`);
  return pdfBlob;
}

function deleteRecord_(sheet, id, user, reason) {
  const existingRow = findRowById_(sheet, id);
  if (!existingRow) return false;
  const existingRecord = getRecordAtRow_(sheet, existingRow);
  const cancellationReason = String(reason || '').trim();

  if (cancellationReason.length < 6) {
    throw new Error('Debe indicar una razón de anulación.');
  }

  if (!isAuditUser_(user) && normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
    throw new Error('No tiene permiso para eliminar registros de otro peaje.');
  }

  sendCancellationEmail_(existingRecord, cancellationReason, user);
  sheet.deleteRow(existingRow);
  return true;
}

function getRecordAtRow_(sheet, rowNumber) {
  const values = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getValues()[0];
  const record = {};

  HEADERS.forEach((header, index) => {
    record[header] = values[index];
  });

  return record;
}

function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (!id || lastRow < 2) return null;

  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index += 1) {
    if (String(ids[index][0]) === String(id)) {
      return index + 2;
    }
  }

  return null;
}

function parseBody_(e) {
  if (!e) return {};

  const parseJsonField = (value) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  };

  if (e.postData && e.postData.contents) {
    const text = e.postData.contents;
    try {
      return JSON.parse(text);
    } catch (error) {
      const data = {};
      text.split('&').forEach((pair) => {
        const parts = pair.split('=');
        const key = decodeURIComponent(parts[0] || '');
        const value = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
        if (key) data[key] = value;
      });
      Object.keys(data).forEach((key) => { data[key] = parseJsonField(data[key]); });
      return data;
    }
  }

  if (e.parameter) {
    const data = {};
    Object.keys(e.parameter).forEach((key) => {
      const value = e.parameter[key];
      data[key] = Array.isArray(value) ? value[0] : value;
    });
    Object.keys(data).forEach((key) => { data[key] = parseJsonField(data[key]); });
    return data;
  }

  return {};
}

function parseRecordFromGet_(e) {
  const raw = e.parameter.record || '{}';

  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function jsonResponse_(payload, callback) {
  const json = JSON.stringify(payload);
  const output = callback
    ? ContentService.createTextOutput(`${callback}(${json});`)
    : ContentService.createTextOutput(json);

  return output.setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
