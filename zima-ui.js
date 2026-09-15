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
            '<div class="zima-confirm-icon" aria-hidden="true">!</div>' +
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

      function cleanup(value) {
        document.removeEventListener('keydown', onKeydown);
        document.body.style.overflow = '';
        backdrop.remove();
        resolve(value);
      }

      function onKeydown(event) {
        if (event.key === 'Escape') cleanup(false);
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

      const primary = backdrop.querySelector('[data-zima-confirm="ok"]');
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
      title: options.title || 'Cerrar sesi\u00f3n',
      message: options.message || 'Confirme si desea cerrar la sesi\u00f3n actual de ZIMA 360.',
      detail: options.detail || '',
      confirmText: options.confirmText || 'Cerrar sesi\u00f3n',
      cancelText: options.cancelText || 'Cancelar',
      danger: true
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

    try {
      localStorage.setItem('ZIMA_SUPPORT_LAST', JSON.stringify(payload));
    } catch (e) {}

    const sending = sendSupportReport(payload);

    if (options.redirect !== false && !/soporte\.html/i.test(location.pathname)) {
      setTimeout(function () {
        const target = 'soporte.html?auto=1';
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
    sendSupportReport: sendSupportReport
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      repairVisibleText();
      watchTextRepairs();
      installSupportWatcher();
    });
  } else {
    repairVisibleText();
    watchTextRepairs();
    installSupportWatcher();
  }
})();
