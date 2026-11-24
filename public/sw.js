const cachePrefix = 'kk-offline-';
const cacheName = `${cachePrefix}v2`;
const offlinePage = '/offline.html';
const brandFont = '/fonts/chilanka-malayalam.woff2';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([offlinePage, brandFont].map(resource => new Request(resource, {
      cache: 'reload',
      credentials: 'omit',
      redirect: 'error',
    })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function navigate(request) {
  let response;
  try {
    response = await fetch(request, { cache: 'no-store' });
    if (response.status < 500) return response;
  } catch {
    // A failed connection can still show the locally stored page.
  }

  const cache = await caches.open(cacheName);
  return await cache.match(offlinePage) ?? response ?? Response.error();
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const { origin, pathname } = new URL(request.url);
  if (origin !== self.location.origin) return;
  if (request.destination === 'font' && pathname === brandFont) {
    event.respondWith(caches.match(brandFont, { cacheName }).then(cached => cached ?? fetch(request)));
    return;
  }
  if (request.mode !== 'navigate' || /^\/(api|_next)(\/|$)/.test(pathname)) return;
  event.respondWith(navigate(request));
});
