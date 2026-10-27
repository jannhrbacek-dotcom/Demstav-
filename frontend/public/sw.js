/* DEMSTAV OPERATIONS service worker: keeps the app shell available offline.
   API calls are never cached here; offline data lives in the per-account IndexedDB queue. */
const CACHE = 'demstav-shell-v2';
const SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('sockjs') || url.pathname.endsWith('.hot-update.json')) return;
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (!sameOrigin && !isFont) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/index.html', copy)); return res; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  e.respondWith(fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});

// Push: zobrazí notifikaci i při zavřené aplikaci.
self.addEventListener("push", (event) => {
  let data = { title: "DEMSTAV OPERATIONS", body: "Máte novou událost.", url: "/", tag: "demstav" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch (_) { /* fallback */ }
  const opts = {
    body: data.body, tag: data.tag, renotify: true, badge: "/icon-192.png", icon: "/icon-192.png",
    data: { url: data.url || "/" }, requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(data.title || "DEMSTAV OPERATIONS", opts));
});

// Klepnutí na upozornění (např. blížící se servis) otevře aplikaci.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
  }));
});
