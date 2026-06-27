/* CIPES Delegate App - service worker.
   Strategy:
   - App shell (HTML/CSS/JS/images): cache-first → instant load on repeat visits,
     background-revalidate so updates still roll out silently.
   - Static event JSON (/api/rundown etc.): stale-while-revalidate - show cached
     immediately, refresh in background.
   - Auth / per-user / dynamic: network-only, never cached. */

const CACHE = 'cipes-v5';
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
const NETWORK_ONLY = ['/api/me', '/api/config', '/api/favourites', '/api/announcements', '/api/feedback', '/health'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Cross-origin (Supabase, Google Fonts): let browser handle it.
  if (url.origin !== location.origin) return;

  // Network-only endpoints - never touch cache.
  if (NETWORK_ONLY.some((p) => url.pathname.startsWith(p))) return;

  // Static event JSON: stale-while-revalidate.
  // Returns cached copy instantly, then fetches fresh in the background.
  if (STATIC_API.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // App shell (HTML, CSS, JS, images): cache-first, revalidate in background.
  // On first visit: network. On repeat visits: instant from cache, update silently.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached); // offline fallback

        // Return cached immediately if available; otherwise wait for network.
        return cached || fetchPromise;
      })
    )
  );
});
