const CACHE_NAME = 'zima360-shell-offline-v9';
const OPTIONAL_CACHE = 'zima360-assets-offline-v9';
const APP_SHELL = [
  'login.html', 'dashboard.html', 'planilla.html', 'historial.html', 'informes.html',
  'granadmin.html', 'soporte.html', 'mantenimiento.html',
  'zima-offline.js', 'zima-ui.js', 'zima-updates.js', 'soporte.js', 'pwa.js', 'maintenance-redirect.js',
  'zima-offline-tutorial.js', 'zima-offline-tutorial.css',
  'logo-zima.png', 'logo-ani.png',
  'zima.css', 'zima-brand.css', 'zima-ui-modern.css', 'ui-theme.css', 'dashboard.css', 'soporte.css',
  'responsive-fixes.css', 'style1.css', 'manifest.json', 'assets/vendor/lucide.min.js',
  'assets/logos/logo-ani.png', 'img/logo.png', 'img/logo-ani.png', 'img/logo-zima.png',
  'img/navidad-santa-renos.png',
  'img/fondo-gracias-equipo-zima-octubre-2026.png', 'img/fondo-especial-zima-centro-octubre-2026.png',
  'img/fondo-celebracion-zima-octubre-2026.png'
];
const EXTERNAL = ['https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.2/font/bootstrap-icons.min.css'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Instalacion atomica: conservar la version anterior si falta un archivo esencial.
    await cache.addAll(APP_SHELL);
    const optional = await caches.open(OPTIONAL_CACHE);
    await Promise.allSettled(EXTERNAL.map(async url => {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      await optional.put(url, response.clone());
      const css = await response.text();
      const fonts = Array.from(css.matchAll(/url\(["']?([^\s)"']+)/g), match => new URL(match[1], url).href);
      await Promise.allSettled(fonts.map(async font => {
        const data = await fetch(font, { signal: AbortSignal.timeout(5000) }); if (data.ok) await optional.put(font, data);
      }));
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      (name.startsWith('zima360-') || name.startsWith('ujeca-congreso-open-')) &&
      name !== CACHE_NAME && name !== OPTIONAL_CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const base = new URL(self.registration.scope);
  // Nunca almacenar credenciales, JSONP ni respuestas privadas de la API en CacheStorage.
  if (url.origin !== base.origin) {
    if (!['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'].includes(url.hostname)) return;
    event.respondWith((async () => {
      const cached = await caches.match(request); if (cached) return cached;
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        const cache = await caches.open(OPTIONAL_CACHE); await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }
  const relative = url.pathname.slice(base.pathname.length);
  const file = relative || 'login.html';
  if (!APP_SHELL.includes(file)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // HTML/JS de una misma version para no mezclar contratos de sincronizacion.
    const cached = await cache.match(new URL(file, base).href);
    if (cached) return cached;
    return fetch(request);
  })());
});
