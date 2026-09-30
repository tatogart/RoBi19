// Robis offline cache (generated list of files is injected at build time).
const VERSION = '__VERSION__';
const BASE = '__BASE__';
const FILES = __FILES__;
const CACHE = 'robis-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => BASE + f))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('robis-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let path = url.pathname;
    // Pages are linked without ".html" (/game?id=2 -> game.html).
    const candidates = [path];
    if (path.endsWith('/')) candidates.push(path + 'index.html');
    else if (!/\.[a-z0-9]+$/i.test(path)) candidates.push(path + '.html');
    for (const c of candidates) {
      const hit = await cache.match(c);
      if (hit) return hit;
    }
    try {
      return await fetch(req);
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match(BASE + '/404.html')) || Response.error();
      throw err;
    }
  })());
});
