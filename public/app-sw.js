// Service worker for the online server version: makes Robis installable as
// an app and shows a friendly page when the server can't be reached.
// Everything else always comes fresh from the server.
const CACHE = 'robis-app-v1';
const OFFLINE = ['/offline.html', '/img/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('robis-app-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
});
