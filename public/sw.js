const CACHE_NAME = "mom-meeting-hub-v1";

const APP_SHELL = [
  "/",
  "/login",
  "/manifest.webmanifest",
  "/mom-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (cacheName) =>
              cacheName !== CACHE_NAME
          )
          .map((cacheName) =>
            caches.delete(cacheName)
          )
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(
    event.request.url
  );

  if (
    requestUrl.origin !==
    self.location.origin
  ) {
    return;
  }

  if (
    requestUrl.pathname.startsWith(
      "/_next/webpack-hmr"
    )
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return (
          caches.match("/") ||
          Response.error()
        );
      })
    );

    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((cachedResponse) => {
        const networkResponse = fetch(
          event.request
        )
          .then((response) => {
            if (response.ok) {
              const responseCopy =
                response.clone();

              caches
                .open(CACHE_NAME)
                .then((cache) => {
                  cache.put(
                    event.request,
                    responseCopy
                  );
                });
            }

            return response;
          })
          .catch(() => {
            return (
              cachedResponse ||
              Response.error()
            );
          });

        return (
          cachedResponse ||
          networkResponse
        );
      })
  );
});