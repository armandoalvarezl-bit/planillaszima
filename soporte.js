(function(){
  'use strict';
  const API_URL='https://script.google.com/macros/s/AKfycbxtUVnS29d-Oo976b6poyXAIxahCLK5tIgXkKBfa_g_zrEP_dCYWVac8XCy22w3_1xsJQ/exec';
  const $=id=>document.getElementById(id);
  const esc=ZimaUI.escapeHtml;
  const session=ZimaUI.getSupportSession();
  if(new URLSearchParams(location.search).get('embed')==='1'){
    document.body.classList.add('embedded-support');
    if(/^(SOPORTE|ADMIN|ADMINISTRADOR)$/.test(String(session.rol).toUpperCase())){
      document.body.classList.add('control-ticket-inbox');
      document.querySelector('.hero h1').textContent='Bandeja de tickets';
      document.querySelector('.hero p').textContent='Consulta los casos, responde al equipo y actualiza su estado.';
    }
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape' && !$('ticketDialog').open && !document.querySelector('.zima-confirm-backdrop.open')){
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
    $('tickets').innerHTML=rows.length?rows.map(t=>`<article class="ticket"><div class="ticket-top"><span class="ticket-id">${esc(t.id)}</span><span class="badge ${labels[t.estado]?t.estado:''}">${esc(labels[t.estado]||t.estado)}</span></div><h3>${esc(t.titulo)}</h3><div class="meta">${esc(t.peaje)} · ${esc(t.categoria)} · ${esc(t.prioridad)}${admin?' · '+esc(t.nombre||t.usuario):''}</div><button type="button" class="secondary conversation-button" data-ticket="${esc(t.id)}">Ver conversación y responder</button></article>`).join(''):'<p class="empty">No hay tickets en este estado.</p>';
  }
  let currentTicketId='';
  let replyId=requestId();
  let replying=false;
  let requestedTicketOpened=false;
  function openTicket(id){
    if(replying || !tickets.some(ticket=>ticket.id===id))return;
    currentTicketId=id;replyId=requestId();
    $('replyForm').reset();$('conversationNotice').innerHTML='';
    paintConversation();$('ticketDialog').showModal();
  }
  function paintConversation(){
    const t=tickets.find(t=>t.id===currentTicketId);
    if(!t)return;
    $('conversationTitle').textContent=t.titulo;
    $('conversationId').textContent=t.id;
    const messages=Array.isArray(t.conversacion)?t.conversacion:[];
    const history=messages.length?messages:(t.respuesta?[{usuario:'Soporte',rol:'ADMIN',mensaje:t.respuesta,fecha:t.updatedAt}]:[]);
    $('conversationMessages').innerHTML='<div class="conversation-message"><strong>'+esc(t.nombre||t.usuario)+' · Solicitud inicial</strong><p>'+esc(t.mensaje)+'</p></div>'+history.map(m=>'<div class="conversation-message '+(['ADMIN','ADMINISTRADOR','SOPORTE'].includes(m.rol)?'support-message':'')+'"><strong>'+esc(m.nombre||m.usuario)+(['ADMIN','ADMINISTRADOR','SOPORTE'].includes(m.rol)?' · Soporte':' · Peaje')+'</strong><time>'+esc(new Date(m.fecha).toLocaleString('es-CO',{timeZone:'America/Bogota'}))+'</time><p>'+esc(m.mensaje)+'</p></div>').join('');
    $('replyStateField').hidden=!admin;
    $('replyState').value=t.estado;
    $('replyMessage').required=!admin;
    $('replyHint').textContent=admin?'Puedes responder y actualizar el estado del caso.':'Tu respuesta quedará en la conversación y el caso volverá a quedar abierto para soporte.';
  }
  $('tickets').addEventListener('click',event=>{
    const button=event.target.closest('[data-ticket]');
    if(!button || replying)return;
    openTicket(button.dataset.ticket);
  });
  $('closeConversation').addEventListener('click',()=>$('ticketDialog').close());
  $('ticketDialog').addEventListener('click',event=>{if(event.target===$('ticketDialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});

  async function load(){
    if(loading)return;
    loading=true;$('refresh').disabled=true;
    try{
      const r=await api('tickets');
      if(!r || !r.ok)throw Error(r && r.error || 'No fue posible consultar los tickets.');
      tickets=r.rows || [];admin=r.admin===true;render();if($('ticketDialog').open)paintConversation();
      const requested=new URLSearchParams(location.search).get('ticket');
      if(requested && !requestedTicketOpened){requestedTicketOpened=true;openTicket(requested);}
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
  $('replyForm').addEventListener('submit',async event=>{
    event.preventDefault();if(replying)return;
    replying=true;
    const ticketId=currentTicketId;
    const text=$('replyMessage').value.trim();
    const state=$('replyState').value;
    $('sendReply').disabled=true;$('replyMessage').disabled=true;$('replyState').disabled=true;
    try{
      const r=await api('responderticket',{id:ticketId,requestId:replyId,estado:state,respuesta:text},true);
      if(!r || !r.ok)throw Error(r && r.error || 'No se pudo enviar la respuesta.');
      replyId=requestId();$('replyMessage').value='';
      ZimaUI.notice('conversationNotice','Respuesta guardada correctamente.','success');
      await load();
    }catch(e){ZimaUI.notice('conversationNotice',e.message,'error');}
    finally{replying=false;$('sendReply').disabled=false;$('replyMessage').disabled=false;$('replyState').disabled=false;}
  });
  $('refresh').addEventListener('click',load);$('status').addEventListener('change',render);
  $('sessionName').textContent=session.nombre || session.usuario;
  $('email').value=session.email || '';
  if(!session.token){$('submitTicket').disabled=true;ZimaUI.notice('notice','Inicie sesión para registrar y consultar sus tickets.','error');$('tickets').innerHTML='<p class="empty"><a href="login.html">Iniciar sesión</a></p>';}
  else void load();
})();
