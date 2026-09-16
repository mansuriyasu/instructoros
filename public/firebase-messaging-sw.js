/* global firebase */
const CACHE = 'instructoros-shell-v2';
const OFFLINE_ASSETS = ['/offline.html', '/offline.css?v=2', '/offline-app.js?v=2', '/offline-store.js?v=2', '/icons/icon-192.png'];
const OWNER_CACHE = 'instructoros-push-owner';
const OWNER_URL = '/__push_owner__';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(OFFLINE_ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('instructoros-shell-') && k !== CACHE).map(k => caches.delete(k))))])));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (OFFLINE_ASSETS.includes(url.pathname + url.search)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
    return;
  }
  if (event.request.mode === 'navigate' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
    event.respondWith((async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const response = await fetch(event.request, { signal: controller.signal });
        if (response.status >= 500) throw new Error('Server unavailable');
        return response;
      } catch {
        return (await caches.open(CACHE)).match('/offline.html');
      } finally { clearTimeout(timeout); }
    })());
  }
});
self.addEventListener('message', event => {
  if (event.data?.type === 'PUSH_OWNER') event.waitUntil(caches.open(OWNER_CACHE).then(async cache => {
    await cache.put(OWNER_URL, new Response(event.data.uid || ''));
    if (!event.data.uid) for (const notification of await self.registration.getNotifications()) notification.close();
    event.ports[0]?.postMessage('saved');
  }));
});
// Register before Firebase to retain control of notification-click navigation.
self.addEventListener('notificationclick', event => {
  event.stopImmediatePropagation();
  event.notification.close();
  const id = event.notification.data?.notificationId;
  const url = new URL(/^[a-f0-9]{64}$/.test(id || '') ? `/app/notifications/open?id=${id}` : '/app', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const app = clients.find(client => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname.startsWith('/app'));
    if (app) { await app.navigate(url); await app.focus(); } else await self.clients.openWindow(url);
  }));
});
const config = new URL(self.location.href).searchParams.get('config');
if (config) {
  try {
  importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');
  firebase.initializeApp(JSON.parse(config));
  firebase.messaging().onBackgroundMessage(async payload => {
    const data = payload.data || {};
    const owner = await caches.match(OWNER_URL);
    if (!owner || await owner.text() !== data.recipientUid) return;
    await self.registration.showNotification(data.title || 'InstructorOS', { body: data.body || 'You have a new notification.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: data.notificationId, data: { notificationId: data.notificationId } });
  });
  } catch { /* The offline workspace must remain available if push libraries cannot load. */ }
}
