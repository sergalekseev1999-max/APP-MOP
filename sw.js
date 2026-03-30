const CACHE_NAME = 'cgg-app-cache-v3';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      }).catch(() => {
        return cachedResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// === ОБРАБОТКА ПУША: клик на уведомление открывает PWA, а не браузер ===
self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Извлекаем action и containerId из data-поля пуша (приоритет)
  var action = '';
  var containerId = '';
  var targetUrl = '';

  if (event.notification.data) {
    // Наш кастомный data
    action = event.notification.data.action || '';
    containerId = event.notification.data.containerId || '';
    // Также проверяем URL из OneSignal
    targetUrl = event.notification.data.url || event.notification.data.launchURL || '';
  }

  // Формируем параметры для навигации внутри PWA
  var paramParts = [];
  if (action) paramParts.push('action=' + action);
  if (containerId && action !== 'new') paramParts.push('c=' + encodeURIComponent(containerId));

  // Если из data не удалось взять — пробуем из URL
  if (paramParts.length === 0 && targetUrl) {
    try {
      var urlObj = new URL(targetUrl, self.location.origin);
      if (urlObj.search) {
        paramParts.push(urlObj.search.replace('?', ''));
      }
    } catch (e) {
      if (targetUrl.includes('?')) {
        paramParts.push(targetUrl.split('?')[1]);
      }
    }
  }

  var params = paramParts.length > 0 ? '?' + paramParts.join('&') : '';

  // Собираем правильный URL для PWA (всегда наш index.html)
  var appUrl = self.location.origin + self.location.pathname.replace('sw.js', 'index.html') + params;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Сначала пробуем найти уже открытое окно PWA
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes('index.html') || client.url.includes('APP-MOP')) {
          // PWA уже открыто — фокусируемся и передаём параметры
          client.postMessage({ type: 'PUSH_NAVIGATE', params: params });
          return client.focus();
        }
      }
      // PWA не открыто — открываем новое окно с нашим URL
      return clients.openWindow(appUrl);
    })
  );
});
