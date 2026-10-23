const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'historial.html'), 'utf8');
for (const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script);
const elements = new Map();
const dialogs = [];
const el = id => {
  if(!elements.has(id)) elements.set(id,{value:'',innerHTML:'',textContent:''});
  return elements.get(id);
};
const context = vm.createContext({
  $:el, esc:s=>String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;'), money:String,
  normalizarEstado:s=>s, statusClass:()=>'', accionesFila:()=>'',
  ZimaUI:{confirm:options=>{dialogs.push(options); return {then:callback=>callback(false)};}}
});
vm.runInContext(html.slice(html.indexOf('    let allRows = [];'),html.indexOf("    let currentPreviewId = '';")),context);
context.testRows = [
  {id:'1',codigo:' P-1 ',estado:'APROBADO',fecha:'2026-10-01'},
  {id:'2',codigo:'p-1',estado:'ANULADA',fecha:'2026-10-23'},
  {id:'3',codigo:'P-2',estado:'APROBADO',fecha:'2026-10-31'},
  {id:'4',codigo:'',estado:'APROBADO',fecha:'2026-10-02'},
  {id:'5',codigo:'SEPTIEMBRE',estado:'APROBADO',fecha:'2026-09-30'},
  {id:'6',codigo:'NOVIEMBRE',estado:'APROBADO',fecha:'2026-11-01'}
];
el('mes').value='2026-10';
vm.runInContext('allRows=testRows; render()',context);
assert.match(el('duplicateNotice').innerHTML,/Advertencia/);
assert.doesNotMatch(el('rows').innerHTML,/SEPTIEMBRE|NOVIEMBRE/);
assert.equal(el('count').textContent,'4 registros');
assert.equal(dialogs.length,1);
assert.match(dialogs[0].message,/ajustar.*administrador/);
context.render();
assert.equal(dialogs.length,1);
assert.equal((el('rows').innerHTML.match(/Código duplicado/g)||[]).length,2);
// Filtrar no debe ocultar que el código tiene otra planilla en el historial.
el('estado').value='APROBADO';
context.render();
assert.equal((el('rows').innerHTML.match(/Código duplicado/g)||[]).length,1);
el('mes').value='2026-09';
context.render();
assert.match(el('rows').innerHTML,/SEPTIEMBRE/);
assert.doesNotMatch(el('rows').innerHTML,/2026-10/);
assert.equal(el('duplicateNotice').innerHTML,'');
el('mes').value='2026-12';
context.render();
assert.equal(el('count').textContent,'0 registros');
el('mes').value='2026-10';
context.testRows=[{id:'1',codigo:'P-1',estado:'APROBADO',fecha:'2026-10-01'},{id:'2',codigo:'P-2',estado:'APROBADO',fecha:'2026-10-02'}];
vm.runInContext('allRows=testRows; render()',context);
assert.equal(el('duplicateNotice').innerHTML,'');
assert.doesNotMatch(el('rows').innerHTML,/Código duplicado/);
assert.match(context.mesActualHistorial(),/^\d{4}-\d{2}$/);
console.log('OK: historial por mes, límites de mes, mes vacío, modal de duplicados sin repeticiones y filtros.');
