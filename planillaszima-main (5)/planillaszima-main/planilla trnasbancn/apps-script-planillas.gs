const SHEET_NAME = 'BASE DE DATOS PLANILLAS';
const USERS_SHEET_NAME = 'USUARIOS PLANILLAS';
const SPREADSHEET_NAME = 'BASE DE DATOS PLANILLAS';
const SPREADSHEET_ID_PROPERTY = 'PLANILLAS_SPREADSHEET_ID';
const SPREADSHEET_ID = '';

const USER_HEADERS = ['peaje', 'nombre', 'password', 'activo'];
const DEFAULT_USERS = [
  ['PEAJE ZARAGOZA', 'Peaje Zaragoza', 'zaragoza123', 'SI'],
  ['PEAJE FRAGUA', 'Peaje Fragua', 'fragua123', 'SI']
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
      payload = { ok: true, record: saveRecord_(sheet, record, user) };
    } else if (action === 'delete') {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      payload = { ok: true, deleted: deleteRecord_(sheet, e.parameter.id, user) };
    } else {
      const user = authenticateUser_(usersSheet, e.parameter.peaje, e.parameter.password);
      payload = { ok: true, records: readRecords_(sheet, user.peaje) };
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
    const user = authenticateUser_(usersSheet, body.peaje, body.password);
    const saved = saveRecord_(sheet, record, user);

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
  if (lastRow >= 2) return;

  sheet.getRange(2, 1, DEFAULT_USERS.length, USER_HEADERS.length).setValues(DEFAULT_USERS);
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

function publicUser_(user) {
  return {
    peaje: user.peaje,
    nombre: user.nombre || user.peaje
  };
}

function normalizeText_(value) {
  return String(value || '').trim().toUpperCase();
}

function readRecords_(sheet, peaje) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const normalizedPeaje = normalizeText_(peaje);

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
    .filter((record) => normalizeText_(record.peaje) === normalizedPeaje)
    .reverse();
}

function saveRecord_(sheet, incoming, user) {
  const now = new Date().toISOString();
  const record = {};

  HEADERS.forEach((header) => {
    record[header] = incoming[header] == null ? '' : incoming[header];
  });

  record.id = record.id || Utilities.getUuid();
  record.createdAt = record.createdAt || now;
  record.updatedAt = now;
  record.peaje = user.peaje;

  const rowValues = HEADERS.map((header) => record[header]);
  const existingRow = findRowById_(sheet, record.id);

  if (existingRow) {
    const existingRecord = getRecordAtRow_(sheet, existingRow);
    if (normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
      throw new Error('No tiene permiso para modificar registros de otro peaje.');
    }

    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }

  return record;
}

function deleteRecord_(sheet, id, user) {
  const existingRow = findRowById_(sheet, id);
  if (!existingRow) return false;
  const existingRecord = getRecordAtRow_(sheet, existingRow);

  if (normalizeText_(existingRecord.peaje) !== normalizeText_(user.peaje)) {
    throw new Error('No tiene permiso para eliminar registros de otro peaje.');
  }

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
  if (!e || !e.postData || !e.postData.contents) return {};

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
    return data;
  }
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
