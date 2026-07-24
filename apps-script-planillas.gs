const SHEET_NAME = 'BASE DE DATOS PLANILLAS';
const USERS_SHEET_NAME = 'USUARIOS PLANILLAS';
const ALERTS_SHEET_NAME = 'ALERTAS PLANILLAS';
const SPREADSHEET_NAME = 'BASE DE DATOS PLANILLAS';
const SPREADSHEET_ID_PROPERTY = 'PLANILLAS_SPREADSHEET_ID';
const SPREADSHEET_ID = '';

const USER_HEADERS = ['peaje', 'nombre', 'password', 'activo', 'rol'];
const ALERT_HEADERS = ['id', 'createdAt', 'sentAt', 'sentBy', 'targetPeaje', 'message', 'attachmentNames', 'recipients'];
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
const SUPPORT_EMAIL = 'sistemaplanillaszima@gmail.com';
const AUDITORA_EMAIL = 'c.recaudo3@zimaseguridad.com.co';

function doGet(e) {
  const event = e || {};
  const params = event.parameter || {};
  const action = String((params.action || params.mode || 'list')).toLowerCase();
  const callback = params.callback;

  try {
    const sheet = getDatabaseSheet_();
    const usersSheet = getUsersSheet_();
    let payload;

    if (action === 'ping') {
      payload = { ok: true, sheet: SHEET_NAME, rows: Math.max(sheet.getLastRow() - 1, 0) };
    } else if (action === 'login') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, user: publicUser_(user) };
    } else if (action === 'save') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      const record = parseRecordFromGet_(event);
      const skipEmail = params.skipEmail;
      payload = { ok: true, record: saveRecord_(sheet, record, user, skipEmail) };
    } else if (action === 'notifymissing') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, missing: notifyMissingPlanillas_(sheet, user, params) };
    } else if (action === 'sendalert') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, alert: sendAlertToPeaje_(params.targetPeaje, params.message, user, parseAttachments_(params.attachments)) };
    } else if (action === 'alerts') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, alerts: listAlerts_(user) };
    } else if (action === 'users') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, users: listUsers_(usersSheet, user) };
    } else if (action === 'saveuser') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, user: saveUser_(usersSheet, params, user) };
    } else if (action === 'changepassword') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, user: changePassword_(usersSheet, params.targetPeaje || params.userPeaje, params.passwordValue || params.newPassword, user) };
    } else if (action === 'deleteuser') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, user: disableUser_(usersSheet, params.targetPeaje || params.userPeaje, user) };
    } else if (action === 'delete') {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
      payload = { ok: true, deleted: deleteRecord_(sheet, params.id, user, params.reason) };
    } else {
      const user = authenticateUser_(usersSheet, params.peaje, params.password);
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

    const action = String(body.action || '').toLowerCase();

    if (action === 'emailcopy') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      sendRecordCopyEmail_(record, body.pdfBase64);
      return jsonResponse_({ ok: true });
    }

    if (action === 'notifymissing') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      const missing = notifyMissingPlanillas_(sheet, user, body);
      return jsonResponse_({ ok: true, missing });
    }

    if (action === 'users') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      return jsonResponse_({ ok: true, users: listUsers_(usersSheet, user) });
    }

    if (action === 'saveuser') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      return jsonResponse_({ ok: true, user: saveUser_(usersSheet, body.user || body, user) });
    }

    if (action === 'changepassword') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      return jsonResponse_({ ok: true, user: changePassword_(usersSheet, body.targetPeaje || body.userPeaje, body.passwordValue || body.newPassword, user) });
    }

    if (action === 'deleteuser') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      return jsonResponse_({ ok: true, user: disableUser_(usersSheet, body.targetPeaje || body.userPeaje, user) });
    }

    if (action === 'sendalert') {
      const user = authenticateUser_(usersSheet, body.peaje, body.password);
      return jsonResponse_({ ok: true, alert: sendAlertToPeaje_(body.targetPeaje, body.message, user, parseAttachments_(body.attachments)) });
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

function getAlertsSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(ALERTS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ALERTS_SHEET_NAME);
  }

  ensureAlertHeaders_(sheet);
  return sheet;
}

function getUsersSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(USERS_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(USERS_SHEET_NAME);
  }

  ensureUserHeaders_(sheet);
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

  throw new Error(
    `No se encontró el spreadsheet '${SPREADSHEET_NAME}'. Configure el ID en SPREADSHEET_ID o establezca la propiedad de script '${SPREADSHEET_ID_PROPERTY}'.`
  );
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

function ensureAlertHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, ALERT_HEADERS.length).getValues()[0];
  const needsHeaders = ALERT_HEADERS.some((header, index) => current[index] !== header);

  if (needsHeaders) {
    sheet.getRange(1, 1, 1, ALERT_HEADERS.length).setValues([ALERT_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, ALERT_HEADERS.length);
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

function authenticateUser_(sheet, peaje, password) {
  const normalizedPeaje = normalizeText_(peaje);
  const incomingPassword = String(password || '');

  if (!normalizedPeaje || !incomingPassword) {
    throw new Error('Debe iniciar sesion.');
  }

  const lastRow = sheet.getLastRow();
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
      activo: String(row[3] || ''),
      rol: String(row[4] || '')
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
  const rol = normalizeText_(user && user.rol);
  return peaje === 'AUDITORIA DE OPERACIONES' || nombre.includes('AUDITORIA') || rol === 'AUDITORIA';
}

function isAdminUser_(user) {
  const peaje = normalizeText_(user && user.peaje);
  const nombre = normalizeText_(user && user.nombre);
  const rol = normalizeText_(user && user.rol);
  return rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'SOPORTE' || peaje.includes('ADMIN') || nombre.includes('ADMIN') || peaje.includes('SOPORTE') || nombre.includes('SOPORTE');
}

function canAuditRecords_(user) {
  return isAuditUser_(user) || isAdminUser_(user);
}

function publicUser_(user) {
  return {
    peaje: user.peaje,
    nombre: user.nombre || user.peaje,
    isAuditoria: isAuditUser_(user),
    isAdmin: isAdminUser_(user),
    rol: inferRole_(user),
    role: inferRole_(user)
  };
}

function inferRole_(user) {
  const rol = normalizeText_(user && user.rol);
  if (rol === 'ADMIN' || rol === 'ADMINISTRADOR' || rol === 'SOPORTE') return 'ADMIN';
  if (rol === 'AUDITORIA') return 'AUDITORIA';
  return 'PEAJE';
}

function listUsers_(sheet, user) {
  if (!isAdminUser_(user)) {
    throw new Error('Solo el administrador general puede gestionar usuarios.');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, USER_HEADERS.length).getValues();
  return values
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => ({
      peaje: String(row[0] || ''),
      nombre: String(row[1] || ''),
      activo: String(row[3] || ''),
      rol: String(row[4] || '')
    }))
    .filter((candidate) => candidate.peaje);
}

function saveUser_(sheet, incoming, user) {
  if (!isAdminUser_(user)) {
    throw new Error('Solo el administrador general puede gestionar usuarios.');
  }

  const payload = incoming && incoming.user ? incoming.user : incoming;
  const peaje = String(payload && payload.peaje ? payload.peaje : '').trim();
  const nombre = String(payload && payload.nombre ? payload.nombre : '').trim();
  const nuevoPassword = String(payload && payload.password ? payload.password : '').trim();
  const activo = String(payload && payload.activo ? payload.activo : 'SI').trim().toUpperCase();
  const rol = normalizeRole_(payload && payload.rol ? payload.rol : payload && payload.role ? payload.role : 'PEAJE');

  if (!peaje || !nombre) {
    throw new Error('Debe indicar el peaje y el nombre del usuario.');
  }

  const existingRow = findUserRowByPeaje_(sheet, peaje);
  const existingUser = existingRow ? readUserAtRow_(sheet, existingRow) : null;
  const passwordValue = nuevoPassword || String(existingUser && existingUser.password ? existingUser.password : '');
  const values = [peaje, nombre, passwordValue, activo, rol];

  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, USER_HEADERS.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return { peaje, nombre, activo, rol };
}

function changePassword_(sheet, targetPeaje, newPassword, user) {
  // Allow admins, soporte users, or users changing their own password
  const normalizedUserPeaje = normalizeText_(user && user.peaje);
  const isSupport = normalizedUserPeaje && normalizedUserPeaje.includes('SOPORTE');
  const isAdminOrSupport = isAdminUser_(user) || isSupport;

  const normalizedTarget = String(targetPeaje || normalizedUserPeaje || '').trim();
  const passwordValue = String(newPassword || '').trim();

  Logger.log('changePassword_ request by=%s target=%s isAdminOrSupport=%s', normalizedUserPeaje, normalizedTarget, String(isAdminOrSupport));

  if (!normalizedTarget || !passwordValue) {
    throw new Error('Debe indicar el usuario y la nueva clave.');
  }

  // Only admin/support can change other users' passwords; others can change their own
  if (!isAdminOrSupport && normalizeText_(normalizedTarget) !== normalizedUserPeaje) {
    Logger.log('changePassword_ permission denied caller=%s target=%s', normalizedUserPeaje, normalizedTarget);
    throw new Error('No tiene permisos para cambiar la clave de otro usuario.');
  }

  const existingRow = findUserRowByPeaje_(sheet, normalizedTarget);
  if (!existingRow) {
    Logger.log('changePassword_ user not found target=%s', normalizedTarget);
    throw new Error('No existe el usuario indicado.');
  }

  Logger.log('changePassword_ changing password for %s at row %s (newLength=%s)', normalizedTarget, existingRow, String((passwordValue || '').length));
  sheet.getRange(existingRow, 3, 1, 1).setValue(passwordValue);
  Logger.log('changePassword_ saved password for %s', normalizedTarget);
  return { peaje: normalizedTarget, passwordChanged: true };
}

function disableUser_(sheet, targetPeaje, user) {
  if (!isAdminUser_(user)) {
    throw new Error('Solo el administrador general puede desactivar usuarios.');
  }

  const normalizedTarget = String(targetPeaje || '').trim();
  if (!normalizedTarget) {
    throw new Error('Debe indicar el usuario.');
  }

  const existingRow = findUserRowByPeaje_(sheet, normalizedTarget);
  if (!existingRow) {
    throw new Error('No existe el usuario indicado.');
  }

  sheet.getRange(existingRow, 4, 1, 1).setValue('NO');
  return { peaje: normalizedTarget, activo: 'NO' };
}

function normalizeRole_(role) {
  const normalized = normalizeText_(role);
  if (normalized === 'ADMIN' || normalized === 'ADMINISTRADOR' || normalized === 'SOPORTE' || normalized === 'ADMINISTRADOR GENERAL') return 'ADMIN';
  if (normalized === 'AUDITORIA') return 'AUDITORIA';
  return 'PEAJE';
}

function findUserRowByPeaje_(sheet, peaje) {
  const lastRow = sheet.getLastRow();
  if (!peaje || lastRow < 2) return null;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (normalizeText_(values[index][0]) === normalizeText_(peaje)) {
      return index + 2;
    }
  }

  return null;
}

