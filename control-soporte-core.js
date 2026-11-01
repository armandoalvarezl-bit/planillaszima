(function(){
  'use strict';
  if(window.ZimaSupportControl || window.self!==window.top)return;
  const session=ZimaUI.getSupportSession();
  if(!session.token || !['SOPORTE','ADMIN','ADMINISTRADOR'].includes(String(session.rol).trim().toUpperCase()))return;
  const key='ZIMA_SUPPORT_DESKTOP:'+String(session.usuario).toLowerCase();
  const seenKey=key+':seen';
  const listeners=new Set();
  let snapshot=null,error='',busy=false,timer;
  // Conservar la base al navegar, incluso si la primera consulta no tenía eventos.
  let initialized=Array.isArray(read(seenKey,null));
  function read(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch(_){return fallback;}}
  function write(k,value){try{localStorage.setItem(k,JSON.stringify(value));}catch(_){}}
  function desktopState(){
    if(!('Notification' in window) || !window.isSecureContext)return 'unavailable';
    if(Notification.permission==='denied')return 'denied';
    return Notification.permission==='granted' && read(key,false)?'enabled':'disabled';
  }
  function publish(){listeners.forEach(fn=>fn({snapshot,error,busy,desktop:desktopState()}));}
  function notify(title,body,tag){
    if(desktopState()!=='enabled')return false;
    try{
      const notice=new Notification(title,{body,icon:'img/logo.png',tag});
      notice.onclick=()=>{window.focus();location.href='control-soporte.html#actividad';notice.close();};
      return true;
    }catch(_){error='El navegador no pudo mostrar el aviso. Revisa los permisos de notificaciones.';publish();return false;}
  }
  function processEvents(events){
    const seen=new Set(read(seenKey,[]));
    const fresh=events.filter(event=>!seen.has(event.id));
    // Solo la primera consulta de este navegador descarta ingresos históricos.
    if(!initialized || desktopState()!=='enabled'){
      events.slice().reverse().forEach(event=>seen.add(event.id));
      write(seenKey,[...seen].slice(-300));
      initialized=true;
      return;
    }
    fresh.slice().reverse().forEach(event=>{
      const shared=new Set(read(seenKey,[]));
      if(shared.has(event.id))return;
      // Un fallo del navegador se reintenta en la próxima sincronización.
      if(notify('Ingreso de peaje · '+event.peaje,(event.nombre||event.usuario)+' ingresó al sistema.','zima-peaje-'+event.id)){
        shared.add(event.id);write(seenKey,[...shared].slice(-300));
      }
    });
  }
  function request(){
    const payload={action:'controlsoporte',token:session.token};
    if(window.google && google.script && google.script.run)return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).apiGet(payload));
    return new Promise((resolve,reject)=>{
      const cb='__zima_control_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const cleanup=()=>{clearTimeout(timeout);delete window[cb];script.remove();};
      const timeout=setTimeout(()=>{cleanup();reject(Error('La consulta tardó demasiado. Intenta sincronizar nuevamente.'));},20000);
      window[cb]=data=>{cleanup();resolve(data);};
      script.onerror=()=>{cleanup();reject(Error('No se pudo conectar con el centro de control.'));};
      script.src=ZimaUI.apiUrl+'?'+new URLSearchParams({...payload,callback:cb});document.head.appendChild(script);
    });
  }
  async function refresh(){
    if(busy)return;
    const current=ZimaUI.getSupportSession();
    if(current.token!==session.token){clearInterval(timer);error='La sesión cambió. Inicia sesión nuevamente.';publish();return;}
    busy=true;publish();
    try{
      const result=await request();
      if(!result || !result.ok)throw Error(result?.error || 'No se pudo consultar la operación.');
      error='';processEvents(result.eventos||[]);snapshot=result;
    }catch(e){error=e.message||String(e);}
    finally{busy=false;publish();}
  }
  async function enable(){
    if(desktopState()==='unavailable')return {ok:false,message:'Abre el sistema con HTTPS en un navegador de escritorio compatible.'};
    if(Notification.permission==='denied')return {ok:false,message:'Las notificaciones están bloqueadas. Permítelas desde la configuración del sitio en el navegador.'};
    const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
    write(key,permission==='granted');publish();
    return {ok:permission==='granted',message:permission==='granted'?'Avisos activados para este navegador. Mantén el sistema abierto.':'No se activaron los avisos. Puedes volver a intentarlo desde este panel.'};
  }
  window.ZimaSupportControl={
    subscribe(fn){listeners.add(fn);fn({snapshot,error,busy,desktop:desktopState()});return ()=>listeners.delete(fn);},
    refresh,enable,
    disable(){write(key,false);publish();},
    test(){return notify('Centro de control ZIMA','Los avisos de ingresos de peajes están listos en este equipo.','zima-support-test');},
    state:()=>({snapshot,error,busy,desktop:desktopState()})
  };
  window.dispatchEvent(new Event('zima-support-ready'));
  timer=setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  void refresh();
})();
