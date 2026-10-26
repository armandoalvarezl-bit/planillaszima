const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const assert = require('node:assert/strict');
const source = readFileSync(require('node:path').join(__dirname, '../zima-ui.js'), 'utf8');
const limit = 15 * 60 * 1000;
function setup(page = 'dashboard.html', elapsed = 0) {
  let now = 2000000;
  const values = new Map([['ZIMA_LAST_ACTIVITY', String(now - elapsed)], ['ZIMA_SESSION_TOKEN', 'token']]);
  const localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const events = {};
  let redirect, timer;
  const listen = (name, fn) => { events[name] = fn; };
  runInNewContext(source, {
    localStorage, sessionStorage: { removeItem() {}, getItem() { return null; } },
    fetch: () => Promise.resolve({}),
    Date: { now: () => now },
    setTimeout: fn => { timer = fn; return 1; }, clearTimeout() {},
    window: { location: { pathname: '/' + page, replace: url => { redirect = url; } }, addEventListener: listen },
    document: { readyState: 'loading', addEventListener: listen }
  });
  return { values, events, advance: ms => { now += ms; }, tick: () => timer(), redirect: () => redirect };
}
let tab = setup();
tab.advance(limit); tab.tick();
assert.equal(tab.redirect(), 'login.html?motivo=inactividad');
assert.equal(tab.values.has('ZIMA_SESSION_TOKEN'), false);
tab = setup();
tab.advance(limit - 1000); tab.events.keydown();
tab.advance(2000); tab.tick();
assert.equal(tab.redirect(), undefined, 'Typing renews the timeout');
tab = setup(); tab.advance(limit); tab.events.pointerdown();
assert.ok(tab.redirect(), 'Activity after suspension cannot revive an expired session');
assert.ok(setup('historial.html', limit).redirect(), 'Expired session stays expired across navigation');
tab = setup(); tab.values.set('ZIMA_LAST_ACTIVITY', '2800000');
tab.advance(limit); tab.events.storage({ key: 'ZIMA_LAST_ACTIVITY' });
assert.equal(tab.redirect(), undefined, 'Activity in another tab renews the session');
tab.values.delete('ZIMA_LAST_ACTIVITY'); tab.events.storage({ key: 'ZIMA_LAST_ACTIVITY' });
assert.ok(tab.redirect(), 'Logout propagates across tabs');
assert.equal(setup('login.html', limit).redirect(), undefined);
console.log('Idle logout checks passed');
