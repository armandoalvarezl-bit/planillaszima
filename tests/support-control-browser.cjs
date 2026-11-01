const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless','--no-sandbox','--disable-gpu','--no-first-run','--disable-background-networking','--remote-debugging-port=9355','--user-data-dir='+path.join(root,'.tmp','support-control-browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let tabs;
  for(let i=0;i<40;i++){try{tabs=await fetch('http://127.0.0.1:9355/json').then(r=>r.json());if(tabs.length)break;}catch(_){}await pause(250);}
  assert.ok(tabs?.length,'Edge no inició');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve));
  let seq=0;const pending=new Map();
  socket.addEventListener('message',event=>{const response=JSON.parse(event.data);if(response.id){const item=pending.get(response.id);pending.delete(response.id);response.error?item.reject(Error(response.error.message)):item.resolve(response.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;};
  await call('Page.enable');await call('Network.enable');
  await call('Runtime.enable');
  const errors=[];
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails.exception?.description||r.params.exceptionDetails.text);});
  await call('Network.setBlockedURLs',{urls:['*script.google.com*','*fonts.googleapis.com*','*fonts.gstatic.com*','*cdn.jsdelivr.net*']});
  const data={ok:true,serverTime:'2026-10-31T18:30:00Z',usuarios:[
    {usuario:'fragua',nombre:'Marliza Herazo',peaje:'FRAGUA',estado:'ACTIVO',ultimoIngreso:'2026-10-31T18:22:00Z',ingresoHoy:true,requiereCambioContrasena:false},
    {usuario:'zaragoza',nombre:'Adriana Espitia',peaje:'ZARAGOZA',estado:'ACTIVO',ultimoIngreso:'2026-10-31T18:14:00Z',ingresoHoy:true,requiereCambioContrasena:false},
    {usuario:'turno2',nombre:'Operador de relevo',peaje:'FRAGUA',estado:'ACTIVO',ultimoIngreso:'2026-10-30T18:00:00Z',ingresoHoy:false,requiereCambioContrasena:true},
    {usuario:'temporal',nombre:'Cuenta temporal',peaje:'ZARAGOZA',estado:'INACTIVO',ultimoIngreso:'',ingresoHoy:false,requiereCambioContrasena:false}],
    eventos:[{id:'login-1',fecha:'2026-10-31T18:22:00Z',nombre:'Marliza Herazo',usuario:'fragua',peaje:'FRAGUA'},{id:'login-2',fecha:'2026-10-31T18:14:00Z',nombre:'Adriana Espitia',usuario:'zaragoza',peaje:'ZARAGOZA'},{id:'login-3',fecha:'2026-10-31T16:20:00Z',nombre:'Marliza Herazo',usuario:'fragua',peaje:'FRAGUA'}],
    tickets:[{id:'ZT-1',titulo:'Revisar acceso al historial de planillas',estado:'ABIERTO',prioridad:'ALTA',peaje:'FRAGUA',updatedAt:'2026-10-31T18:20:00Z'},{id:'ZT-2',titulo:'Acompañamiento para renovar contraseña',estado:'EN_PROCESO',prioridad:'NORMAL',peaje:'ZARAGOZA',updatedAt:'2026-10-31T17:00:00Z'},{id:'ZT-3',titulo:'Validar los datos de mi perfil',estado:'ABIERTO',prioridad:'NORMAL',peaje:'FRAGUA',updatedAt:'2026-10-31T16:30:00Z'}],
    auditoria:[{fecha:'2026-10-31T18:25:00Z',accion:'USER_STATUS',usuario:'soporte',detalle:'Usuario: temporal · Cambios: estado'},{fecha:'2026-10-31T18:20:00Z',accion:'USER_PASSWORD',usuario:'soporte',detalle:'Usuario: turno2 · Contraseña renovada'},{fecha:'2026-10-31T18:14:00Z',accion:'PEAJE_LOGIN',usuario:'zaragoza',detalle:'Ingreso al sistema · ZARAGOZA'}]};
  const injection=`localStorage.clear();localStorage.setItem('ZIMA360_SESION',JSON.stringify({usuario:'soporte',nombre:'Equipo de soporte',rol:'SOPORTE',token:'preview-token'}));window.__controlData=${JSON.stringify(data)};window.__notifications=[];window.google={script:{run:{withSuccessHandler(resolve){return {withFailureHandler(){return {apiGet(payload){resolve(payload.action==='controlsoporte'?window.__controlData:{ok:true,rows:[],admin:true});}};}};}}}};Object.defineProperty(window,'isSecureContext',{value:true});window.Notification=class{static permission='default';static async requestPermission(){this.permission='granted';return 'granted';}constructor(title,options){window.__notifications.push({title,...options});}};`;
  const html=fs.readFileSync(path.join(root,'control-soporte.html'),'utf8').replace('<head>','<head><meta charset="utf-8"><base href="'+pathToFileURL(root+path.sep).href+'"><script>'+injection+'</script>');
  const fixture=path.join(root,'.tmp','control-soporte.html');fs.writeFileSync(fixture,html);
  await call('Page.navigate',{url:pathToFileURL(fixture).href});
  for(let i=0;i<40;i++){await pause(100);if(await evaluate('document.getElementById("metricTickets")?.textContent==="3"'))break;}
  assert.equal(await evaluate('document.getElementById("metricActive").textContent'),'3');
  assert.equal(await evaluate('document.getElementById("metricToday").textContent'),'2');
  assert.equal(await evaluate('window.__notifications.length'),0);
  await evaluate('document.getElementById("openDesktop").click();document.getElementById("enableDesktop").click()');await pause(80);
  assert.equal(await evaluate('ZimaSupportControl.state().desktop'),'enabled');
  await evaluate('document.getElementById("desktopDialog").close();window.__controlData.eventos.unshift({id:"login-new",fecha:"2026-10-31T18:31:00Z",nombre:"Nuevo ingreso",usuario:"turno2",peaje:"FRAGUA"});ZimaSupportControl.refresh()');
  assert.equal(await evaluate('window.__notifications.length'),1);
  await evaluate('ZimaSupportControl.refresh()');assert.equal(await evaluate('window.__notifications.length'),1);
  for(const width of [1440,390,320]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<800});await pause(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'Desborde a '+width);
    await evaluate('document.getElementById("tab-accesos").click();document.querySelector("[data-validate]").click()');
    assert.equal(await evaluate('document.getElementById("accessDialog").open'),true);
    assert.match(await evaluate('document.getElementById("accessDetail").textContent'),/Acceso habilitado/);
    await evaluate('document.getElementById("accessDialog").close();document.getElementById("tab-auditoria").click();document.getElementById("auditType").value="USER_";document.getElementById("auditType").dispatchEvent(new Event("change"))');
    assert.equal(await evaluate('document.querySelectorAll("#auditRows tr").length'),2);
    await evaluate('document.getElementById("tab-resumen").click();scrollTo(0,0)');
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(root,'.tmp','support-control-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
  await evaluate('const oldCreate=URL.createObjectURL;URL.createObjectURL=blob=>{window.__exported=blob;return oldCreate(blob)};const oldElement=document.createElement.bind(document);document.createElement=function(tag){const el=oldElement(tag);if(tag==="a")el.click=()=>{};return el;};document.getElementById("exportAudit").click()');
  assert.match(await evaluate('window.__exported.text()'),/Usuario: temporal/);
  await evaluate('document.querySelector("[data-ticket-inbox]").click()');
  assert.equal(await evaluate('document.getElementById("panel-tickets").hidden'),false);
  assert.equal(await evaluate('document.getElementById("controlTicketsFrame").getAttribute("src")'),'soporte.html?embed=1');
  assert.equal(await evaluate('!!document.querySelector(".sidebar")'),true);
  await evaluate('document.getElementById("tab-resumen").click()');
  assert.equal(await evaluate('document.getElementById("panel-tickets").hidden'),true);
  await evaluate('document.querySelector("[data-user-manager]").click()');
  assert.equal(await evaluate('document.getElementById("panel-usuarios").hidden'),false);
  assert.equal(await evaluate('document.getElementById("controlUsersFrame").getAttribute("src")'),'granadmin.html?embed=1');
  await evaluate('document.getElementById("tab-resumen").click()');
  assert.equal(await evaluate('document.getElementById("panel-usuarios").hidden'),true);
  const sharedFixture=path.join(root,'.tmp','granadmin.html');
  fs.writeFileSync(sharedFixture,'<!doctype html><html><head><meta charset="utf-8"><base href="'+pathToFileURL(root+path.sep).href+'"><script>'+injection+'</script></head><body><aside class="sidebar"><nav><a href="soporte.html">Tickets</a></nav></aside><main class="main"><header class="topbar"><div class="userbox">Soporte</div></header></main><script src="zima-ui.js"></script></body></html>');
  await call('Page.navigate',{url:pathToFileURL(sharedFixture).href});
  for(let i=0;i<40;i++){await pause(100);if(await evaluate('!!document.getElementById("zimaDesktopLauncher") && !!window.ZimaSupportControl'))break;}
  assert.equal(await evaluate('!!document.getElementById("zimaDesktopLauncher")'),true,'El acceso a notificaciones debe aparecer fuera del inicio');
  assert.equal(await evaluate('Notification.permission'),'default','No solicitar permisos al cargar');
  await evaluate('document.getElementById("zimaDesktopLauncher").click()');
  assert.equal(await evaluate('document.querySelector(".zima-desktop-settings").open'),true);
  await evaluate('document.querySelector("[data-desktop-enable]").click()');await pause(80);
  assert.equal(await evaluate('Notification.permission'),'granted');
  await evaluate('document.querySelector("[data-desktop-test]").click()');
  assert.equal(await evaluate('window.__notifications.length'),1);
  await evaluate('document.querySelector("[data-desktop-close]").click()');
  let ticketNavigation=false;
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.method==='Page.frameRequestedNavigation' && /\/control-soporte\.html#tickets$/.test(r.params.url))ticketNavigation=true;});
  await evaluate('document.querySelector("#zimaSupportLauncher .support-fab").click()');await pause(120);
  assert.equal(ticketNavigation,true,'Soporte abre tickets mediante navegaci\u00f3n normal');
  assert.deepEqual(errors,[]);
  console.log('OK: centro de control en escritorio y móvil, validación, filtros de auditoría, CSV y avisos nuevos sin duplicados.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill();});
