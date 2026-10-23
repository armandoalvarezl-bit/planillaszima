const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'code.gs'),'utf8'),ctx);
let session={usuario:'fragua',nombre:'Operador Fragua',peaje:'FRAGUA',rol:'PEAJE'};
const values=[];
let created=false,locked=false,emails=0,failEmail=false,sequence=0;
const sheet={
  getLastRow:()=>values.length,
  appendRow:row=>{assert.equal(locked,true);values.push(row.slice());},
  setFrozenRows(){},
  getRange(row,col,count=1,width=1){return {
    setFontWeight(){},
    getValues:()=>values.slice(row-1,row-1+count).map(r=>r.slice(col-1,col-1+width)),
    setValues:rows=>{assert.equal(locked,true);rows.forEach((r,i)=>r.forEach((value,j)=>{values[row-1+i][col-1+j]=value;}));}
  };}
};
Object.assign(ctx,{
  obtenerContextoUsuario_:data=>data.token?{ok:true,sesion:session}:{ok:false,error:'Sesion requerida'},
  getSpreadsheet_:()=>({getSheetByName:()=>created?sheet:null,insertSheet:()=>{created=true;return sheet;}}),
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})},
  Utilities:{getUuid:()=> 'uuid-'+(++sequence)},SpreadsheetApp:{flush(){}},
  obtenerEmailNotificacion_:()=> 'soporte@example.com',
  MailApp:{sendEmail:mail=>{emails++;assert.equal(mail.to,'soporte@example.com');assert.equal(mail.replyTo,'operador@example.com');if(failEmail)throw Error('Correo no disponible');}},
  jsonOutput_:value=>value
});
const data={token:'session',requestId:'request-123',titulo:'Error al guardar',mensaje:'No puedo guardar mi planilla de hoy.',email:'operador@example.com',categoria:'PLANILLAS',prioridad:'NORMAL'};
assert.equal(ctx.apiGet({action:'tickets'}).ok,false);
assert.equal(ctx.apiGet({action:'tickets',token:'session'}).rows.length,0);
assert.equal(created,false);
const first=ctx.apiPost({...data,action:'crearticket',usuario:'admin',peaje:'OTRO'});
assert.equal(first.ok,true);assert.equal(first.correoEnviado,true);assert.equal(locked,false);
assert.equal(values[1][3],'fragua');assert.equal(values[1][5],'FRAGUA');
assert.equal(ctx.crearTicket_(data).id,first.id);assert.equal(values.length,2);assert.equal(emails,1);
assert.throws(()=>ctx.crearTicket_({...data,titulo:'x'}),/asunto/);
assert.throws(()=>ctx.crearTicket_({...data,email:'invalido'}),/correo/);
assert.equal(ctx.actualizarTicket_({token:'session',id:first.id,estado:'RESUELTO',respuesta:'Listo',rol:'ADMIN'}).ok,false);
session={usuario:'zaragoza',peaje:'ZARAGOZA',rol:'PEAJE'};
assert.equal(ctx.listarTickets_({token:'session'}).rows.length,0);
session={usuario:'admin',rol:'ADMIN',peaje:'TODOS'};
assert.equal(ctx.listarTickets_({token:'session'}).rows.length,1);
assert.equal(ctx.listarTickets_({token:'session'}).admin,true);
assert.throws(()=>ctx.actualizarTicket_({token:'session',id:first.id,estado:'RESUELTO'}),/soluci/);
assert.equal(ctx.actualizarTicket_({token:'session',id:first.id,estado:'EN_PROCESO',respuesta:'Estamos revisando.'}).ok,true);
assert.equal(ctx.actualizarTicket_({token:'session',id:first.id,estado:'RESUELTO',respuesta:'Caso solucionado.'}).ok,true);
session={usuario:'fragua',peaje:'FRAGUA',rol:'PEAJE'};
assert.equal(ctx.listarTickets_({token:'session'}).rows[0].respuesta,'Caso solucionado.');
failEmail=true;
const saved=ctx.crearTicket_({...data,requestId:'request-456'});
assert.equal(saved.ok,true);assert.equal(saved.correoEnviado,false);assert.equal(values.length,3);
assert.equal(ctx.crearTicket_({...data,requestId:'request-456'}).id,saved.id);
assert.equal(emails,2);assert.equal(locked,false);
for(const name of ['soporte.js','zima-ui.js']) new vm.Script(fs.readFileSync(path.join(root,name),'utf8'));
console.log('OK: tickets, correo simulado, reintentos sin duplicados, permisos, seguimiento y persistencia si falla el correo.');
