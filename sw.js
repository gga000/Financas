const CACHE = 'financas-v3';

const urlsToCache = [
  self.registration.scope,
  self.registration.scope + 'index.html',
  self.registration.scope + 'js/globals.js',
  self.registration.scope + 'js/db.js',
  self.registration.scope + 'js/utils.js',
  self.registration.scope + 'js/pessoas.js',
  self.registration.scope + 'js/cards.js',
  self.registration.scope + 'js/transactions.js',
  self.registration.scope + 'js/budget.js',
  self.registration.scope + 'js/projection.js',
  self.registration.scope + 'js/config.js',
  self.registration.scope + 'js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        return caches.match(e.request)
          .then(cached => cached || new Response('Offline — sem cache disponível', {status: 503}));
      })
  );
});
