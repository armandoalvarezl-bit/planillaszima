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

  window.ZimaUI = {
    busy: busy,
    closeModal: closeModal,
    escapeHtml: escapeHtml,
    notice: notice,
    openModal: openModal
  };
})();
