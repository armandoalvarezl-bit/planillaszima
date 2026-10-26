const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
module.exports = function fixture() {
  let now = Date.now(), locked = false, failDone = false, failWrite = false;
  const sheets = new Map(), properties = new Map(), cache = new Map();
  const users = new Map([['operador', { USUARIO: 'operador', NOMBRE: 'Operador', CONTRASENA: 'hash-password', ROL: 'PEAJE', PEAJE: 'FRAGUA', ESTADO: 'ACTIVO', FECHA_CAMBIO_CONTRASENA: new Date(now).toISOString(), EMAIL: 'operador@example.com' }]]);
  function sheet(name, initial = []) {
    const rows = initial.map(row => row.slice());
    const sh = {
      rows, getName: () => name, getLastRow: () => rows.length, getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
      appendRow: row => { if (name === 'PLANILLAS' && failWrite) { failWrite = false; throw Error('Simulated interruption before financial write'); } rows.push(Array.from(row)); }, getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
      getRange(row, col, count = 1, width = 1) {
        return {
          getValues: () => Array.from({ length: count }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[col - 1 + j] ?? '')),
          setValue(value) {
            if (name === 'OFFLINE_OPERACIONES' && value === 'DONE' && failDone) { failDone = false; throw Error('Simulated disconnect after writing'); }
            if (!rows[row - 1]) rows[row - 1] = []; rows[row - 1][col - 1] = value; return this;
          },
          setValues(values) { values.forEach((values, i) => values.forEach((value, j) => { if (!rows[row - 1 + i]) rows[row - 1 + i] = []; rows[row - 1 + i][col - 1 + j] = value; })); return this; },
          setFontWeight() { return this; }
        };
      }
    };
    sheets.set(name, sh); return sh;
  }
  const context = vm.createContext({
    console,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    Utilities: {
      getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algorithm, value) => [...crypto.createHash('sha256').update(String(value)).digest()],
      formatDate: date => new Date(date).toISOString().slice(0, 10)
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key) || null, setProperty: (key, value) => properties.set(key, value), deleteProperty: key => properties.delete(key), getProperties: () => Object.fromEntries(properties) }) },
    CacheService: { getScriptCache: () => ({ get: key => { const item = cache.get(key); return item && item.until > now ? item.value : null; }, put: (key, value, seconds) => cache.set(key, { value, until: now + seconds * 1000 }), remove: key => cache.delete(key) }) },
    SpreadsheetApp: { flush() {} },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createHtmlOutput: html => ({ html, setXFrameOptionsMode() { return this; } }) },
    LockService: { getScriptLock: () => ({ waitLock() { if (locked) throw Error('Nested script lock'); locked = true; }, releaseLock() { locked = false; } }) }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../code.gs'), 'utf8'), context);
  const headers = vm.runInContext('ZIMA.HEADERS.slice()', context);
  sheet('PLANILLAS', [headers]);
  Object.assign(context, {
    getSpreadsheet_: () => ({ getId: () => 'database', getSheetByName: name => sheets.get(name) || null, insertSheet: name => sheet(name) }),
    buscarUsuario_: username => users.get(String(username).toLowerCase()) || null,
    obtenerFotoUsuarioPersistente_: () => '', registrarAuditoria_: () => {},
    notificarCambioPlanilla_: () => ({ ok: true, enviado: true }),
    jsonOutput_: value => value
  });
  const profile = { usuario: 'operador', nombre: 'Operador', rol: 'PEAJE', peaje: 'FRAGUA', estado: 'ACTIVO', loginAt: new Date(now).toISOString() };
  const token = context.crearSesion_(profile);
  return { context, profile: { ...profile, token }, token, users, sheets, properties,
    advance: ms => { now += ms; }, failAfterWrite: () => { failDone = true; }, failBeforeWrite: () => { failWrite = true; }, expireSessions: () => cache.clear(),
    api: (action, data = {}) => context.doPost({ postData: { contents: JSON.stringify({ action, ...data }) } }) };
};
