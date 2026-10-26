(function () {
  'use strict';
  // Campaña temporal: desactivar cuando el equipo termine su aprendizaje.
  const ENABLED = true;
  const CAMPAIGN = 'offline-intro-2026-10-v2';
  let showing;
  const seenInMemory = new Set();
  const icons = {
    wifi: '<path d="M3 9a15 15 0 0 1 18 0M6 13a10 10 0 0 1 12 0M9 17a5 5 0 0 1 6 0"/><circle cx="12" cy="21" r=".6"/>',
    laptop: '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="M2 20h20M9 8l2 2 4-4"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    sync: '<path d="M20 7a8 8 0 0 0-14-2L3 8M3 3v5h5M4 17a8 8 0 0 0 14 2l3-3M21 21v-5h-5"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'
  };
  const steps = [
    {
      icon: 'wifi', tag: '01 · PREPARA', title: 'Tu equipo, listo para seguir.',
      text: 'Al ingresar con internet, el sistema prepara tu equipo automáticamente. Cada día actualiza la copia en segundo plano para que puedas seguir si se pierde la conexión.',
      points: ['Usa siempre el mismo equipo y navegador.', 'La primera vez, deja terminar el ingreso y la descarga de pantallas antes de desconectarte.'],
      preview: 'Preparación automática', caption: 'Con internet, la actualización trabaja sin avisos constantes', badge: 'Preparación en segundo plano',
      note: 'Un equipo nuevo necesita su primer ingreso con internet.'
    },
    {
      icon: 'laptop', tag: '02 · CONTINÚA', title: 'Se va internet. Tu turno sigue.',
      text: 'Puedes volver a entrar con tu usuario y contraseña, consultar lo descargado y crear, editar, anular e imprimir planillas sin conexión.',
      points: ['El acceso local dura hasta 7 días desde la validación, o menos si vence tu contraseña.', 'Después de 15 minutos sin actividad, vuelve a iniciar sesión.'],
      preview: 'Sin internet · trabajando en este equipo', caption: 'Trabajas con los datos de tu última descarga', badge: 'Tu operación continúa',
      note: 'Usuarios, permisos, perfiles y contraseñas se modifican con internet.'
    },
    {
      icon: 'save', tag: '03 · GUARDA', title: 'Guardada aquí. Pendiente de enviar.',
      text: 'Pulsa Guardar como siempre. Si no hay conexión, la planilla queda guardada en este equipo y aparece en el historial y en el contador de pendientes.',
      points: ['Puedes cerrar sesión y volver después: los cambios guardados se conservan.', 'La impresión indica «COPIA LOCAL · PENDIENTE DE SINCRONIZACIÓN».'],
      preview: '1 pendiente de sincronización', caption: 'Ejemplo: aún no está confirmado en el servidor', badge: 'Guardado en este equipo',
      note: 'No borres los datos del navegador mientras tengas pendientes.'
    },
    {
      icon: 'sync', tag: '04 · SINCRONIZA', title: 'Vuelve la conexión. Todo se pone al día.',
      text: 'Deja la plataforma abierta y la sesión activa. Tus pendientes se enviarán automáticamente; si ya cerraste la sesión, ingresa otra vez para continuar.',
      points: ['Al terminar los envíos, el aviso de pendientes desaparece.', 'Si una planilla cambió en otro equipo, abre Pendientes y revisa el conflicto antes de enviarla.'],
      preview: 'Sin pendientes · aviso oculto', caption: 'La pantalla vuelve a quedar libre cuando todo está al día', badge: 'De tu equipo al servidor',
      note: 'Si un envío se detiene, tu copia local permanece guardada.'
    },
    {
      icon: 'check', tag: '05 · PRUÉBALO', title: 'Una pequeña prueba. Y ya lo tienes.',
      text: 'Cuando el equipo esté preparado, haz una prueba con una planilla identificada como prueba y comprueba el recorrido completo.',
      points: ['Desconecta internet, vuelve a entrar y guarda la planilla de prueba.', 'Ábrela desde el historial; reconecta y comprueba que desaparezca el aviso de pendientes.'],
      preview: 'Prepara → guarda → reconecta', caption: 'El mismo sistema, también sin conexión', badge: 'Listo para tu próximo turno',
      note: 'Esta guía aparece una sola vez por usuario en este navegador.'
    }
  ];
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
  }
  function showOnce(username) {
    if (!ENABLED || !username) return Promise.resolve(false);
    if (showing) return showing;
    const storageKey = 'ZIMA_TUTORIAL_SEEN:' + CAMPAIGN + ':' + String(username).trim().toLowerCase();
    try { if (localStorage.getItem(storageKey) === 'seen') return Promise.resolve(false); } catch (_) {}
    if (seenInMemory.has(storageKey)) return Promise.resolve(false);
    seenInMemory.add(storageKey);
    try { localStorage.setItem(storageKey, 'seen'); } catch (_) {}
    showing = new Promise(resolve => {
      let index = 0;
      const dialog = document.createElement('dialog');
      dialog.className = 'zima-offline-tutorial';
      dialog.setAttribute('aria-labelledby', 'offlineTutorialTitle');
      dialog.setAttribute('aria-describedby', 'offlineTutorialText');
      dialog.innerHTML = '<div class="ot-layout"><aside class="ot-scene" aria-label="Ejemplo ilustrativo"><div class="ot-brand" aria-label="ZIMA Seguridad y ANI"><img class="ot-logo-zima" src="logo-zima.png" alt="ZIMA Seguridad Ltda."><img class="ot-logo-ani" src="logo-ani.png" alt="Agencia Nacional de Infraestructura"></div><div class="ot-orbit" aria-hidden="true"><span></span><span></span><div class="ot-symbol"></div></div><div class="ot-demo"><span class="ot-demo-label">ASÍ LO VERÁS</span><strong></strong><small></small></div><div class="ot-scene-foot"><span class="ot-live-dot"></span><span></span></div></aside><section class="ot-content"><header class="ot-top"><span>GUÍA RÁPIDA · SIN INTERNET</span><button type="button" class="ot-close" aria-label="Cerrar tutorial">×</button></header><nav class="ot-progress" aria-label="Pasos del tutorial"></nav><div class="ot-copy"><span class="ot-kicker"></span><h2 id="offlineTutorialTitle" tabindex="-1"></h2><p id="offlineTutorialText"></p><ul class="ot-points"></ul><div class="ot-note"></div></div><footer class="ot-footer"><button type="button" class="ot-skip">Omitir guía</button><div class="ot-controls"><button type="button" class="ot-back">Atrás</button><button type="button" class="ot-next">Siguiente <span aria-hidden="true">→</span></button></div></footer></section></div>';
      const find = selector => dialog.querySelector(selector);
      const progress = find('.ot-progress');
      steps.forEach((step, i) => {
        const button = document.createElement('button');
        button.type = 'button'; button.setAttribute('aria-label', 'Paso ' + (i + 1) + ': ' + step.title);
        button.addEventListener('click', () => { index = i; paint(); }); progress.appendChild(button);
      });
      function paint() {
        const step = steps[index];
        dialog.dataset.step = String(index + 1);
        find('.ot-symbol').innerHTML = icon(step.icon);
        find('.ot-demo strong').textContent = step.preview;
        find('.ot-demo small').textContent = step.caption;
        find('.ot-scene-foot span:last-child').textContent = step.badge;
        find('.ot-kicker').textContent = step.tag;
        find('h2').textContent = step.title;
        find('#offlineTutorialText').textContent = step.text;
        const list = find('.ot-points'); list.replaceChildren();
        step.points.forEach(point => { const item = document.createElement('li'); item.textContent = point; list.appendChild(item); });
        find('.ot-note').textContent = step.note;
        find('.ot-back').disabled = index === 0;
        find('.ot-next').textContent = index === steps.length - 1 ? 'Listo, comenzar' : 'Siguiente →';
        [...progress.children].forEach((button, i) => { button.classList.toggle('ot-done', i <= index); if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
        find('h2').focus({ preventScroll: true });
        find('.ot-content').scrollTop = 0;
      }
      find('.ot-back').onclick = () => { if (index) { index--; paint(); } };
      find('.ot-next').onclick = () => { if (index < steps.length - 1) { index++; paint(); } else dialog.close(); };
      find('.ot-skip').onclick = find('.ot-close').onclick = () => dialog.close();
      dialog.addEventListener('close', () => { dialog.remove(); showing = null; resolve(true); }, { once: true });
      document.body.appendChild(dialog); dialog.showModal(); paint();
    });
    return showing;
  }
  window.ZimaOfflineTutorial = { showOnce };
})();
