const CACHE_NAME = "ujeca-congreso-open-v7";
const MAINTENANCE_MODE = false;
const LOCK_PAGE = "evento-cancelado.html";

const APP_SHELL = [
  "./",
  "evento-cancelado.html",
  "mantenimiento.html",
  "maintenance-redirect.js",
  "index.html",
  "home.html",
  "cpanel.html",
  "form.html",
  "consulta-deuda.html",
  "pasarelapago.html",
  "Basedatos.html",
  "live.html",
  "contacto.html",
  "api-config.js",
  "live-config.js",
  "style1.css",
  "responsive-fixes.css",
  "pwa.js",
  "manifest.json",
  "img/logo.png",
  "img/banner.jpg",
  "img/WhatsApp Image 2026-02-19 at 18.27.17.jpeg",
  "img/afiche-oficial-congreso-2026.jpeg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if(request.method !== "GET") return;

  const url = new URL(request.url);
  const currentPage = url.pathname.substring(url.pathname.lastIndexOf("/") + 1) || "index.html";
  const acceptsHtml = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");

  if(MAINTENANCE_MODE && acceptsHtml && currentPage !== LOCK_PAGE){
    event.respondWith(
      caches.match(LOCK_PAGE)
        .then((cached) => cached || fetch(LOCK_PAGE))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("home.html")))
  );
});
