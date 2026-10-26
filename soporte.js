(function(){
  'use strict';
  const API_URL='https://script.google.com/macros/s/AKfycbwcCMhxYhF3uMmzpAmGL2uK02UHkHP1gyikRSsW5OfLxTofSjnT821hgqAuWX9TyrWXZg/exec';
  const $=id=>document.getElementById(id);
  const esc=ZimaUI.escapeHtml;
  const session=ZimaUI.getSupportSession();
  if(new URLSearchParams(location.search).get('embed')==='1'){
    document.body.classList.add('embedded-support');
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && !document.querySelector('.zima-confirm-backdrop.open')){
        window.parent.postMessage({type:'zima-support-close'},location.origin);
      }
    });
  }
  let tickets=[];
  let admin=false;
  let sending=false;
  let loading=false;
  const requestId=()=>window.crypto && crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  let submissionId=requestId();
  const labels={ABIERTO:'Abierto',EN_PROCESO:'En proceso',RESUELTO:'Resuelto'};
  function jsonp(payload){
    return new Promise((resolve,reject)=>{
      const callback='__zima_ticket_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const cleanup=()=>{clearTimeout(timer);delete window[callback];script.remove();};
      const timer=setTimeout(()=>{cleanup();reject(Error('La consulta tardó demasiado. Intente actualizar.'));},20000);
      window[callback]=value=>{cleanup();resolve(value);};
      script.onerror=()=>{cleanup();reject(Error('No se pudo conectar con soporte.'));};
      script.src=API_URL+'?'+new URLSearchParams({...payload,callback});
      document.head.appendChild(script);
    });
  }
  async function api(action,data={},write=false){
    if(window.ZimaOffline)return ZimaOffline.request(action,data,write,()=>remoteApi(action,data,write));
    return remoteApi(action,data,write);
  }
  async function remoteApi(action,data={},write=false){
    const payload={...data,action,token:session.token};
    if(window.google && google.script && google.script.run){
      return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[write?'apiPost':'apiGet'](payload));
    }
    if(!write)return jsonp(payload);
    // Un envío no confirmado conserva requestId para que reintentar no duplique el caso.
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),25000);
    try {
      const r=await fetch(API_URL,{method:'POST',redirect:'follow',signal:controller.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
      if(!r.ok)throw Error('HTTP '+r.status);
      return await r.json();
    } catch(error) {
      if(error.name==='TypeError' || error.name==='AbortError')return jsonp(payload);
      throw error;
    } finally { clearTimeout(timer); }
  }
  function render(){
    $('listTitle').textContent=admin?'Bandeja de soporte':'Mis tickets';
    $('openCount').textContent=tickets.filter(t=>t.estado==='ABIERTO').length;
    $('progressCount').textContent=tickets.filter(t=>t.estado==='EN_PROCESO').length;
    $('resolvedCount').textContent=tickets.filter(t=>t.estado==='RESUELTO').length;
    const rows=tickets.filter(t=>!$('status').value || t.estado===$('status').value);
    $('tickets').innerHTML=rows.length?rows.map(t=>`<article class="ticket"><div class="ticket-top"><span class="ticket-id">${esc(t.id)}</span><span class="badge ${labels[t.estado]?t.estado:''}">${esc(labels[t.estado]||t.estado)}</span></div><h3>${esc(t.titulo)}</h3><div class="meta">${esc(t.peaje)} · ${esc(t.categoria)} · ${esc(t.prioridad)}<br>${esc(new Date(t.fecha).toLocaleString('es-CO',{timeZone:'America/Bogota'}))}${admin?' · '+esc(t.nombre||t.usuario):''}</div><details><summary>Ver detalle${t.respuesta?' y respuesta':''}</summary><p class="description">${esc(t.mensaje)}</p>${t.respuesta?'<div class="answer"><strong>Respuesta de soporte</strong><br>'+esc(t.respuesta)+'</div>':''}${admin?`<form class="manage" data-ticket="${esc(t.id)}"><label>Estado<select name="estado">${Object.keys(labels).map(key=>`<option value="${key}" ${key===t.estado?'selected':''}>${labels[key]}</option>`).join('')}</select></label><label>Respuesta o solución<textarea name="respuesta" maxlength="6000" rows="3">${esc(t.respuesta||'')}</textarea></label><button type="submit" class="primary">Guardar seguimiento</button></form>`:''}</details></article>`).join(''):'<div class="empty"><i class="bi bi-inbox" aria-hidden="true"></i><strong>'+ (tickets.length?'Sin casos en este estado':'Tus solicitudes, organizadas aquí') +'</strong><span>'+(tickets.length?'Prueba con otro estado para ver tus tickets.':'Crea tu primer ZimaTicket y consulta aquí cada avance<br>y las respuestas del equipo de soporte.')+'</span></div>';
  }
  async function load(){
    if(loading)return;
    loading=true;$('refresh').disabled=true;
    try{
      const r=await api('tickets');
      if(!r || !r.ok)throw Error(r && r.error || 'No fue posible consultar los tickets.');
      tickets=r.rows || [];admin=r.admin===true;render();
    }catch(e){ZimaUI.notice('notice',e.message,'error');}
    finally{loading=false;$('refresh').disabled=false;}
  }
  $('ticketForm').addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;
    sending=true;$('submitTicket').disabled=true;$('submitTicket').textContent='Registrando…';
    try{
      const r=await api('crearticket',{requestId:submissionId,titulo:$('subject').value.trim(),mensaje:$('description').value.trim(),email:$('email').value.trim(),categoria:$('category').value,prioridad:$('priority').value},true);
      if(!r || !r.ok)throw Error(r && r.error || 'No se confirmó el registro. Reintente con el mismo formulario.');
      submissionId=requestId();$('ticketForm').reset();$('email').value=session.email || '';
      const message=r.correoEnviado===false?r.mensaje:r.yaRegistrado?'Su ticket ya estaba registrado. Puede consultar su estado en esta página.':'Su caso quedó registrado y se envió el aviso por correo a soporte. Puede consultar los avances en esta página.';
      ZimaUI.notice('notice','Ticket '+r.id+'. '+message,r.correoEnviado===false?'error':'success');
      await load();
      await ZimaUI.confirm({tone:'success',danger:false,title:'ZimaTicket registrado',message:message,detail:r.id,confirmText:'Entendido',cancelText:'Cerrar'});
    }catch(e){ZimaUI.notice('notice',e.message==='Failed to fetch'?'No se pudo confirmar el envío. Pulse Crear ZimaTicket para reintentar; se conservará la identificación del caso.':e.message,'error');}
    finally{sending=false;$('submitTicket').disabled=false;$('submitTicket').textContent='Crear ZimaTicket ↗';}
  });
  $('tickets').addEventListener('submit',async event=>{
    const form=event.target;if(!form.matches('.manage'))return;
    event.preventDefault();const button=form.querySelector('button');if(button.disabled)return;button.disabled=true;
    try{
      const r=await api('actualizarticket',{id:form.dataset.ticket,estado:form.elements.estado.value,respuesta:form.elements.respuesta.value},true);
      if(!r || !r.ok)throw Error(r && r.error || 'No se pudo guardar el seguimiento.');
      ZimaUI.notice('notice','Seguimiento guardado. El usuario podrá consultar su respuesta.','success');await load();
    }catch(e){ZimaUI.notice('notice',e.message,'error');}finally{button.disabled=false;}
  });
  $('refresh').addEventListener('click',load);$('status').addEventListener('change',render);
  $('sessionName').textContent=session.nombre || session.usuario;
  $('email').value=session.email || '';
  if(!session.token){$('submitTicket').disabled=true;ZimaUI.notice('notice','Inicie sesión para registrar y consultar sus tickets.','error');$('tickets').innerHTML='<p class="empty"><a href="login.html">Iniciar sesión</a></p>';}
  else void load();
})();
