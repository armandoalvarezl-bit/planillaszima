const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const events = {};
const ctx = vm.createContext({ self: { addEventListener: (name, fn) => { events[name] = fn; }, registration: { scope: 'https://example.com/zima/' } }, URL });
const source = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
vm.runInContext(source, ctx);
for (const asset of vm.runInContext('APP_SHELL', ctx)) assert.ok(fs.existsSync(path.join(root, asset)), 'Missing precached asset: ' + asset);
let handled = false;
events.fetch({ request: { method: 'GET', url: 'https://script.google.com/macros/s/test/exec?action=login&password=private' }, respondWith() { handled = true; } });
assert.equal(handled, false, 'API responses must never enter static caches');
for (const name of ['login', 'dashboard', 'planilla', 'historial', 'informes', 'granadmin', 'soporte']) {
  const html = fs.readFileSync(path.join(root, name + '.html'), 'utf8');
  assert.ok(html.includes('src="zima-offline.js"'), name + ' must load offline support');
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script, { filename: name + '.html' });
}
for (const name of ['zima-offline.js', 'zima-ui.js', 'soporte.js', 'zima-offline-tutorial.js']) new vm.Script(fs.readFileSync(path.join(root, name), 'utf8'), { filename: name });
assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'))).start_url, 'login.html');
console.log('OK: complete shell, inline and shared JavaScript syntax, ZIMA manifest, no cached API credentials.');
