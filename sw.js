import {
  activatePackage,
  assertPackageManifest,
  confirmActivePackage,
  downloadPackage,
  matchActiveRequest,
  readOfflineState,
  SHELL_CACHE
} from './src/offline-cache.js';

let downloadController = null;
// State-mutating commands run one at a time. Two handlers interleaving their
// readState/writeState pairs on the one meta record lose whichever write
// landed first — a double-tapped Apply could hand the page a package the
// second command had already replaced.
let commandQueue = Promise.resolve();
let activeDownload = null;

function enqueue(run) {
  const result = commandQueue.then(run, run);
  commandQueue = result.then(() => {}, () => {});
  return result;
}

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
  const manifest = await response.json();
  // Both consumers share the download path's trust boundary: an update check
  // used to report a version and byte total from a manifest nothing had
  // validated, and offer to download it.
  assertPackageManifest(manifest);
  return { manifest, url: url.href };
}

async function runDownload(manifest, url) {
  // The controller slot belongs to this download until this download leaves
  // it: a later one overwriting the slot, or a shared catch clearing it,
  // stranded Cancel with nothing to abort.
  const controller = new AbortController();
  downloadController = controller;
  try {
    const before = await readOfflineState(caches);
    const state = await downloadPackage({
      packageManifest: manifest,
      packageUrl: url,
      cacheStorage: caches,
      fetchImpl: fetch,
      signal: controller.signal,
      onProgress: progress => broadcast({ type: 'OFFLINE_PROGRESS', state: progress, version: manifest.version })
    });
    if (before.activeVersion) return state;
    return activatePackage({ cacheStorage: caches, version: manifest.version });
  } finally {
    if (downloadController === controller) downloadController = null;
  }
}

async function handleMessage(event) {
  const { type, version } = event.data ?? {};
  if (type === 'SKIP_WAITING') {
    await self.skipWaiting();
    reply(event, { ok: true });
    return;
  }
  if (type === 'CANCEL_DOWNLOAD') {
    // Abort ahead of the queue — waiting our turn behind the very download we
    // are cancelling would never come — then let it finish writing its
    // cancelled state before reporting one.
    downloadController?.abort();
    await commandQueue;
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
    const { manifest, url } = await fetchPackageManifest();
    // A second tap on Download while the same package is already coming down
    // rides the first download's result instead of starting a rival one.
    if (activeDownload?.version === manifest.version) {
      reply(event, { ok: true, state: await activeDownload.promise });
      return;
    }
    const promise = enqueue(() => runDownload(manifest, url));
    activeDownload = { version: manifest.version, promise };
    try {
      reply(event, { ok: true, state: await promise });
    } finally {
      if (activeDownload?.promise === promise) activeDownload = null;
    }
    return;
  }
  if (type === 'APPLY_UPDATE') {
    reply(event, { ok: true, state: await enqueue(() => activatePackage({ cacheStorage: caches, version })) });
    return;
  }
  if (type === 'CONFIRM_ACTIVE') {
    reply(event, { ok: true, state: await enqueue(() => confirmActivePackage({ cacheStorage: caches, version })) });
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
    reply(event, { ok: false, error: error?.message ?? String(error) });
  }));
});
