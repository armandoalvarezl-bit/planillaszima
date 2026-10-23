const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../zima-ui.js'), 'utf8');
const fn = source.slice(source.indexOf('  function installAdminTicketNotifications('), source.indexOf('  function installHolidayTheme('));
function setup(role = 'ADMIN', saved = []) {
  const storage = new Map([['ZIMA_ADMIN_TICKETS_REVIEWED:admin', JSON.stringify(saved)]]);
  const session = {usuario: 'admin', token: 'test-token', rol: role};
  const children = [];
  const events = {};
  let response = {ok: true, admin: true, rows: []};
  let polls = 0;
  let opened = 0;
  let interval;
  let soundInterval;
  let tones = 0;
  let now = Date.now();
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; }
    createOscillator() { return {frequency: {},connect(){},disconnect(){},start(){tones++;},stop(){}}; }
    createGain() { return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}; }
  }
  class Element {
    constructor() { this.hidden = false; this.children = []; this.events = {}; this.parts = {}; }
    appendChild(child) { this.children.push(child); }
    setAttribute(key, value) { this[key] = value; }
    addEventListener(key, fn) { this.events[key] = fn; }
    querySelector(key) { return this.parts[key] ||= new Element(); }
    remove() {}
  }
  const launcher = new Element();
  const menuLinks = [new Element(), new Element()];
  const modal = {hidden: true};
  const document = {
    hidden: false,
    head: {appendChild(el) {
      if (!el.src) return;
      polls++;
      const name = new URL(el.src).searchParams.get('callback');
      queueMicrotask(() => context.window[name](response));
    }},
    body: {appendChild(el) { children.push(el); }},
    createElement() { return new Element(); },
    getElementById() { return modal; },
    querySelectorAll() { return menuLinks; },
    addEventListener(key, fn) { events[key] = fn; }
  };
  const context = {document, location: {pathname: '/dashboard.html'}, getSupportSession: () => ({...session}),
    localStorage: {getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v)},
    setInterval: (fn,ms) => { if(ms===60000)interval=fn;else soundInterval=fn; }, setTimeout, clearTimeout, URLSearchParams, Date:{now:()=>now}, Math, Set,
    window: {AudioContext,addEventListener() {}}};
  vm.runInNewContext(fn + '\ninstallAdminTicketNotifications(launcher, openSupport);', {...context, launcher, openSupport() { opened++; }});
  return {children, launcher, menuLinks, modal, session, document, events, storage,
    setResponse(value) { response = value; },
    async refresh() { await interval?.(); await new Promise(resolve => setImmediate(resolve)); },
    async ring() { now+=15000; await soundInterval?.(); },
    tones: () => tones,
    polls: () => polls, opened: () => opened};
}
(async () => {
  const user = setup('PEAJE');
  assert.equal(user.polls(), 0, 'Un usuario de peaje no consulta notificaciones de admin');
  const admin = setup();
  await new Promise(resolve => setImmediate(resolve));
  const alert = admin.children[0];
  const badge = admin.launcher.children[0];
  const ticket = {id: 'ZT-1', estado: 'ABIERTO', nombre: 'María', titulo: '<img onerror=alert(1)>'};
  admin.setResponse({ok: true, admin: true, rows: [ticket]});
  await admin.refresh();
  assert.equal(alert.hidden, false);
  assert.equal(badge.textContent, '1');
  for(const link of admin.menuLinks){
    assert.equal(link.children[0].textContent,'1','El menú muestra el mismo contador');
    assert.equal(link.children[0].hidden,false);
    assert.match(link['aria-label'],/1 tickets pendientes/);
  }
  assert.equal(admin.tones(),2,'Suena un aviso de dos tonos');
  await admin.ring();
  assert.equal(admin.tones(),4,'Repite hasta abrir soporte');
  assert.deepEqual(JSON.parse(admin.storage.get('ZIMA_ADMIN_TICKETS_REVIEWED:admin')),[],'Mostrar el aviso no marca el ticket como revisado');
  assert.equal(alert.querySelector('p').textContent, 'María: <img onerror=alert(1)>', 'El contenido se inserta como texto');
  alert.querySelector('.ticket-review').events.click();
  assert.equal(admin.opened(), 1);
  assert.equal(alert.hidden, true);
  await admin.ring();
  assert.equal(admin.tones(),4,'Abrir soporte detiene el sonido');
  await admin.refresh();
  assert.equal(alert.hidden, true, 'No repite el mismo aviso');
  admin.modal.hidden = false;
  admin.setResponse({ok: true, admin: true, rows: [ticket, {...ticket, id: 'ZT-2'}]});
  await admin.refresh();
  assert.equal(alert.hidden, true, 'No avisa mientras soporte está abierto');
  admin.modal.hidden = true;
  await admin.refresh();
  assert.equal(alert.hidden, true, 'Los tickets consultados con soporte abierto quedan revisados');
  admin.setResponse({ok:true,admin:true,rows:[{...ticket,id:'ZT-3'}]});
  await admin.refresh();
  assert.equal(alert.hidden,false,'Un ticket posterior genera otro aviso');
  admin.events['zima-support-opened']();
  const tonesBefore=admin.tones();
  await admin.ring();
  assert.equal(admin.tones(),tonesBefore,'Abrir desde el menú también detiene el sonido');
  admin.setResponse({ok: true, admin: true, rows: [{...ticket, estado: 'RESUELTO'}]});
  await admin.refresh();
  assert.equal(badge.hidden, true);
  for(const link of admin.menuLinks)assert.equal(link.children[0].hidden,true,'Sin pendientes se oculta el número del menú');
  admin.setResponse({ok:true,admin:true,rows:Array.from({length:101},(_,i)=>({...ticket,id:'ZT-'+i,estado:'EN_PROCESO'}))});
  await admin.refresh();
  assert.equal(admin.menuLinks[0].children[0].textContent,'99+');
  assert.match(admin.menuLinks[0]['aria-label'],/101 tickets pendientes/);
  admin.setResponse({ok:true,admin:true,rows:[]});
  await admin.refresh();
  assert.equal(alert.hidden, true);
  admin.document.hidden = true;
  const before = admin.polls();
  await admin.refresh();
  assert.equal(admin.polls(), before, 'No consulta en pestañas ocultas');
  admin.document.hidden = false;
  admin.session.token = '';
  await admin.refresh();
  assert.equal(admin.polls(), before, 'Se detiene al cerrar sesión');
  console.log('OK: avisos admin, contador, no repetición, contenido seguro y pausa de consultas.');
})().catch(error => { console.error(error); process.exitCode = 1; });
