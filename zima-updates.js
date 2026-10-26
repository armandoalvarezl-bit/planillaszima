(function () {
  'use strict';
  // Cambiar id y mensaje al publicar una nueva actualización.
  const release = {
    id: '2026-10-26.1',
    title: 'Tu operación continúa sin internet',
    message: 'Al ingresar con internet, el sistema prepara y actualiza automáticamente una copia en este equipo, sin avisos constantes. Si se pierde la conexión, puedes consultar, crear, editar e imprimir planillas; los pendientes se envían al reconectar con la sesión activa. El tutorial explica cómo usarlo. Usa el mismo navegador y no borres sus datos mientras tengas pendientes.'
  };
  let audioContext;
  let pendingSound = false;
  let previousSignature = null;
  let announcing = false;
  const seenInMemory = new Set();

  async function playSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    pendingSound = true;
    try {
      audioContext = audioContext || new Audio();
      if (audioContext.state !== 'running') {
        if (!navigator.userActivation || !navigator.userActivation.isActive) return;
        await audioContext.resume();
      }
      if (audioContext.state !== 'running' || !pendingSound) return;
      pendingSound = false;
      const start = audioContext.currentTime;
      [660, 880].forEach(function (frequency, index) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const time = start + index * 0.16;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.07, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.22);
        oscillator.onended = function () { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch (_) { /* El aviso visual permanece disponible sin audio. */ }
  }

  function unlockSound() { if (pendingSound) void playSound(); }
  document.addEventListener('pointerdown', unlockSound);
  document.addEventListener('keydown', unlockSound);

  async function announce(user) {
    if (!user || announcing) return;
    const key = 'ZIMA_RELEASE_SEEN:' + String(user).trim().toLowerCase();
    let seen = seenInMemory.has(key);
    try { seen = seen || localStorage.getItem(key) === release.id; } catch (_) {}
    if (seen) return;
    announcing = true;
    try {
      void playSound();
      await ZimaUI.confirm({
        title: release.title,
        message: release.message,
        detail: 'Actualización ' + release.id,
        confirmText: 'Entendido', cancelText: 'Cerrar', danger: false
      });
      seenInMemory.add(key);
      try { localStorage.setItem(key, release.id); } catch (_) {}
    } finally { announcing = false; }
  }

  function observe(rows) {
    const signature = JSON.stringify(rows.map(function (row) {
      return [String(row.id || ''), row.updatedAt || '', row.estado || '', row.codigo || '', row.total || 0];
    }).sort(function (a, b) { return a[0].localeCompare(b[0]); }));
    if (previousSignature !== null && previousSignature !== signature) void playSound();
    previousSignature = signature;
  }

  window.ZimaUpdates = { release: release, announce: announce, observe: observe };
})();
