/* CIPES Delegate App — service worker.
   Strategy:
   - App shell + static assets: cache-first (so the app opens on poor wifi).
   - Static event JSON (/api/rundown, /api/visits, /api/speakers, /api/checkin,
     /api/contact): network-first with cache fallback (fresh when online,
     available offline).
   - Auth + per-user + dynamic endpoints (/api/me, /api/config, /api/favourites,
     /api/announcements, /api/feedback, Supabase): always network, never cached. */
const CACHE = 'cscd-v5';
const SHELL = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/vendor/supabase.js',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png',
];
const STATIC_API = ['/api/rundown', '/api/visits', '/api/speakers', '/api/checkin', '/api/contact'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Allow the page to trigger an immediate takeover of a waiting worker.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache cross-origin (Supabase, fonts handled by browser) — let it pass.
  if (url.origin !== location.origin) return;

  // Dynamic / auth endpoints: network only.
  if (
    url.pathname.startsWith('/api/me') ||
    url.pathname === '/api/config' ||
    url.pathname.startsWith('/api/favourites') ||
    url.pathname.startsWith('/api/announcements') ||
    url.pathname.startsWith('/api/feedback') ||
    url.pathname === '/health'
  ) {
    return; // default browser fetch
  }

  // Static event JSON: network-first, fall back to cache.
  if (STATIC_API.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell (HTML/CSS/JS): network-first so updates roll out immediately;
  // fall back to cache when offline.
  if (request.destination === 'document' || request.destination === 'script' || request.destination === 'style') {
    e.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Other static assets (images, fonts, vendor): cache-first.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
        return res;
      })
    )
  );
});
