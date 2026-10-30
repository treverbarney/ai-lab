const CACHE = "dino-phone-v7";
const SHELL = [
  "./",
  "./app.js",
  "./styles.css",
  "./catalog.js",
  "./manifest.webmanifest",
  "./icons/dino-180.png",
  "./icons/dino-192.png",
  "./icons/dino-512.png",
].map((file) => new URL(file, self.registration.scope).href);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("dino-phone-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  // Session responses, job output, pairing and artifact downloads are never cached.
  if (!SHELL.includes(event.request.url)) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Dino Lab", {
      body: data.body,
      icon: "/phone/icons/dino-192.png",
      data: { url: "/phone/" },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/phone/"));
});
