const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ctx=vm.createContext({Date,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','code.gs'),'utf8'),ctx);
const headers=vm.runInContext('ZIMA.USUARIOS_HEADERS.slice()',ctx);
function sheet(values){return {
  values,getLastRow:()=>values.length,getLastColumn:()=>headers.length,
  getDataRange:()=>({getValues:()=>values.map(row=>row.slice())}),
  appendRow:row=>values.push(row.slice()),
  getRange(row,col,count=1,width=1){return {
    getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>values[row-1+i]?.[col-1+j]??'')),
    setValue(value){values[row-1][col-1]=value;return this;},
    setValues(rows){rows.forEach((r,i)=>r.forEach((v,j)=>values[row-1+i][col-1+j]=v));return this;},setFontWeight(){return this;}
  };}
};}
function user(usuario,rol,peaje){const row=Array(headers.length).fill('');Object.entries({ID:usuario,USUARIO:usuario,CONTRASENA:'hash:original',NOMBRE:usuario,ROL:rol,PEAJE:peaje,ESTADO:'ACTIVO',FECHA_CREACION:new Date(),FECHA_CAMBIO_CONTRASENA:new Date()}).forEach(([key,value])=>row[headers.indexOf(key)]=value);return row;}
const users=sheet([headers,user('admin','ADMIN','TODOS'),user('tecnico','SOPORTE','TODOS'),user('fragua','PEAJE','FRAGUA')]);
const audit=sheet([['fecha','accion','id','codigo','usuario','detalle','email'],[new Date(),'UPDATE','p-1','P-1','admin','Total: 9000000','']]);
let locked=false,sequence=0;
const sessions={admin:{usuario:'admin',rol:'ADMIN',peaje:'TODOS',loginAt:new Date(Date.now()+1000).toISOString()},support:{usuario:'tecnico',rol:'ADMIN',peaje:'TODOS',loginAt:new Date(Date.now()+1000).toISOString()},peaje:{usuario:'fragua',rol:'PEAJE',peaje:'FRAGUA',loginAt:new Date(Date.now()-10000).toISOString()}};
Object.assign(ctx,{
  getSpreadsheet_:()=>({getSheetByName:name=>name==='USUARIOS'?users:name==='AUDITORIA'?audit:null}),
  prepararHojaUsuarios_:()=>users,crearUsuariosIniciales_:()=>{},prepararHojaAuditoria_:()=>audit,
  obtenerSesion_:token=>sessions[token]||null,
  guardarFotoUsuarioPersistente_:()=>{},
  hashContrasena_:password=>'hash:'+password,
  verificarContrasena_:(password,hash)=>hash==='hash:'+password,
  Utilities:{getUuid:()=> 'new-'+(++sequence)},SpreadsheetApp:{flush(){}},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},
  jsonOutput_:value=>value
});
const call=(action,data={})=>ctx.apiPost({action,token:'support',...data});
// El rol actual de USUARIOS prevalece sobre una sesión vieja con rol ADMIN.
assert.equal(ctx.obtenerContextoUsuario_({token:'support'}).sesion.rol,'SOPORTE');
assert.equal(ctx.apiGet({action:'usuarios',token:'support'}).usuarios.length,1);
assert.equal(ctx.apiGet({action:'usuarios',token:'support'}).usuarios[0].CONTRASENA,undefined);
for(const action of ['list','get','dashboard'])assert.equal(ctx.apiGet({action,token:'support',id:'p-1'}).ok,false);
for(const action of ['save','create','update','delete','permanentdelete'])assert.equal(call(action,{id:'p-1',total:10}).ok,false);
assert.equal(ctx.puedeAccederPlanilla_({rol:'SOPORTE',peaje:'TODOS'},{peaje:'FRAGUA'}),false);
assert.equal(call('cambiarcontrasenausuario',{usuario:'admin',nuevaContrasena:'secreta'}).ok,false);
assert.equal(call('crearusuario',{usuario:'elevado',nombre:'Mal',rol:'ADMIN',peaje:'TODOS',password:'secreta'}).ok,false);
assert.equal(call('crearusuario',{usuario:'global',nombre:'Mal',rol:'PEAJE',peaje:'TODOS',password:'secreta'}).ok,false);
assert.equal(call('crearusuario',{usuario:'zaragoza',nombre:'Operador',rol:'PEAJE',peaje:'ZARAGOZA',password:'secreta'}).verificado,true);
const target=ctx.buscarUsuario_('zaragoza');
assert.equal(target.ROL,'PEAJE');
assert.equal(target.CONTRASENA,'hash:secreta');
assert.equal(call('actualizarusuario',{usuario:'fragua',nombre:'Operadora',rol:'PEAJE',peaje:'FRAGUA',estado:'ACTIVO',nuevaContrasena:'nueva123'}).verificado,true);
assert.equal(ctx.buscarUsuario_('fragua').CONTRASENA,'hash:nueva123');
assert.equal(ctx.buscarUsuario_('fragua').NOMBRE,'Operadora');
assert.equal(ctx.obtenerContextoUsuario_({token:'peaje'}).ok,false); // Contraseña anterior revocada.
assert.equal(call('cambiarestadousuario',{usuario:'fragua',estado:'INACTIVO'}).verificado,true);
assert.equal(ctx.buscarUsuario_('fragua').ESTADO,'INACTIVO');
assert.equal(call('cambiarestadousuario',{usuario:'admin',estado:'INACTIVO'}).ok,false);
assert.equal(call('cambiarcontrasenausuario',{usuario:'zaragoza',nuevaContrasena:'ClaveReset789'}).verificado,true);
assert.equal(ctx.buscarUsuario_('zaragoza').CONTRASENA,'hash:ClaveReset789');
assert.equal(ctx.apiPost({action:'crearusuario',token:'admin',usuario:'otro-soporte',nombre:'Soporte',rol:'SOPORTE',peaje:'TODOS',password:'soporte123'}).ok,true);
assert.equal(ctx.buscarUsuario_('otro-soporte').ROL,'SOPORTE');
assert.equal(ctx.crearUsuario({usuario:'sin-sesion',rol:'ADMIN'}).ok,false);
assert.equal(ctx.cambiarContrasenaUsuario({usuario:'admin',nuevaContrasena:'invalida'}).ok,false);
assert.equal(ctx.apiGet({action:'auditoria',token:'peaje'}).ok,false);
const log=ctx.apiGet({action:'auditoria',token:'support'});
assert.equal(log.ok,true);
assert.ok(log.rows.some(row=>row.accion==='USER_PASSWORD'&&row.usuario==='tecnico'));
assert.doesNotMatch(JSON.stringify(log),/nueva123|ClaveReset789|soporte123|9000000/);
assert.equal(locked,false);
assert.equal(ctx.puedeGestionarSoporte_({rol:'SOPORTE'}),true);
assert.equal(ctx.doGet({parameter:{action:'usuarios',token:'support'}}).ok,true);
assert.equal(ctx.doPost({postData:{contents:JSON.stringify({action:'cambiarestadousuario',token:'support',usuario:'zaragoza',estado:'INACTIVO'})}}).verificado,true);
ctx.Utilities.formatDate=(date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const beforeLogin=audit.values.length;
ctx.registrarIngresoPeaje_({usuario:'admin',rol:'ADMIN',peaje:'TODOS'});
assert.equal(audit.values.length,beforeLogin);
ctx.registrarIngresoPeaje_({usuario:'fragua',nombre:'Operadora Fragua',rol:'PEAJE',peaje:'FRAGUA'});
assert.equal(audit.values.length,beforeLogin+1);
assert.equal(audit.values.at(-1)[1],'PEAJE_LOGIN');
assert.equal(ctx.apiGet({action:'controlsoporte'}).ok,false);
assert.equal(ctx.apiGet({action:'controlsoporte',token:'peaje'}).ok,false);
const control=ctx.apiGet({action:'controlsoporte',token:'support'});
assert.equal(control.ok,true);
assert.equal(control.eventos[0].peaje,'FRAGUA');
assert.equal(control.eventos[0].nombre,'Operadora Fragua');
assert.equal(control.usuarios.length,2);
assert.equal(control.usuarios[0].requiereCambioContrasena,false);
assert.doesNotMatch(JSON.stringify(control),/hash:|nueva123|9000000|"total"|"CONTRASENA"/);
for(const name of ['granadmin.html','login.html','control-soporte.html']){
  const html=fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(script,{filename:name});
}
async function probarTransporte(){
  const html=fs.readFileSync(path.join(__dirname,'..','granadmin.html'),'utf8');
  const transport=html.slice(html.indexOf('    function accessJsonp('),html.indexOf('    function normalizarUsuario('));
  let response={ok:false,error:'Cambio rechazado'};
  const browser=vm.createContext({URLSearchParams,window:{google:true},google:{script:{run:true}},sessionPayload:data=>({...data,token:'support'}),onlineRun:async(name,data)=>{assert.equal(name,'apiPost');assert.equal(data.token,'support');return response;}});
  vm.runInContext(transport,browser);
  await assert.rejects(browser.apiPost('cambiarcontrasenausuario',{usuario:'fragua',nuevaContrasena:'nueva123'}),/Cambio rechazado/);
  response={ok:true,verificado:true};
  assert.equal((await browser.apiPost('cambiarestadousuario',{usuario:'fragua',estado:'INACTIVO'})).verificado,true);
  browser.window.google=false;
  browser.fetch=async()=>{throw Error('Sin conexion');};
  await assert.rejects(browser.apiPost('actualizarusuario',{foto:'x'.repeat(7000)}),/No se pudo confirmar/);
}
probarTransporte().then(()=>console.log('OK: rol SOPORTE, cambios persistidos y verificados, contraseñas, sesiones revocadas, auditoría sin secretos, bloqueo financiero y errores de transporte.')).catch(error=>{console.error(error);process.exitCode=1;});
