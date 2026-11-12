// Puzzle Me This: keeps a copy of the app on the device so it works offline.
// When online, the app page is fetched fresh (so updates show right away);
// if there is no connection within 3 seconds, the saved copy is used.
const CACHE = 'pmt-v2';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) { return new Promise(res => setTimeout(() => res(null), ms)); }

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  const key = isPage ? './index.html' : req;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const fresh = fetch(req, { cache: 'no-cache' })
      .then(res => { if (res.ok && !res.redirected) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    const cached = await cache.match(key, { ignoreSearch: true });
    if (isPage) {
      const res = await Promise.race([fresh, timeout(3000)]);
      if (res && res.ok) return res;
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response('Offline', { status: 503 });
    }
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || new Response('Offline', { status: 503 });
  }));
});
