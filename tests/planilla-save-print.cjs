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
    if (!elements.has(id)) elements.set(id, { value: '', innerHTML: '', disabled: false, inert: false, open:false, setAttribute() {}, showModal(){this.open=true;}, close(){this.open=false;} });
    return elements.get(id);
  };
  const actions = ['saveBtn', 'printBtn', 'cancelBtn', 'newBtn'].map(el);
  const navigation = [];
  const messages = [];
  const calls = [];
  const dialogs = [];
  let printed = 0;
  let saveSounds = 0;
  let finish;
  let printError = false;
  const context = vm.createContext({
    window: {}, document: { querySelectorAll: () => actions },
    go: page => navigation.push(page),
    $: el, msg: el('msg'), embeddedEdit: false,
    actualizar() {}, actualizarAccionesAdmin() {},
    syncRows: async () => [],
    datos: () => ({ peaje: 'ZIMA', fecha: '2026-10-21', tipoPlanilla:'RECAUDO', total: 1000, codigo: 'BORRADOR' }),
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
      playSaveSound: () => {saveSounds++;},
      confirm: async options => { dialogs.push(options); return false; },
      busy: (id, busy) => { el(id).disabled = busy; },
      notice: (_, message, type) => messages.push({ message, type })
    }
  });
  vm.runInContext('let id=null; let estadoActual="APROBADO";\n' + source + printSource, context);
  return { context, el, calls, dialogs, messages, navigation, finish: value => finish(value), printed: () => printed, sounds:()=>saveSounds, failPrint: () => { printError = true; } };
}
const saved = { ok: true, row: { id: '123', codigo: 'GUARDADO-123', estado: 'APROBADO' } };
(async () => {
  const success = setup();
  success.context.nuevaPlanilla();
  assert.equal(success.navigation.length, 0);
  const saving = success.context.guardar();
  await new Promise(setImmediate);
  assert.equal(success.calls.length, 1);
  assert.equal(success.dialogs.length, 0); // La validación de fecha es interna.
  assert.equal(success.printed(), 0);
  assert.equal(success.el('saveProgressModal').open, true);
  assert.equal(success.sounds(), 0);
  assert.equal(success.el('doc').inert, true);
  assert.equal(success.el('saveBtn').disabled, true);
  success.context.nuevaPlanilla();
  assert.equal(success.navigation.length, 0);
  await success.context.guardar();
  assert.equal(success.calls.length, 1);
  success.finish(saved);
  await saving;
  assert.equal(success.el('saveProgressModal').open, false);
  assert.equal(success.sounds(), 1);
  assert.equal(success.printed(), 1);
  assert.equal(success.el('doc').inert, false);
  assert.equal(success.el('saveBtn').disabled, false);
  assert.equal(success.el('msg').innerHTML, '');
  assert.equal(success.dialogs.length, 1);
  assert.equal(success.dialogs[0].tone, 'success');
  assert.match(success.dialogs[0].message, /no necesita crear una nueva/);
  assert.match(success.dialogs[0].detail, /GUARDADO-123/);
  assert.equal(success.dialogs[0].confirmText, 'Ir al historial');
  // Reimprimir no debe volver a guardar ni crear otra planilla.
  success.context.imprimirDesdeVistaPrevia = async () => {};
  await success.context.imprimir();
  assert.equal(success.calls.length, 1);
  assert.equal(vm.runInContext('id', success.context), '123');
  success.context.nuevaPlanilla();
  assert.deepEqual(success.navigation, ['planilla.html']);
  assert.equal(success.calls.length, 1);
  assert.equal(vm.runInContext('id', success.context), '123');

  const failure = setup();
  const failed = failure.context.guardar();
  await new Promise(setImmediate);
  failure.finish({ ok: false, error: 'No se pudo guardar' });
  await failed;
  assert.equal(failure.printed(), 0);
  assert.equal(vm.runInContext('id', failure.context), null);
  assert.equal(failure.el('saveBtn').disabled, false);

  const duplicate = setup();
  const duplicateSaving = duplicate.context.guardar();
  await new Promise(setImmediate);
  duplicate.finish({ ok: false, code: 'CODIGO_DUPLICADO', error: 'Ya existe esta planilla.', existingId: 'original-123' });
  await duplicateSaving;
  assert.equal(duplicate.printed(), 0);
  assert.equal(duplicate.el('saveProgressModal').open, false);
  assert.equal(duplicate.sounds(), 0);
  assert.equal(vm.runInContext('id', duplicate.context), null);
  assert.equal(duplicate.el('msg').innerHTML, '');
  assert.equal(duplicate.dialogs.at(-1).tone, 'warning');
  assert.equal(duplicate.dialogs.at(-1).sound, 'warning');
  assert.equal(duplicate.dialogs.at(-1).confirmText, 'Abrir planilla existente');
  assert.equal(duplicate.el('saveBtn').disabled, false);
  assert.equal(duplicate.el('doc').inert, false);

  const knownDuplicate = setup();
  knownDuplicate.context.syncRows = async () => [{ id: 'original', codigo: ' borrador ' }];
  await knownDuplicate.context.guardar();
  assert.equal(knownDuplicate.calls.length, 0);
  assert.equal(knownDuplicate.printed(), 0);
  assert.equal(knownDuplicate.el('msg').innerHTML, '');
  assert.match(knownDuplicate.dialogs[0].message, /Ya existe una planilla/);
  assert.equal(knownDuplicate.dialogs[0].sound, 'warning');
  assert.equal(knownDuplicate.el('doc').inert, false);
  assert.equal(knownDuplicate.el('saveBtn').disabled, false);

  const editing = setup();
  const fechaDuplicada = setup();
  fechaDuplicada.context.syncRows = async () => [{id:'fecha-original',codigo:'CODIGO-DIFERENTE',peaje:'ZIMA',fecha:'2026-10-21',tipoPlanilla:'RECAUDO',estado:'APROBADO'}];
  await fechaDuplicada.context.guardar();
  assert.equal(fechaDuplicada.calls.length,0);
  assert.match(fechaDuplicada.dialogs[0].title,/fecha ya registrada/);
  assert.equal(fechaDuplicada.dialogs[0].sound,'warning');
  // Una marca recambio en la existente permite el recaudo de esa misma fecha.
  const recaudoConRecambioPrevio = setup();
  recaudoConRecambioPrevio.context.syncRows = async () => [{id:'recambio-previo',codigo:'REC-OTRO',peaje:'ZIMA',fecha:'2026-10-21',tipoPlanilla:'RECAUDO',observaciones:'Recambio de TransBank',estado:'APROBADO'}];
  const guardarRecaudo = recaudoConRecambioPrevio.context.guardar();
  await new Promise(setImmediate);
  assert.equal(recaudoConRecambioPrevio.calls.length,1);
  assert.equal(recaudoConRecambioPrevio.calls[0].tipoPlanilla,'RECAUDO');
  recaudoConRecambioPrevio.finish(saved);
  await guardarRecaudo;
  const recambioConRecaudoPrevio = setup();
  recambioConRecaudoPrevio.context.datos = () => ({peaje:'ZIMA',fecha:'2026-10-21',total:2500,codigo:'REC-NUEVO',observaciones:'re cambio',tipoPlanilla:'RECAUDO'});
  recambioConRecaudoPrevio.context.syncRows = async () => [{id:'recaudo-previo',codigo:'RECAUDO-OTRO',peaje:'ZIMA',fecha:'2026-10-21',tipoPlanilla:'RECAMBIO',observaciones:'',estado:'APROBADO'}];
  const guardarRecambio = recambioConRecaudoPrevio.context.guardar();
  await new Promise(setImmediate);
  assert.equal(recambioConRecaudoPrevio.calls.length,1);
  assert.equal(recambioConRecaudoPrevio.calls[0].tipoPlanilla,'RECAMBIO');
  recambioConRecaudoPrevio.finish(saved);
  await guardarRecambio;
  vm.runInContext('id="original"', editing.context);
  editing.context.syncRows = async () => [{ id: 'original', codigo: 'BORRADOR' }];
  const updating = editing.context.guardar();
  await new Promise(setImmediate);
  assert.equal(editing.calls[0].action, 'update');
  editing.finish(saved);
  await updating;
  assert.equal(editing.printed(), 0);

  const unavailable = setup();
  unavailable.context.syncRows = async () => { throw Error('No se pudieron consultar las planillas'); };
  await unavailable.context.guardar();
  assert.equal(unavailable.calls.length, 0);
  assert.match(unavailable.messages.at(-1).message, /No se pudieron consultar/);

  const printerFailure = setup();
  printerFailure.failPrint();
  const pending = printerFailure.context.guardar();
  await new Promise(setImmediate);
  printerFailure.finish(saved);
  await pending;
  assert.equal(printerFailure.calls.length, 1);
  assert.equal(vm.runInContext('id', printerFailure.context), '123');
  assert.match(printerFailure.messages.at(-1).message, /quedó guardada/);
  assert.match(printerFailure.messages.at(-1).message, /Volver a imprimir/);
  assert.equal(printerFailure.el('saveBtn').disabled, false);
  console.log('OK: guardado confirmado antes de imprimir, código del servidor, bloqueo de doble clic, error de guardado y reimpresión sin duplicados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
