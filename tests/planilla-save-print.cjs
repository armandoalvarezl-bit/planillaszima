const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'planilla.html'), 'utf8');
for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
  new vm.Script(script, { filename: 'planilla.html' });
}
const source = html.slice(html.indexOf('    function mostrarProgresoPlanilla('), html.indexOf('    async function anularPlanilla('));
const printSource = html.slice(html.indexOf('    async function imprimir(){'), html.indexOf("    document.addEventListener('keydown'"));
function setup() {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', disabled: false, inert: false, setAttribute() {} });
    return elements.get(id);
  };
  const actions = ['saveBtn', 'printBtn', 'cancelBtn'].map(el);
  const messages = [];
  const calls = [];
  let printed = 0;
  let finish;
  let printError = false;
  const context = vm.createContext({
    window: {}, document: { querySelectorAll: () => actions },
    $: el, msg: el('msg'), embeddedEdit: false,
    actualizar() {}, actualizarAccionesAdmin() {},
    datos: () => ({ peaje: 'ZIMA', fecha: '2026-10-21', total: 1000, codigo: 'BORRADOR' }),
    apiPost: data => { calls.push(data); return new Promise(resolve => { finish = resolve; }); },
    normalizarEstado: value => value,
    formatCOP: value => String(value), parseMoney: Number,
    esc: String, textoNotificacion: () => '',
    imprimirDesdeVistaPrevia: async () => {
      printed++;
      assert.equal(el('codigo').value, 'GUARDADO-123');
      assert.equal(el('doc').inert, true);
      if (printError) throw new Error('Impresora no disponible');
    },
    ZimaUI: {
      busy: (id, busy) => { el(id).disabled = busy; },
      notice: (_, message, type) => messages.push({ message, type })
    }
  });
  vm.runInContext('let id=null; let estadoActual="APROBADO";\n' + source + printSource, context);
  return { context, el, calls, messages, finish: value => finish(value), printed: () => printed, failPrint: () => { printError = true; } };
}
const saved = { ok: true, row: { id: '123', codigo: 'GUARDADO-123', estado: 'APROBADO' } };
(async () => {
  const success = setup();
  const saving = success.context.guardar();
  assert.equal(success.calls.length, 1);
  assert.equal(success.printed(), 0);
  assert.equal(success.el('doc').inert, true);
  assert.equal(success.el('saveBtn').disabled, true);
  await success.context.guardar();
  assert.equal(success.calls.length, 1);
  success.finish(saved);
  await saving;
  assert.equal(success.printed(), 1);
  assert.equal(success.el('doc').inert, false);
  assert.equal(success.el('saveBtn').disabled, false);
  // Reimprimir no debe volver a guardar ni crear otra planilla.
  success.context.imprimirDesdeVistaPrevia = async () => {};
  await success.context.imprimir();
  assert.equal(success.calls.length, 1);
  assert.equal(vm.runInContext('id', success.context), '123');

  const failure = setup();
  const failed = failure.context.guardar();
  failure.finish({ ok: false, error: 'No se pudo guardar' });
  await failed;
  assert.equal(failure.printed(), 0);
  assert.equal(vm.runInContext('id', failure.context), null);
  assert.equal(failure.el('saveBtn').disabled, false);

  const printerFailure = setup();
  printerFailure.failPrint();
  const pending = printerFailure.context.guardar();
  printerFailure.finish(saved);
  await pending;
  assert.equal(printerFailure.calls.length, 1);
  assert.equal(vm.runInContext('id', printerFailure.context), '123');
  assert.match(printerFailure.messages.at(-1).message, /quedó guardada/);
  assert.match(printerFailure.messages.at(-1).message, /Volver a imprimir/);
  assert.equal(printerFailure.el('saveBtn').disabled, false);
  console.log('OK: guardado confirmado antes de imprimir, código del servidor, bloqueo de doble clic, error de guardado y reimpresión sin duplicados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
