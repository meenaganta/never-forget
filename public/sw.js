const CACHE_NAME =
  "never-forget-v1";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
];

/* =========================
   INSTALL
========================= */

self.addEventListener(
  "install",
  (event) => {
    console.log(
      "Never Forget Service Worker installed"
    );

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then((cache) =>
          cache.addAll(APP_SHELL)
        )
    );

    self.skipWaiting();
  }
);

/* =========================
   ACTIVATE
========================= */

self.addEventListener(
  "activate",
  (event) => {
    console.log(
      "Never Forget Service Worker activated"
    );

    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter(
                (cacheName) =>
                  cacheName !==
                  CACHE_NAME
              )
              .map((cacheName) =>
                caches.delete(
                  cacheName
                )
              )
          )
        )
    );

    event.waitUntil(
      self.clients.claim()
    );
  }
);

/* =========================
   FETCH
========================= */

self.addEventListener(
  "fetch",
  (event) => {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const url =
      new URL(request.url);

    /*
      API requests should always
      go to the backend.
    */

    if (
      url.pathname.startsWith(
        "/api/"
      )
    ) {
      return;
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type ===
              "basic"
          ) {
            const responseClone =
              response.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) => {
                cache.put(
                  request,
                  responseClone
                );
              });
          }

          return response;
        })
        .catch(() =>
          caches.match(request)
        )
    );
  }
);

/* =========================
   PUSH NOTIFICATION
========================= */

self.addEventListener(
  "push",
  (event) => {
    if (!event.data) {
      return;
    }

    const data =
      event.data.json();

    const title =
      data.title ||
      "Never Forget 🔔";

    const options = {
      body:
        data.body ||
        "You have an important reminder.",

      icon: "/icon-192.svg",

      badge: "/icon-192.svg",

      data: {
        url:
          data.url || "/",

        reminderId:
          data.reminderId ||
          null,
      },

      requireInteraction: true,
    };

    event.waitUntil(
      self.registration.showNotification(
        title,
        options
      )
    );
  }
);

/* =========================
   NOTIFICATION CLICK
========================= */

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const reminderId =
      event.notification.data
        ?.reminderId;

    const url = reminderId
      ? `/?reminder=${reminderId}`
      : "/";

    event.waitUntil(
      clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (
            const client of clientList
          ) {
            if (
              "focus" in client
            ) {
              return client
                .navigate(url)
                .then(() =>
                  client.focus()
                );
            }
          }

          if (
            clients.openWindow
          ) {
            return clients.openWindow(
              url
            );
          }
        })
    );
  }
);