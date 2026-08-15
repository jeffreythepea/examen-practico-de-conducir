import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  activatePackage,
  cleanupObsoletePackages,
  confirmActivePackage,
  downloadPackage,
  matchActiveRequest,
  META_CACHE,
  META_REQUEST,
  PACKAGE_MANIFEST_REQUEST,
  readOfflineState,
  runtimeCacheName
} from '../src/offline-cache.js';

class MemoryCache {
  constructor() { this.entries = new Map(); }
  key(request) { return typeof request === 'string' ? request : request.url; }
  async match(request) { return this.entries.get(this.key(request))?.clone(); }
  async put(request, response) { this.entries.set(this.key(request), response.clone()); }
  async delete(request) { return this.entries.delete(this.key(request)); }
}

class MemoryCacheStorage {
  constructor() { this.caches = new Map(); }
  async open(name) {
    if (!this.caches.has(name)) this.caches.set(name, new MemoryCache());
    return this.caches.get(name);
  }
  async delete(name) { return this.caches.delete(name); }
  async keys() { return [...this.caches.keys()]; }
}

function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

function packageManifest(version = 'v1', files = { 'index.html': '<main>app</main>', 'audio/test.mp3': 'audio' }) {
  const assets = Object.entries(files).map(([path, contents]) => ({
    path,
    bytes: Buffer.byteLength(contents),
    sha256: digest(contents)
  }));
  return {
    manifest: {
      schemaVersion: 1,
      version,
      totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
      recordedCorpusComplete: true,
      assets
    },
    files
  };
}

function fetchFiles(files, calls = []) {
  return async request => {
    const url = new URL(typeof request === 'string' ? request : request.url);
    const path = url.pathname.replace(/^\/app\//, '');
    calls.push(path);
    if (!(path in files)) return new Response('missing', { status: 404 });
    return new Response(files[path], { status: 200, headers: { 'content-type': 'application/octet-stream' } });
  };
}

test('download verifies assets, reports exact progress, and stages without activating', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest();
  const progress = [];
  const state = await downloadPackage({
    packageManifest: manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(files),
    onProgress: snapshot => progress.push(snapshot)
  });

  assert.equal(state.stagedVersion, 'v1');
  assert.equal(state.activeVersion, null);
  assert.equal(state.completedAssets, 2);
  assert.equal(state.completedBytes, manifest.totalBytes);
  assert.equal(progress.at(-1).completedBytes, manifest.totalBytes);
  assert.ok(progress.every((item, index) => index === 0 || item.completedBytes >= progress[index - 1].completedBytes));
  const cache = await cacheStorage.open(runtimeCacheName('v1'));
  assert.ok(await cache.match(PACKAGE_MANIFEST_REQUEST));
});

test('resumed download verifies cached entries and fetches only missing assets', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest();
  const calls = [];
  const cache = await cacheStorage.open(runtimeCacheName('v1'));
  await cache.put('https://example.test/app/index.html', new Response(files['index.html']));

  await downloadPackage({
    packageManifest: manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(files, calls)
  });

  assert.deepEqual(calls, ['audio/test.mp3']);
});

test('corrupt response removes staging while preserving the active package pointer', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const prior = packageManifest('old', { 'index.html': '<main>old</main>' });
  await downloadPackage({
    packageManifest: prior.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(prior.files)
  });
  await activatePackage({ cacheStorage, version: 'old' });
  await confirmActivePackage({ cacheStorage, version: 'old' });
  const { manifest } = packageManifest('bad', { 'index.html': 'expected' });

  await assert.rejects(downloadPackage({
    packageManifest: manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: async () => new Response('corrupt')
  }), /integrity/i);

  const state = await readOfflineState(cacheStorage);
  assert.equal(state.activeVersion, 'old');
  assert.equal(state.stagedVersion, null);
  assert.equal((await cacheStorage.keys()).includes(runtimeCacheName('old')), true);
  assert.equal((await cacheStorage.keys()).includes(runtimeCacheName('bad')), false);
});

