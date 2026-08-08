// Service worker for Web Push. Registered once on app boot (see lib/push.ts);
// this file only handles the two events push notifications need - it does not
// do offline caching or anything else.

self.addEventListener('install', () => {
  // Activate immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Cars Fetcher', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Cars Fetcher', {
      body: payload.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Reuse a tab that is already on the app instead of opening a new one.
      for (const client of clientList) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }

      await self.clients.openWindow(url);
    })(),
  );
});
