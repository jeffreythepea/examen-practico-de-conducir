import {
  activatePackage,
  confirmActivePackage,
  downloadPackage,
  matchActiveRequest,
  readOfflineState,
  SHELL_CACHE
} from './src/offline-cache.js';

let downloadController = null;

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

function reply(event, payload) {
  const message = { requestId: event.data?.requestId ?? null, ...payload };
  if (event.ports?.[0]) event.ports[0].postMessage(message);
  else event.source?.postMessage?.(message);
}

async function fetchPackageManifest() {
  const url = new URL('./offline-package.json', self.registration.scope);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Offline package manifest failed (${response.status})`);
  return { manifest: await response.json(), url: url.href };
}

async function handleMessage(event) {
  const { type, version } = event.data ?? {};
  if (type === 'SKIP_WAITING') {
    await self.skipWaiting();
    reply(event, { ok: true });
    return;
  }
  if (type === 'CANCEL_DOWNLOAD') {
    downloadController?.abort();
    reply(event, { ok: true, state: await readOfflineState(caches) });
    return;
  }
  if (type === 'GET_OFFLINE_STATE') {
    reply(event, { ok: true, state: await readOfflineState(caches) });
    return;
  }
  if (type === 'CHECK_FOR_UPDATE') {
    const [{ manifest }, state] = await Promise.all([fetchPackageManifest(), readOfflineState(caches)]);
    reply(event, {
      ok: true,
      state,
      availablePackage: {
        version: manifest.version,
        totalAssets: manifest.totalAssets,
        totalBytes: manifest.totalBytes,
        recordedCorpusComplete: manifest.recordedCorpusComplete
      },
      updateAvailable: manifest.version !== state.activeVersion
    });
    return;
  }
  if (type === 'DOWNLOAD_OFFLINE') {
    const before = await readOfflineState(caches);
    const { manifest, url } = await fetchPackageManifest();
    downloadController = new AbortController();
    let state = await downloadPackage({
      packageManifest: manifest,
      packageUrl: url,
      cacheStorage: caches,
      fetchImpl: fetch,
      signal: downloadController.signal,
      onProgress: progress => broadcast({ type: 'OFFLINE_PROGRESS', state: progress, version: manifest.version })
    });
    if (!before.activeVersion) state = await activatePackage({ cacheStorage: caches, version: manifest.version });
    downloadController = null;
    reply(event, { ok: true, state });
    return;
  }
  if (type === 'APPLY_UPDATE') {
    reply(event, { ok: true, state: await activatePackage({ cacheStorage: caches, version }) });
    return;
  }
  if (type === 'CONFIRM_ACTIVE') {
    reply(event, { ok: true, state: await confirmActivePackage({ cacheStorage: caches, version }) });
    return;
  }
  throw new Error(`Unsupported offline message: ${type}`);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.add('./offline.html')));
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cached = await matchActiveRequest({ cacheStorage: caches, request: event.request });
    if (cached) return cached;
    try {
      return await fetch(event.request);
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const recovery = await caches.match('./offline.html');
        if (recovery) return recovery;
      }
      throw error;
    }
  })());
});

self.addEventListener('message', event => {
  event.waitUntil(handleMessage(event).catch(error => {
    downloadController = null;
    reply(event, { ok: false, error: error?.message ?? String(error) });
  }));
});
