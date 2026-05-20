// Service Worker для «Дыши Носом»
// Стратегия: cache-first для статики/шрифтов, network-first для HTML.
// При обновлении версии CACHE_VERSION — старый кэш чистится.

const CACHE_VERSION = 'dyshinosom-v5';
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
  './assets/favicon.ico',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png'
];

// При установке — кладём ядро в кэш
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Используем addAll, но не падаем целиком если какой-то ассет отсутствует
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Не удалось закэшировать', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// При активации — чистим старые версии кэша
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

// fetch: network-first для HTML (чтобы получать свежие версии страниц),
// cache-first для шрифтов assets/fonts/ и остальной статики
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Только GET кэшируем
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Не вмешиваемся в межсайтовые запросы
  if (!sameOrigin) return;

  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  // Шрифты: cache-first (локальные woff2, не меняются)
  const isFontAsset = url.pathname.startsWith('/assets/fonts/');

  if (isHTML) {
    // network-first для HTML — всегда получаем свежую версию, при офлайне — кэш
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match('./index.html'))
        )
    );
    return;
  }

  if (isFontAsset) {
    // cache-first для локальных шрифтов — шрифты не меняются между релизами
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // cache-first для остальной статики (иконки, манифест, svg и т.п.)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Кэшируем только успешные ответы базового или CORS-типа
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
    })
  );
});