test('activation isolates active fetches and retains prior version until confirmation', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const first = packageManifest('v1');
  await downloadPackage({
    packageManifest: first.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(first.files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  await confirmActivePackage({ cacheStorage, version: 'v1' });

  const second = packageManifest('v2', { 'index.html': '<main>new</main>' });
  await downloadPackage({
    packageManifest: second.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(second.files)
  });
  const activated = await activatePackage({ cacheStorage, version: 'v2' });
  assert.equal(activated.activeVersion, 'v2');
  assert.equal(activated.previousVersion, 'v1');
  assert.equal((await cacheStorage.keys()).includes(runtimeCacheName('v1')), true);

  const response = await matchActiveRequest({
    cacheStorage,
    request: new Request('https://example.test/app/', { headers: { accept: 'text/html' } })
  });
  assert.equal(await response.text(), '<main>new</main>');

  const confirmed = await confirmActivePackage({ cacheStorage, version: 'v2' });
  assert.equal(confirmed.previousVersion, null);
  assert.equal((await cacheStorage.keys()).includes(runtimeCacheName('v1')), false);
});

test('a download in flight cannot resurrect the activation state that changed underneath it', async () => {
  // downloadPackage used to spread the state it read at entry into every
  // later write, so a confirmation landing mid-download was undone: the card
  // went back to "unconfirmed" and the meta record pointed at a predecessor
  // package whose cache the confirmation had just deleted.
  const cacheStorage = new MemoryCacheStorage();
  const first = packageManifest('v1');
  await downloadPackage({
    packageManifest: first.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(first.files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });

  const next = packageManifest('v2', { 'index.html': '<main>new</main>', 'audio/next.mp3': 'audio' });
  let confirmed = null;
  const state = await downloadPackage({
    packageManifest: next.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: async request => {
      // The boot confirmation runs on its own, between two of this
      // download's writes.
      confirmed ??= await confirmActivePackage({ cacheStorage, version: 'v1' });
      return fetchFiles(next.files)(request);
    }
  });

  assert.equal(confirmed.activeConfirmed, true);
  assert.equal(state.activeVersion, 'v1');
  assert.equal(state.activeConfirmed, true);
  assert.equal(state.previousVersion, null);
  assert.equal(state.stagedVersion, 'v2');
  assert.equal(state.stagedComplete, true);
  assert.equal((await readOfflineState(cacheStorage)).activeConfirmed, true);
});

test('cached hits honour byte ranges so iPadOS Safari plays offline video', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest('v1', { 'assets/clip.mp4': '0123456789' });
  await downloadPackage({
    packageManifest: manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  const url = 'https://example.test/app/assets/clip.mp4';

  const sliced = await matchActiveRequest({
    cacheStorage,
    request: new Request(url, { headers: { range: 'bytes=2-5' } })
  });
  assert.equal(sliced.status, 206);
  assert.equal(sliced.headers.get('content-range'), 'bytes 2-5/10');
  assert.equal(sliced.headers.get('content-length'), '4');
  assert.equal(await sliced.text(), '2345');

  const openEnded = await matchActiveRequest({
    cacheStorage,
    request: new Request(url, { headers: { range: 'bytes=8-' } })
  });
  assert.equal(openEnded.status, 206);
  assert.equal(await openEnded.text(), '89');

  const unsatisfiable = await matchActiveRequest({
    cacheStorage,
    request: new Request(url, { headers: { range: 'bytes=10-' } })
  });
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */10');

  const whole = await matchActiveRequest({ cacheStorage, request: new Request(url) });
  assert.equal(whole.status, 200);
  assert.equal(await whole.text(), '0123456789');
});

test('missing active entries invalidate readiness without deleting ordinary caches', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest();
  await downloadPackage({
    packageManifest: manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  const cache = await cacheStorage.open(runtimeCacheName('v1'));
  await cache.delete('https://example.test/app/audio/test.mp3');

  const state = await readOfflineState(cacheStorage);
  assert.equal(state.activeVersion, null);
  assert.equal(state.error, 'OFFLINE_FILES_MISSING');
});

test('meta state is memoized per cacheStorage: repeated queries do not re-read the meta cache', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest();
  await downloadPackage({
    packageManifest: manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });

  const metaCache = await cacheStorage.open(META_CACHE);
  let matchCalls = 0;
  const originalMatch = metaCache.match.bind(metaCache);
  metaCache.match = async request => {
    matchCalls += 1;
    return originalMatch(request);
  };

  await readOfflineState(cacheStorage);
  await matchActiveRequest({
    cacheStorage,
    request: new Request('https://example.test/app/index.html')
  });
  await matchActiveRequest({
    cacheStorage,
    request: new Request('https://example.test/app/index.html')
  });

  assert.equal(matchCalls, 0, 'meta cache must not be re-read once memoized for this cacheStorage');
});

test('readOfflineState sweeps asset presence once per cacheStorage lifetime, then trusts the memo', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest();
  await downloadPackage({
    packageManifest: manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });

  const first = await readOfflineState(cacheStorage);
  assert.equal(first.activeVersion, 'v1');

  // Remove an asset *after* the first (real) sweep. A second sweep would
  // catch this; trusting the memo means it stays silently reported as ready.
  const cache = await cacheStorage.open(runtimeCacheName('v1'));
  await cache.delete('https://example.test/app/audio/test.mp3');

  const second = await readOfflineState(cacheStorage);
  assert.equal(second.activeVersion, 'v1', 'second call within the same lifetime must trust the memoized state');

  // A fresh cacheStorage is a new "lifetime" — no memo carries over, so its
  // own first sweep must still run and catch a real problem (fail-closed).
  const freshCacheStorage = new MemoryCacheStorage();
  const second2 = packageManifest();
  await downloadPackage({
    packageManifest: second2.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage: freshCacheStorage, fetchImpl: fetchFiles(second2.files)
  });
  await activatePackage({ cacheStorage: freshCacheStorage, version: 'v1' });
  const freshCache = await freshCacheStorage.open(runtimeCacheName('v1'));
  await freshCache.delete('https://example.test/app/audio/test.mp3');
  const freshState = await readOfflineState(freshCacheStorage);
  assert.equal(freshState.activeVersion, null);
  assert.equal(freshState.error, 'OFFLINE_FILES_MISSING');
});

test('activating a new version forces one fresh sweep on the next readOfflineState call', async () => {
  const cacheStorage = new MemoryCacheStorage();
  const first = packageManifest('v1');
  await downloadPackage({
    packageManifest: first.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(first.files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  await readOfflineState(cacheStorage); // consumes the v1 sweep, memo now trusted
  await confirmActivePackage({ cacheStorage, version: 'v1' });

  const second = packageManifest('v2', { 'index.html': '<main>new</main>' });
  await downloadPackage({
    packageManifest: second.manifest, packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage, fetchImpl: fetchFiles(second.files)
  });
  await activatePackage({ cacheStorage, version: 'v2' });

  // Corrupt v2 before its own sweep has had a chance to run. v2's manifest
  // only contains index.html (see `second` above), so that's the asset to
  // remove — not audio/test.mp3, which isn't part of this version at all.
  const v2Cache = await cacheStorage.open(runtimeCacheName('v2'));
  await v2Cache.delete('https://example.test/app/index.html');

  const state = await readOfflineState(cacheStorage);
  assert.equal(state.activeVersion, null, 'activation must force a fresh sweep, not trust the pre-activation memo');
  assert.equal(state.error, 'OFFLINE_FILES_MISSING');
});

test('cleanup protects metadata plus active, staged, previous, and explicit versions', async () => {
  const cacheStorage = new MemoryCacheStorage();
  for (const name of [META_CACHE, runtimeCacheName('active'), runtimeCacheName('staged'), runtimeCacheName('prior'), runtimeCacheName('keep'), runtimeCacheName('remove')]) {
    await cacheStorage.open(name);
  }
  const meta = await cacheStorage.open(META_CACHE);
  await meta.put(META_REQUEST, new Response(JSON.stringify({
    protocolVersion: 1, activeVersion: 'active', previousVersion: 'prior', activeConfirmed: false,
    stagedVersion: 'staged', recordedCorpusComplete: true, completedAssets: 1, totalAssets: 1,
    completedBytes: 1, totalBytes: 1, error: null
  })));

  await cleanupObsoletePackages({ cacheStorage, keepVersions: ['keep'] });
  const keys = await cacheStorage.keys();
  assert.equal(keys.includes(runtimeCacheName('remove')), false);
  for (const version of ['active', 'staged', 'prior', 'keep']) {
    assert.equal(keys.includes(runtimeCacheName(version)), true);
  }
});

test('service worker uses active-cache fetch isolation and explicit lifecycle messages', async () => {
  const worker = await readFile(resolve(new URL('..', import.meta.url).pathname, 'sw.js'), 'utf8');
  assert.match(worker, /matchActiveRequest/);
  assert.match(worker, /offline\.html/);
  for (const type of [
    'GET_OFFLINE_STATE', 'DOWNLOAD_OFFLINE', 'CHECK_FOR_UPDATE', 'APPLY_UPDATE',
    'CONFIRM_ACTIVE', 'CANCEL_DOWNLOAD', 'SKIP_WAITING'
  ]) {
    assert.match(worker, new RegExp(type));
  }
  const installHandler = worker.match(/addEventListener\('install',[\s\S]*?\n\}\);/)?.[0] ?? '';
  assert.match(installHandler, /offline\.html/);
  assert.doesNotMatch(installHandler, /skipWaiting/);
});

test('service worker update checks expose exact package size and corpus completeness before download', async () => {
  const worker = await readFile(resolve(new URL('..', import.meta.url).pathname, 'sw.js'), 'utf8');
  assert.match(worker, /availablePackage:\s*\{/);
  assert.match(worker, /totalAssets:\s*manifest\.totalAssets/);
  assert.match(worker, /totalBytes:\s*manifest\.totalBytes/);
  assert.match(worker, /recordedCorpusComplete:\s*manifest\.recordedCorpusComplete/);
});

test('an update copies unchanged assets from the installed package instead of refetching', async () => {
  // Recorded audio and video are 98% of the package and almost never change,
  // yet every update opened a fresh per-version cache and pulled all of it
  // down again. A code-only update should cost only the code.
  const cacheStorage = new MemoryCacheStorage();
  const first = packageManifest('v1', {
    'index.html': '<main>app</main>',
    'audio/one.mp3': 'recording one',
    'audio/two.mp3': 'recording two'
  });
  await downloadPackage({
    packageManifest: first.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(first.files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  await confirmActivePackage({ cacheStorage, version: 'v1' });

  // Only the markup changed; both recordings are byte-identical.
  const second = packageManifest('v2', {
    'index.html': '<main>app v2</main>',
    'audio/one.mp3': 'recording one',
    'audio/two.mp3': 'recording two'
  });
  const calls = [];
  const state = await downloadPackage({
    packageManifest: second.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(second.files, calls)
  });

  assert.deepEqual(calls, ['index.html'], 'unchanged recordings must not be refetched');
  assert.equal(state.stagedVersion, 'v2');
  assert.equal(state.stagedComplete, true);
  assert.equal(state.completedAssets, 3);
  assert.equal(state.completedBytes, second.manifest.totalBytes);

  // The copies are real, verifiable entries in the new package's own cache,
  // not references into the old one — activation checks every asset.
  const activated = await activatePackage({ cacheStorage, version: 'v2' });
  assert.equal(activated.activeVersion, 'v2');
  const cache = await cacheStorage.open(runtimeCacheName('v2'));
  assert.equal(await (await cache.match('https://example.test/app/audio/one.mp3')).text(), 'recording one');
  assert.equal(await (await cache.match('https://example.test/app/index.html')).text(), '<main>app v2</main>');
});

test('a damaged copy in the installed package is refetched, not installed', async () => {
  // The digest is the contract whichever side of the network the bytes came
  // from: a corrupt donor entry must fall through to the network rather than
  // failing the update or installing bad bytes.
  const cacheStorage = new MemoryCacheStorage();
  const first = packageManifest('v1', { 'index.html': '<main>app</main>', 'audio/one.mp3': 'recording one' });
  await downloadPackage({
    packageManifest: first.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(first.files)
  });
  await activatePackage({ cacheStorage, version: 'v1' });
  await confirmActivePackage({ cacheStorage, version: 'v1' });
  const installed = await cacheStorage.open(runtimeCacheName('v1'));
  await installed.put('https://example.test/app/audio/one.mp3', new Response('corrupted on disk'));

  const second = packageManifest('v2', { 'index.html': '<main>v2</main>', 'audio/one.mp3': 'recording one' });
  const calls = [];
  const state = await downloadPackage({
    packageManifest: second.manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(second.files, calls)
  });

  assert.deepEqual(calls.sort(), ['audio/one.mp3', 'index.html']);
  assert.equal(state.stagedComplete, true);
  const cache = await cacheStorage.open(runtimeCacheName('v2'));
  assert.equal(await (await cache.match('https://example.test/app/audio/one.mp3')).text(), 'recording one');
});

test('copying never opens a cache for a version that is not installed', async () => {
  // Opening a missing cache creates it; a first install has no donor and must
  // not leave an empty runtime cache behind.
  const cacheStorage = new MemoryCacheStorage();
  const { manifest, files } = packageManifest('v1');
  await downloadPackage({
    packageManifest: manifest,
    packageUrl: 'https://example.test/app/offline-package.json',
    cacheStorage,
    fetchImpl: fetchFiles(files)
  });
  assert.deepEqual(
    (await cacheStorage.keys()).filter(name => name.startsWith('examen-practico-runtime-')),
    [runtimeCacheName('v1')]
  );
});
