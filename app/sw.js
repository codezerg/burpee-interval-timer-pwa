// Service worker: makes the app work offline and keeps it up to date.
//
// App files: network first (revalidated, so a new deploy shows up right away),
// falling back to the saved copy when offline. Google Fonts: saved copy first,
// refreshed in the background. Bump SHELL_CACHE only when the file list changes.

const SHELL_CACHE = 'burpee-shell-v5';
const FONT_CACHE = 'burpee-fonts-v1';
const NETWORK_TIMEOUT_MS = 4000;

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/router.js',
  'js/run.js',
  'js/components.js',
  'js/engine.js',
  'js/audio.js',
  'js/store.js',
  'js/types.js',
  'js/format.js',
  'js/backup.js',
  'js/stats.js',
  'js/plan.js',
  'js/motivation.js',
  'js/levels.js',
  'js/review.js',
  'js/screens/home.js',
  'js/screens/workout.js',
  'js/screens/run.js',
  'js/screens/history.js',
  'js/screens/settings.js',
  'js/screens/summary.js',
  'js/screens/rest.js',
  'js/screens/levels.js',
  'js/screens/recap.js',
  'vendor/van-1.6.1.js',
  'vendor/van-x-0.6.3.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== SHELL_CACHE && k !== FONT_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE));
    return;
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (url.pathname.endsWith('/version.json')) return; // always straight from the network

  event.respondWith(networkFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  // Navigation requests can't be re-created with options, so fetch by URL.
  const fresh = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' })
    .then((res) => {
      if (res.ok) cache.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
      return res;
    });
  fresh.catch(() => {}); // a late failure after the timeout is fine
  const fallback = async () => {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('index.html');
    return undefined;
  };
  try {
    const res = await Promise.race([
      fresh,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
    ]);
    return res;
  } catch {
    return (await fallback()) || fresh;
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(event.request);
  const update = fetch(event.request)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  return update;
}
