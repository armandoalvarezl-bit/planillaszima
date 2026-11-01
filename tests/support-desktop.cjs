const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','control-soporte-core.js'),'utf8');
const storage=new Map(),notifications=[];
let permissionRequests=0,polls=0,stopped=0,token='support-session';
let result={ok:true,serverTime:'2026-10-31T12:00:00Z',usuarios:[],auditoria:[],tickets:[],eventos:[{id:'old',fecha:'2026-10-31T10:00:00Z',usuario:'fragua',nombre:'Fragua',peaje:'FRAGUA'}]};
class Notification {
  static permission='default';
  static async requestPermission(){permissionRequests++;Notification.permission='granted';return 'granted';}
  constructor(title,options){notifications.push({title,...options});}
}
const window={Notification,isSecureContext:true,dispatchEvent(){},focus(){}};
window.self=window.top=window;
const ctx=vm.createContext({window,Notification,Event:class{},document:{hidden:false,addEventListener(){}},location:{href:''},
  ZimaUI:{getSupportSession:()=>({token,usuario:'tecnico',rol:'SOPORTE'}),apiUrl:'https://example.test'},
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  setInterval:(fn,delay)=>{assert.equal(delay,30000);return 1;},clearInterval:()=>stopped++,
  google:{script:{run:{withSuccessHandler(resolve){return {withFailureHandler(){return {apiGet(){polls++;resolve(result);}};}};}}}}
});
window.google=ctx.google;
vm.runInContext(source,ctx);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  await tick();
  const core=window.ZimaSupportControl;
  assert.equal(permissionRequests,0);assert.equal(notifications.length,0);
  assert.equal(core.state().desktop,'disabled');
  assert.equal((await core.enable()).ok,true);assert.equal(permissionRequests,1);
  result={...result,eventos:[{id:'new',fecha:'2026-10-31T12:00:01Z',usuario:'zaragoza',nombre:'Operadora',peaje:'ZARAGOZA'},...result.eventos]};
  ctx.document.hidden=true;
  await core.refresh();
  assert.equal(notifications.length,1);assert.match(notifications[0].body,/Operadora/);assert.equal(notifications[0].tag,'zima-peaje-new');
  await core.refresh();assert.equal(notifications.length,1);
  assert.equal(core.test(),true);assert.equal(notifications.length,2);
  core.disable();assert.equal(core.state().desktop,'disabled');assert.equal(core.test(),false);
  Notification.permission='denied';assert.equal((await core.enable()).ok,false);assert.equal(permissionRequests,1);
  window.isSecureContext=false;assert.equal(core.state().desktop,'unavailable');assert.equal((await core.enable()).ok,false);
  result={ok:false,error:'Sesión expirada'};await core.refresh();assert.equal(core.state().error,'Sesión expirada');assert.equal(core.state().snapshot.eventos[0].id,'new');
  const before=polls;token='other-session';await core.refresh();assert.equal(polls,before);assert.ok(stopped);
  vm.runInContext(source,ctx);assert.equal(polls,before);
  console.log('OK: consentimiento explícito, sin avisos históricos/duplicados, segundo plano, prueba, desactivación, permiso bloqueado y cambio de sesión.');
})().catch(error=>{console.error(error);process.exitCode=1;});
