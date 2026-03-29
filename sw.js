const CACHE_NAME = 'cgg-app-cache-v2';
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

self.addEventListener('notificationclick', event => {
    event.notification.close();

                        var targetUrl = '/';
    if (event.notification.data && event.notification.data.url) {
          targetUrl = event.notification.data.url;
    } else if (event.notification.data && event.notification.data.launchURL) {
          targetUrl = event.notification.data.launchURL;
    }

                        var params = '';
    try {
          var urlObj = new URL(targetUrl, self.location.origin);
          params = urlObj.search;
    } catch (e) {
          if (targetUrl.includes('?')) {
                  params = '?' + targetUrl.split('?')[1];
          }
    }

                        var appUrl = self.location.origin + self.location.pathname.replace('sw.js', 'index.html') + params;

                        event.waitUntil(
                              clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
                                      for (var i = 0; i < clientList.length; i++) {
                                                var client = clientList[i];
                                                if (client.url.includes('index.html') || client.url.includes('APP-MOP')) {
                                                            client.postMessage({ type: 'PUSH_NAVIGATE', params: params });
                                                            return client.focus();
                                                }
                                      }
                                      return clients.openWindow(appUrl);
                              })
                            );
});
