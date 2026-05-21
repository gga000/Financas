const CACHE = 'financas-v2';

// Cacheamos apenas o próprio HTML principal
const urlsToCache = [self.registration.scope, self.registration.scope + 'index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => {
        // Tenta cachear, ignora erros individuais
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
  // Apenas requisições GET
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Atualiza cache com resposta fresca
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Offline: serve do cache
        return caches.match(e.request)
          .then(cached => cached || new Response('Offline — sem cache disponível', {status: 503}));
      })
  );
});
