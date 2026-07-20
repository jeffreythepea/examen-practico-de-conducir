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
