// AksaraSync AI - Service Worker v2 (with Web Push support)
const CACHE_NAME = 'aksarasync-v2';
const STATIC_ASSETS = ['/', '/index.html', '/logo-AksaraSyncAI.png', '/custom-notification.mp3'];

// ── Install: pre-cache static assets ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for HTML, cache-first for static ─────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached && !event.request.url.endsWith('.html')) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});

// ── Push: terima notifikasi dari server walau app tertutup ─────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'AksaraSync AI', body: 'Ada pembaruan baru.', url: '/' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/logo-AksaraSyncAI.png',
    badge: '/logo-AksaraSyncAI.png',
    tag: data.tag || 'aksarasync-notif',   // group notifikasi sejenis
    renotify: true,                         // selalu bunyi walau tag sama
    requireInteraction: false,
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Buka App' },
      { action: 'dismiss', title: 'Tutup' }
    ]
  };

  event.waitUntil(
    // Cek apakah ada tab aplikasi yang sedang terbuka dan aktif (focused)
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const anyClientVisible = windowClients.some(client => client.visibilityState === 'visible');
      
      // Jika tab/app tidak terbuka atau tidak aktif, baru tampilkan background push notification
      if (!anyClientVisible) {
        return self.registration.showNotification(data.title, options);
      }
      
      console.log('[SW] App is currently open and visible. Skipping background push notification to prevent duplicates.');
    })
  );
});

// ── Notification click: buka / fokus ke app ───────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Kalau app sudah terbuka, fokus ke sana
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalau app tertutup, buka tab baru
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
