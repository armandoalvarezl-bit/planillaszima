const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run',
  '--disable-background-networking','--remote-debugging-port=9347',
  '--user-data-dir='+path.resolve(root,'../edge-layout-check'),'about:blank'
],{stdio:'ignore',windowsHide:true});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let tabs;
  for(let i=0;i<40;i++){
    try{tabs=await fetch('http://127.0.0.1:9347/json').then(r=>r.json());if(tabs.length)break;}catch{}
    await pause(250);
  }
  assert(tabs?.length,'Edge no inició');
  socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  let seq=0;const pending=new Map();
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data);if(r.id){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(r.error.message)):p.resolve(r.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  await call('Page.enable');
  await call('Network.enable');
  await call('Network.setBlockedURLs',{urls:['*cdn.jsdelivr.net*','*fonts.googleapis.com*','*fonts.gstatic.com*']});
  await call('Page.navigate',{url:pathToFileURL(path.join(root,'preview-navidad/index.html')).href});
  for(let i=0;i<40;i++){
    const ready=await call('Runtime.evaluate',{expression:"!!(document.querySelector('.login-card') && window.ZimaUI)",returnByValue:true});
    if(ready.result.value)break;
    await pause(250);
  }
  for(const width of [1440,768,390,320]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<800});
    await pause(200);
    const result=await call('Runtime.evaluate',{expression:`JSON.stringify({width:innerWidth,scroll:document.documentElement.scrollWidth,boxes:[...document.querySelectorAll('.login-card')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width};})})`,returnByValue:true});
    const metrics=JSON.parse(result.result.value);
    assert(metrics.scroll<=width+1,JSON.stringify(metrics));
    for(const box of metrics.boxes)assert(box.left>=0&&box.right<=width+1,JSON.stringify(metrics));
    assert.equal(metrics.boxes.length,1);
    const seasonal=await call('Runtime.evaluate',{expression:"!!document.querySelector('.holiday-login-intro,.zima-holiday-trim,.zima-holiday-note,body.zima-holiday')",returnByValue:true});
    assert.equal(seasonal.result.value,false,'El login debe usar el diseño habitual');
    console.log('OK: '+width+' px, sin desbordamiento ni superposición.');
  }
  const interaction=await call('Runtime.evaluate',{expression:`(async()=>{
    let called=false;
    autenticarRemoto=async()=>{called=true;return {ok:false,mensaje:'PRUEBA LOCAL DE LOGIN'};};
    document.getElementById('usuario').value='prueba-local';
    document.getElementById('password').value='prueba-local';
    document.getElementById('loginForm').requestSubmit();
    await new Promise(r=>setTimeout(r,150));
    const supportAbsent=!document.getElementById('zimaSupportLauncher');
    return {called,supportAbsent,status:document.getElementById('status').textContent};
  })()`,awaitPromise:true,returnByValue:true});
  assert(interaction.result.value?.called,JSON.stringify(interaction));
  assert(interaction.result.value.supportAbsent,'El login no debe mostrar soporte');
  assert.match(interaction.result.value.status,/PRUEBA LOCAL DE LOGIN/);
  console.log('OK: formulario conectado al login real (servidor simulado), sin soporte antes de ingresar.');
  const loading=await call('Runtime.evaluate',{expression:`(async()=>{
    let finish;
    autenticarRemoto=()=>new Promise(resolve=>{finish=resolve;});
    document.getElementById('loginForm').requestSubmit();
    await new Promise(r=>setTimeout(r,80));
    const visible=()=>getComputedStyle(document.getElementById('loginSuccessModal')).display!=='none';
    const pending=visible();
    const bars=document.querySelectorAll('.login-loader-mark span').length;
    finish({ok:false,mensaje:'Credenciales de prueba incorrectas'});
    await new Promise(r=>setTimeout(r,80));
    const closed=!visible();
    const retry=!document.getElementById('loginButton').disabled;
    let redirected=false;
    irDashboard=()=>{redirected=true;};
    guardarSesion=()=>{};
    programarAnuncioSistema=()=>{};
    autenticarRemoto=async()=>({ok:true,nombre:'Equipo ZIMA',usuario:'prueba-local'});
    document.getElementById('loginForm').requestSubmit();
    await new Promise(r=>setTimeout(r,80));
    const success=visible()&&document.getElementById('loginSuccessText').textContent.includes('Equipo ZIMA');
    const title=document.getElementById('loginLoadingTitle').textContent;
    await new Promise(r=>setTimeout(r,950));
    return {pending,bars,closed,retry,success,title,redirected};
  })()`,awaitPromise:true,returnByValue:true});
  assert.deepEqual(loading.result.value,{pending:true,bars:3,closed:true,retry:true,success:true,title:'Todo listo para comenzar',redirected:true});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const reduced=await call('Runtime.evaluate',{expression:"getComputedStyle(document.querySelector('.login-loader-mark span')).animationName",returnByValue:true});
  assert.equal(reduced.result.value,'none');
  await call('Emulation.setEmulatedMedia',{features:[]});
  for(const width of [1440,390]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
    const bounds=await call('Runtime.evaluate',{expression:"(()=>{const r=document.querySelector('.login-success-box').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})()",returnByValue:true});
    assert(bounds.result.value.left>=0&&bounds.result.value.right<=width&&bounds.result.value.top>=0&&bounds.result.value.bottom<=900);
    const shot=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(root,'preview-navidad','carga-'+width+'.png'),Buffer.from(shot.data,'base64'));
  }
  console.log('OK: carga pendiente, error recuperable, bienvenida, redireccion y movimiento reducido.');
  await call('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill();});
