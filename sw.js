const CACHE_NAME = 'control-gastos-2026-v4';
const SCOPE = '/ControlGastos/';
const PRECACHE_URLS = [
  '/ControlGastos/',
  '/ControlGastos/index.html',
  '/ControlGastos/styles.css',
  '/ControlGastos/app.js',
  '/ControlGastos/manifest.json',
  '/ControlGastos/icon-192.png',
  '/ControlGastos/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.includes(SCOPE)) return;
  if (e.request.url.includes('firestore') || e.request.url.includes('firebase')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
