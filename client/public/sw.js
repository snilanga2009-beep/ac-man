// AC-Pro Development Safe Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(names.map((name) => caches.delete(name)));
    }).then(() => self.registration.unregister())
  );
});

self.addEventListener('fetch', () => {
  // Pass all requests to network directly
  return;
});
