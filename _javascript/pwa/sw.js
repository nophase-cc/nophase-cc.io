importScripts('./assets/js/data/swconf.js');

const purge = swconf.purge;
const interceptor = swconf.interceptor;

function verifyUrl(url) {
  const requestUrl = new URL(url);
  const requestPath = requestUrl.pathname;

  if (!requestUrl.protocol.startsWith('http')) {
    return false;
  }

  for (const prefix of interceptor.urlPrefixes) {
    if (requestUrl.href.startsWith(prefix)) {
      return false;
    }
  }

  for (const path of interceptor.paths) {
    if (requestPath.startsWith(path)) {
      return false;
    }
  }
  return true;
}

self.addEventListener('install', (event) => {
  if (purge) {
    return;
  }

  event.waitUntil(
    caches.open(swconf.cacheName).then((cache) => {
      return cache.addAll(
        swconf.resources.map((url) => new Request(url, { cache: 'reload' }))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (purge) {
            return caches.delete(key);
          } else {
            if (key !== swconf.cacheName) {
              return caches.delete(key);
            }
          }
        })
      );
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (
    purge ||
    event.request.method !== 'GET' ||
    event.request.headers.has('range') ||
    !verifyUrl(event.request.url)
  ) {
    return;
  }

  const url = new URL(event.request.url);
  const fresh =
    url.origin === self.location.origin &&
    (event.request.mode === 'navigate' || /\.(?:css|js)$/i.test(url.pathname));

  event.respondWith(respond(event, fresh));
});

async function respond(event, fresh) {
  const cache = await caches.open(swconf.cacheName);
  const cached = await cache.match(event.request);

  if (!fresh && cached) {
    return cached;
  }

  try {
    const response = await fetch(
      event.request,
      fresh ? { cache: 'no-cache' } : undefined
    );

    if (!response.ok && cached) {
      return cached;
    }

    if (response.ok || response.type === 'opaque') {
      event.waitUntil(
        cache.put(event.request, response.clone()).catch(() => {})
      );
    }

    return response;
  } catch (error) {
    if (cached) {
      return cached;
    }

    throw error;
  }
}