function readUserAtRow_(sheet, rowNumber) {
  const values = sheet.getRange(rowNumber, 1, 1, USER_HEADERS.length).getValues()[0];
  return {
    peaje: String(values[0] || ''),
    nombre: String(values[1] || ''),
    password: String(values[2] || ''),
    activo: String(values[3] || ''),
    rol: String(values[4] || '')
  };
}

function normalizeText_(value) {
  return String(value || '').trim().toUpperCase();
}

function readRecords_(sheet, peaje, user) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const normalizedPeaje = normalizeText_(peaje);
  const canAudit = canAuditRecords_(user);

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
    .filter((record) => canAudit || normalizeText_(record.peaje) === normalizedPeaje)
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
  record.peaje = canAuditRecords_(user) && incomingPeaje ? incomingPeaje : user.peaje;

  const rowValues = HEADERS.map((header) => record[header]);
  const existingRow = findRowById_(sheet, record.id);

  if (existingRow) {
    const existingRecord = getRecordAtRow_(sheet, existingRow);
    if (!canAuditRecords_(user) && normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
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

function getNotificationRecipients_(peaje) {
  const recipients = [];
  const peajeEmail = getPeajeEmail_(peaje);
  if (peajeEmail) recipients.push(peajeEmail);
  if (SUPPORT_EMAIL) recipients.push(SUPPORT_EMAIL);
  if (AUDITORA_EMAIL) recipients.push(AUDITORA_EMAIL);

  return recipients.filter((email, index, list) => email && list.indexOf(email) === index);
}

function sendEmailToRecipients_(recipients, subject, body, attachments) {
  const uniqueRecipients = (recipients || []).filter((email, index, list) => email && list.indexOf(email) === index);
  if (!uniqueRecipients.length) {
    Logger.log('No hay destinatarios para el correo: %s', subject);
    return;
  }

  MailApp.sendEmail({
    to: uniqueRecipients.join(','),
    subject,
    body,
    attachments: attachments || []
  });
}

function parseAttachments_(attachments) {
  if (!attachments) return [];
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch (error) {
      return [];
    }
  }

  if (!Array.isArray(attachments)) return [];

  return attachments
    .map((item) => {
      if (!item || !item.name || !item.data) return null;
      try {
        const decoded = Utilities.base64Decode(String(item.data || '').replace(/^data:[^;]+;base64,/, ''));
        return Utilities.newBlob(decoded, String(item.mimeType || 'application/octet-stream'), String(item.name));
      } catch (error) {
        Logger.log('No se pudo crear blob de adjunto: %s', error.message || error);
        return null;
      }
    })
    .filter(Boolean);
}

function saveAlertLog_(alert) {
  const sheet = getAlertsSheet_();
  const rowValues = [
    alert.id || '',
    alert.createdAt || '',
    alert.sentAt || '',
    alert.sentBy || '',
    alert.targetPeaje || '',
    alert.message || '',
    (alert.attachmentNames || []).join('|'),
    Array.isArray(alert.recipients) ? alert.recipients.join(', ') : String(alert.recipients || '')
  ];
  sheet.appendRow(rowValues);
}

function listAlerts_(user) {
  if (!isAdminUser_(user)) {
    throw new Error('Solo el administrador general puede ver el historial de alertas.');
  }

  const sheet = getAlertsSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, ALERT_HEADERS.length).getValues();
  return values
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => ({
      id: row[0],
      createdAt: row[1],
      sentAt: row[2],
      sentBy: row[3],
      targetPeaje: row[4],
      message: row[5],
      attachmentNames: row[6],
      recipients: row[7]
    }))
    .reverse();
}

