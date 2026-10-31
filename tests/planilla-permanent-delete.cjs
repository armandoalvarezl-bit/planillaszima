const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'code.gs'), 'utf8');
const context = vm.createContext({Date, console});
vm.runInContext(source, context);
let session = {usuario:'admin', rol:'ADMIN', peaje:'TODOS'};
let authenticated = true, locked = false;
const rows = [{id:'a', codigo:'P-1', estado:'APROBADO'}, {id:'b', codigo:'P-2', estado:'ANULADA'}];
const audit = [];
Object.assign(context, {
  obtenerContextoUsuario_: () => authenticated ? {ok:true, sesion:session} : {ok:false, error:'Sesión inválida'},
  puedeAccederPlanilla_: (session) => session.peaje === 'TODOS',
  LockService: {getScriptLock: () => ({
    waitLock() {assert.equal(locked, false); locked = true;},
    releaseLock() {assert.equal(locked, true); locked = false;}
  })},
  getPlanillasSheet_: () => ({deleteRow(n) {assert.equal(locked, true); rows.splice(n - 2, 1);}}),
  findRowById_: (_, id) => {const index = rows.findIndex(row => row.id === id); return index < 0 ? null : {rowNumber:index + 2};},
  rowToObject_: (_, n) => rows[n - 2],
  registrarAuditoria_: (...args) => audit.push(args)
});
const remove = id => context.apiPost({action:'permanentdelete', id, rol:'ADMIN', peaje:'TODOS'});
authenticated = false;
assert.equal(remove('a').ok, false);
authenticated = true;
session = {usuario:'peaje', rol:'PEAJE', peaje:'TODOS'};
assert.equal(remove('a').ok, false); // El rol enviado por el cliente no concede permisos.
session = {usuario:'admin', rol:'ADMIN', peaje:'FRAGUA'};
assert.equal(remove('a').ok, false);
assert.equal(locked, false);
assert.equal(rows.length, 2);
session.peaje = 'TODOS';
assert.equal(remove('').ok, false);
assert.equal(remove('missing').ok, false);
assert.equal(remove('a').ok, true);
assert.equal(rows.length, 1);
assert.equal(rows[0].id, 'b');
assert.equal(remove('b').ok, true);
assert.equal(rows.length, 0);
assert.equal(remove('b').ok, false);
assert.equal(locked, false);
assert.equal(audit.length, 2);
assert.equal(audit[0][0], 'PERMANENT_DELETE');

const html = fs.readFileSync(path.join(__dirname, '..', 'historial.html'), 'utf8');
for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script);
const calls = [];
let admin = true, confirm = false, success = true;
const ui = vm.createContext({
  esGranAdministradorSesion: () => admin,
  ZimaUI: {confirm: async () => confirm, notice: () => {}},
  apiPost: async (...args) => {calls.push(args); return {ok:success};},
  render: () => {}
});
vm.runInContext('let allRows = [{id:"a", codigo:"P-1"}];' + html.slice(html.indexOf('    const eliminacionesEnCurso'), html.indexOf('    async function restaurar(id)')), ui);
(async () => {
  admin = false;
  await ui.eliminarDefinitivamente('a');
  admin = true;
  await ui.eliminarDefinitivamente('a');
  assert.equal(calls.length, 0);
  confirm = true;
  success = false;
  await ui.eliminarDefinitivamente('a');
  assert.equal(vm.runInContext('allRows.length', ui), 1);
  success = true;
  await Promise.all([ui.eliminarDefinitivamente('a'), ui.eliminarDefinitivamente('a')]);
  assert.equal(calls.length, 2); // Un intento fallido y uno correcto, sin solicitudes simultáneas duplicadas.
  assert.equal(calls[1][0], 'permanentdelete');
  assert.equal(vm.runInContext('allRows.length', ui), 0);
  console.log('OK: eliminación definitiva, permisos de servidor, auditoría, cancelación, errores y solicitudes duplicadas.');
})().catch(error => {console.error(error); process.exitCode = 1;});
