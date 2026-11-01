(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=ZimaUI.escapeHtml;
  const session=ZimaUI.getSupportSession();
  let core,snapshot=null,previous=null;
  const tabs=Array.from(document.querySelectorAll('[data-panel]'));
  const desktopLabels={enabled:'Activadas en este equipo',disabled:'Sin activar en este navegador',denied:'Bloqueadas por el navegador',unavailable:'No disponibles: se necesita HTTPS y un navegador compatible'};
  const actionLabels={PEAJE_LOGIN:'Ingreso de peaje',USER_CREATE:'Usuario creado',USER_UPDATE:'Perfil actualizado',USER_PASSWORD:'Contraseña renovada',USER_STATUS:'Estado de acceso',TICKET_UPDATE:'Seguimiento de ticket',CREATE:'Planilla creada',UPDATE:'Planilla actualizada',DELETE:'Planilla anulada',PERMANENT_DELETE:'Planilla eliminada'};
  function dateKey(value){
    const date=new Date(value);if(isNaN(date.getTime()))return '';
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>['year','month','day'].includes(p.type)).map(p=>p.value).join('-');
  }
  function formatDate(value,full=false){const date=new Date(value);return value&&!isNaN(date.getTime())?date.toLocaleString('es-CO',{timeZone:'America/Bogota',...(full?{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}:{hour:'2-digit',minute:'2-digit'})}):'Sin ingreso registrado';}
  function notice(text){$('controlNotice').textContent=text||'';$('controlNotice').hidden=!text;}
  function activate(name,focus=false){
    if(!['resumen','accesos','auditoria','tickets','usuarios'].includes(name))name='resumen';
    $('panel-usuarios').hidden=name!=='usuarios';
    document.querySelector('[data-user-manager]').classList.toggle('active',name==='usuarios');
    if(name==='usuarios'&&!$('controlUsersFrame').getAttribute('src'))$('controlUsersFrame').src='granadmin.html?embed=1';
    $('panel-tickets').hidden=name!=='tickets';
    document.querySelector('[data-ticket-inbox]').classList.toggle('active',name==='tickets');
    if(name==='tickets'&&!$('controlTicketsFrame').getAttribute('src'))$('controlTicketsFrame').src='soporte.html?embed=1';
    tabs.forEach(tab=>{const active=tab.dataset.panel===name;tab.setAttribute('aria-selected',String(active));tab.classList.toggle('active',active);tab.tabIndex=active?0:-1;$('panel-'+tab.dataset.panel).hidden=!active;if(active&&focus)tab.focus();});
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(!link||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    const url=new URL(link.href,location.href);
    if(link.hasAttribute('data-user-manager')||/\/granadmin\.html$/i.test(url.pathname)){
      event.preventDefault();event.stopImmediatePropagation();
      const usuario=url.searchParams.get('usuario');
      if(usuario)$('controlUsersFrame').src='granadmin.html?embed=1&usuario='+encodeURIComponent(usuario);
      activate('usuarios');
      if($('accessDialog').open)$('accessDialog').close();
      if(document.body.classList.contains('zima-nav-open'))document.querySelector('.zima-menu-close')?.click();
      history.replaceState(null,'',location.pathname+location.search+'#usuarios');
      return;
    }
    if(!link.hasAttribute('data-ticket-inbox')&&!/\/soporte\.html$/i.test(url.pathname))return;
    event.preventDefault();event.stopImmediatePropagation();
    const ticket=url.searchParams.get('ticket');
    if(ticket)$('controlTicketsFrame').src='soporte.html?embed=1&ticket='+encodeURIComponent(ticket);
    activate('tickets');
    if(document.body.classList.contains('zima-nav-open'))document.querySelector('.zima-menu-close')?.click();
    history.replaceState(null,'',location.pathname+location.search+'#tickets');
    document.dispatchEvent(new Event('zima-support-opened'));
  },true);
  window.addEventListener('hashchange',()=>activate(location.hash.slice(1)));
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>{activate(tab.dataset.panel);try{const target=new URL(location.href);target.hash=tab.dataset.panel;history.replaceState(null,'',target.href);}catch(_){}});
    tab.addEventListener('keydown',event=>{
      let target=index;
      if(['ArrowDown','ArrowRight'].includes(event.key))target=(index+1)%tabs.length;
      else if(['ArrowUp','ArrowLeft'].includes(event.key))target=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home')target=0;else if(event.key==='End')target=tabs.length-1;else return;
      event.preventDefault();activate(tabs[target].dataset.panel,true);
    });
  });
  document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>activate(button.dataset.jump,true)));
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
  $('controlUser').textContent=session.nombre||session.usuario||'Equipo de soporte';
  if($('sideUser'))$('sideUser').textContent=session.nombre||session.usuario||'Equipo de soporte';
  $('controlLogout').addEventListener('click',()=>ZimaUI.confirmLogout({detail:session.nombre||session.usuario}));
  $('refreshControl').addEventListener('click',()=>core?.refresh());
  $('openDesktop').addEventListener('click',()=>{$('desktopMessage').textContent='';$('desktopDialog').showModal();});
  $('enableDesktop').addEventListener('click',async()=>{
    if(!core)return;
    $('enableDesktop').disabled=true;
    try{const result=await core.enable();$('desktopMessage').textContent=result.message;}
    catch(error){$('desktopMessage').textContent=error.message||'No se pudo solicitar el permiso.';}
    finally{paintDesktop(core.state().desktop);}
  });
  $('disableDesktop').addEventListener('click',()=>{core?.disable();$('desktopMessage').textContent='Avisos desactivados en este equipo.';});
  $('testDesktop').addEventListener('click',()=>{$('desktopMessage').textContent=core?.test()?'Se envió un aviso de prueba al escritorio.':'No se pudo mostrar el aviso. Comprueba los permisos del navegador y del equipo.';});
  function paintDesktop(state){
    $('desktopState').textContent=desktopLabels[state]||desktopLabels.disabled;
    $('enableDesktop').disabled=state==='enabled';
    $('testDesktop').disabled=state!=='enabled';$('disableDesktop').disabled=state!=='enabled';
    $('openDesktop').innerHTML='<i class="bi '+(state==='enabled'?'bi-bell-fill':'bi-bell')+'" aria-hidden="true"></i><span>'+(state==='enabled'?'Notificaciones activadas':'Activar notificaciones')+'</span>';
  }
  function paintOverview(){
    const users=snapshot.usuarios||[],tickets=snapshot.tickets||[],events=snapshot.eventos||[];
    $('metricActive').textContent=users.filter(u=>u.estado==='ACTIVO').length;
    $('metricToday').textContent=users.filter(u=>u.ingresoHoy).length;
    $('metricTickets').textContent=tickets.filter(t=>t.estado!=='RESUELTO').length;
    $('metricReview').textContent=users.filter(u=>u.estado!=='ACTIVO'||u.requiereCambioContrasena).length;
    $('loginActivity').innerHTML=events.length?events.slice(0,6).map(event=>'<div class="activity-item"><div class="activity-avatar" aria-hidden="true">'+esc(String(event.nombre||event.usuario).trim().split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())+'</div><div class="activity-body"><strong>'+esc(event.nombre||event.usuario)+'</strong><span>'+esc(event.peaje)+' · Ingreso confirmado</span></div><time datetime="'+esc(event.fecha)+'">'+esc(formatDate(event.fecha,true))+'</time></div>').join(''):'<p class="empty-state">Aún no hay ingresos registrados.<br>Los nuevos accesos de peajes aparecerán aquí.</p>';
    const pending=tickets.filter(t=>t.estado!=='RESUELTO').sort((a,b)=>(b.prioridad==='ALTA')-(a.prioridad==='ALTA') || new Date(b.updatedAt)-new Date(a.updatedAt));
    $('priorityTickets').innerHTML=pending.length?pending.slice(0,4).map(ticket=>'<a class="ticket-preview" href="soporte.html?ticket='+encodeURIComponent(ticket.id)+'"><div class="ticket-preview-top"><span class="tag '+(ticket.prioridad==='ALTA'?'red':'')+'">'+(ticket.prioridad==='ALTA'?'Prioridad alta':'Prioridad normal')+'</span><span class="tag amber">'+(ticket.estado==='ABIERTO'?'Abierto':'En proceso')+'</span></div><h3>'+esc(ticket.titulo)+'</h3><p>'+esc(ticket.peaje)+' · Atender caso ↗</p></a>').join(''):'<p class="empty-state">Todo al día.<br>No hay tickets pendientes por atender.</p>';
  }
  function filteredUsers(){
    const query=$('accessSearch').value.trim().toLowerCase(),state=$('accessState').value;
    return (snapshot?.usuarios||[]).filter(user=>(!query||[user.nombre,user.usuario,user.peaje].join(' ').toLowerCase().includes(query))&&(!state||(state==='REVISAR'?(user.estado!=='ACTIVO'||user.requiereCambioContrasena):user.estado===state)));
  }
  function paintUsers(){
    const users=filteredUsers();
    $('accessRows').innerHTML=users.length?users.map(user=>'<tr><td><strong>'+esc(user.nombre)+'</strong><small>'+esc(user.usuario)+' · '+esc(user.peaje)+'</small></td><td><span class="tag '+(user.estado==='ACTIVO'?'':'red')+'">'+esc(user.estado)+'</span></td><td><span class="tag '+(user.requiereCambioContrasena?'amber':'')+'">'+(user.requiereCambioContrasena?'Requiere renovación':'Vigente')+'</span></td><td>'+esc(formatDate(user.ultimoIngreso,true))+'</td><td><button class="validate-button" data-validate="'+esc(encodeURIComponent(user.usuario))+'">Validar ↗</button></td></tr>').join(''):'<tr><td colspan="5" class="empty-state">No hay usuarios que coincidan con el filtro.</td></tr>';
    $('accessCount').textContent=users.length+' usuarios en esta vista · La validación consulta estado y vigencia; no prueba contraseñas.';
  }
  function filteredAudit(){
    const query=$('auditSearch').value.trim().toLowerCase(),type=$('auditType').value,today=$('auditPeriod').value==='HOY',day=dateKey(snapshot?.serverTime||new Date());
    return (snapshot?.auditoria||[]).filter(row=>
      (!query||[row.usuario,row.detalle,actionLabels[row.accion]||row.accion].join(' ').toLowerCase().includes(query))&&
      (!type||(type==='USER_'?String(row.accion).startsWith('USER_'):type==='PLANILLA'?['CREATE','UPDATE','DELETE','PERMANENT_DELETE'].includes(row.accion):row.accion===type))&&(!today||dateKey(row.fecha)===day));
  }
  function paintAudit(){
    const rows=filteredAudit();
    $('auditRows').innerHTML=rows.length?rows.map(row=>'<tr><td>'+esc(formatDate(row.fecha,true))+'</td><td><span class="tag">'+esc(actionLabels[row.accion]||row.accion)+'</span></td><td>'+esc(row.usuario)+'</td><td>'+esc(row.detalle)+'</td></tr>').join(''):'<tr><td colspan="4" class="empty-state">No hay movimientos para estos filtros.</td></tr>';
    $('auditCount').textContent=rows.length+' movimientos en esta vista · Los registros anteriores a la auditoría no se reconstruyen.';
    $('exportAudit').disabled=!rows.length;
  }
  ['accessSearch','accessState'].forEach(id=>$(id).addEventListener(id==='accessSearch'?'input':'change',paintUsers));
  ['auditSearch','auditType','auditPeriod'].forEach(id=>$(id).addEventListener(id==='auditSearch'?'input':'change',paintAudit));
  $('accessRows').addEventListener('click',event=>{
    const button=event.target.closest('[data-validate]');if(!button)return;
    const user=snapshot?.usuarios.find(u=>u.usuario===decodeURIComponent(button.dataset.validate));if(!user)return;
    $('accessTitle').textContent=user.nombre;
    const facts=[['Usuario',user.usuario],['Peaje',user.peaje],['Estado',user.estado],['Contraseña',user.requiereCambioContrasena?'Renovación requerida':'Vigente'],['Último ingreso',formatDate(user.ultimoIngreso,true)],['Validación',user.estado!=='ACTIVO'?'El acceso está inactivo':user.requiereCambioContrasena?'Debe renovar su contraseña':'Acceso habilitado según los controles actuales']];
    $('accessDetail').innerHTML=facts.map(([label,value])=>'<div class="access-fact"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
    $('manageAccess').href='granadmin.html?usuario='+encodeURIComponent(user.usuario);$('accessDialog').showModal();
  });
  $('exportAudit').addEventListener('click',()=>{
    const safe=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
    const rows=[['Fecha Colombia','Movimiento','Responsable','Detalle'],...filteredAudit().map(row=>[formatDate(row.fecha,true),actionLabels[row.accion]||row.accion,row.usuario,row.detalle])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(safe).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='ZIMA_auditoria_'+dateKey(snapshot.serverTime)+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function connect(){
    if(core || !window.ZimaSupportControl)return;
    core=window.ZimaSupportControl;
    core.subscribe(state=>{
      paintDesktop(state.desktop);$('refreshControl').disabled=state.busy;
      notice(state.error);
      $('syncStatus').textContent=state.error?'No se pudo actualizar':state.busy?'Sincronizando operación…':state.snapshot?'Sincronización automática activa':'Esperando primera consulta';
      if(state.snapshot){snapshot=state.snapshot;$('lastSync').textContent='Última consulta · '+formatDate(snapshot.serverTime);if(previous!==snapshot){paintOverview();paintUsers();paintAudit();previous=snapshot;}}
    });
  }
  if(!session.token)notice('Inicia sesión para consultar el centro de control.');
  else if(!['SOPORTE','ADMIN','ADMINISTRADOR'].includes(String(session.rol).toUpperCase())){notice('Este centro está reservado al equipo de soporte y administración.');}
  else {connect();window.addEventListener('zima-support-ready',connect);}
  activate(location.hash.slice(1));
})();
