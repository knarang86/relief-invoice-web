const CACHE = "relief-invoice-v9";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./storage.js",
  "./app.js",
  "./invoice.js",
  "./pdf.js",
  "./manifest.json",
  "./vendor/jspdf.umd.min.js",
  "./icons/icon.svg",
  "./icons/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        FILES.map(function (url) {
          return cache.add(url).catch(function () {
            return null;
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return (
        cached ||
        fetch(event.request).then(function (response) {
          return response;
        })
      );
    })
  );
});
