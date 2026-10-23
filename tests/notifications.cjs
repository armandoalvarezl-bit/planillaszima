const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'zima-updates.js'), 'utf8');
const stored = new Map();
function setup(holiday = false, now = Date.parse('2026-10-24T06:00:00-05:00')) {
  const events = {};
  const dialogs = [];
  let tones = 0;
  class Audio {
    constructor() { this.state = 'suspended'; this.currentTime = 0; }
    async resume() { this.state = 'running'; }
    createOscillator() { return {frequency:{value:0},connect(){},start(){tones++;},stop(){},disconnect(){}}; }
    createGain() { return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}}; }
  }
  const context = vm.createContext({
    window:{AudioContext:Audio},
    document:{body:{classList:{contains:()=>holiday}},addEventListener:(event,handler)=>{events[event]=handler;}},
    Date:{now:()=>now,parse:Date.parse},
    navigator:{userActivation:{isActive:false}},
    localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    ZimaUI:{confirm:async options=>{dialogs.push(options); return true;}}
  });
  vm.runInContext(source,context);
  return {context, api:context.window.ZimaUpdates, events,dialogs,tones:()=>tones};
}
(async () => {
  const first = setup();
  await first.api.announce('peaje1');
  assert.equal(first.dialogs.length,1);
  assert.equal(first.tones(),0);
  first.context.navigator.userActivation.isActive=true;
  first.events.pointerdown();
  await new Promise(setImmediate);
  assert.equal(first.tones(),2);
  await first.api.announce('peaje1');
  assert.equal(first.dialogs.length,1);
  const nextLogin=setup();
  await nextLogin.api.announce('peaje1');
  assert.equal(nextLogin.dialogs.length,0);
  await nextLogin.api.announce('peaje2');
  assert.equal(nextLogin.dialogs.length,1);
  stored.set('ZIMA_RELEASE_SEEN:peaje1','old-release');
  const newRelease=setup();
  await newRelease.api.announce('peaje1');
  assert.equal(newRelease.dialogs.length,1);
  const rows=[{id:'1',updatedAt:'ayer',total:100}];
  first.api.observe(rows);
  first.api.observe(rows);
  assert.equal(first.tones(),2);
  first.api.observe([{...rows[0],updatedAt:'hoy'}]);
  assert.equal(first.tones(),4);
  const preview = setup(true, Date.parse('2026-10-23T16:40:00-05:00'));
  await preview.api.announce('navidad');
  assert.equal(preview.dialogs[0].tone, 'holiday');
  const holiday = setup(true);
  await holiday.api.announce('navidad');
  assert.equal(holiday.dialogs[0].tone, 'holiday', 'La prueba no oculta el saludo de mañana');
  await holiday.api.announce('navidad');
  assert.equal(holiday.dialogs.filter(d=>d.tone==='holiday').length, 1);
  const returnVisit = setup(true);
  await returnVisit.api.announce('navidad');
  assert.equal(returnVisit.dialogs.filter(d=>d.tone==='holiday').length, 0);
  for(const [,script] of fs.readFileSync(path.join(root,'dashboard.html'),'utf8').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(script);
  console.log('OK: avisos por usuario y versión, sonido tras interacción y nuevos cambios sin repetir al sincronizar.');
})().catch(error=>{console.error(error);process.exitCode=1;});
