const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'zima-ui.js'), 'utf8');
new vm.Script(source);
const sound = source.slice(source.indexOf('  let warningAudioContext;'), source.indexOf('  function confirmDialog('));
let contexts = 0;
const tones = [];
class AudioContext {
  constructor() {contexts++; this.state = 'suspended'; this.currentTime = 1;}
  async resume() {this.state = 'running';}
  createOscillator() {
    const tone = {frequency:{}, connect(){}, disconnect(){}, start(at){this.at=at;}, stop(at){this.end=at;}};
    tones.push(tone); return tone;
  }
  createGain() {return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
}
const context = vm.createContext({window:{AudioContext}});
vm.runInContext(sound, context);
(async () => {
  assert.equal(await context.playWarningSound(), true);
  assert.equal(tones.length, 4);
  assert.equal(tones[0].frequency.value, 740);
  assert.equal(tones[1].frequency.value, 554);
  assert.ok(tones[1].at > tones[0].end);
  assert.equal(await context.playWarningSound(), true);
  assert.equal(contexts, 1);
  assert.equal(await context.playWarningSound('success'), true);
  assert.equal(tones.length, 11);
  assert.equal(tones[8].type, 'triangle');
  assert.ok(tones[10].frequency.value > tones[8].frequency.value);
  const unsupported = vm.createContext({window:{}});
  vm.runInContext(sound, unsupported);
  assert.equal(await unsupported.playWarningSound(), false);
  const blocked = vm.createContext({window:{AudioContext:class {constructor(){throw Error('Audio bloqueado');}}}});
  vm.runInContext(sound, blocked);
  assert.equal(await blocked.playWarningSound(), false);
  console.log('OK: sonido breve de advertencia, contexto reutilizable y tolerancia a audio bloqueado o no disponible.');
})().catch(error=>{console.error(error);process.exitCode=1;});
