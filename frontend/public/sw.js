// SmartGully Lightweight Service Worker for PWA Installation
const CACHE_NAME = "smartgully-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/report",
  "/map",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass API and upload requests directly to network
  if (event.request.url.includes("/api/") || event.request.url.includes("/uploads/")) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
