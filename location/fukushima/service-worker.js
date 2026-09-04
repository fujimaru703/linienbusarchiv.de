const CACHE_NAME = "fukushima-bus-pwa-v1";

const PRECACHE = [
  "./",
  "./manifest.webmanifest",
  "./icons/pwa-192.png",
  "./icons/pwa-512.png",
  "./splash.css",
  "./splash.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 外部Worker APIや地図タイルなどはリアルタイム性を優先し、
  // Service Workerのキャッシュ対象にしない。
  if (url.origin !== self.location.origin) {
    return;
  }

  // ページ本体は network-first。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () =>
          (await caches.match(request)) ||
          (await caches.match("./"))
        )
    );
    return;
  }

  // GitHub Pages上の静的ファイルのみ cache-first。
  const cacheable =
    ["script", "style", "image", "font"].includes(request.destination) ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?|json|csv)$/i.test(url.pathname);

  if (!cacheable) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (!response || !response.ok) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    })
  );
});


// =========================================================
// 将来のWeb Push通知用「準備工事」
// 現時点ではPush購読・VAPID鍵・通知サーバーは未実装。
// 後からCloudflare Worker + D1を追加するとき、この受信部を有効利用できる。
// =========================================================

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      title: "福島交通バスロケ",
      body: event.data ? event.data.text() : ""
    };
  }

  const title =
    data.title ||
    "福島交通バスロケ";

  const options = {
    body: data.body || "",
    icon: "./icons/pwa-192.png",
    badge: "./icons/pwa-192.png",
    data: {
      url: data.url || "./",
      ...(data.data || {})
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl =
    event.notification?.data?.url || "./";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(windowClients => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
