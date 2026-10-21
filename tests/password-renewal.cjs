const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'code.gs'), 'utf8');
const context = vm.createContext({ console, Date, JSON });
vm.runInContext(source, context);
for (const file of ['login.html', 'dashboard.html']) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    new vm.Script(script, { filename: file });
  }
}
const policy = context.estadoContrasena_;
assert.equal(policy({ FECHA_CREACION: '2026-07-21T12:00:00Z' }, new Date('2026-10-21T11:59:59Z')).requiereCambioContrasena, false);
assert.equal(policy({ FECHA_CREACION: '2026-07-21T12:00:00Z' }, new Date('2026-10-21T12:00:00Z')).requiereCambioContrasena, true);
assert.equal(policy({ FECHA_CREACION: '2025-11-30T12:00:00Z' }, new Date('2026-02-28T12:00:00Z')).venceContrasena, '2026-02-28T12:00:00.000Z');
assert.equal(policy({ FECHA_CREACION: '2023-11-30T12:00:00Z' }, new Date('2024-02-29T12:00:00Z')).venceContrasena, '2024-02-29T12:00:00.000Z');
assert.equal(policy({}).requiereCambioContrasena, true);
assert.equal(policy({ FECHA_CREACION: 'inválida' }).requiereCambioContrasena, true);
assert.equal(policy({ FECHA_CREACION: '2020-01-01', FECHA_CAMBIO_CONTRASENA: new Date() }).requiereCambioContrasena, false);
const renovado = { FECHA_CREACION: '2020-01-01', FECHA_CAMBIO_CONTRASENA: '2026-10-21T12:00:00Z' };
for (const fecha of ['2026-10-21T12:00:00Z', '2026-11-21T12:00:00Z', '2026-12-21T12:00:00Z', '2027-01-21T11:59:59Z']) {
  assert.equal(policy(renovado, new Date(fecha)).requiereCambioContrasena, false);
}
assert.equal(policy(renovado, new Date('2027-01-21T12:00:00Z')).requiereCambioContrasena, true);

const headers = vm.runInContext('ZIMA.USUARIOS_HEADERS.slice()', context);
const hash = value => 'hash:' + Buffer.from(value).toString('hex');
const row = ['1', 'prueba', hash('anterior'), 'Prueba', 'PEAJE', 'ZIMA', 'ACTIVO', new Date('2020-01-01'), '', '', '', '', '', ''];
let sessionsCreated = 0;
const sh = {
  getLastRow: () => 2,
  getLastColumn: () => headers.length,
  getDataRange: () => ({ getValues: () => [headers.slice(), row.slice()] }),
  getRange(r, c, count, width) {
    return {
      getValues: () => [headers, row].slice(r - 1, r - 1 + (count || 1)).map(values => values.slice(c - 1, c - 1 + width)),
      setValue(value) { row[c - 1] = value; return this; }
    };
  }
};
Object.assign(context, {
  getSpreadsheet_: () => ({}), prepararHojaUsuarios_: () => sh,
  crearUsuariosIniciales_: () => {},
  hashContrasena_: hash,
  esHashContrasena_: value => value.startsWith('hash:'),
  verificarContrasena_: (value, stored) => stored === hash(value),
  obtenerFotoUsuarioPersistente_: () => '',
  notificarIngresoPlataforma_: () => {},
  crearSesion_: () => { sessionsCreated++; return 'token'; },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  SpreadsheetApp: { flush() {} },
  parsePost_: e => e,
  jsonOutput_: value => value,
  errorMessage_: e => e.message
});
const expired = context.autenticarUsuario('prueba', 'anterior');
assert.equal(expired.requiereCambioContrasena, true);
assert.equal(expired.token, undefined);
assert.equal(sessionsCreated, 0);
const change = { action: 'renovarcontrasena', usuario: 'prueba', passwordActual: 'anterior', nuevaContrasena: 'nueva clave ', confirmarContrasena: 'nueva clave ' };
for (const invalid of [
  { passwordActual: 'incorrecta' }, { nuevaContrasena: 'corta', confirmarContrasena: 'corta' },
  { confirmarContrasena: 'diferente' }, { nuevaContrasena: 'anterior', confirmarContrasena: 'anterior' }
]) {
  assert.equal(context.doPost({ ...change, ...invalid }).ok, false);
  assert.equal(row[2], hash('anterior'));
  assert.equal(row[13], '');
}
row[6] = 'INACTIVO';
assert.equal(context.doPost(change).ok, false);
row[6] = 'ACTIVO';
assert.equal(context.doPost(change).ok, true);
assert.equal(row[2], hash('nueva clave '));
assert.ok(row[13] instanceof Date);
assert.equal(context.autenticarUsuario('prueba', 'anterior').ok, false);
assert.equal(context.autenticarUsuario('prueba', 'nueva clave ').ok, true);
assert.equal(sessionsCreated, 1);
const fechaGuardada = row[13].getTime();
for (let ingreso = 0; ingreso < 3; ingreso++) {
  assert.equal(context.autenticarUsuario('prueba', 'nueva clave ').ok, true);
  assert.equal(row[13].getTime(), fechaGuardada);
}
context.buscarUsuario_ = () => Object.fromEntries(headers.map((key, i) => [key, row[i]]));
context.obtenerSesion_ = () => ({ usuario: 'prueba', loginAt: '2020-01-01' });
assert.equal(context.obtenerContextoUsuario_({ token: 'viejo' }).ok, false);
context.obtenerSesion_ = () => ({ usuario: 'prueba', loginAt: new Date().toISOString() });
assert.equal(context.obtenerContextoUsuario_({ token: 'nuevo' }).ok, true);
row[13] = new Date('2020-01-01');
assert.equal(context.obtenerContextoUsuario_({ token: 'nuevo' }).requiereCambioContrasena, true);

