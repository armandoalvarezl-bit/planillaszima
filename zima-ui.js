(function () {
  function byId(target) {
    return typeof target === 'string' ? document.getElementById(target) : target;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[char];
    });
  }

  function fixMojibake(value) {
    if (value == null) return value;
    return String(value)
      .replace(/\u00c2\u00bf/g, '\u00bf')
      .replace(/\u00c2\u00a1/g, '\u00a1')
      .replace(/\u00c2\u00a9/g, '\u00a9')
      .replace(/\u00c2\u00b7/g, '\u00b7')
      .replace(/\u00c3\u00a1/g, '\u00e1')
      .replace(/\u00c3\u00a9/g, '\u00e9')
      .replace(/\u00c3\u00ad/g, '\u00ed')
      .replace(/\u00c3\u00b3/g, '\u00f3')
      .replace(/\u00c3\u00ba/g, '\u00fa')
      .replace(/\u00c3\u00b1/g, '\u00f1')
      .replace(/\u00c3\u0081/g, '\u00c1')
      .replace(/\u00c3\u0089/g, '\u00c9')
      .replace(/\u00c3\u008d/g, '\u00cd')
      .replace(/\u00c3\u0093/g, '\u00d3')
      .replace(/\u00c3\u0161/g, '\u00da')
      .replace(/\u00c3\u0091/g, '\u00d1');
  }

  function repairVisibleText(root) {
    root = root || document.body;
    if (!root) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (node) {
      const fixed = fixMojibake(node.nodeValue);
      if (fixed !== node.nodeValue) node.nodeValue = fixed;
    });

    document.querySelectorAll('[title],[aria-label],[alt],[placeholder],[value]').forEach(function (el) {
      ['title', 'aria-label', 'alt', 'placeholder', 'value'].forEach(function (attr) {
        if (!el.hasAttribute(attr)) return;
        const current = el.getAttribute(attr);
        const fixed = fixMojibake(current);
        if (fixed !== current) el.setAttribute(attr, fixed);
      });
    });
  }

  function watchTextRepairs() {
    if (!window.MutationObserver || !document.body || window.__zimaTextRepairObserver) return;
    let scheduled = false;
    window.__zimaTextRepairObserver = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        repairVisibleText();
      }, 0);
    });
    window.__zimaTextRepairObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label', 'alt', 'placeholder', 'value']
    });
  }

  function notice(target, message, type) {
    const el = byId(target);
    if (!el) return;
    if (!message) {
      el.innerHTML = '';
      return;
    }
    const kind = type ? ' ' + type : '';
    el.innerHTML = '<div class="notice' + kind + '">' + escapeHtml(message) + '</div>';
  }

  function busy(button, isBusy, label) {
    const el = byId(button);
    if (!el) return;
    if (isBusy) {
      if (!el.dataset.originalText) el.dataset.originalText = el.innerHTML;
      el.disabled = true;
      el.classList.add('is-busy');
      if (label) el.innerHTML = '<span class="zima-spinner" aria-hidden="true"></span>' + label;
      return;
    }
    el.disabled = false;
    el.classList.remove('is-busy');
    if (el.dataset.originalText) {
      el.innerHTML = el.dataset.originalText;
      delete el.dataset.originalText;
    }
  }

  function openModal(target) {
    const el = byId(target);
    if (!el) return;
    el.classList.add('open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(target) {
    const el = byId(target);
    if (!el) return;
    el.classList.remove('open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function ensureConfirmStyles() {
    if (document.getElementById('zima-confirm-styles')) return;

    const style = document.createElement('style');
    style.id = 'zima-confirm-styles';
    style.textContent = [
      '.zima-confirm-backdrop{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,17,30,.48);backdrop-filter:blur(6px)}',
      '.zima-confirm-backdrop.open{display:flex}',
      '.zima-confirm-card{width:min(460px,100%);background:#fff;border:1px solid #d9e1ea;border-radius:6px;box-shadow:0 24px 70px rgba(8,17,30,.26);overflow:hidden;color:#111}',
      '.zima-confirm-card:before{content:"";display:block;height:5px;background:#003747}',
      '.zima-confirm-head{display:flex;align-items:flex-start;gap:13px;padding:20px 22px 10px}',
      '.zima-confirm-icon{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#fff0ef;color:#b42318;border:1px solid #f2c4bd;font-weight:900;font-size:20px;flex:0 0 auto}',
      '.warning .zima-confirm-card{border-top:5px solid #e6a009}.warning .zima-confirm-icon{width:52px;height:52px;background:#fff5d6;border-color:#f2cf75;color:#925b00;font-size:30px}.warning .zima-confirm-detail{background:#fffaeb;color:#785400}.warning .zima-confirm-btn.primary{background:#f4bd36;border-color:#e6a009;color:#442d00}',
      '.zima-confirm-title{margin:0;font-size:18px;line-height:1.18;font-weight:850;color:#101827}',
      '.zima-confirm-body{padding:0 22px 18px;color:#46515f;font-size:13px;line-height:1.55}',
      '.zima-confirm-message{max-width:390px}',
      '.zima-confirm-detail{margin-top:13px;padding:11px 12px;border-left:4px solid #003747;background:#f6f8fa;color:#111;font-weight:800}',
      '.zima-confirm-actions{display:flex;justify-content:flex-end;gap:9px;padding:14px 22px 20px;border-top:1px solid #edf1f5;background:#fbfcfe}',
      '.zima-confirm-btn{min-height:38px;border:1px solid #cfd6df;background:#fff;border-radius:4px;padding:0 14px;font-weight:800;cursor:pointer;color:#111}',
      '.zima-confirm-btn:hover{background:#f2f4f6}',
      '.zima-confirm-btn.primary{background:#003747;border-color:#003747;color:#fff}',
      '.zima-confirm-btn.primary:hover{background:#00485c}',
      '.zima-confirm-btn.danger{background:#b42318;border-color:#b42318;color:#fff}',
      '.zima-confirm-btn.danger:hover{background:#9f1f16}',
      '.zima-confirm-btn:focus{outline:3px solid rgba(0,59,73,.22);outline-offset:2px}',
      '.zima-confirm-backdrop.success .zima-confirm-card{max-width:480px;border-radius:16px;border-color:#e2e8f0;box-shadow:0 24px 80px rgba(15,23,42,.2)}',
      '.zima-confirm-backdrop.success .zima-confirm-card:before{background:#0f766e;height:4px}',
      '.zima-confirm-backdrop.success .zima-confirm-head{padding:26px 26px 14px;align-items:center}',
      '.zima-confirm-backdrop.success .zima-confirm-icon{background:#e6f6ef;border-color:#c9eadb;color:#137452;font-size:23px;width:48px;height:48px}',
      '.zima-confirm-backdrop.success .zima-confirm-body{padding:0 26px 24px;font-size:14px;line-height:1.65}',
      '.zima-confirm-backdrop.success .zima-confirm-detail{border:1px solid #dcebe6;border-radius:9px;background:#f4faf7;color:#164b3c;letter-spacing:.3px}',
      '.zima-confirm-backdrop.success .zima-confirm-actions{padding:16px 26px 22px;background:#fff;border-color:#f1f5f9}',
      '.zima-confirm-backdrop.success .zima-confirm-btn{border-radius:8px;min-height:42px}',
      '.zima-confirm-backdrop.success .zima-confirm-btn.primary{background:#0f766e;border-color:#0f766e}',
      '.success.animated-check .zima-confirm-head{flex-direction:column;text-align:center;gap:20px;padding-top:34px}.success.animated-check .zima-confirm-icon{width:84px;height:84px;border:0;background:#edf8f2;box-shadow:0 0 0 9px #f5fbf7;animation:zima-check-appear .45s ease-out both}.animated-check .zima-confirm-icon svg{width:64px;height:64px;fill:none;stroke:#16845d;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.animated-check .check-ring{stroke:#b8e0cb;stroke-dasharray:145;stroke-dashoffset:145;animation:zima-check-draw .6s ease-out .1s forwards}.animated-check .check-mark{stroke-dasharray:40;stroke-dashoffset:40;animation:zima-check-draw .4s ease-out .45s forwards}.success.animated-check .zima-confirm-body{text-align:center}.success.animated-check .zima-confirm-actions{justify-content:center}.success.animated-check .zima-confirm-btn.primary{min-width:160px}',
      '@keyframes zima-check-appear{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}@keyframes zima-check-draw{to{stroke-dashoffset:0}}',
      '@media(prefers-reduced-motion:reduce){.success.animated-check .zima-confirm-icon{animation:none}.animated-check .check-ring,.animated-check .check-mark{animation:none;stroke-dashoffset:0}}',
      '.zima-confirm-backdrop.zima-logout-dialog{background:rgba(3,20,29,.76);backdrop-filter:blur(12px)}',
      '.zima-logout-dialog .zima-confirm-card{position:relative;width:min(480px,100%);max-height:calc(100dvh - 40px);overflow-y:auto;box-sizing:border-box;border:1px solid #ffffff25;border-radius:26px;background:radial-gradient(ellipse at 50% 0,#125867 0,transparent 65%),#062d3a;color:#fff;box-shadow:0 32px 100px #00151bc9;animation:zima-logout-enter .35s ease-out both}',
      '.zima-logout-dialog .zima-confirm-card:before{height:3px;background:linear-gradient(90deg,transparent,#f7c600,transparent)}',
      '.zima-logout-dialog .zima-confirm-head{flex-direction:column;align-items:center;gap:26px;padding:42px 28px 14px;text-align:center}',
      '.zima-logout-dialog .zima-confirm-icon{position:relative;width:92px;height:92px;border-radius:28px;border:1px solid #f7c60060;background:linear-gradient(145deg,#f7c60026,#f7c60008);color:#f7c600;box-shadow:0 0 0 10px #ffffff03,0 0 60px #f7c60012}',
      '.zima-logout-dialog .zima-confirm-icon svg{width:42px;height:42px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
      '.zima-logout-dialog .zima-confirm-icon .logout-arrow{animation:zima-logout-arrow 2.4s ease-in-out infinite}',
      '.zima-logout-eyebrow{margin:0 0 10px;color:#f7c600;font-size:10px;font-weight:750;letter-spacing:2.5px}',
      '.zima-logout-dialog .zima-confirm-title{color:#fff;font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-.8px}',
      '.zima-logout-dialog .zima-confirm-body{padding:0 32px 28px;text-align:center;color:#bcd1d8;font-size:14px;line-height:1.7}',
      '.zima-logout-dialog .zima-confirm-message{max-width:360px;margin:auto}',
      '.zima-logout-dialog .zima-confirm-detail{margin-top:22px;padding:12px 16px;border:1px solid #ffffff14;border-radius:12px;background:#ffffff06;color:#e0edf0;font-size:12px;font-weight:500;overflow-wrap:anywhere}',
      '.zima-logout-dialog .zima-confirm-actions{padding:22px 28px 28px;gap:10px;background:#001d282e;border-color:#ffffff12}',
      '.zima-logout-dialog .zima-confirm-btn{flex:1;min-height:48px;border:1px solid #ffffff30;border-radius:12px;background:transparent;color:#e0edf0;font-size:12px;font-weight:650}',
      '.zima-logout-dialog .zima-confirm-btn:hover{background:#ffffff0d}',
      '.zima-logout-dialog .zima-confirm-btn.primary{background:#f7c600;border-color:#f7c600;color:#062d3a;box-shadow:0 6px 20px #f7c60016}',
      '.zima-logout-dialog .zima-confirm-btn.primary:hover{background:#ffda3d;border-color:#ffda3d}',
      '.zima-logout-dialog .zima-confirm-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}',
      '@keyframes zima-logout-enter{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '@keyframes zima-logout-arrow{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}',
      '@media(prefers-reduced-motion:reduce){.zima-logout-dialog .zima-confirm-card,.zima-logout-dialog .zima-confirm-icon .logout-arrow{animation:none}}',
      '@media(max-width:560px){.zima-confirm-actions{flex-direction:column-reverse}.zima-confirm-btn{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  let warningAudioContext;
  async function playWarningSound(kind) {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      warningAudioContext = warningAudioContext || new Audio();
      if (warningAudioContext.state !== 'running') await warningAudioContext.resume();
      if (warningAudioContext.state !== 'running') return false;
      const start = warningAudioContext.currentTime;
      const success = kind === 'success';
      const notes = success ? [523.25, 659.25, 783.99] : [740, 554, 740, 554];
      notes.forEach(function(frequency, index) {
        const oscillator = warningAudioContext.createOscillator();
        const gain = warningAudioContext.createGain();
        const at = start + index * (success ? 0.13 : 0.28);
        oscillator.type = success ? 'triangle' : 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(success ? 0.06 : 0.12, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, at + (success ? 0.42 : 0.24));
        oscillator.connect(gain);
        gain.connect(warningAudioContext.destination);
        oscillator.onended = function() { oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(at);
        oscillator.stop(at + (success ? 0.45 : 0.26));
      });
      return true;
    } catch (_) { return false; }
  }

  function confirmDialog(options) {
    options = options || {};
    ensureConfirmStyles();

    return new Promise(function (resolve) {
      const backdrop = document.createElement('div');
      backdrop.className = 'zima-confirm-backdrop open';
      if (options.tone === 'success') backdrop.classList.add('success');
      if (options.tone === 'success' && options.animatedCheck) backdrop.classList.add('animated-check');
      if (options.tone === 'logout') backdrop.classList.add('zima-logout-dialog');
      if (options.tone === 'warning') backdrop.classList.add('warning');
      backdrop.setAttribute('aria-hidden', 'false');
      const previousFocus = document.activeElement;
      const previousOverflow = document.body.style.overflow;
      let settled = false;
      let soundPlayed = false;
      let soundPending = false;
      async function warningSound() {
        if (options.sound !== 'warning' || soundPlayed || soundPending || settled) return;
        soundPending = true;
        soundPlayed = await playWarningSound();
        soundPending = false;
      }

      const title = options.title || 'Confirmar acci\u00f3n';
      const message = options.message || '\u00bfDesea continuar?';
      const detail = options.detail || '';
      const confirmText = options.confirmText || 'Confirmar';
      const cancelText = options.cancelText || 'Cancelar';
      const danger = options.danger !== false;

      backdrop.innerHTML =
        '<div class="zima-confirm-card" role="' + (options.tone === 'warning' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="zimaConfirmTitle" aria-describedby="zimaConfirmMessage">' +
          '<div class="zima-confirm-head">' +
            '<div class="zima-confirm-icon" aria-hidden="true">' + (options.tone === 'logout' ? '<svg viewBox="0 0 32 32"><path d="M14 5H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h7"/><g class="logout-arrow"><path d="M12 16h15m-6-6 6 6-6 6"/></g></svg>' : options.tone === 'success' ? (options.animatedCheck ? '<svg viewBox="0 0 56 56"><circle class="check-ring" cx="28" cy="28" r="23"/><path class="check-mark" d="m16 28 8 8 16-17"/></svg>' : '&#10003;') : '!') + '</div>' +
            '<div>' + (options.tone === 'logout' ? '<div class="zima-logout-eyebrow">HASTA PRONTO</div>' : '') + '<h2 class="zima-confirm-title" id="zimaConfirmTitle">' + escapeHtml(title) + '</h2></div>' +
          '</div>' +
          '<div class="zima-confirm-body">' +
            '<div class="zima-confirm-message" id="zimaConfirmMessage">' + escapeHtml(message) + '</div>' +
            (detail ? '<div class="zima-confirm-detail">' + escapeHtml(detail) + '</div>' : '') +
          '</div>' +
          '<div class="zima-confirm-actions">' +
            (options.hideCancel ? '' : '<button class="zima-confirm-btn" type="button" data-zima-confirm="cancel">' + escapeHtml(cancelText) + '</button>') +
            '<button class="zima-confirm-btn ' + (danger ? 'danger' : 'primary') + '" type="button" data-zima-confirm="ok">' + escapeHtml(confirmText) + '</button>' +
          '</div>' +
        '</div>';

      function cleanup(value) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown);
        backdrop.removeEventListener('pointerdown', warningSound);
        backdrop.removeEventListener('keydown', warningSound);
        document.body.style.overflow = previousOverflow;
        backdrop.remove();
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        resolve(value);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') { event.preventDefault(); cleanup(false); }
        if (event.key === 'Tab') {
          const buttons = backdrop.querySelectorAll('button');
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }

      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) cleanup(false);
        const action = event.target && event.target.getAttribute('data-zima-confirm');
        if (action === 'cancel') cleanup(false);
        if (action === 'ok') cleanup(true);
      });

      document.addEventListener('keydown', onKeydown);
      document.body.appendChild(backdrop);
      document.body.style.overflow = 'hidden';
      backdrop.addEventListener('pointerdown', warningSound);
      backdrop.addEventListener('keydown', warningSound);
      void warningSound();

      const primary = backdrop.querySelector(options.tone === 'logout' ? '[data-zima-confirm="cancel"]' : '[data-zima-confirm="ok"]');
      if (primary) primary.focus();
    });
  }

  const SESSION_KEYS = [
    'ZIMA360_SESION',
    'ZIMA_SESION',
    'ZIMA_SESSION',
    'ZIMA_USUARIO',
    'ZIMA360_USUARIO',
    'ZIMA360_NOMBRE',
    'ZIMA360_ROL',
    'ZIMA360_PEAJE',
    'ZIMA360_FOTO',
    'ZIMA360_EMAIL',
    'ZIMA360_TELEFONO',
    'ZIMA360_CARGO',
    'ZIMA360_ESTADO',
    'ZIMA360_LOGIN_AT',
    'ZIMA_USER',
    'ZIMA_USER_NAME',
    'ZIMA_PEAJE',
    'ZIMA_OFFICE',
    'ZIMA_ROLE',
    'ZIMA_ROL',
    'ZIMA_LAST_LOGIN',
    'ZIMA_SESSION_TOKEN',
    'ZIMA360_SESSION_TOKEN',
    'ZIMA_TOKEN',
    'ZIMA_API_URL'
  ];

  function clearSession(extraKeys) {
    const keys = SESSION_KEYS.concat(extraKeys || []);
    [localStorage, sessionStorage].forEach(function (storage) {
      keys.forEach(function (key) {
        try {
          storage.removeItem(key);
        } catch (e) {}
      });
    });
  }

  function confirmLogout(options) {
    options = options || {};

    return confirmDialog({
      tone: 'logout',
      title: options.title || '¿Cerramos por hoy?',
      message: options.message || 'Gracias por ser parte del equipo. Antes de salir, asegúrate de guardar los cambios pendientes.',
      detail: options.detail || '',
      confirmText: options.confirmText || 'Cerrar sesi\u00f3n',
      cancelText: options.cancelText || 'Seguir aquí',
      danger: false
    }).then(function (ok) {
      if (!ok) return false;

      return Promise
        .resolve(options.beforeClear ? options.beforeClear() : null)
        .catch(function () {})
        .then(function () {
          clearSession(options.extraKeys);
          window.location.href = options.redirect || 'login.html';
          return true;
        });
    });
  }

  function readJsonStorage(key) {
    try {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getSupportSession() {
    const stored =
      readJsonStorage('ZIMA360_SESION') ||
      readJsonStorage('ZIMA_SESION') ||
      readJsonStorage('ZIMA_SESSION') ||
      {};

    return {
      usuario:
        stored.usuario ||
        stored.user ||
        localStorage.getItem('ZIMA360_USUARIO') ||
        localStorage.getItem('ZIMA_USUARIO') ||
        '',
      nombre:
        stored.nombre ||
        stored.name ||
        localStorage.getItem('ZIMA360_NOMBRE') ||
        localStorage.getItem('ZIMA_USER_NAME') ||
        '',
      rol:
        stored.rol ||
        stored.role ||
        localStorage.getItem('ZIMA360_ROL') ||
        localStorage.getItem('ZIMA_ROL') ||
        '',
      peaje:
        stored.peaje ||
        stored.office ||
        localStorage.getItem('ZIMA360_PEAJE') ||
        localStorage.getItem('ZIMA_PEAJE') ||
        '',
      email:
        stored.email ||
        localStorage.getItem('ZIMA360_EMAIL') ||
        '',
      token:
        stored.token ||
        stored.sessionToken ||
        localStorage.getItem('ZIMA360_SESSION_TOKEN') ||
        localStorage.getItem('ZIMA_SESSION_TOKEN') ||
        localStorage.getItem('ZIMA_TOKEN') ||
        ''
    };
  }

  function buildSupportCapture(error, extra) {
    extra = extra || {};
    const session = getSupportSession();
    const lines = [
      'Fecha local: ' + new Date().toISOString(),
      'Pagina: ' + location.href,
      'Titulo pagina: ' + document.title,
      'Usuario: ' + (session.usuario || ''),
      'Nombre: ' + (session.nombre || ''),
      'Rol: ' + (session.rol || ''),
      'Peaje: ' + (session.peaje || ''),
      'Navegador: ' + navigator.userAgent,
      'Viewport: ' + window.innerWidth + 'x' + window.innerHeight,
      'Online: ' + (navigator.onLine ? 'si' : 'no'),
      'Tipo: ' + (extra.tipo || 'error'),
      'Mensaje: ' + (extra.mensaje || (error && (error.message || error.reason)) || String(error || '')),
      'Archivo: ' + (extra.filename || ''),
      'Linea: ' + (extra.lineno || ''),
      'Columna: ' + (extra.colno || ''),
      '',
      'Stack:',
      (error && error.stack) || (extra.stack || '')
    ];

    return lines.join('\n');
  }

  function sendSupportReport(payload) {
    const apiUrl =
      localStorage.getItem('ZIMA_API_URL') ||
      window.ZIMA_API_URL ||
      '';

    if (!apiUrl || apiUrl.indexOf('PEGA_AQUI') !== -1) {
      return Promise.resolve({ ok: false, error: 'API no configurada' });
    }

    const body = JSON.stringify(payload);

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(apiUrl, new Blob([body], { type: 'text/plain;charset=utf-8' }));
      }
    } catch (e) {}

    return fetch(apiUrl, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    }).catch(function () {
      return { ok: false };
    });
  }

  function reportSupport(error, options) {
    options = options || {};
    const session = getSupportSession();
    const message =
      options.mensaje ||
      options.message ||
      (error && (error.message || error.reason)) ||
      String(error || 'Error no identificado');

    const payload = {
      action: 'soporte',
      tipo: options.tipo || 'automatico',
      titulo: options.titulo || options.title || 'Fallo detectado por el sistema',
      mensaje: message,
      pagina: location.href,
      navegador: navigator.userAgent,
      captura: options.captura || buildSupportCapture(error, options),
      usuario: session.usuario,
      nombre: session.nombre,
      rol: session.rol,
      peaje: session.peaje,
      email: session.email,
      token: session.token,
      sessionToken: session.token
    };

    const signature = [
      payload.tipo,
      payload.mensaje,
      payload.pagina
    ].join('|').slice(0, 500);

    try {
      const lastSignature = sessionStorage.getItem('ZIMA_SUPPORT_LAST_SIGNATURE') || '';
      const lastTime = Number(sessionStorage.getItem('ZIMA_SUPPORT_LAST_TIME') || 0);
      if (lastSignature === signature && Date.now() - lastTime < 60000) {
        return Promise.resolve({ ok: true, skipped: true });
      }
      sessionStorage.setItem('ZIMA_SUPPORT_LAST_SIGNATURE', signature);
      sessionStorage.setItem('ZIMA_SUPPORT_LAST_TIME', String(Date.now()));
    } catch (e) {}

    try {
      localStorage.setItem('ZIMA_SUPPORT_LAST', JSON.stringify(payload));
    } catch (e) {}

    const sending = sendSupportReport(payload);

    if (options.redirect === true && !/soporte\.html/i.test(location.pathname)) {
      setTimeout(function () {
        const target = 'dashboard.html';
        if (!/soporte\.html/i.test(location.pathname)) window.location.href = target;
      }, options.delay || 450);
    }

    return sending;
  }

  function installSupportWatcher() {
    if (window.__zimaSupportWatcher) return;
    window.__zimaSupportWatcher = true;

    window.addEventListener('error', function (event) {
      if (event && event.target && event.target !== window && event.target !== document) return;
      if (event && event.error && event.error.__zimaReported) return;
      if (event && event.error) event.error.__zimaReported = true;
      reportSupport(event && event.error || new Error(event && event.message || 'Error de interfaz'), {
        tipo: 'javascript',
        mensaje: event && event.message,
        filename: event && event.filename,
        lineno: event && event.lineno,
        colno: event && event.colno
      });
    });

    window.addEventListener('unhandledrejection', function (event) {
      const reason = event && event.reason;
      if (reason && reason.__zimaReported) return;
      if (reason && typeof reason === 'object') reason.__zimaReported = true;
      reportSupport(reason || new Error('Promesa rechazada'), {
        tipo: 'promesa',
        mensaje: reason && reason.message || String(reason || 'Promesa rechazada')
      });
    });
  }

  function installSupportLauncher() {
    if (window.self !== window.top || document.getElementById('zimaSupportLauncher')) return;
    if (document.querySelector('.login-wrapper')) return;
    const session = getSupportSession();
    if (!session.usuario || !session.token) return;
    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
      const icons = document.createElement('link');
      icons.rel = 'stylesheet';
      icons.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
      document.head.appendChild(icons);
    }
    const style = document.createElement('style');
    style.textContent = [
      '#zimaSupportLauncher .support-fab{position:fixed;right:24px;bottom:24px;z-index:1050;width:54px;height:54px;border:1px solid #ffffff50;border-radius:50%;background:#0f6552;color:white;display:grid;place-items:center;box-shadow:0 6px 22px #103e3733;cursor:pointer;font-size:23px}',
      '#zimaSupportLauncher .support-fab:hover{background:#104c40}',
      '#zimaSupportLauncher .support-fab svg{display:block;width:25px;height:25px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}',
      '#zimaSupportLauncher .support-fab[hidden]{display:none}',
      '#zimaSupportLauncher button:focus-visible{outline:3px solid #81cbb1;outline-offset:4px}',
      '#zimaSupportModal{position:fixed;inset:0;z-index:2100;background:#0b201b80;backdrop-filter:blur(5px);padding:24px;display:flex;align-items:center;justify-content:center}',
      '#zimaSupportModal[hidden]{display:none}',
      '#zimaSupportModal .support-dialog{width:min(1180px,100%);height:min(900px,94dvh);background:#f3f6f5;border-radius:18px;overflow:hidden;box-shadow:0 28px 90px #071d1c55;display:flex;flex-direction:column}',
      '#zimaSupportModal .support-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 22px;background:white;border-bottom:1px solid #e0e8e2}',
      '#zimaSupportModal h2{font:650 18px "Segoe UI",Arial,sans-serif;color:#153c31;margin:0}',
      '#zimaSupportModal .support-close{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;border:1px solid #dce7e0;color:#345b4b;background:white;font-size:24px;cursor:pointer}',
      '#zimaSupportFrame{width:100%;flex:1;min-height:0;border:0;background:#f3f6f5}',
      '@media(max-width:700px){#zimaSupportLauncher .support-fab{right:16px;bottom:calc(86px + env(safe-area-inset-bottom,0px));width:48px;height:48px}#zimaSupportModal{padding:8px}#zimaSupportModal .support-dialog{height:96dvh;border-radius:12px}}',
      '@media print{#zimaSupportLauncher{display:none!important}}'
    ].join('');
    document.head.appendChild(style);
    const wrapper = document.createElement('div');
    wrapper.id = 'zimaSupportLauncher';
    wrapper.className = 'no-print';
    wrapper.innerHTML = '<button class="support-fab" type="button" aria-label="Abrir soporte ZimaTicket" title="Soporte · ZimaTicket" aria-haspopup="dialog" aria-controls="zimaSupportModal" aria-expanded="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 12H3v6h4v-6H4Zm16 0h1v6h-4v-6h3Zm0 6v1a2 2 0 0 1-2 2h-4"/><path d="M10 21h4"/></svg></button>' +
      '<div id="zimaSupportModal" hidden><section class="support-dialog" role="dialog" aria-modal="true" aria-labelledby="zimaSupportTitle"><div class="support-dialog-head"><h2 id="zimaSupportTitle">ZimaTicket · Centro de soporte</h2><button class="support-close" type="button" aria-label="Cerrar soporte">&times;</button></div><iframe id="zimaSupportFrame" title="Portal de soporte ZimaTicket"></iframe></section></div>';
    document.body.appendChild(wrapper);
    const modal = document.getElementById('zimaSupportModal');
    const frame = document.getElementById('zimaSupportFrame');
    const launcher = wrapper.querySelector('.support-fab');
    const closeButton = wrapper.querySelector('.support-close');
    let previousFocus;
    let previousOverflow = '';
    let backgrounds = [];
    function openSupport() {
      if (/^(ADMIN|ADMINISTRADOR|SOPORTE)$/.test(String(session.rol).trim().toUpperCase()) && !/\/soporte\.html$/i.test(location.pathname)) {
        window.location.href = 'control-soporte.html#tickets';
        return;
      }
      document.dispatchEvent(new Event('zima-support-opened'));
      if (/\/soporte\.html$/i.test(location.pathname)) {
        const subject = document.getElementById('subject');
        if (subject) subject.focus();
        return;
      }
      if (!modal.hidden) return;
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      backgrounds = Array.from(document.body.children).filter(el => el !== wrapper).map(el => [el, el.inert]);
      backgrounds.forEach(([el]) => { el.inert = true; });
      launcher.hidden = true;
      modal.hidden = false;
      launcher.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (!frame.getAttribute('src')) frame.src = 'soporte.html?embed=1';
      closeButton.focus();
    }
    function closeSupport() {
      if (modal.hidden) return;
      modal.hidden = true;
      launcher.hidden = false;
      launcher.setAttribute('aria-expanded', 'false');
      backgrounds.forEach(([el, inert]) => { el.inert = inert; });
      backgrounds = [];
      document.body.style.overflow = previousOverflow;
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
      else launcher.focus();
    }
    launcher.addEventListener('click', openSupport);
    closeButton.addEventListener('click', closeSupport);
    modal.addEventListener('click', event => { if (event.target === modal) closeSupport(); });
    document.addEventListener('keydown', event => {
      if (modal.hidden) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeSupport(); }
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === closeButton) { event.preventDefault(); frame.focus(); }
      else if (event.key === 'Tab' && !event.shiftKey && document.activeElement === frame) { event.preventDefault(); closeButton.focus(); }
    }, true);
    window.addEventListener('message', event => {
      if (event.source === frame.contentWindow && event.origin === location.origin && event.data && event.data.type === 'zima-support-close') closeSupport();
    });
    document.addEventListener('click', event => {
      const link = event.target.closest && event.target.closest('a[href="soporte.html"]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); openSupport();
    });
    installAdminTicketNotifications(launcher, openSupport);
  }

  function installAdminTicketNotifications(launcher, openSupport) {
    const session = getSupportSession();
    if (!session.token || !/^(ADMIN|ADMINISTRADOR|SOPORTE)$/.test(String(session.rol).trim().toUpperCase()) || /\/login(?:-soporte)?\.html$/i.test(location.pathname)) return;
    const endpoint = 'https://script.google.com/macros/s/AKfycbxtUVnS29d-Oo976b6poyXAIxahCLK5tIgXkKBfa_g_zrEP_dCYWVac8XCy22w3_1xsJQ/exec';
    const key = 'ZIMA_ADMIN_TICKETS_REVIEWED:' + String(session.usuario).trim().toLowerCase();
    let seen = new Set();
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(stored)) seen = new Set(stored);
    } catch (_) {}
    let attention = [];
    const notified = new Set();
    let soundContext;
    let lastRing = 0;
    async function ring() {
      if (!attention.length || document.hidden || getSupportSession().token !== session.token) return;
      if (Date.now() - lastRing < 15000) return;
      const modal = document.getElementById('zimaSupportModal');
      if (modal && !modal.hidden) return;
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      try {
        soundContext = soundContext || new Audio();
        if (soundContext.state !== 'running') {
          if (!navigator.userActivation || !navigator.userActivation.isActive) return;
          await soundContext.resume();
        }
        if (soundContext.state !== 'running' || !attention.length) return;
        lastRing = Date.now();
        const start = soundContext.currentTime;
        [740, 988].forEach((frequency, index) => {
          const oscillator = soundContext.createOscillator();
          const gain = soundContext.createGain();
          const time = start + index * .15;
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(.065, time + .015);
          gain.gain.exponentialRampToValueAtTime(.001, time + .28);
          oscillator.connect(gain); gain.connect(soundContext.destination);
          oscillator.start(time); oscillator.stop(time + .3);
          oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        });
      } catch (_) { /* El contador sigue disponible si el navegador bloquea el sonido. */ }
    }
    function acknowledge() {
      attention.forEach(row => seen.add(String(row.id)));
      attention = [];
      alert.hidden = true;
      try { localStorage.setItem(key, JSON.stringify(Array.from(seen).slice(-1000))); } catch (_) {}
    }
    const style = document.createElement('style');
    style.textContent = '.zima-ticket-count{position:absolute;top:-5px;right:-5px;min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;border:2px solid white;border-radius:20px;background:#b73336;color:white;font:700 11px/18px Arial,sans-serif}.zima-ticket-alert{position:fixed;right:24px;bottom:90px;width:min(350px,calc(100vw - 32px));box-sizing:border-box;z-index:1060;padding:20px;border:1px solid #cdded6;border-left:4px solid #0f6552;border-radius:14px;background:#fff;color:#183c32;box-shadow:0 12px 36px #103e3730;font:14px/1.5 "Segoe UI",Arial,sans-serif}.zima-ticket-alert[hidden],.zima-ticket-count[hidden]{display:none}.zima-ticket-alert strong{display:block;padding-right:22px;font-size:16px}.zima-ticket-alert p{margin:8px 0 14px}.zima-ticket-alert .ticket-review{border:0;border-radius:8px;background:#0f6552;color:white;padding:10px 16px;font:600 14px "Segoe UI",Arial,sans-serif;cursor:pointer}.zima-ticket-alert .ticket-dismiss{position:absolute;right:10px;top:8px;border:0;background:transparent;color:#45665b;font-size:24px;cursor:pointer}@media(max-width:700px){.zima-ticket-alert{right:16px;bottom:calc(148px + env(safe-area-inset-bottom,0px))}}@media print{.zima-ticket-alert{display:none!important}}';
    document.head.appendChild(style);
    const badge = document.createElement('span');
    badge.className = 'zima-ticket-count';
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    launcher.appendChild(badge);
    const menuBadges = Array.from(document.querySelectorAll('a[href="soporte.html"]')).map(link => {
      const count = document.createElement('span');
      count.className = 'zima-ticket-menu-count';
      count.hidden = true;
      count.setAttribute('aria-hidden', 'true');
      link.appendChild(count);
      return {link, count};
    });
    const menuStyle = document.createElement('style');
    menuStyle.textContent = 'a[href="soporte.html"] .zima-ticket-menu-count{display:inline-flex!important;align-items:center;justify-content:center;position:static!important;flex:0 0 auto!important;margin-left:auto!important;min-width:23px!important;width:auto!important;height:23px!important;padding:0 6px!important;border-radius:20px!important;background:#b73336!important;color:#fff!important;font:700 11px/1 Arial,sans-serif!important;letter-spacing:0!important}a[href="soporte.html"] .zima-ticket-menu-count[hidden]{display:none!important}';
    document.head.appendChild(menuStyle);
    function updateCounts(total) {
      const text = total > 99 ? '99+' : String(total);
      badge.textContent = text;
      badge.hidden = total === 0;
      menuBadges.forEach(({link, count}) => {
        count.textContent = text;
        count.hidden = total === 0;
        link.setAttribute('aria-label', 'ZimaTicket' + (total ? ' · ' + total + ' tickets pendientes' : ''));
      });
    }
    const alert = document.createElement('aside');
    alert.className = 'zima-ticket-alert no-print';
    alert.hidden = true;
    alert.setAttribute('role', 'status');
    alert.setAttribute('aria-live', 'polite');
    alert.innerHTML = '<button type="button" class="ticket-dismiss" aria-label="Cerrar aviso de tickets">&times;</button><strong>Nuevo ZimaTicket</strong><p></p><button type="button" class="ticket-review">Revisar tickets</button>';
    document.body.appendChild(alert);
    alert.querySelector('.ticket-dismiss').addEventListener('click', () => { alert.hidden = true; });
    alert.querySelector('.ticket-review').addEventListener('click', () => { acknowledge(); openSupport(); });
    launcher.addEventListener('click', acknowledge);
    document.addEventListener('zima-support-opened', acknowledge);
    document.addEventListener('pointerdown', ring);
    document.addEventListener('keydown', ring);
    let loading = false;
    let stopped = false;
    function queryTickets() {
      return new Promise((resolve, reject) => {
        const callback = '__zima_admin_tickets_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        const script = document.createElement('script');
        const cleanup = () => { clearTimeout(timeout); delete window[callback]; script.remove(); };
        const timeout = setTimeout(() => { cleanup(); reject(Error('timeout')); }, 20000);
        window[callback] = result => { cleanup(); resolve(result); };
        script.onerror = () => { cleanup(); reject(Error('connection')); };
        script.src = endpoint + '?' + new URLSearchParams({action: 'tickets', token: session.token, callback: callback});
        document.head.appendChild(script);
      });
    }
    async function refresh() {
      if (loading || stopped || document.hidden) return;
      const current = getSupportSession();
      if (current.token !== session.token || !/^(ADMIN|ADMINISTRADOR|SOPORTE)$/.test(String(current.rol).trim().toUpperCase())) {
        stopped = true; updateCounts(0); alert.hidden = true; return;
      }
      loading = true;
      try {
        const result = await queryTickets();
        if (getSupportSession().token !== session.token) {
          stopped = true; updateCounts(0); alert.hidden = true; return;
        }
        if (!result || !result.ok || result.admin !== true) return;
        const pending = (result.rows || []).filter(row => row.estado === 'ABIERTO' || row.estado === 'EN_PROCESO');
        updateCounts(pending.length);
        launcher.setAttribute('aria-label', 'Abrir soporte ZimaTicket' + (pending.length ? ' · ' + pending.length + ' tickets pendientes' : ''));
        const fresh = pending.filter(row => row.id && !seen.has(String(row.id)));
        attention = fresh;
        if (!pending.length) alert.hidden = true;
        if (!fresh.length) return;
        // Esperar a que el administrador cierre soporte para evitar avisos sobre el formulario.
        const modal = document.getElementById('zimaSupportModal');
        if ((modal && !modal.hidden) || /\/soporte\.html$/i.test(location.pathname)) { acknowledge(); return; }
        if (fresh.every(row => notified.has(String(row.id)))) return;
        alert.querySelector('strong').textContent = fresh.length === 1 ? 'Nuevo ZimaTicket' : fresh.length + ' nuevos ZimaTickets';
        alert.querySelector('p').textContent = fresh.length === 1
          ? String(fresh[0].nombre || fresh[0].usuario || 'Un usuario') + ': ' + String(fresh[0].titulo || 'Solicitud de soporte')
          : 'Hay nuevas solicitudes de soporte esperando revisión del administrador.';
        alert.hidden = false;
        fresh.forEach(row => notified.add(String(row.id)));
        void ring();
      } catch (_) { /* Reintentar en la siguiente consulta sin interrumpir el trabajo. */ }
      finally { loading = false; }
    }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', event => {
      if (event.key === key) {
        try { JSON.parse(event.newValue || '[]').forEach(id => seen.add(id)); } catch (_) {}
        attention = attention.filter(row => !seen.has(String(row.id)));
        alert.hidden = true;
      }
    });
    setInterval(refresh, 60000);
    setInterval(ring, 15000);
    void refresh();
  }

  function installSupportWorkspace() {
    const session = getSupportSession();
    if (String(session.rol || '').trim().toUpperCase() !== 'SOPORTE') return;
    const page = location.pathname.split('/').pop().toLowerCase();
    if (page === 'login-soporte.html') return;
    if (!['login.html','soporte.html','granadmin.html','control-soporte.html'].includes(page)) {
      window.location.replace('control-soporte.html');
      return;
    }
    document.body.classList.add('zima-support-workspace');
    const style = document.createElement('style');
    style.textContent = 'body.zima-support-workspace [data-zima-support-hidden]{display:none!important}';
    document.head.appendChild(style);
    document.querySelectorAll('nav a[href], .sidebar .nav a[href]').forEach(function(link) {
      const target = new URL(link.getAttribute('href'),location.href).pathname.split('/').pop().toLowerCase();
      if (!['soporte.html','granadmin.html','control-soporte.html'].includes(target)) link.setAttribute('data-zima-support-hidden','');
      if (target === 'granadmin.html' && page !== 'control-soporte.html') {
        const label = link.querySelector('span:last-child');
        if (label) label.textContent = 'Accesos y auditoría';
        else link.textContent = 'Accesos y auditoría';
      }
    });
    document.querySelectorAll('.top nav').forEach(function(nav) {
      if (nav.querySelector('a[href="granadmin.html"]')) return;
      const link = document.createElement('a');
      link.href = 'granadmin.html';
      link.textContent = 'Accesos y auditoría';
      nav.appendChild(link);
    });
    if (page !== 'login.html') {
      document.querySelectorAll('.sidebar nav, .sidebar .nav, .top nav').forEach(function(nav) {
        if (page === 'control-soporte.html') return;
        if (nav.querySelector('a[href="control-soporte.html"]')) return;
        const link = document.createElement('a');
        link.href = 'control-soporte.html';
        link.textContent = 'Centro de control';
        if (nav.closest('.sidebar')) link.className = 'nav-item';
        nav.prepend(link);
      });
      if (window.self === window.top && !document.getElementById('zimaSupportCore')) {
        const script = document.createElement('script');
        script.id = 'zimaSupportCore';
        script.src = 'control-soporte-core.js';
        document.head.appendChild(script);
      }
    }
  }

  function installDesktopNotifications() {
    const session = getSupportSession();
    if (window.self !== window.top || !session.token || !/^(ADMIN|ADMINISTRADOR|SOPORTE)$/.test(String(session.rol).trim().toUpperCase()) || /\/login(?:-soporte)?\.html$/i.test(location.pathname)) return;
    if (!window.ZimaSupportControl && !document.getElementById('zimaSupportCore')) {
      const script = document.createElement('script');
      script.id = 'zimaSupportCore';
      script.src = 'control-soporte-core.js';
      document.head.appendChild(script);
    }
    if (document.getElementById('openDesktop') || document.getElementById('zimaDesktopLauncher')) return;
    const header = document.querySelector('.topbar .userbox,.topbar-right,.toolbar .actions,.top .session-user') || document.querySelector('.topbar,.top,.toolbar');
    if (!header) return;
    const style = document.createElement('style');
    style.textContent = '.zima-desktop-launcher{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:8px 10px;border:1px solid #cbd8dc;border-radius:8px;background:#fff;color:#003747;font:700 11px "Segoe UI",Arial,sans-serif;cursor:pointer}.zima-desktop-launcher svg{width:16px;height:16px}.topbar .zima-desktop-launcher,.top .zima-desktop-launcher{color:inherit;background:transparent;border-color:#ffffff50}.zima-desktop-settings{width:min(450px,calc(100% - 24px));max-height:90dvh;overflow:auto;border:1px solid #e4e8ee;border-radius:12px;padding:24px;background:#fff;color:#172235;box-shadow:0 24px 70px #08111e40;font-family:"Segoe UI",Arial,sans-serif}.zima-desktop-settings::backdrop{background:#08111e80;backdrop-filter:blur(5px)}.zima-desktop-settings h2{margin:0 0 14px;font-size:21px}.zima-desktop-settings p{font-size:13px;color:#64748b;line-height:1.7}.zima-desktop-settings .desktop-state{padding:12px;background:#f8fafc;border:1px solid #e4e8ee;border-radius:8px;font-size:12px;line-height:1.7}.zima-desktop-settings .desktop-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.zima-desktop-settings .btn{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:10px 14px;border:1px solid #e4e8ee;border-radius:8px;background:#fff;color:#172235;font:750 12px "Segoe UI",Arial,sans-serif;cursor:pointer}.zima-desktop-settings .btn.primary{background:#003747;border-color:#003747;color:#fff}.zima-desktop-settings [data-desktop-message]{font-size:12px;line-height:1.7;margin-top:14px;color:#8b6a1e}.zima-desktop-settings button:disabled{opacity:.55;cursor:wait}@media(max-width:600px){.zima-desktop-launcher span{display:none}}@media print{.zima-desktop-launcher,.zima-desktop-settings{display:none!important}}';
    document.head.appendChild(style);
    const launcher = document.createElement('button');
    launcher.id = 'zimaDesktopLauncher';
    launcher.type = 'button';
    launcher.className = 'btn zima-desktop-launcher no-print';
    launcher.setAttribute('aria-label','Activar notificaciones de escritorio');
    launcher.title = 'Notificaciones de escritorio';
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span>Notificaciones</span>';
    header.appendChild(launcher);
    const dialog = document.createElement('dialog');
    dialog.className = 'zima-desktop-settings no-print';
    dialog.setAttribute('aria-labelledby','zimaDesktopTitle');
    dialog.innerHTML = '<h2 id="zimaDesktopTitle">Notificaciones de escritorio</h2><p>Activa los avisos en este PC para saber cuándo ingresa un peaje. El sistema debe permanecer abierto.</p><div class="desktop-state" data-desktop-state>Cargando el servicio de notificaciones…</div><div data-desktop-message role="status" aria-live="polite"></div><div class="desktop-actions"><button type="button" class="btn primary" data-desktop-enable>Activar notificaciones</button><button type="button" class="btn" data-desktop-test>Probar aviso</button><button type="button" class="btn" data-desktop-disable>Desactivar</button><button type="button" class="btn" data-desktop-close>Cerrar</button></div>';
    document.body.appendChild(dialog);
    const state = dialog.querySelector('[data-desktop-state]');
    const message = dialog.querySelector('[data-desktop-message]');
    const enable = dialog.querySelector('[data-desktop-enable]');
    const test = dialog.querySelector('[data-desktop-test]');
    const disable = dialog.querySelector('[data-desktop-disable]');
    let connected = false;
    function connect() {
      if (connected || !window.ZimaSupportControl) return;
      connected = true;
      window.ZimaSupportControl.subscribe(function(value) {
        const labels = {enabled:'Notificaciones activadas en este PC.',disabled:'Sin activar. Pulsa «Activar notificaciones» y permite los avisos del navegador.',denied:'El navegador las bloqueó. Abre la configuración de este sitio y permite las notificaciones.',unavailable:'Para mostrar avisos en el escritorio debes abrir el sitio con HTTPS en un navegador de escritorio compatible.'};
        state.textContent = labels[value.desktop];
        enable.disabled = value.desktop === 'enabled';
        test.disabled = value.desktop !== 'enabled';
        disable.disabled = value.desktop !== 'enabled';
      });
    }
    launcher.onclick = function() {
      connect();message.textContent = '';
      if (!window.ZimaSupportControl) state.textContent = 'No se cargó el servicio. Publica control-soporte-core.js junto con zima-ui.js y recarga la página.';
      dialog.showModal();
    };
    enable.onclick = async function() {
      if (!window.ZimaSupportControl) {message.textContent='Falta cargar control-soporte-core.js. Actualiza los archivos del sitio y recarga.';return;}
      enable.disabled = true;
      try {const result=await window.ZimaSupportControl.enable();message.textContent=result.message;}
      catch (error) {message.textContent=error.message;}
      finally {enable.disabled=window.ZimaSupportControl.state().desktop==='enabled';}
    };
    test.onclick = function() {message.textContent=window.ZimaSupportControl?.test()?'Aviso de prueba enviado al escritorio.':'No se pudo mostrar el aviso. Revisa los permisos del navegador y del PC.';};
    disable.onclick = function() {window.ZimaSupportControl?.disable();message.textContent='Notificaciones desactivadas en este equipo.';};
    dialog.querySelector('[data-desktop-close]').onclick = function() {dialog.close();};
    window.addEventListener('zima-support-ready',connect);
    connect();
  }

  function installFloatingClock() {
    if (window.self !== window.top || document.getElementById('zimaFloatingClock')) return;
    const style = document.createElement('style');
    style.textContent = [
      '#zimaFloatingClock{position:fixed;right:24px;bottom:calc(24px + env(safe-area-inset-bottom,0px));z-index:1040;display:flex;align-items:center;gap:10px;box-sizing:border-box;padding:10px 14px;border:1px solid #d6e2e5;border-radius:14px;background:rgba(255,255,255,.96);color:#104149;box-shadow:0 5px 22px #103e371a;font-family:"Segoe UI",Arial,sans-serif;pointer-events:none}',
      '#zimaFloatingClock.has-support{right:90px}',
      '#zimaFloatingClock svg{width:22px;height:22px;flex-shrink:0;color:#b28a24}',
      '#zimaFloatingClock time{display:block;font-size:19px;font-weight:700;line-height:1.15;letter-spacing:.6px;font-variant-numeric:tabular-nums}',
      '#zimaFloatingClock small{display:block;font-size:10px;line-height:1.4;margin-top:3px;color:#65777a}',
      '@media(max-width:700px){#zimaFloatingClock{right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));padding:8px 10px;gap:7px}#zimaFloatingClock.has-support{right:76px;bottom:calc(86px + env(safe-area-inset-bottom,0px))}#zimaFloatingClock time{font-size:17px}#zimaFloatingClock svg{width:18px;height:18px}}',
      '@media print{#zimaFloatingClock{display:none!important}}'
    ].join('');
    document.head.appendChild(style);
    const clock = document.createElement('aside');
    clock.id = 'zimaFloatingClock';
    clock.className = 'no-print' + (document.getElementById('zimaSupportLauncher') ? ' has-support' : '');
    clock.setAttribute('aria-label', 'Hora de Colombia');
    clock.setAttribute('aria-live', 'off');
    clock.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div><time></time><small></small></div>';
    document.body.appendChild(clock);
    const time = clock.querySelector('time');
    const date = clock.querySelector('small');
    const timeFormat = new Intl.DateTimeFormat('es-CO', {timeZone:'America/Bogota',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const dateFormat = new Intl.DateTimeFormat('es-CO', {timeZone:'America/Bogota',day:'numeric',month:'short'});
    function updateClock() {
      if (document.hidden) return;
      const now = new Date();
      time.textContent = timeFormat.format(now);
      time.dateTime = now.toISOString();
      date.textContent = 'Colombia · ' + dateFormat.format(now);
      clock.title = 'Hora de Colombia · America/Bogota (UTC−5)';
    }
    updateClock();
    setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', updateClock);
  }

  function installResponsiveNavigation() {
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.topbar-left,.topbar,.top,.toolbar');
    if (!sidebar || !header || document.body.classList.contains('embedded-edit')) return;
    document.body.classList.add('zima-responsive-nav');
    const compact = window.matchMedia('(max-width: 1180px)');
    sidebar.id = sidebar.id || 'zimaMainMenu';
    const toggle = document.getElementById('menuToggle') || document.createElement('button');
    toggle.type = 'button';
    toggle.classList.add('zima-menu-toggle');
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.removeAttribute('onclick');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
    if (!toggle.parentElement) header.prepend(toggle);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'zima-menu-close';
    close.setAttribute('aria-label', 'Cerrar menú');
    close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    sidebar.prepend(close);
    const backdrop = document.createElement('div');
    backdrop.className = 'zima-nav-backdrop no-print';
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
    function setOpen(open, restoreFocus) {
      const drawer = compact.matches;
      document.body.classList.toggle('zima-drawer-nav', drawer);
      open = Boolean(open && drawer);
      document.body.classList.toggle('zima-nav-open', open);
      sidebar.classList.toggle('mobile-open', open);
      sidebar.inert = drawer && !open;
      if (drawer) sidebar.setAttribute('aria-hidden', String(!open));
      else sidebar.removeAttribute('aria-hidden');
      backdrop.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      toggle.title = open ? 'Cerrar menú' : 'Abrir menú';
      if (open) close.focus();
      else if (restoreFocus) toggle.focus();
    }
    toggle.onclick = function () { setOpen(!document.body.classList.contains('zima-nav-open'), true); };
    close.onclick = backdrop.onclick = function () { setOpen(false, true); };
    sidebar.addEventListener('click', function (event) {
      if (event.target.closest('a[href], [role="tab"]')) setOpen(false, !!event.target.closest('[role="tab"]'));
    });
    document.addEventListener('keydown', function (event) {
      if (!document.body.classList.contains('zima-nav-open')) return;
      if (event.key === 'Escape') { setOpen(false, true); return; }
      if (event.key !== 'Tab') return;
      const items = Array.from(sidebar.querySelectorAll('a[href],button')).filter(function (el) {
        return !el.disabled && el.getClientRects().length;
      });
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    compact.addEventListener('change', function () { setOpen(false, false); });
    setOpen(false, false);
  }

  window.ZimaUI = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbxtUVnS29d-Oo976b6poyXAIxahCLK5tIgXkKBfa_g_zrEP_dCYWVac8XCy22w3_1xsJQ/exec',
    busy: busy,
    clearSession: clearSession,
    closeModal: closeModal,
    confirm: confirmDialog,
    playSaveSound: function() { return playWarningSound('success'); },
    confirmLogout: confirmLogout,
    escapeHtml: escapeHtml,
    fixMojibake: fixMojibake,
    notice: notice,
    openModal: openModal,
    repairVisibleText: repairVisibleText,
    reportSupport: reportSupport,
    sendSupportReport: sendSupportReport,
    getSupportSession: getSupportSession
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installSupportWorkspace();
      installDesktopNotifications();
      installResponsiveNavigation();
      installSupportLauncher();
      installFloatingClock();
      repairVisibleText();
      watchTextRepairs();
    });
  } else {
    installSupportWorkspace();
    installDesktopNotifications();
    installResponsiveNavigation();
    installSupportLauncher();
    installFloatingClock();
    repairVisibleText();
    watchTextRepairs();
  }
})();
