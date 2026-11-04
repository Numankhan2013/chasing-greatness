// Offline support: app shell precached; CDN libraries and fonts cached on first use.
const CACHE = 'cg-v7';
const SHELL = ['./', 'index.html', 'css/base.css', 'css/components.css', 'js/icons.js', 'js/standards.js', 'js/data.js', 'js/engine.js',
  'js/ui-core.js', 'js/views-main.js', 'js/views-ranks.js', 'js/views-log.js', 'js/views-data.js', 'js/views-profile.js', 'js/firebase-config.js', 'js/cloud.js', 'js/app.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (so updates land immediately), cache as fallback when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (/googleapis\.com$|firebaseapp\.com$/.test(url.hostname) || url.pathname.startsWith('/__/')) return; // auth + Firestore: always live
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
