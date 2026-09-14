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
      '.zima-confirm-backdrop{position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(8,17,30,.52);backdrop-filter:blur(5px)}',
      '.zima-confirm-backdrop.open{display:flex}',
      '.zima-confirm-card{width:min(430px,100%);background:#fff;border:1px solid #dce5ee;border-radius:14px;box-shadow:0 26px 90px rgba(8,17,30,.28);overflow:hidden}',
      '.zima-confirm-head{display:flex;align-items:center;gap:12px;padding:18px 20px 12px}',
      '.zima-confirm-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:#fff4db;color:#8a6200;font-weight:900;font-size:20px;flex:0 0 auto}',
      '.zima-confirm-title{margin:0;font-size:18px;line-height:1.15;font-weight:900;color:#07182b}',
      '.zima-confirm-body{padding:0 20px 18px;color:#526477;font-size:13px;line-height:1.5}',
      '.zima-confirm-detail{margin-top:12px;padding:12px;border:1px solid #e6edf4;border-radius:10px;background:#f8fafc;color:#07182b;font-weight:800}',
      '.zima-confirm-actions{display:flex;justify-content:flex-end;gap:10px;padding:14px 20px 18px;border-top:1px solid #edf2f7}',
      '.zima-confirm-btn{border:1px solid #d6e0ea;background:#fff;border-radius:10px;padding:10px 14px;font-weight:850;cursor:pointer}',
      '.zima-confirm-btn.primary{background:#003b49;border-color:#003b49;color:#fff}',
      '.zima-confirm-btn.danger{background:#b42318;border-color:#b42318;color:#fff}',
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

      const title = options.title || 'Confirmar acción';
      const message = options.message || '¿Desea continuar?';
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
            '<div>' + escapeHtml(message) + '</div>' +
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

  window.ZimaUI = {
    busy: busy,
    closeModal: closeModal,
    confirm: confirmDialog,
    escapeHtml: escapeHtml,
    notice: notice,
    openModal: openModal
  };
})();
