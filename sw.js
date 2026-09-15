// sw.js — Оптимизированный Service Worker для «Мой ТСД»
const CACHE_VERSION = 'v8';
const CACHE_NAME = 'moy-tsd-cache-' + CACHE_VERSION;

// Критически важные файлы для мгновенного офлайн-старта
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon.png',
    // Версионированные библиотеки (фиксированные URL):
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js',
    'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js',
    // Точный URL шрифта со стилем 900:
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                APP_SHELL.map((url) => 
                    cache.add(url).catch((err) => {
                        console.warn(`[SW] Пропущен ресурс при предзагрузке: ${url}`, err);
                    })
                )
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
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // 1. ВНЕШНИЕ CDN И ШРИФТЫ: Cache-First
    // Библиотеки жестко зафиксированы по версиям, отдаем мгновенно из кэша
    if (url.origin !== self.location.origin) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;

                return fetch(req).then((res) => {
                    if (!res || res.status !== 200 && res.type !== 'opaque') {
                        return res;
                    }
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                    return res;
                });
            })
        );
        return;
    }

    // 2. СОБСТВЕННЫЕ ФАЙЛЫ (HTML, манифест, иконка): Stale-While-Revalidate
    // Отдаем мгновенно из кэша, но в фоне обновляем при наличии сети
    event.respondWith(
        caches.match(req).then((cached) => {
            const networkFetch = fetch(req).then((res) => {
                if (res && res.status === 200) {
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
                }
                return res;
            }).catch(() => cached);

            return cached || networkFetch;
        })
    );
});

