import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const origin = 'https://nophase.cc';
const workerSource = readFileSync(
  process.env.PWA_SW_SOURCE || new URL('../_javascript/pwa/sw.js', import.meta.url),
  'utf8'
);
const appSource = readFileSync(
  new URL('../_javascript/pwa/app.js', import.meta.url),
  'utf8'
).replace(/^import Toast[^\n]+\n/, '');

function worker(options = {}) {
  const listeners = new Map();
  const entries = new Map();
  const requests = [];
  const installed = [];
  const cacheName = 'chirpy-current';
  const key = (request) => typeof request === 'string' ? request : request.url;
  const cache = {
    match: async (request) => entries.get(key(request))?.clone(),
    put: async (request, response) => entries.set(key(request), response.clone()),
    addAll: async (resources) => installed.push(...resources)
  };
  const swconf = {
    cacheName,
    resources: ['/', '/assets/css/theme.css?v=current'],
    interceptor: {
      paths: ['/uncached/'],
      urlPrefixes: ['https://raw.githubusercontent.com/feed.json', 'https://dns.google/resolve']
    },
    purge: !!options.purge
  };
  vm.runInNewContext(workerSource, {
    swconf,
    importScripts() {},
    URL,
    Request: class extends Request {
      constructor(input, init) {
        super(new URL(input, origin), init);
      }
    },
    self: {
      location: { origin },
      addEventListener: (name, handler) => listeners.set(name, handler),
      skipWaiting() {}
    },
    caches: {
      open: async (name) => {
        assert.equal(name, cacheName);
        return cache;
      },
      match: cache.match
    },
    fetch: async (request, init) => {
      requests.push({ request, init });
      if (options.offline) throw new Error('offline');
      return new Response(options.body || 'new deployment', { status: options.status || 200 });
    }
  });

  return {
    requests,
    installed,
    seed: (path, body) => entries.set(new URL(path, origin).href, new Response(body)),
    cached: async (path) => (await cache.match(new URL(path, origin).href))?.text(),
    async dispatch(path, overrides = {}) {
      const pending = [];
      let response;
      listeners.get('fetch')({
        request: {
          url: new URL(path, origin).href,
          method: 'GET',
          mode: 'cors',
          headers: new Headers(),
          ...overrides
        },
        respondWith: (promise) => { response = promise; },
        waitUntil: (promise) => pending.push(promise)
      });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
    async install() {
      const pending = [];
      listeners.get('install')({ waitUntil: (promise) => pending.push(promise) });
      await Promise.all(pending);
    }
  };
}

for (const [path, overrides] of [
  ['/', { mode: 'navigate' }],
  ['/assets/js/nophase/tools-music.js', {}],
  ['/assets/css/theme.css?v=current', {}]
]) {
  test(`revalidates ${path} instead of serving stale cached code`, async () => {
    const runtime = worker();
    runtime.seed(path, 'old deployment');
    assert.equal(await (await runtime.dispatch(path, overrides)).text(), 'new deployment');
    assert.equal(runtime.requests[0].init.cache, 'no-cache');
    assert.equal(await runtime.cached(path), 'new deployment');
  });
}

test('keeps the last good tool script available offline', async () => {
  const runtime = worker({ offline: true });
  runtime.seed('/assets/js/nophase/tools-core.js', 'offline tool');
  const response = await runtime.dispatch('/assets/js/nophase/tools-core.js');
  assert.equal(await response.text(), 'offline tool');
  assert.equal(runtime.requests.length, 1);
});

test('does not overwrite good cached assets with server errors', async () => {
  const runtime = worker({ status: 503 });
  runtime.seed('/assets/js/nophase/tools-core.js', 'last good tool');
  const response = await runtime.dispatch('/assets/js/nophase/tools-core.js');
  assert.equal(await response.text(), 'last good tool');
  assert.equal(await runtime.cached('/assets/js/nophase/tools-core.js'), 'last good tool');
});

test('propagates offline failures when no fallback exists', async () => {
  const runtime = worker({ offline: true });
  await assert.rejects(runtime.dispatch('/assets/js/nophase/tools-core.js'), /offline/);
});

test('retains cache-first delivery for static images', async () => {
  const runtime = worker();
  runtime.seed('/assets/img/project.png', 'cached image');
  assert.equal(await (await runtime.dispatch('/assets/img/project.png')).text(), 'cached image');
  assert.equal(runtime.requests.length, 0);
});

test('never intercepts excluded feeds and DNS, even if previously cached', async () => {
  const runtime = worker();
  for (const path of [
    'https://raw.githubusercontent.com/feed.json',
    'https://dns.google/resolve?name=nophase.cc',
    '/uncached/example'
  ]) {
    runtime.seed(path, 'stale excluded response');
    assert.equal(await runtime.dispatch(path), undefined);
  }
  assert.equal(runtime.requests.length, 0);
});

test('does not intercept POST or partial-content requests', async () => {
  const runtime = worker();
  assert.equal(await runtime.dispatch('/', { method: 'POST' }), undefined);
  assert.equal(await runtime.dispatch('/', { headers: new Headers({ range: 'bytes=0-99' }) }), undefined);
  assert.equal(runtime.requests.length, 0);
});

test('does not serve cached content when caching is disabled', async () => {
  const runtime = worker({ purge: true });
  runtime.seed('/', 'stale page');
  assert.equal(await runtime.dispatch('/', { mode: 'navigate' }), undefined);
});

test('installation bypasses stale HTTP-cache entries', async () => {
  const runtime = worker();
  await runtime.install();
  assert.equal(runtime.installed.length, 2);
  assert.ok(runtime.installed.every((request) => request.cache === 'reload'));
});

async function app(register) {
  const calls = [];
  let unregistered = 0;
  const registration = { waiting: null, addEventListener() {} };
  vm.runInNewContext(appSource, {
    URL,
    document: {
      currentScript: { src: `${origin}/app.min.js?register=${register}&baseurl=` },
      getElementById: () => ({ querySelector: () => ({ addEventListener() {} }) })
    },
    navigator: {
      serviceWorker: {
        register: async (url, options) => {
          calls.push({ url, options });
          return registration;
        },
        addEventListener() {},
        getRegistrations: async () => [{ unregister: () => { unregistered++; } }]
      }
    },
    Toast: { getOrCreateInstance: () => ({ show() {}, hide() {} }) },
    window: { location: { reload() {} } }
  });
  await Promise.resolve();
  return { calls, unregistered };
}

test('checks imported worker configuration without the HTTP cache', async () => {
  const runtime = await app('true');
  assert.equal(runtime.calls.length, 1);
  assert.equal(runtime.calls[0].url, '/sw.min.js');
  assert.equal(runtime.calls[0].options.updateViaCache, 'none');
});

test('unregisters the worker when register=false', async () => {
  const runtime = await app('false');
  assert.equal(runtime.calls.length, 0);
  assert.equal(runtime.unregistered, 1);
});
