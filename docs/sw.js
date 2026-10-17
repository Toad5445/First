// Offline support. Bump VERSION on every release so phones pick up the new files.
const VERSION = 'v3.7.4';
const SHELL = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'js/app.js', 'js/core.js', 'js/data.js', 'js/sync.js',
  'js/fx.js', 'js/charts.js', 'js/card.js', 'vendor/firebase.js', 'icons/icon-192-v2.png', 'icons/apple-touch-icon-v2.png', 'art/frost.svg', 'art/frost-wide.svg'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so an update never stores stale files
  e.waitUntil(caches.open('shell-' + VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('shell-') && k !== 'shell-' + VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'];

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Fonts (Google, Fontshare, self-hosted): cache after first load so themes look right offline
  if (FONT_HOSTS.includes(url.host) || (url.origin === location.origin && url.pathname.includes('/fonts/'))) {
    e.respondWith(caches.open('fonts').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;   // Firebase traffic goes straight to the network
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
