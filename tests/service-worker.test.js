import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readOfflineState, runtimeCacheName } from '../src/offline-cache.js';

// sw.js registers its listeners against worker globals at import time, so the
// globals go up first and every test drives the one imported worker through
// the message handler it registered.
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

const SCOPE = 'https://example.test/app/';
const FILES = { 'index.html': '<main>app</main>', 'audio/test.mp3': 'audio' };

function manifestFor(version) {
  const assets = Object.entries(FILES).map(([path, contents]) => ({
    path,
    bytes: Buffer.byteLength(contents),
    sha256: createHash('sha256').update(contents).digest('hex')
  }));
  return {
    schemaVersion: 1,
    version,
    totalAssets: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    recordedCorpusComplete: true,
    assets
  };
}

const listeners = new Map();
let manifestVersion = 'v1';
let gateAssetFetch = null;
const assetFetches = [];

globalThis.self = {
  addEventListener: (type, listener) => listeners.set(type, listener),
  registration: { scope: SCOPE },
  clients: { matchAll: async () => [], claim: async () => {} },
  skipWaiting: async () => {}
};
// A fresh storage per test, not a fresh backing map: offline-cache memoizes
// its state per cacheStorage instance, so reusing the object would carry one
// test's meta record into the next.
globalThis.caches = new MemoryCacheStorage();
globalThis.fetch = async request => {
  const url = request instanceof URL ? request : new URL(typeof request === 'string' ? request : request.url);
  const path = url.pathname.replace('/app/', '');
  if (path === 'offline-package.json') {
    return new Response(JSON.stringify(manifestFor(manifestVersion)), { status: 200 });
  }
  assetFetches.push(path);
  if (gateAssetFetch) await gateAssetFetch;
  if (!(path in FILES)) return new Response('missing', { status: 404 });
  return new Response(FILES[path], { status: 200 });
};

await import('../sw.js');

function send(type, payload = {}) {
  let resolveReply;
  const reply = new Promise(resolve => { resolveReply = resolve; });
  listeners.get('message')({
    data: { type, requestId: `${type}-${Math.random()}`, ...payload },
    ports: [{ postMessage: message => resolveReply(message) }],
    waitUntil: () => {}
  });
  return reply;
}

function deferred() {
  let resolve;
  const promise = new Promise(settle => { resolve = settle; });
  return { promise, resolve };
}

test.beforeEach(() => {
  globalThis.caches = new MemoryCacheStorage();
  manifestVersion = 'v1';
  gateAssetFetch = null;
  assetFetches.length = 0;
});

test('a second download of the same package rides the first instead of racing it', async () => {
  // Two taps on Download used to run two downloads over one meta record and
  // one shared abort controller, so whichever wrote last won and Cancel was
  // left holding the wrong controller.
  const gate = deferred();
  gateAssetFetch = gate.promise;
  const first = send('DOWNLOAD_OFFLINE');
  await new Promise(resolve => setTimeout(resolve, 0));
  const second = send('DOWNLOAD_OFFLINE');
  gate.resolve();

  const [firstReply, secondReply] = await Promise.all([first, second]);
  assert.equal(firstReply.ok, true);
  assert.equal(secondReply.ok, true);
  assert.deepEqual(firstReply.state, secondReply.state);
  assert.deepEqual(assetFetches.sort(), ['audio/test.mp3', 'index.html']);
  assert.equal(firstReply.state.activeVersion, 'v1');
});

test('a cancelled download reports the cancellation it actually wrote', async () => {
  const gate = deferred();
  gateAssetFetch = gate.promise;
  const download = send('DOWNLOAD_OFFLINE');
  await new Promise(resolve => setTimeout(resolve, 0));
  const cancelled = send('CANCEL_DOWNLOAD');
  gate.resolve();

  const reply = await cancelled;
  await download;
  // Reading state before the aborted download finished writing reported a
  // download still in progress, moments before it stopped.
  assert.equal(reply.ok, true);
  assert.equal(reply.state.error, 'OFFLINE_DOWNLOAD_CANCELLED');
  assert.equal(reply.state.stagedComplete, false);
});

test('state-mutating commands run one at a time', async () => {
  const gate = deferred();
  gateAssetFetch = gate.promise;
  const download = send('DOWNLOAD_OFFLINE');
  await new Promise(resolve => setTimeout(resolve, 0));
  // Nothing is staged yet, so an apply that jumped the queue would fail; one
  // that waits its turn finds the download already active and says so.
  const apply = send('APPLY_UPDATE', { version: 'v1' });
  gate.resolve();

  const downloaded = await download;
  assert.equal(downloaded.state.activeVersion, 'v1');
  const applied = await apply;
  assert.equal(applied.ok, false);
  assert.match(applied.error, /not staged/);
});

test('an update download stages completely before it is offered for applying', async () => {
  const installed = await send('DOWNLOAD_OFFLINE');
  assert.equal(installed.state.activeVersion, 'v1');

  manifestVersion = 'v2';
  const gate = deferred();
  gateAssetFetch = gate.promise;
  const update = send('DOWNLOAD_OFFLINE');
  await new Promise(resolve => setTimeout(resolve, 0));
  // Mid-download the staged slot is claimed but the package is not there; an
  // Apply offered now activates a package that does not exist yet.
  const midflight = await readOfflineState(caches);
  assert.equal(midflight.stagedVersion, 'v2');
  assert.equal(midflight.stagedComplete, false);

  gate.resolve();
  const staged = await update;
  assert.equal(staged.state.stagedVersion, 'v2');
  assert.equal(staged.state.stagedComplete, true);
  assert.equal(staged.state.activeVersion, 'v1');

  const applied = await send('APPLY_UPDATE', { version: 'v2' });
  assert.equal(applied.state.activeVersion, 'v2');
  assert.equal(applied.state.stagedComplete, false);
  assert.equal(applied.state.stagedVersion, null);
  assert.ok((await caches.keys()).includes(runtimeCacheName('v2')));
});
