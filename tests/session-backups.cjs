const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const cache = new Map();
const props = new Map();
let now = 2000000, copies = 0, triggers = 0;
const context = vm.createContext({
  Date: class extends Date { static now() { return now; } },
  CacheService: { getScriptCache: () => ({ put: (k,v) => cache.set(k,v), get: k => cache.get(k), remove: k => cache.delete(k) }) },
  Utilities: { getUuid: () => 'uuid', formatDate: () => 'stamp' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k), setProperty: (k,v) => props.set(k,v) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  DriveApp: { createFolder: () => ({ getId: () => 'folder' }), getFolderById: () => ({}), getFileById: () => ({ makeCopy: () => { copies++; return { getId: () => 'copy' }; } }) },
  ScriptApp: { getProjectTriggers: () => triggers ? [{ getHandlerFunction: () => 'crearRespaldoAutomatico' }] : [], newTrigger: () => {
    const builder = { timeBased: () => builder, everyDays: () => builder, atHour: () => builder, inTimezone: () => builder, create: () => { triggers++; } }; return builder;
  } }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../code.gs'), 'utf8'), context);
const token = context.crearSesion_({ usuario: 'test', loginAt: new Date(now).toISOString() });
now += 899000;
assert.ok(context.obtenerSesion_(token));
now += 1000;
assert.equal(context.obtenerSesion_(token), null, 'Reads do not extend inactivity');
assert.equal(cache.size, 0);
const fresh = context.crearSesion_({ usuario: 'test' });
context.obtenerContextoUsuario_ = data => ({ ok: !!context.obtenerSesion_(data.token), sesion: context.obtenerSesion_(data.token) });
now += 600000;
assert.equal(context.apiPost({ action: 'sessionactivity', token: fresh }).ok, true);
now += 600000;
assert.ok(context.obtenerSesion_(fresh), 'Explicit activity renews session');
now += 900000;
assert.equal(context.registrarActividadSesion_({ token: fresh }).ok, false, 'Cannot revive expired token');
context.getSpreadsheet_ = () => ({ getId: () => 'database' });
assert.throws(() => context.crearRespaldoAutomatico(), /configurarRespaldos/);
context.configurarRespaldosAutomaticos();
context.configurarRespaldosAutomaticos();
assert.equal(triggers, 1, 'Configuration does not duplicate daily jobs');
assert.equal(copies, 2);
assert.equal(props.get('ZIMA_BACKUP_LAST_FILE_ID'), 'copy');
console.log('Server session and backup checks passed');
