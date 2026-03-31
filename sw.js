// CACHE v5 — форсированный сброс старого кэша
const CACHE_NAME = 'cgg-app-cache-v5';
const urlsToCache = [
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
// ВАЖНО: index.html НЕ кэшируем — всегда берём из сети!
// Старый SW кэшировал index.html и отдавал устаревшую версию,
// из-за чего двухуровневая авторизация не работала.

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
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
  var url = event.request.url;

  // index.html и навигационные запросы — ВСЕГДА из сети (network-first)
  if (url.includes('index.html') || event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Успешно получили из сети — обновляем кэш
          var clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Нет сети — отдаём из кэша (offline fallback)
          return caches.match(event.request);
        })
    );
    return;
  }

  // Остальные ресурсы (иконки, манифест) — cache-first
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
        });
        return networkResponse;
      });
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
    var terminalName = event.notification.data.terminalName || '';
    // Также проверяем URL из OneSignal
    targetUrl = event.notification.data.url || event.notification.data.launchURL || '';
  }

  // Формируем параметры для навигации внутри PWA
  var paramParts = [];
  if (action) paramParts.push('action=' + action);
  if (containerId && action !== 'new' && action !== 'terminal') paramParts.push('c=' + encodeURIComponent(containerId));
  if (action === 'terminal' && terminalName) paramParts.push('t=' + encodeURIComponent(terminalName));

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