function sendRecordCopyEmail_(record, pdfBase64) {
  const recipients = getNotificationRecipients_(record.peaje);
  if (!recipients.length) {
    Logger.log('No se encontró correo para el peaje: %s', record.peaje);
    return;
  }

  let pdf;
  if (pdfBase64) {
    const cleanBase64 = String(pdfBase64 || '').replace(/^data:application\/pdf;base64,/, '');
    const documentName = `Planilla_${record.peaje || 'SinPeaje'}_${record.codigoSello || 'SinCodigo'}_${record.fecha || dateKey_(new Date())}.pdf`;
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

  sendEmailToRecipients_(recipients, subject, body, [pdf]);
}

function sendCancellationEmail_(record, reason, user) {
  const recipients = getNotificationRecipients_(record.peaje);
  if (!recipients.length) {
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

  sendEmailToRecipients_(recipients, subject, body);
}

function notifyMissingPlanillas_(sheet, user, options) {
  if (!isAuditUser_(user) && !isAdminUser_(user)) {
    throw new Error('Solo auditoria o soporte puede notificar faltantes de planillas.');
  }

  const dateRange = missingNotificationDateRange_(options);
  const expectedPeajes = Object.keys(PEAJE_EMAILS);
  const existingKeys = buildExistingPlanillaKeys_(sheet);
  const missingByPeaje = {};

  expectedPeajes.forEach((peaje) => {
    dateRange.forEach((dateKey) => {
      const key = `${normalizeText_(peaje)}|${dateKey}`;
      if (!existingKeys[key]) {
        if (!missingByPeaje[peaje]) missingByPeaje[peaje] = [];
        missingByPeaje[peaje].push(dateKey);
      }
    });
  });

  const sent = [];
  const skipped = [];
  Object.keys(missingByPeaje).forEach((peaje) => {
    const pendingDates = missingByPeaje[peaje].filter((dateKey) => !wasMissingNoticeSent_(peaje, dateKey));
    const alreadyNotified = missingByPeaje[peaje].filter((dateKey) => wasMissingNoticeSent_(peaje, dateKey));

    alreadyNotified.forEach((dateKey) => skipped.push({ peaje, fecha: dateKey, reason: 'already-notified' }));
    if (!pendingDates.length) return;

    sendMissingPlanillaEmail_(peaje, pendingDates, user);
    pendingDates.forEach((dateKey) => {
      markMissingNoticeSent_(peaje, dateKey);
      sent.push({ peaje, fecha: dateKey });
    });
  });

  return {
    checkedFrom: dateRange[0] || '',
    checkedTo: dateRange[dateRange.length - 1] || '',
    sent,
    skipped
  };
}

function missingNotificationDateRange_(options) {
  const todayKey = dateKey_(new Date());
  const startDate = parseDateKey_(options && (options.startDate || options.from));
  const endDate = parseDateKey_(options && (options.endDate || options.to));
  const days = Math.max(1, Math.min(31, Number(options && options.days) || 10));

  let start = startDate;
  let end = endDate;

  if (!start || !end) {
    const yesterday = addDays_(parseDateKey_(todayKey), -1);
    end = end || yesterday;
    start = start || addDays_(end, -(days - 1));
  }

  if (dateKey_(end) >= todayKey) {
    end = addDays_(parseDateKey_(todayKey), -1);
  }

  const keys = [];
  for (let cursor = start; cursor && end && dateKey_(cursor) <= dateKey_(end); cursor = addDays_(cursor, 1)) {
    keys.push(dateKey_(cursor));
  }
  return keys;
}

function buildExistingPlanillaKeys_(sheet) {
  const keys = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return keys;

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  values.forEach((row) => {
    const record = {};
    HEADERS.forEach((header, index) => {
      record[header] = row[index];
    });

    const peaje = normalizeText_(record.peaje);
    const fecha = recordDateKey_(record.fecha);
    if (peaje && fecha) {
      keys[`${peaje}|${fecha}`] = true;
    }
  });

  return keys;
}

function sendAlertToPeaje_(targetPeaje, message, user, attachments = []) {
  const normalizedTarget = String(targetPeaje || '').trim();
  const alertText = String(message || '').trim();
  if (!normalizedTarget || !alertText) {
    throw new Error('Debe indicar el peaje destino y el mensaje de alerta.');
  }

  const recipients = getNotificationRecipients_(normalizedTarget);
  if (!recipients.length) {
    throw new Error('No se encontraron destinatarios para la alerta.');
  }

  const now = new Date().toISOString();
  const subject = `Alerta de sistema para ${normalizedTarget}`;
  const body = [
    'Se ha generado una nueva alerta desde el sistema de planillas ZIMA.',
    '',
    `Peaje destino: ${normalizedTarget}`,
    '',
    'Mensaje:',
    alertText,
    '',
    `Enviado por: ${user.nombre || user.peaje || 'Administrador'}`,
    `Fecha de envío: ${new Date().toLocaleString('es-CO')}`
  ].join('\n');

  sendEmailToRecipients_(recipients, subject, body, attachments);

  const attachmentNames = (attachments || []).map((attachment) => {
    if (attachment && attachment.getName) return attachment.getName();
    if (attachment && attachment.name) return String(attachment.name);
    return '';
  }).filter(Boolean);

  const alertRecord = {
    id: Utilities.getUuid(),
    createdAt: now,
    sentAt: now,
    sentBy: user.nombre || user.peaje || 'Administrador',
    targetPeaje: normalizedTarget,
    message: alertText,
    attachmentNames,
    recipients
  };

  saveAlertLog_(alertRecord);
  return alertRecord;
}

function sendMissingPlanillaEmail_(peaje, dates, user) {
  const recipients = getNotificationRecipients_(peaje);
  if (!recipients.length) {
    Logger.log('No se encontro correo para notificar faltante del peaje: %s', peaje);
    return;
  }

  const dateList = dates.map((dateKey) => `- ${dateKey}`).join('\n');
  const subject = `Reposicion requerida de planillas - ${peaje}`;
  const body = [
    'Buen dia.',
    '',
    'El sistema de seguimiento no encontro planillas registradas para las siguientes fechas:',
    '',
    dateList,
    '',
    'Por favor revisar y reponer/cargar la planilla faltante en el sistema lo antes posible para evitar novedades en seguimiento.',
    '',
    `Notificado por: ${(user && user.nombre) || (user && user.peaje) || 'Auditoria'}`,
    `Fecha de notificacion: ${new Date().toLocaleString('es-CO')}`,
    '',
    'Este correo se envia automaticamente desde el sistema de planillas ZIMA.'
  ].join('\n');

  sendEmailToRecipients_(recipients, subject, body);
}

function wasMissingNoticeSent_(peaje, dateKey) {
  const key = missingNoticeKey_(peaje, dateKey);
  return PropertiesService.getScriptProperties().getProperty(key) === 'sent';
}

function markMissingNoticeSent_(peaje, dateKey) {
  const key = missingNoticeKey_(peaje, dateKey);
  PropertiesService.getScriptProperties().setProperty(key, 'sent');
}

function missingNoticeKey_(peaje, dateKey) {
  return `MISSING_PLANILLA_NOTICE_${normalizeText_(peaje)}_${dateKey}`;
}

function recordDateKey_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.valueOf())) {
    return dateKey_(value);
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[1].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) return dateKey_(parsed);
  return '';
}

function parseDateKey_(value) {
  const key = recordDateKey_(value);
  if (!key) return null;
  const parts = key.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays_(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function dateKey_(date) {
  const timezone = Session.getScriptTimeZone() || 'America/Bogota';
  return Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
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
  const documentName = `Planilla_${record.peaje || 'SinPeaje'}_${record.codigoSello || 'SinCodigo'}_${record.fecha || dateKey_(new Date())}`;
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

  if (!canAuditRecords_(user) && normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
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
  const event = e || {};
  const params = event.parameter || {};
  const raw = params.record || '{}';

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
