// Service Worker для «Дыши Носом»
// Стратегия: cache-first для оболочки приложения и статики.
// HTML обновляется в фоне, чтобы дневник открывался даже при плохой сети.
// При обновлении версии CACHE_VERSION старый кэш чистится.

const CACHE_VERSION = 'dyshinosom-v6';

const CORE_ASSETS = [
  './',
  './index.html',
  './app.html',
  './about.html',
  './404.html',
  './privacy.html',
  './terms.html',
  './manifest.json',
  './assets/logo.svg',
  './assets/logo-maskable.svg',
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './assets/og-image.png',
  './assets/apple-touch-icon.png'
];

const FONT_ASSETS = [
  './assets/fonts/Fraunces-VariableFont.woff2',
  './assets/fonts/Fraunces-Italic-VariableFont.woff2',
  './assets/fonts/JetBrainsMono-VariableFont.woff2',
  './assets/fonts/JetBrainsMono-Italic-VariableFont.woff2'
];

const STARTUP_ASSETS = [
  './assets/course/71.jpeg'
];

const PRECACHE_ASSETS = [...CORE_ASSETS, ...FONT_ASSETS, ...STARTUP_ASSETS];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Не удалось закэшировать', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function cacheFreshResponse(request) {
  return fetch(request).then((response) => {
    if (
      response &&
      response.status === 200 &&
      (response.type === 'basic' || response.type === 'cors')
    ) {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = cacheFreshResponse(request).catch(() => null);

        if (cached) {
          event.waitUntil(fresh);
          return cached;
        }

        return fresh.then((response) => {
          if (response) return response;
          return caches.match('./app.html')
            .then((fallback) => fallback || caches.match('./index.html'));
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return cacheFreshResponse(request);
    })
  );
});
