import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfflineClient } from '../src/offline-client.js';

function respondingWorker(onMessage = () => ({})) {
  return {
    postMessage(message, ports) {
      const result = onMessage(message);
      queueMicrotask(() => ports?.[0]?.postMessage({ requestId: message.requestId, ok: true, ...result }));
    }
  };
}

function browserFixture({ worker = respondingWorker(), standalone = false } = {}) {
  const listeners = new Map();
  const calls = [];
  const registration = { active: worker, waiting: null, installing: null, update: async () => {} };
  const serviceWorker = {
    controller: worker,
    async register(path, options) { calls.push([path, options]); return registration; },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const navigatorRef = {
    serviceWorker,
    standalone,
    storage: {
      estimate: async () => ({ usage: 20, quota: 100 }),
      persisted: async () => false,
      persist: async () => true
    }
  };
  const windowRef = {
    isSecureContext: true,
    location: { hostname: 'example.test', reload() {} },
    matchMedia: () => ({ matches: standalone })
  };
  return { navigatorRef, windowRef, registration, serviceWorker, listeners, calls };
}

test('unsupported service workers retain an immutable online-only state', async () => {
  const client = createOfflineClient({
    navigatorRef: {},
    windowRef: { isSecureContext: true, location: { hostname: 'example.test' }, matchMedia: () => ({ matches: false }) }
  });
  assert.equal(client.supported, false);
  const state = await client.register();
  assert.equal(state.status, 'unsupported');
  assert.equal(Object.isFrozen(state), true);
});

test('registration uses the project-relative module worker and requests state', async () => {
  const types = [];
  const fixture = browserFixture({ worker: respondingWorker(message => {
    types.push(message.type);
    return message.type === 'CHECK_FOR_UPDATE'
      ? {
          state: { activeVersion: null, stagedVersion: null },
          availablePackage: { version: 'v1', totalAssets: 367, totalBytes: 15_518_698, recordedCorpusComplete: true }
        }
      : { state: { activeVersion: null, stagedVersion: null } };
  }) });
  const client = createOfflineClient(fixture);
  await client.register();
  assert.deepEqual(fixture.calls, [['./sw.js', { scope: './', type: 'module', updateViaCache: 'none' }]]);
  assert.equal(client.getState().activeVersion, null);
  assert.equal(client.getState().availableVersion, 'v1');
  assert.equal(client.getState().totalAssets, 367);
  assert.equal(client.getState().totalBytes, 15_518_698);
  assert.deepEqual(types, ['GET_OFFLINE_STATE', 'CHECK_FOR_UPDATE']);
});

test('progress messages notify subscribers with immutable snapshots', async () => {
  const fixture = browserFixture();
  const client = createOfflineClient(fixture);
  const seen = [];
  client.subscribe(state => seen.push(state));
  await client.register();
  fixture.listeners.get('message')({ data: {
    type: 'OFFLINE_PROGRESS', version: 'v1',
    state: { stagedVersion: 'v1', completedAssets: 2, totalAssets: 10 }
  } });
  assert.equal(seen.at(-1).completedAssets, 2);
  assert.equal(Object.isFrozen(seen.at(-1)), true);
});

test('download and update commands preserve worker response state', async () => {
  const types = [];
  const fixture = browserFixture({ worker: respondingWorker(message => {
    types.push(message.type);
    return { state: { activeVersion: message.type === 'DOWNLOAD_OFFLINE' ? 'v1' : null } };
  }) });
  const client = createOfflineClient(fixture);
  await client.register();
  const state = await client.download();
  assert.equal(state.activeVersion, 'v1');
  assert.deepEqual(types, ['GET_OFFLINE_STATE', 'CHECK_FOR_UPDATE', 'DOWNLOAD_OFFLINE']);
});

test('a manifest check failure preserves online play and the worker state already read', async () => {
  const worker = {
    postMessage(message, ports) {
      queueMicrotask(() => ports[0].postMessage(message.type === 'GET_OFFLINE_STATE'
        ? { requestId: message.requestId, ok: true, state: { activeVersion: 'installed-v1', totalBytes: 123 } }
        : { requestId: message.requestId, ok: false, error: 'network unavailable' }));
    }
  };
  const client = createOfflineClient(browserFixture({ worker }));
  const state = await client.register();
  assert.equal(state.status, 'ready');
  assert.equal(state.activeVersion, 'installed-v1');
  assert.equal(state.totalBytes, 123);
  assert.equal(state.error, null);
});

test('registration exposes an available update without replacing the active offline package', async () => {
  const fixture = browserFixture({ worker: respondingWorker(message => message.type === 'CHECK_FOR_UPDATE'
    ? {
        state: { activeVersion: 'installed-v1', stagedVersion: null },
        updateAvailable: true,
        availablePackage: { version: 'available-v2', totalAssets: 368, totalBytes: 15_531_098 }
      }
    : { state: { activeVersion: 'installed-v1', stagedVersion: null } }) });
  const client = createOfflineClient(fixture);
  const state = await client.register();
  assert.equal(state.status, 'update-available');
  assert.equal(state.activeVersion, 'installed-v1');
  assert.equal(state.availableVersion, 'available-v2');
  assert.equal(state.updateAvailable, true);
});

test('a successfully booted active package confirms and releases its retained predecessor', async () => {
  const types = [];
  const fixture = browserFixture({ worker: respondingWorker(message => {
    types.push(message.type);
    if (message.type === 'GET_OFFLINE_STATE') {
      return { state: { activeVersion: 'v2', previousVersion: 'v1', activeConfirmed: false, stagedVersion: null } };
    }
    if (message.type === 'CONFIRM_ACTIVE') {
      assert.equal(message.version, 'v2');
      return { state: { activeVersion: 'v2', previousVersion: null, activeConfirmed: true, stagedVersion: null } };
    }
    return {
      state: { activeVersion: 'v2', previousVersion: null, activeConfirmed: true, stagedVersion: null },
      availablePackage: { version: 'v2', totalAssets: 368, totalBytes: 15_531_098 },
      updateAvailable: false
    };
  }) });
  const client = createOfflineClient(fixture);
  const state = await client.register();
  assert.equal(state.status, 'ready');
  assert.equal(state.activeConfirmed, true);
  assert.equal(state.previousVersion, null);
  assert.deepEqual(types, ['GET_OFFLINE_STATE', 'CONFIRM_ACTIVE', 'CHECK_FOR_UPDATE']);
});

test('standalone detects either iOS navigator state or display mode', () => {
  assert.equal(createOfflineClient(browserFixture({ standalone: true })).standalone, true);
  const fixture = browserFixture();
  fixture.windowRef.matchMedia = () => ({ matches: true });
  assert.equal(createOfflineClient(fixture).standalone, true);
});

test('storage estimate reports availability and persistence result', async () => {
  const client = createOfflineClient(browserFixture());
  assert.deepEqual(await client.storageEstimate(), {
    usage: 20, quota: 100, available: 80, persisted: false, persistResult: true
  });
});
