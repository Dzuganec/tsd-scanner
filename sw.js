// sw.js — Service Worker для «Мой ТСД»
// В этой версии все необходимые библиотеки принудительно скачиваются 
// в момент установки SW (на фоне), чтобы сканер работал 100% оффлайн 
// даже при самом первом выходе без связи.

const CACHE_VERSION = 'v7';
const CACHE_NAME = 'moy-tsd-cache-' + CACHE_VERSION;

// Список файлов, которые браузер обязан загрузить и положить в кэш
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon.png',
    // Принудительно кэшируем CDN-библиотеки для оффлайна:
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll не должен валить установку целиком, если один из файлов недоступен
            // (например, иконки ещё нет на сервере) — поэтому кэшируем по одному.
            return Promise.all(
                APP_SHELL.map((url) => cache.add(url).catch((e) => { 
                    console.warn(`Не удалось закэшировать ресурс ${url} при установке SW:`, e); 
                }))
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // POST/PUT и т.п. не кэшируем — просто пропускаем в сеть как есть.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Внешние ресурсы (CDN-библиотеки, шрифты Google Fonts): "network first,
    // затем кэш" — так пользователь всегда получает свежую версию библиотеки,
    // когда есть сеть, а офлайн получает последнюю сохранённую копию.
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match(req))
        );
        return;
    }

    // Собственные файлы приложения: "кэш, но обнови в фоне" (stale-while-revalidate) —
    // мгновенная загрузка из кэша + подтягивание новой версии на следующий раз.
    event.respondWith(
        caches.match(req).then((cached) => {
            const fetchPromise = fetch(req)
                .then((res) => {
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone())).catch(() => {});
                    return res;
                })
                .catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
