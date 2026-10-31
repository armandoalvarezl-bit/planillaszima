const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const elements = new Map();
const el = id => {
  if (!elements.has(id)) elements.set(id, {
    value:'', innerHTML:'', textContent:'', disabled:false, open:false, events:{},
    addEventListener(type, fn) { this.events[type] = fn; },
    reset() {}, showModal() {this.open = true;}, close() {this.open = false;}
  });
  return elements.get(id);
};
let admin = false, fail = false, writes = 0;
let ticket = {id:'ZT-1',titulo:'Error de planilla',usuario:'fragua',peaje:'FRAGUA',mensaje:'<script>inseguro</script>',estado:'ABIERTO',conversacion:[]};
const context = vm.createContext({
  document:{getElementById:el}, location:{search:''}, URLSearchParams,
  window:{google:true, crypto:{randomUUID:()=> 'request-test-123'}},
  crypto:{randomUUID:()=> 'request-test-123'}, google:{script:{run:{
    withSuccessHandler(resolve) { return {withFailureHandler(reject) { return {
      apiGet() {resolve({ok:true,rows:[ticket],admin});},
      apiPost(payload) {
        writes++;
        if(fail) {reject(Error('Sin conexión'));return;}
        assert.equal(payload.action,'responderticket');
        assert.equal(payload.id,'ZT-1');
        assert.ok(payload.requestId);
        ticket={...ticket,conversacion:[{usuario:'fragua',rol:'PEAJE',mensaje:payload.respuesta,fecha:'2026-10-31T12:00:00Z'}]};
        resolve({ok:true});
      }
    };}};}
  }}},
  ZimaUI:{escapeHtml:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),
    getSupportSession:()=>({token:'test',usuario:'fragua'}), notice() {}}
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','soporte.js'),'utf8'), context);
const tick = () => new Promise(resolve=>setImmediate(resolve));
(async () => {
  await tick();
  assert.match(el('tickets').innerHTML,/Ver conversación y responder/);
  assert.doesNotMatch(el('tickets').innerHTML,/<details|<textarea/);
  el('tickets').events.click({target:{closest:()=>({dataset:{ticket:'ZT-1'}})}});
  assert.equal(el('ticketDialog').open,true);
  assert.equal(el('replyStateField').hidden,true);
  assert.match(el('conversationMessages').innerHTML,/&lt;script&gt;/);
  el('replyMessage').value='Todavía no funciona';
  fail=true;
  await el('replyForm').events.submit({preventDefault(){}});
  assert.equal(el('replyMessage').value,'Todavía no funciona');
  assert.equal(el('sendReply').disabled,false);
  fail=false;
  await el('replyForm').events.submit({preventDefault(){}});
  assert.equal(writes,2);
  assert.equal(el('replyMessage').value,'');
  assert.match(el('conversationMessages').innerHTML,/Todavía no funciona/);
  admin=true;
  await el('refresh').events.click();
  assert.equal(el('replyStateField').hidden,false);
  el('closeConversation').events.click();
  assert.equal(el('ticketDialog').open,false);
  console.log('OK: modal compacto, respuestas de peaje y admin, escape HTML y conservación del texto si falla el envío.');
})().catch(error=>{console.error(error);process.exitCode=1;});
