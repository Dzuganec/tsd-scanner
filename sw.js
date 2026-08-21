const CACHE_NAME = 'tsd-cache-v1';

// Список того, что нужно сохранить в память телефона для работы без интернета
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  // Сохраняем внешние скрипты, чтобы сканер и генератор работали оффлайн
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

// При первой установке (открытии) сохраняем всё в кэш
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Открыт кэш');
        return cache.addAll(urlsToCache);
      })
  );
});

// Перехватываем запросы: если нет интернета, отдаем из кэша
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Если файл есть в кэше — отдаем его
        if (response) {
          return response;
        }
        // Иначе качаем из интернета
        return fetch(event.request);
      })
  );
});

// Удаляем старый кэш при выходе новой версии
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

