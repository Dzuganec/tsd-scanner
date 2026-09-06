// sw.js — Service Worker для «Мой ТСД»
// Задачи:
// 1) Дать приложению открываться офлайн (после первого захода) — сама HTML-страница
//    и манифест/иконка кэшируются как "app shell".
// 2) Внешние библиотеки (html5-qrcode, JsBarcode, qrcode, шрифты) кэшируются
//    по мере использования, чтобы повторный офлайн-запуск не требовал сети.
// 3) При обновлении версии приложения — старые кэши подчищаются, новая версия
//    подхватывается сразу после закрытия всех вкладок (skipWaiting + clients.claim).

const CACHE_VERSION = 'v6';
const CACHE_NAME = 'moy-tsd-cache-' + CACHE_VERSION;

// Замените список на реальные имена файлов вашего проекта, если они отличаются.
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // addAll не должен валить установку целиком, если один из файлов недоступен
            // (например, иконки ещё нет на сервере) — поэтому кэшируем по одному.
            return Promise.all(
                APP_SHELL.map((url) => cache.add(url).catch(() => {}))
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
