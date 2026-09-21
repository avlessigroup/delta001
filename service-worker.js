const CACHE_NAME = "baca-app-v1";

const APP_SHELL = [
    "/",
    "/index.html",
    "/inventaire.html",
    "/inventaire-form.html",
    "/manifest.webmanifest",
    "/assets/icons/icon-192.png",
    "/assets/icons/icon-512.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(APP_SHELL);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function (cacheName) {
                            return cacheName !== CACHE_NAME;
                        })
                        .map(function (cacheName) {
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

self.addEventListener("fetch", function (event) {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (
        url.origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        caches.match(request)
            .then(function (cachedResponse) {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request)
                    .then(function (networkResponse) {
                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type !== "basic"
                        ) {
                            return networkResponse;
                        }

                        const responseClone =
                            networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(function (cache) {
                                cache.put(
                                    request,
                                    responseClone
                                );
                            });

                        return networkResponse;
                    });
            })
            .catch(function () {
                if (request.mode === "navigate") {
                    return caches.match("/index.html");
                }

                return new Response(
                    "Ressource indisponible hors connexion.",
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8"
                        }
                    }
                );
            })
    );
});