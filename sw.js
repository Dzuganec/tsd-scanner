const CACHE_NAME = 'tsd-cache-v2'; // Поменял версию, чтобы обновить старый кэш

// Базовый список только самых критичных файлов
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js' // Исправил ссылку на ту, что в HTML
];

// 1. УСТАНОВКА: Кэшируем базовые файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Кэширование базовых ресурсов');
        // Используем addAll, но ошибки не "роняют" весь процесс
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Заставляет SW активироваться немедленно
  );
});

// 2. АКТИВАЦИЯ: Очистка старого кэша при смене CACHE_NAME
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // SW сразу берет под контроль открытые вкладки
  );
});

// 3. ПЕРЕХВАТ ЗАПРОСОВ: Стратегия "Кэш, с фоллбэком на сеть и динамическим кэшированием"
self.addEventListener('fetch', event => {
  // Игнорируем запросы, которые не относятся к GET (например, POST/PUT) или специфичные схемы (chrome-extension)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // 1. Если файл есть в кэше — отдаём мгновенно
        if (cachedResponse) {
          return cachedResponse;
        }

        // 2. Если файла нет, идём в интернет
        return fetch(event.request).then(networkResponse => {
          // Проверяем валидность ответа (200 OK) и тип (basic для своих файлов, cors для CDN)
          if (!networkResponse || networkResponse.status !== 200 || (networkResponse.type !== 'basic' && networkResponse.type !== 'cors')) {
            return networkResponse;
          }

          // Клонируем ответ, так как поток (stream) можно прочитать только один раз
          const responseToCache = networkResponse.clone();

          // 3. Динамически сохраняем новый файл в кэш (например, Google Шрифты)
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return networkResponse;
        }).catch(err => {
          // Сюда попадем, если нет ни кэша, ни интернета
          console.warn('[SW] Сеть недоступна, запрос не выполнен:', event.request.url);
        });
      })
  );
});
