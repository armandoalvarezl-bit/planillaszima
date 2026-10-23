const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ Date, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'code.gs'), 'utf8'), context);
const headers = vm.runInContext('ZIMA.HEADERS.slice()', context);
const rows = [];
let locked = false;
let sequence = 0;
let notices = 0;
let sesion = { usuario: 'fragua', peaje: 'FRAGUA', rol: 'PEAJE' };
const sheet = {
  getLastRow: () => rows.length + 1,
  getRange(row, col, count = 1, width = 1) {
    return {
      getValues: () => rows.slice(row - 2, row - 2 + count).map(r => r.slice(col - 1, col - 1 + width)),
      setValues(values) { assert.equal(locked, true); rows[row - 2] = values[0].slice(); }
    };
  },
  appendRow(row) { assert.equal(locked, true); rows.push(row.slice()); }
};
Object.assign(context, {
  LockService: { getScriptLock: () => ({
    waitLock() { assert.equal(locked, false); locked = true; },
    releaseLock() { assert.equal(locked, true); locked = false; }
  }) },
  Utilities: { getUuid: () => 'id-' + (++sequence) },
  obtenerContextoUsuario_: () => ({ ok: true, sesion }),
  getPlanillasSheet_: () => sheet,
  registrarAuditoria_: () => {},
  notificarCambioPlanilla_: () => { notices++; return {}; }
});
const data = { codigo: 'P-123', fecha: '2026-10-23', total: 1000, peaje: 'FRAGUA', estado: 'APROBADO' };
const first = context.guardarPlanilla_(data);
assert.equal(first.ok, true);
for (const codigo of ['P-123', ' p-123 ']) {
  const duplicate = context.guardarPlanilla_({ ...data, codigo });
  assert.equal(duplicate.code, 'CODIGO_DUPLICADO');
  assert.equal(duplicate.existingId, first.row.id);
  assert.equal(locked, false);
}
assert.equal(rows.length, 1);
assert.equal(notices, 1);
// Editar la misma planilla conserva su código y ajusta el valor.
assert.equal(context.actualizarPlanilla_({ ...data, id: first.row.id, total: 2000 }).ok, true);
assert.equal(rows[0][headers.indexOf('total')], 2000);
const second = context.guardarPlanilla_({ ...data, codigo: 'P-456' });
const before = JSON.stringify(rows);
assert.equal(context.actualizarPlanilla_({ ...data, id: second.row.id, codigo: 'p-123' }).code, 'CODIGO_DUPLICADO');
assert.equal(JSON.stringify(rows), before);
// Otro peaje no recibe el ID ni permiso para abrir la planilla ajena.
sesion = { usuario: 'zaragoza', peaje: 'ZARAGOZA', rol: 'PEAJE' };
const privateDuplicate = context.guardarPlanilla_(data);
assert.equal(privateDuplicate.code, 'CODIGO_DUPLICADO');
assert.equal(privateDuplicate.existingId, '');
assert.equal(context.actualizarPlanilla_({ ...data, id: first.row.id }).ok, false);
assert.equal(JSON.stringify(rows), before);
// Los códigos automáticos siguen siendo diferentes en guardados sucesivos.
const auto1 = context.guardarPlanilla_({ ...data, codigo: '' });
const auto2 = context.guardarPlanilla_({ ...data, codigo: '' });
assert.equal(auto1.ok, true);
assert.equal(auto2.ok, true);
assert.notEqual(auto1.row.codigo, auto2.row.codigo);
assert.equal(locked, false);
console.log('OK: códigos únicos al crear/editar, edición del registro original, permisos y códigos automáticos.');