// Una columna adicional no debe causar solicitudes de cambio repetidas.
headers.splice(13, 0, 'NOTAS');
row.splice(13, 0, 'Conservar este dato');
assert.equal(context.autenticarUsuario('prueba', 'nueva clave ').requiereCambioContrasena, true);
assert.equal(context.doPost({ ...change, passwordActual: 'nueva clave ' }).ok, false);
const segundaRenovacion = { ...change, passwordActual: 'nueva clave ', nuevaContrasena: 'otra nueva clave', confirmarContrasena: 'otra nueva clave' };
assert.equal(context.doPost(segundaRenovacion).ok, true);
assert.equal(row[13], 'Conservar este dato');
assert.ok(row[14] instanceof Date);
assert.equal(context.autenticarUsuario('prueba', 'otra nueva clave').ok, true);
assert.equal(context.obtenerUsuariosDesdeHoja_(sh)[0].FECHA_CAMBIO_CONTRASENA.getTime(), row[14].getTime());
assert.equal(context.obtenerContextoUsuario_({ token: 'nuevo' }).ok, true);

async function probarFormulario() {
  const elements = new Map();
  const el = id => {
    if (!elements.has(id)) elements.set(id, {
      value: '', hidden: id === 'passwordChangeForm', disabled: false,
      textContent: '', type: 'password', handlers: {},
      addEventListener(event, callback) { this.handlers[event] = callback; },
      focus() {}, setAttribute() {},
      classList: { add() {}, remove() {}, contains() { return false; } },
      reset() { for (const field of ['changeUsuario', 'passwordActual', 'newPassword', 'confirmPassword']) el(field).value = ''; }
    });
    return elements.get(id);
  };
  let requests = [];
  const saved = new Map();
  let reply = { ok: false, requiereCambioContrasena: true, usuario: 'prueba' };
  const browser = vm.createContext({
    console, URLSearchParams, AbortSignal,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    sessionStorage: { setItem() {}, removeItem() {} },
    window: { addEventListener() {}, location: {} },
    document: { getElementById: el, addEventListener() {} },
    setTimeout() {}, clearTimeout() {},
    fetch: async (url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, text: async () => JSON.stringify(reply), json: async () => reply };
    }
  });
  const html = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)[1];
  vm.runInContext(script, browser);
  const submit = id => el(id).handlers.submit({ preventDefault() {} });
  el('usuario').value = 'prueba';
  el('password').value = 'anterior';
  await submit('loginForm');
  assert.equal(el('loginForm').hidden, true);
  assert.equal(el('passwordChangeForm').hidden, false);
  assert.equal(el('passwordActual').value, 'anterior');
  assert.equal(saved.has('ZIMA360_SESION'), false);
  el('newPassword').value = 'nueva clave';
  el('confirmPassword').value = 'otra clave';
  await submit('passwordChangeForm');
  assert.equal(requests.length, 1);
  el('confirmPassword').value = 'nueva clave';
  reply = { ok: false, error: 'No se pudo guardar' };
  await submit('passwordChangeForm');
  assert.equal(el('passwordChangeForm').hidden, false);
  assert.equal(el('status').textContent, 'No se pudo guardar');
  assert.equal(el('savePasswordButton').disabled, false);
  reply = { ok: true };
  await submit('passwordChangeForm');
  assert.equal(requests.at(-1).action, 'renovarcontrasena');
  assert.equal(requests.at(-1).passwordActual, 'anterior');
  assert.equal(el('passwordChangeForm').hidden, true);
  assert.equal(el('loginForm').hidden, false);
  assert.equal(el('newPassword').value, '');
  assert.equal(el('passwordActual').value, '');
  assert.equal(saved.has('ZIMA360_SESION'), false);
}
probarFormulario().then(() => {
  console.log('OK: vigencia, renovación por POST, validaciones, persistencia, acceso, sesiones y flujo del formulario.');
}).catch(error => { console.error(error); process.exitCode = 1; });
