const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ Date, console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'code.gs'), 'utf8'), context);
const headers = vm.runInContext('ZIMA.HEADERS.slice()', context);
const originalGetSheet = context.getPlanillasSheet_;
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
  Utilities: { getUuid: () => 'id-' + (++sequence), formatDate: () => '2026-10-31' },
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
const second = context.guardarPlanilla_({ ...data, codigo: 'P-456',fecha:'2026-10-22' });
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
const auto1 = context.guardarPlanilla_({ ...data, codigo: '', fecha:'2026-10-21' });
const auto2 = context.guardarPlanilla_({ ...data, codigo: '', fecha:'2026-10-20' });
assert.equal(auto1.ok, true);
assert.equal(auto2.ok, true);
assert.notEqual(auto1.row.codigo, auto2.row.codigo);
assert.equal(locked, false);

// Ciclo operativo: el recambio lleva la fecha de visita; el recaudo su propia fecha.
sesion = {usuario:'ciclo',peaje:'CICLO',rol:'PEAJE'};
const ciclo = {...data,peaje:'CICLO',codigo:'',tipoPlanilla:'RECAUDO'};
const creadas = [];
for (const [fecha,tipoPlanilla] of [
  ['2026-09-04','RECAUDO'], ['2026-09-05','RECAUDO'], ['2026-09-06','RECAUDO'], ['2026-09-07','RECAMBIO'],
  ['2026-09-07','RECAUDO'], ['2026-09-08','RECAUDO'], ['2026-09-09','RECAMBIO'],
  ['2026-09-09','RECAUDO'], ['2026-09-10','RECAUDO'], ['2026-09-11','RECAMBIO']
]) {
  const observaciones = tipoPlanilla === 'RECAMBIO' ? 'Recambio de TransBank' : '';
  const result = context.guardarPlanilla_({...ciclo,fecha,tipoPlanilla,observaciones});
  assert.equal(result.ok,true,result.error);
  creadas.push(result.row);
  // Un código diferente tampoco permite duplicar fecha, tipo y peaje.
  const duplicate = context.guardarPlanilla_({...ciclo,fecha,tipoPlanilla,observaciones,codigo:'OTRO-'+fecha+'-'+tipoPlanilla});
  assert.equal(duplicate.code,'FECHA_DUPLICADA');
  assert.equal(duplicate.existingId,result.row.id);
  assert.equal(locked,false);
}
// Editar un registro conserva su fecha; cambiarlo a una fecha ocupada se bloquea.
assert.equal(context.actualizarPlanilla_({...creadas[0],total:5000}).ok,true);
const beforeDateChange = JSON.stringify(rows);
assert.equal(context.actualizarPlanilla_({...creadas[1],fecha:creadas[0].fecha}).code,'FECHA_DUPLICADA');
assert.equal(JSON.stringify(rows),beforeDateChange);
// Actualizaciones de clientes anteriores conservan el tipo recambio.
const recambio = {...creadas[3]};
delete recambio.tipoPlanilla;
assert.equal(context.actualizarPlanilla_(recambio).row.tipoPlanilla,'RECAMBIO');
// Anular permite reemplazar, pero no restaurar mientras otra activa ocupa esa fecha.
assert.equal(context.actualizarPlanilla_({...creadas[0],estado:'ANULADA'}).ok,true);
assert.equal(context.guardarPlanilla_({...ciclo,fecha:creadas[0].fecha,codigo:'REEMPLAZO'}).ok,true);
assert.equal(context.actualizarPlanilla_({...creadas[0],estado:'APROBADO'}).code,'FECHA_DUPLICADA');
for(const fecha of ['2026-02-30','2026-11-01','mal-formada']) {
  const invalid = context.guardarPlanilla_({...ciclo,fecha});
  assert.equal(invalid.ok,false);
  if (fecha !== 'mal-formada') assert.equal(invalid.code,'FECHA_INVALIDA');
}
assert.equal(context.guardarPlanilla_({...ciclo,fecha:creadas[0].fecha,tipoPlanilla:'RECAMBIO',codigo:'INTENTO-TIPO'}).code,'FECHA_DUPLICADA');
// Ejemplo: recambio del 31; el lunes siguiente se registra el recaudo del 31.
context.Utilities.formatDate = () => '2026-11-02';
const recambio31 = context.guardarPlanilla_({...ciclo,codigo:'REC-31',fecha:'2026-10-31',total:1000,observaciones:'RE CAMBIO de TransBank',tipoPlanilla:'RECAUDO'});
assert.equal(recambio31.ok,true);
assert.equal(recambio31.row.tipoPlanilla,'RECAMBIO');
const recaudo31 = context.guardarPlanilla_({...ciclo,codigo:'RECAUDO-31',fecha:'2026-10-31',total:9000});
assert.equal(recaudo31.ok,true);
assert.equal(recaudo31.row.tipoPlanilla,'RECAUDO');
assert.equal(context.guardarPlanilla_({...ciclo,codigo:'TERCERA-31',fecha:'2026-10-31',total:100000}).code,'FECHA_DUPLICADA');
assert.equal(context.guardarPlanilla_({...ciclo,codigo:'OTRO-REC-31',fecha:'2026-10-31',obsValor:'recambio',total:2000}).code,'FECHA_DUPLICADA');
assert.equal(context.actualizarPlanilla_({...recambio31.row,observaciones:''}).code,'FECHA_DUPLICADA');
assert.equal(context.actualizarPlanilla_({...recaudo31.row,observaciones:'Recambio'}).code,'FECHA_DUPLICADA');
assert.equal(context.actualizarPlanilla_({...recambio31.row,total:3000}).ok,true);
assert.equal(context.serializarRegistro_({tipoPlanilla:'RECAMBIO',observaciones:''}).tipoPlanilla,'RECAUDO');
// Otro peaje sí puede registrar la misma fecha y tipo.
sesion = {usuario:'otro',peaje:'OTRO',rol:'PEAJE'};
assert.equal(context.guardarPlanilla_({...ciclo,fecha:creadas[0].fecha}).ok,true);
assert.equal(locked,false);
// La columna de tipo se agrega a una hoja antigua, incluso si tiene solo 25 columnas.
const legacyHeaders = headers.slice(0,25);
const legacySnapshot = JSON.stringify(legacyHeaders);
let maxColumns = 25;
const legacySheet = {
  getLastColumn:()=>legacyHeaders.length,
  getMaxColumns:()=>maxColumns,
  insertColumnsAfter(after,count) {assert.equal(after,25);maxColumns+=count;},
  getRange(row,col) {assert.equal(row,1);return {getValue:()=>legacyHeaders[col-1],setValue:value=>{legacyHeaders[col-1]=value;}};}
};
context.getSpreadsheet_ = () => ({getSheetByName:()=>legacySheet});
assert.equal(originalGetSheet(),legacySheet);
assert.equal(maxColumns,26);
assert.equal(legacyHeaders[25],'tipoPlanilla');
assert.equal(JSON.stringify(legacyHeaders.slice(0,25)),legacySnapshot);
assert.equal(originalGetSheet(),legacySheet);
console.log('OK: códigos únicos, fecha por peaje y tipo, ciclo de recaudos/recambios, edición, anulación, restauración y fechas inválidas/futuras.');
