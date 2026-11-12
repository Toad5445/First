// Ledger's offline support, separate from The System's (this one only covers /ledger/).
// Bump VERSION on every release so phones pick up the new files.
const VERSION = 'l1.2.2';
const SHELL = ['./', 'index.html', 'ledger.css', 'ledger.js', 'themes.js', 'lsync.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/apple-touch-icon.png', 'art/chain.webp', '../vendor/firebase.js'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open('ledger-shell-' + VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ledger-shell-') && k !== 'ledger-shell-' + VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (FONT_HOSTS.includes(url.host)) {
    e.respondWith(caches.open('ledger-fonts').then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;   // Firebase goes straight to the network
  e.respondWith(caches.open('ledger-shell-' + VERSION).then(c => c.match(e.request, { ignoreSearch: true })).then(hit => hit || fetch(e.request)));
});
