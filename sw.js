/*
 * Service worker — guarda la app en el celular para que abra sin señal.
 * Si cambias algún archivo de la app, sube el número de VERSION para que
 * los celulares descarguen la versión nueva.
 */
const VERSION = 'tvs-v1';
const ARCHIVOS = [
  './', './index.html', './config.js', './manifest.webmanifest',
  './vendor/jspdf.umd.min.js', './fonts/fonts.css',
  './fonts/barlow-latin-400-normal.woff2', './fonts/barlow-latin-500-normal.woff2',
  './fonts/barlow-latin-600-normal.woff2', './fonts/barlow-latin-700-normal.woff2',
  './fonts/barlow-semi-condensed-latin-600-normal.woff2', './fonts/barlow-semi-condensed-latin-700-normal.woff2',
  './fonts/barlow-semi-condensed-latin-700-italic.woff2',
  './fonts/ibm-plex-mono-latin-500-normal.woff2', './fonts/ibm-plex-mono-latin-600-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-64.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// La página y config.js: primero la red (para recibir cambios), con respaldo en el celular si no hay señal.
function redPrimero(req, respaldo) {
  return new Promise(resolve => {
    let listo = false;
    const usarCache = () => caches.match(respaldo || req, { ignoreSearch: true }).then(r => {
      if (!listo && r) { listo = true; resolve(r); }
      return r;
    });
    const t = setTimeout(usarCache, 4000);  // señal débil: no esperar más de 4 s
    fetch(req).then(r => {
      clearTimeout(t);
      if (r && r.ok) caches.open(VERSION).then(c => c.put(respaldo || req, r.clone()));
      if (!listo) { listo = true; resolve(r); }
    }).catch(() => {
      clearTimeout(t);
      usarCache().then(r => { if (!listo) { listo = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // el servidor de Google va directo a la red

  if (req.mode === 'navigate') { e.respondWith(redPrimero(req, './index.html')); return; }
  if (url.pathname.endsWith('/config.js')) { e.respondWith(redPrimero(req)); return; }

  // Resto (fuentes, íconos, librería PDF): primero lo guardado en el celular.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
      if (res && res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    }))
  );
});
