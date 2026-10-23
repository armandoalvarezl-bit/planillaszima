const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../zima-ui.js'), 'utf8');
const start = source.indexOf('  function installHolidayTheme()');
const end = source.indexOf('  window.ZimaUI =', start);
const boundary = Date.parse('2026-10-24T06:00:00-05:00');
let now = boundary - 1;
let timer;
let delay;
const added = [];
const classes = [];
let removed = 0;
const events = {};
const win = {addEventListener(type, fn) { events[type] = fn; }};
win.self = win.top = win;
const doc = {
  createElement: () => ({setAttribute() {}, remove() { removed++; }}),
  head: {appendChild(el) { added.push(el); }},
  body: {classList: {add(value) { classes.push(value); }, remove(value) { classes.splice(classes.indexOf(value), 1); }}, appendChild(el) { added.push(el); }},
  querySelectorAll: selector => selector.startsWith('#zimaHolidayStyle') ? added : [],
  addEventListener(type, fn) { events[type] = fn; }
};
vm.runInNewContext(source.slice(start, end) + '\ninstallHolidayTheme();', {
  window: win, document: doc,
  Date: {parse: Date.parse, now: () => now},
  setTimeout(fn, ms) { timer = fn; delay = ms; }, clearTimeout() {}
});
assert.equal(added.length, 0, 'No debe decorar antes de las 6 a. m.');
assert.equal(delay, 1);
now = boundary;
timer();
assert.deepEqual(classes, ['zima-holiday']);
assert.equal(added.length, 2, 'Activa estilos y borde decorativo a las 6 a. m.');
assert.match(added[0].textContent, /@media print/);
events.focus();
events.visibilitychange();
assert.equal(added.length, 2, 'No duplica adornos al volver a la pestaña');
console.log('OK: activación a las 06:00 de Colombia, sin adornos anticipados ni duplicados.');
added.length = 0;
classes.length = 0;
const preview = /const previewUntil = Date.parse\('([^']+)'\)/.exec(source)[1];
now = Date.parse(preview) - 1;
vm.runInNewContext(source.slice(start, end) + '\ninstallHolidayTheme();', {
  window: win, document: doc,
  Date: {parse: Date.parse, now: () => now},
  setTimeout(fn, ms) { timer = fn; delay = ms; }, clearTimeout() {}
});
assert.equal(added.length, 2, 'Vista previa activa inmediatamente');
assert.equal(delay, 1);
now++;
timer();
assert.equal(removed, 2, 'Al vencer retira los adornos y estilos');
assert.equal(classes.length, 0);
console.log('OK: vista previa temporal y regreso automático al diseño habitual.');
