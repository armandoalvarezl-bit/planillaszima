const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run',
  '--disable-background-networking','--remote-debugging-port=9351',
  '--user-data-dir='+path.resolve(root,'../edge-menu-check'),'about:blank'
],{stdio:'ignore',windowsHide:true});
let socket;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  let tabs;
  for(let i=0;i<40;i++){
    try{tabs=await fetch('http://127.0.0.1:9351/json').then(r=>r.json());if(tabs.length)break;}catch{}
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
  const fixture=path.join(root,'.tmp','menu-layout.html');
  const ui=fs.readFileSync(path.join(root,'zima-ui.js'),'utf8');
  const navigation=ui.slice(ui.indexOf('  function installResponsiveNavigation()'),ui.indexOf('  window.ZimaUI ='));
  fs.mkdirSync(path.dirname(fixture),{recursive:true});
  for(const page of ['dashboard','historial','planilla','informes','granadmin']){
    let html=fs.readFileSync(path.join(root,page+'.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
    html=html.replace('<head>','<head><base href="'+pathToFileURL(root+path.sep).href+'">');
    fs.writeFileSync(fixture,html);
    await call('Page.navigate',{url:pathToFileURL(fixture).href});
    await pause(200);
    await call('Runtime.evaluate',{expression:navigation+'\ninstallResponsiveNavigation();'});
    for(const width of [320,390,700,760,900,1180,1440]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
      await pause(250);
      const state=await call('Runtime.evaluate',{expression:`(()=>{
        const sidebar=document.querySelector('.sidebar');
        const toggle=document.querySelector('.zima-menu-toggle');
        const compact=innerWidth<=1180;
        const hidden=compact?sidebar.inert&&sidebar.getBoundingClientRect().right<=0:!sidebar.inert;
        const toggleVisible=!!toggle.getClientRects().length;
        if(compact)toggle.click();
        const expanded=toggle.getAttribute('aria-expanded');
        return {hidden,toggleVisible,expanded};
      })()`,returnByValue:true});
      assert.equal(state.result.value.hidden,true,page+' '+width+' initial menu state');
      assert.equal(state.result.value.toggleVisible,width<=1180);
      assert.equal(state.result.value.expanded,width<=1180?'true':'false');
      await pause(250);
      const result=await call('Runtime.evaluate',{expression:`JSON.stringify([...document.querySelectorAll('.sidebar .nav-item,.sidebar .nav a')].filter(a=>getComputedStyle(a).display!=='none').map(a=>{const label=a.querySelector('span:not(.nav-icon)');const r=label.getBoundingClientRect();const link=a.getBoundingClientRect();return {text:label.textContent,visible:getComputedStyle(label).display!=='none',left:r.left,right:r.right,top:r.top,bottom:r.bottom,linkBottom:link.bottom};}))`,returnByValue:true});
      const rows=JSON.parse(result.result.value);
      assert(rows.length>=5,page+' navigation missing');
      for(const row of rows){
        assert(row.visible,page+' '+width+' hidden '+row.text);
        assert(row.left>=-1&&row.right<=width+1,page+' '+width+' clipped '+JSON.stringify(row));
        assert(row.bottom<=row.linkBottom+1,page+' '+width+' label outside link '+JSON.stringify(row));
        assert(row.bottom<=900,page+' '+width+' below viewport '+JSON.stringify(row));
      }
      if(page==='dashboard'&&width===390){
        const shot=await call('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(root,'.tmp','menu-mobile.png'),Buffer.from(shot.data,'base64'));
      }
      if(width<=1180){
        const closed=await call('Runtime.evaluate',{expression:`(()=>{
          document.querySelector('.zima-nav-backdrop').click();
          const sidebar=document.querySelector('.sidebar'),toggle=document.querySelector('.zima-menu-toggle');
          const backdropClosed=sidebar.inert&&toggle.getAttribute('aria-expanded')==='false';
          toggle.click();
          document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
          const escapeClosed=sidebar.inert&&document.activeElement===toggle;
          toggle.click();
          document.querySelector('.zima-menu-close').click();
          return {backdropClosed,escapeClosed,buttonClosed:sidebar.inert};
        })()`,returnByValue:true});
        assert.deepEqual(closed.result.value,{backdropClosed:true,escapeClosed:true,buttonClosed:true});
        await pause(250);
      }
    }
    console.log('OK: '+page+', textos visibles de 320 a 1440 px.');
  }
  fs.unlinkSync(fixture);
  await call('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill();});
