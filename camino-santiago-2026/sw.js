/* Camino de Santiago · service worker offline
   Scope: esta carpeta solamente. El sw.js de la raiz de narrador queda intacto:
   ante dos registros, el navegador usa el de scope mas especifico. */

const VERSION = 'camino-v2';
const APP     = VERSION + '-app';
const TILES   = VERSION + '-tiles';
const TILES_MAX = 900;
const BASE    = new URL('./', self.location).pathname;

const CORE = [
  './',
  './index.html',
  './documentos.html',
  './documentos.enc.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

const CSS_FUENTES = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap';

const CDN = new Set(['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
const esTile = h => h === 'tile.openstreetmap.org' || h.endsWith('.tile.openstreetmap.org');

async function guardar(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && (res.ok || res.type === 'opaque')) await cache.put(url, res);
  } catch (e) { /* si falla uno, el resto sigue */ }
}

/* el CSS de Google Fonts trae adentro las URLs de los .woff2: las bajamos tambien,
   si no la primera visita sin señal se veria con la tipografia del sistema */
async function guardarFuentes(cache) {
  try {
    const res = await fetch(CSS_FUENTES);
    if (!res.ok) return;
    const css = await res.clone().text();
    await cache.put(CSS_FUENTES, res);
    const urls = (css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || []);
    await Promise.allSettled(urls.map(u => guardar(cache, u)));
  } catch (e) { }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(APP);
    await Promise.allSettled(CORE.map(u => guardar(cache, u)));
    await guardarFuentes(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const viejos = (await caches.keys()).filter(k => k.startsWith('camino-') && k !== APP && k !== TILES);
    await Promise.all(viejos.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

const sinConexion = () => new Response(
  'Sin conexión y sin copia guardada de esto.',
  { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
);

/* HTML: red primero (con 3s de paciencia) y copia guardada si no hay señal.
   Asi una edicion nueva se ve al toque estando online. */
async function red_primero(req) {
  const cache = await caches.open(APP);
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    const res = await fetch(req, { signal: ctl.signal });
    clearTimeout(t);
    if (res && res.ok) { cache.put(req, res.clone()); return res; }
    throw new Error('respuesta ' + (res && res.status));
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true }))
        || (await cache.match('./index.html'))
        || (await cache.match('./'))
        || sinConexion();
  }
}

/* Resto de archivos propios: copia guardada al instante y refresco por atras. */
async function copia_y_refresco(e, req) {
  const cache = await caches.open(APP);
  const hit = await cache.match(req, { ignoreSearch: true });
  const red = fetch(req)
    .then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  if (hit) { e.waitUntil(red); return hit; }
  return (await red) || sinConexion();
}

async function desde_cdn(req) {
  const cache = await caches.open(APP);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch (e) { return sinConexion(); }
}

/* Mapas: se guarda lo que se va mirando (nada de bajar la ruta entera,
   la politica de uso de OSM no permite descargas masivas). */
async function baldosa(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone()).then(async () => {
        const keys = await cache.keys();
        if (keys.length > TILES_MAX) await Promise.all(keys.slice(0, keys.length - TILES_MAX).map(k => cache.delete(k)));
      });
    }
    return res;
  } catch (e) { return new Response('', { status: 504 }); }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // el pronostico ya se guarda solo en localStorage: no lo tocamos
  if (url.hostname === 'api.open-meteo.com') return;

  if (esTile(url.hostname)) { e.respondWith(baldosa(req)); return; }

  if (url.origin === self.location.origin && url.pathname.startsWith(BASE)) {
    const html = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === BASE;
    e.respondWith(html ? red_primero(req) : copia_y_refresco(e, req));
    return;
  }

  if (CDN.has(url.hostname)) { e.respondWith(desde_cdn(req)); return; }
});
