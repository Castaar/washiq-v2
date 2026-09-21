const CACHE = 'dodane-v5';

const PRECACHE = [
  '/',
];

self.addEventListener('install', (event) => {
  // Precache each resource independently — one missing/failing asset must
  // never fail the whole install (cache.addAll is all-or-nothing and can
  // silently strand every client on the old cached version forever).
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Network-first for API/navigation, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls: network-only (never cache)
  if (url.pathname.startsWith('/api/')) return;

  // Navigation (HTML pages): network-first, fall back to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/') ?? fetch(request)),
    );
    return;
  }

  // Static assets (_next/static, images): cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      }),
    );
    return;
  }

  // Everything else: network-first
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// ─── Push notifications ───────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Dodane', body: event.data.text(), url: '/', icon: '/icons/icon-192.png' };
  }

  const { title, body, url, icon } = data;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon ?? '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url ?? '/' },
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      // postMessage every open window first (fire-and-forget) so the page's
      // own JS can force an in-app route change as a belt-and-braces fallback.
      for (const client of windowClients) {
        client.postMessage({ type: 'notification-navigate', url: targetUrl });
      }
      // clients.openWindow() is the primary path, not focus()+navigate() —
      // navigate() silently no-ops on several iOS/PWA versions (the tab just
      // stays on whatever page it already had open, which is exactly the
      // "app opens but wrong screen" symptom). openWindow() on a URL within
      // the PWA's scope reuses/focuses the existing standalone app window
      // and drives it to the target URL, which is far more reliable on iOS.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      if (windowClients[0] && 'focus' in windowClients[0]) {
        return windowClients[0].focus();
      }
    }),
  );
});

