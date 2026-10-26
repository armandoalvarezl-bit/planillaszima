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
      '.session-logout{background:rgba(9,30,42,.5);backdrop-filter:blur(6px)}',
      '.session-logout .zima-confirm-card{width:min(400px,100%);border:1px solid #e4ecef;border-radius:22px;box-shadow:0 24px 80px #001b3033;max-height:calc(100dvh - 40px);overflow:auto}',
      '.session-logout .zima-confirm-card:before{display:none}',
      '.session-logout .zima-confirm-head{padding:30px 28px 16px;gap:16px;align-items:center}',
      '.session-logout .zima-confirm-icon{font-size:0;background:#edf5f7;border:1px solid #d8e8ec;color:#00687b;width:46px;height:46px}',
      '.session-logout .zima-confirm-icon:after{content:"\\2192";font-size:25px}',
      '.session-logout .zima-confirm-title{font-size:20px;font-weight:700;color:#143b48}',
      '.session-logout .zima-confirm-body{padding:0 28px 26px;color:#617581;line-height:1.7}',
      '.session-logout .zima-confirm-actions{padding:18px 28px;background:#f6f9fa;gap:10px}',
      '.session-logout .zima-confirm-btn{flex:1;border-radius:10px;min-height:44px;font-size:12px;font-weight:600}',
      '.session-logout .zima-confirm-btn.primary{background:#00566b;border-color:#00566b}',
      '.session-exit-spinner{width:28px;height:28px;flex-shrink:0;border:3px solid #d8e8ec;border-top-color:#00687b;border-radius:50%;animation:zima-session-spin .8s linear infinite}',
      '@keyframes zima-session-spin{to{transform:rotate(360deg)}}',
      '@media(prefers-reduced-motion:reduce){.session-exit-spinner{animation:none}}',
      '.zima-confirm-backdrop.holiday .zima-confirm-card{width:min(510px,100%);border-radius:18px;border:1px solid #d5c69e;background:#fffefa;box-shadow:0 28px 90px #0a292950}',
      '.zima-confirm-backdrop.holiday .zima-confirm-card:before{height:5px;background:linear-gradient(90deg,#315e4c,#cfb16b,#8f5650,#cfb16b,#315e4c)}',
      '.zima-confirm-backdrop.holiday .zima-confirm-head{flex-direction:column;align-items:center;text-align:center;gap:18px;padding:32px 30px 17px}',
      '.zima-confirm-backdrop.holiday .zima-confirm-icon{width:66px;height:66px;background:#f5efdf;color:#ac8c45;border:1px solid #e4d7b4;font-size:35px;font-weight:400}',
      '.zima-confirm-backdrop.holiday .zima-confirm-title{font-family:Georgia,"Times New Roman",serif;font-size:30px;font-weight:400;color:#214b3f;line-height:1.2}',
      '.zima-confirm-backdrop.holiday .zima-confirm-body{padding:0 32px 27px;text-align:center;color:#66776f;font-size:14px;line-height:1.85}',
      '.zima-confirm-backdrop.holiday .zima-confirm-message{max-width:none}',
      '.zima-confirm-backdrop.holiday .zima-confirm-detail{margin-top:23px;border:0;border-top:1px solid #e9e2d0;background:transparent;padding-top:18px;color:#9a824b;font-size:11px;font-weight:500;letter-spacing:.5px}',
      '.zima-confirm-backdrop.holiday .zima-confirm-actions{background:#faf8f1;justify-content:center;padding:18px 28px 24px;border-color:#eee8d9}',
      '.zima-confirm-backdrop.holiday .zima-confirm-btn{border-radius:8px;font-weight:600;min-height:43px;font-size:12px}',
      '.zima-confirm-backdrop.holiday .zima-confirm-btn.primary{background:#245744;border-color:#245744}',
      '@media(max-width:560px){.zima-confirm-actions{flex-direction:column-reverse}.zima-confirm-btn{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  function confirmDialog(options) {
    options = options || {};
    ensureConfirmStyles();

    return new Promise(function (resolve) {
      const backdrop = document.createElement('div');
      backdrop.className = 'zima-confirm-backdrop open';
      if (options.tone === 'success') backdrop.classList.add('success');
      if (options.tone === 'logout') backdrop.classList.add('session-logout');
      if (options.tone === 'holiday') backdrop.classList.add('holiday', 'no-print');
      backdrop.setAttribute('aria-hidden', 'false');

      const title = options.title || 'Confirmar acci\u00f3n';
      const message = options.message || '\u00bfDesea continuar?';
      const detail = options.detail || '';
      const confirmText = options.confirmText || 'Confirmar';
      const cancelText = options.cancelText || 'Cancelar';
      const danger = options.danger !== false;

      backdrop.innerHTML =
        '<div class="zima-confirm-card" role="dialog" aria-modal="true" aria-labelledby="zimaConfirmTitle">' +
          '<div class="zima-confirm-head">' +
            '<div class="zima-confirm-icon" aria-hidden="true">' + (options.tone === 'holiday' ? '&#10023;' : options.tone === 'success' ? '&#10003;' : '!') + '</div>' +
            '<div><h2 class="zima-confirm-title" id="zimaConfirmTitle">' + escapeHtml(title) + '</h2></div>' +
          '</div>' +
          '<div class="zima-confirm-body">' +
            '<div class="zima-confirm-message">' + escapeHtml(message) + '</div>' +
            (detail ? '<div class="zima-confirm-detail">' + escapeHtml(detail) + '</div>' : '') +
          '</div>' +
          '<div class="zima-confirm-actions">' +
            '<button class="zima-confirm-btn" type="button" data-zima-confirm="cancel">' + escapeHtml(cancelText) + '</button>' +
            '<button class="zima-confirm-btn ' + (danger ? 'danger' : 'primary') + '" type="button" data-zima-confirm="ok">' + escapeHtml(confirmText) + '</button>' +
          '</div>' +
        '</div>';

      const previousFocus = document.activeElement;
      const previousOverflow = document.body.style.overflow;
      let settled = false;
      function cleanup(value) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKeydown);
        document.body.style.overflow = previousOverflow;
        backdrop.remove();
        if (previousFocus && previousFocus.isConnected) previousFocus.focus();
        resolve(value);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') cleanup(false);
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

      const primary = backdrop.querySelector('[data-zima-confirm="cancel"]');
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
    if (window.ZimaOffline) window.ZimaOffline.lock();
    const keys = SESSION_KEYS.concat(['ZIMA_LAST_ACTIVITY', 'ZIMA_SESION_ESTADO', 'ZIMA_SHOW_WELCOME', 'ZIMA_SHOW_ANNOUNCEMENT'], extraKeys || []);
    [localStorage, sessionStorage].forEach(function (storage) {
      keys.forEach(function (key) {
        try {
          storage.removeItem(key);
        } catch (e) {}
      });
    });
  }

  function installIdleLogout() {
    const page = window.location.pathname.split('/').pop().toLowerCase();
    if (!/^(dashboard|planilla|historial|granadmin|informes|soporte)\.html$/.test(page)) return;

    const idleMs = 15 * 60 * 1000;
    const activityKey = 'ZIMA_LAST_ACTIVITY';
    let lastActivity = Date.now();
    let timer;
    let leaving = false;
    let lastServerActivity = 0;

    function notifyServer() {
      if (Date.now() - lastServerActivity < 30000) return;
      const session = getSupportSession();
      if (!session.token) return;
      lastServerActivity = Date.now();
      const payload = { action: 'sessionactivity', token: session.token };
      if (window.google && window.google.script && window.google.script.run) {
        window.google.script.run.withFailureHandler(function () { lastServerActivity = 0; }).apiPost(payload);
        return;
      }
      const url = localStorage.getItem('ZIMA_API_URL');
      if (!url) return;
      fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
        .catch(function () { lastServerActivity = 0; });
    }

    function readActivity() {
      try {
        const stored = Number(localStorage.getItem(activityKey));
        if (Number.isFinite(stored) && stored > 0) lastActivity = stored;
      } catch (_) {}
      return lastActivity;
    }

    function exit() {
      if (leaving) return;
      leaving = true;
      clearTimeout(timer);
      clearSession();
      window.location.replace('login.html?motivo=inactividad');
    }

    function check() {
      if (leaving) return;
      clearTimeout(timer);
      const remaining = idleMs - (Date.now() - readActivity());
      if (remaining <= 0) return exit();
      timer = setTimeout(check, remaining);
    }

    function activity() {
      // Check before renewing: waking a suspended tab must not revive an expired session.
      if (leaving) return;
      const previous = readActivity();
      if (Date.now() - previous >= idleMs) return exit();
      notifyServer();
      if (Date.now() - previous < 1000) return;
      lastActivity = Date.now();
      try { localStorage.setItem(activityKey, String(lastActivity)); } catch (_) {}
      check();
    }

    try {
      if (!localStorage.getItem(activityKey)) localStorage.setItem(activityKey, String(lastActivity));
    } catch (_) {}
    ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'input'].forEach(function (event) {
      document.addEventListener(event, activity, { capture: true, passive: true });
    });
    window.addEventListener('storage', function (event) {
      if (event.key !== activityKey && event.key !== null) return;
      if (!localStorage.getItem(activityKey)) return exit();
      check();
    });
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    check();
  }

  function confirmLogout(options) {
    options = options || {};

    return confirmDialog({
      title: options.title || 'Cerrar sesi\u00f3n',
      message: options.message || 'Confirme si desea cerrar la sesi\u00f3n actual de ZIMA 360.',
      detail: options.detail || '',
      confirmText: options.confirmText || 'Cerrar sesi\u00f3n',
      cancelText: options.cancelText || 'Cancelar',
      danger: false,
      tone: 'logout'
    }).then(function (ok) {
      if (!ok) return false;

      const leaving = document.createElement('div');
      leaving.className = 'zima-confirm-backdrop open session-logout';
      leaving.innerHTML = '<div class="zima-confirm-card" role="status" aria-live="polite" aria-busy="true"><div class="zima-confirm-head"><div class="session-exit-spinner" aria-hidden="true"></div><h2 class="zima-confirm-title">Cerrando sesi&oacute;n</h2></div><div class="zima-confirm-body">Estamos finalizando tu sesi&oacute;n. En un momento volver&aacute;s al acceso.</div></div>';
      document.body.appendChild(leaving);

      return Promise
        .resolve().then(function () {
          if (!options.beforeClear) return;
          let timeout;
          return Promise.race([
            Promise.resolve().then(function () { return options.beforeClear(); }),
            new Promise(function (resolve) { timeout = setTimeout(resolve, 5000); })
          ]).finally(function () { clearTimeout(timeout); });
        })
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
      'body:has(.login-wrapper) #zimaSupportLauncher .support-fab{bottom:24px}',
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
    if (!session.token || !/^(ADMIN|ADMINISTRADOR)$/.test(String(session.rol).trim().toUpperCase()) || /\/login\.html$/i.test(location.pathname)) return;
    const endpoint = 'https://script.google.com/macros/s/AKfycbwcCMhxYhF3uMmzpAmGL2uK02UHkHP1gyikRSsW5OfLxTofSjnT821hgqAuWX9TyrWXZg/exec';
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
      if (current.token !== session.token || !/^(ADMIN|ADMINISTRADOR)$/.test(String(current.rol).trim().toUpperCase())) {
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

  function installHolidayTheme() {
    // Tema navideno pausado en toda la aplicacion hasta reactivarlo manualmente.
    const holidayThemeEnabled = false;
    if (!holidayThemeEnabled || document.body.dataset.holidayTheme === 'off') {
      document.querySelectorAll('#zimaHolidayStyle,.zima-holiday-trim,.zima-holiday-note').forEach(function (el) { el.remove(); });
      document.body.classList.remove('zima-holiday');
      return;
    }
    // 24 de octubre de 2026, 06:00 en Colombia (UTC-05:00).
    const startsAt = Date.parse('2026-10-24T06:00:00-05:00');
    const previewUntil = Date.parse('2026-10-23T17:14:21-05:00');
    let timer;
    let installed = false;
    function refresh() {
      clearTimeout(timer);
      const now = Date.now();
      if (now < startsAt && now >= previewUntil) {
        if (installed) {
          document.querySelectorAll('#zimaHolidayStyle,.zima-holiday-trim,.zima-holiday-note').forEach(function (el) { el.remove(); });
          document.body.classList.remove('zima-holiday');
          installed = false;
        }
        timer = setTimeout(refresh, Math.min(startsAt - Date.now(), 60000));
        return;
      }
      if (now < startsAt) timer = setTimeout(refresh, Math.min(previewUntil - now, 60000));
      if (installed) return;
      installed = true;
      const style = document.createElement('style');
      style.id = 'zimaHolidayStyle';
      style.textContent = [
        '.zima-holiday-trim{position:fixed;inset:0 0 auto;height:7px;z-index:2000;pointer-events:none;background:radial-gradient(circle at 12px 3px,#b99a4f 0 2px,transparent 2.5px),radial-gradient(circle at 36px 3px,#446b59 0 2px,transparent 2.5px),radial-gradient(circle at 60px 3px,#a45b57 0 2px,transparent 2.5px);background-size:72px 7px;opacity:.75}',
        '.zima-holiday-note{display:flex;align-items:center;gap:7px;margin-top:12px;color:#bda773;font-family:"Segoe UI",Arial,sans-serif;font-size:10px;font-weight:400;letter-spacing:.3px;text-transform:none;line-height:1.5}',
        '.zima-holiday-note svg{display:block;width:17px;height:21px;flex-shrink:0}',
        'footer .zima-holiday-note,.footer .zima-holiday-note{color:#75846b}',
        '.footer:has(.zima-holiday-note){flex-wrap:wrap;gap:10px}.footer>.zima-holiday-note{flex-basis:100%;justify-content:center;margin-top:0}',
        'body.zima-holiday #zimaSupportLauncher .support-fab:after{content:"✦";position:absolute;right:-2px;top:-4px;color:#d4b76d;font-size:17px;text-shadow:0 1px 2px #143b35}',
        '@media print{.zima-holiday-trim,.zima-holiday-note{display:none!important}}'
      ].join('\n');
      document.head.appendChild(style);
      document.body.classList.add('zima-holiday');
      // La vista de soporte incrustada conserva el adorno de su ventana principal.
      if (window.self === window.top) {
        const trim = document.createElement('div');
        trim.className = 'zima-holiday-trim no-print';
        trim.setAttribute('aria-hidden', 'true');
        document.body.appendChild(trim);
      }
      document.querySelectorAll('.sidebar-bottom,.side-foot,body > .shell > .footer,.made-in-colombia').forEach(function (target) {
        // En el login, añadimos el saludo al contenedor, sin alterar la bandera.
        const host = target.matches('.made-in-colombia') ? target.parentElement : target;
        if (host.querySelector('.zima-holiday-note')) return;
        const note = document.createElement('div');
        note.className = 'zima-holiday-note no-print';
        note.innerHTML = '<svg viewBox="0 0 20 26" fill="none" aria-hidden="true"><path d="m10 2 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2L7 4.3 9 4Z" fill="#c3a258"/><path d="m10 8-5 6h3l-5 6h14l-5-6h3l-5-6Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 20v4" stroke="currentColor" stroke-width="1.3"/></svg><span>Una temporada para compartir</span>';
        host.appendChild(note);
      });
    }
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    refresh();
  }

  window.ZimaUI = {
    busy: busy,
    clearSession: clearSession,
    closeModal: closeModal,
    confirm: confirmDialog,
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

  installIdleLogout();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      installSupportLauncher();
      installHolidayTheme();
      repairVisibleText();
      watchTextRepairs();
    });
  } else {
    installSupportLauncher();
    installHolidayTheme();
    repairVisibleText();
    watchTextRepairs();
  }
})();
