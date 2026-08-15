import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOfflineClient, OFFLINE_STATUSES } from '../src/offline-client.js';

function respondingWorker(onMessage = () => ({})) {
  return {
    postMessage(message, ports) {
      const result = onMessage(message);
      queueMicrotask(() => ports?.[0]?.postMessage({ requestId: message.requestId, ok: true, ...result }));
    }
  };
}

function controlledWorker() {
  const requests = [];
  return {
    requests,
    postMessage(message, ports) {
      const reply = response => ports?.[0]?.postMessage({ requestId: message.requestId, ...response });
      if (message.type === 'GET_OFFLINE_STATE' || message.type === 'CHECK_FOR_UPDATE') {
        queueMicrotask(() => reply({ ok: true, state: { activeVersion: null, stagedVersion: null } }));
        return;
      }
      requests.push({ message, reply });
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
  const worker = controlledWorker();
  const fixture = browserFixture({ worker });
  const client = createOfflineClient(fixture);
  const seen = [];
  client.subscribe(state => seen.push(state));
  await client.register();
  const download = client.download();
  fixture.listeners.get('message')({ data: {
    type: 'OFFLINE_PROGRESS', version: 'v1',
    state: { stagedVersion: 'v1', completedAssets: 2, totalAssets: 10 }
  } });
  assert.equal(seen.at(-1).completedAssets, 2);
  assert.equal(Object.isFrozen(seen.at(-1)), true);
  worker.requests.find(request => request.message.type === 'DOWNLOAD_OFFLINE')
    .reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: null } });
  await download;
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

test('a download outliving the reply timeout still lands its completion state', async () => {
  // The DOWNLOAD_OFFLINE reply only arrives when the whole package has
  // downloaded — minutes on a real device. Timing it out dropped the
  // completion state and the card stayed on "downloading" until a reload.
  const worker = {
    postMessage(message, ports) {
      const reply = () => ports?.[0]?.postMessage({
        requestId: message.requestId,
        ok: true,
        state: message.type === 'DOWNLOAD_OFFLINE'
          ? { activeVersion: 'v1', stagedVersion: 'v2', stagedComplete: true }
          : { activeVersion: 'v1', stagedVersion: null }
      });
      if (message.type === 'DOWNLOAD_OFFLINE') setTimeout(reply, 60);
      else queueMicrotask(reply);
    }
  };
  const client = createOfflineClient({ ...browserFixture({ worker }), timeoutMs: 10 });
  await client.register();
  const state = await client.download();
  assert.equal(state.status, 'update-ready');
  assert.equal(state.stagedVersion, 'v2');
});

test('a late failed download cannot overwrite a newer cancellation or its frozen snapshots', async () => {
  const worker = controlledWorker();
  const fixture = browserFixture({ worker });
  const client = createOfflineClient(fixture);
  const seen = [];
  client.subscribe(state => seen.push(state));
  await client.register();

  const download = client.download();
  const cancel = client.cancelDownload();
  const cancelRequest = worker.requests.find(request => request.message.type === 'CANCEL_DOWNLOAD');
  cancelRequest.reply({ ok: true, state: { activeVersion: null, stagedVersion: null } });
  const cancelled = await cancel;
  assert.equal(cancelled.status, 'online-only');

  const downloadRequest = worker.requests.find(request => request.message.type === 'DOWNLOAD_OFFLINE');
  downloadRequest.reply({ ok: false, error: 'network unavailable' });
  const stale = await download;
  assert.strictEqual(stale, cancelled);
  assert.equal(client.getState().status, 'online-only');
  assert.ok(seen.every(Object.isFrozen));
  assert.ok(Object.isFrozen(stale));
});

test('late download success and progress cannot restore downloading after cancellation', async () => {
  const worker = controlledWorker();
  const fixture = browserFixture({ worker });
  const client = createOfflineClient(fixture);
  const seen = [];
  client.subscribe(state => seen.push(state));
  await client.register();

  const download = client.download();
  const cancel = client.cancelDownload();
  worker.requests.find(request => request.message.type === 'CANCEL_DOWNLOAD')
    .reply({ ok: true, state: { activeVersion: null, stagedVersion: null } });
  const cancelled = await cancel;
  worker.requests.find(request => request.message.type === 'DOWNLOAD_OFFLINE')
    .reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: null } });
  const stale = await download;
  assert.strictEqual(stale, cancelled);

  fixture.listeners.get('message')({ data: {
    type: 'OFFLINE_PROGRESS', version: 'v1',
    state: { stagedVersion: 'v1', completedAssets: 4, totalAssets: 10 }
  } });
  assert.equal(client.getState().status, 'online-only');
  assert.equal(client.getState().completedAssets, 0);
  assert.ok(seen.every(Object.isFrozen));
});

test('applying an update reloads the page even when no new worker is waiting', async () => {
  // sw.js has not changed since the first offline release, so a package-only
  // update never produces a waiting worker. Reloading only in that case left
  // the page running the previous package's JS while the offline card showed
  // the newly activated hash — device passes then judged new assets against
  // old code (task #17, 2026-08-14).
  for (const hasWaiting of [false, true]) {
    let reloads = 0;
    const types = [];
    // SKIP_WAITING goes to the waiting worker, never the active one, so it is
    // the waiting worker that has to record it.
    const waiting = hasWaiting ? respondingWorker(message => { types.push(message.type); return {}; }) : null;
    const fixture = browserFixture({ worker: respondingWorker(message => {
      types.push(message.type);
      return { state: { activeVersion: message.type === 'APPLY_UPDATE' ? 'v2' : 'v1', stagedVersion: null } };
    }) });
    fixture.registration.waiting = waiting;
    fixture.windowRef.location.reload = () => { reloads += 1; };
    const client = createOfflineClient(fixture);
    await client.register();
    const applying = client.applyUpdate();
    // A waiting worker hands over on controllerchange; without one the reload
    // must not wait for an event that will never fire.
    if (waiting) {
      while (!fixture.listeners.has('controllerchange')) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      fixture.listeners.get('controllerchange')();
    }
    const state = await applying;
    assert.equal(state.status, 'ready');
    assert.equal(state.activeVersion, 'v2');
    assert.equal(reloads, 1, `waiting=${Boolean(waiting)} must reload exactly once`);
    assert.equal(types.includes('SKIP_WAITING'), Boolean(waiting));
  }
});

test('a failed update neither skips waiting nor reloads', async () => {
  let reloads = 0;
  const fixture = browserFixture({ worker: {
    postMessage(message, ports) {
      queueMicrotask(() => ports?.[0]?.postMessage(message.type === 'APPLY_UPDATE'
        ? { requestId: message.requestId, ok: false, error: 'digest mismatch' }
        : { requestId: message.requestId, ok: true, state: { activeVersion: 'v1', stagedVersion: 'v2' } }));
    }
  } });
  fixture.windowRef.location.reload = () => { reloads += 1; };
  const client = createOfflineClient(fixture);
  await client.register();
  const state = await client.applyUpdate();
  assert.equal(state.status, 'failed');
  assert.equal(reloads, 0);
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

test('a slow registration check cannot overwrite a download the learner already started', async () => {
  // register()'s CHECK_FOR_UPDATE can resolve minutes in, after a Download
  // was tapped. Publishing its pre-download snapshot dropped the card back to
  // "update available": progress events were then discarded, Cancel was
  // replaced by Download, and a second 60 MB download was one tap away.
  const worker = controlledWorker();
  const fixture = browserFixture({ worker });
  // controlledWorker answers registration's reads immediately; hold the
  // update check so the download can overtake it.
  const held = [];
  fixture.serviceWorker.controller = {
    postMessage(message, ports) {
      const reply = response => ports?.[0]?.postMessage({ requestId: message.requestId, ...response });
      if (message.type === 'GET_OFFLINE_STATE') {
        queueMicrotask(() => reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: null } }));
        return;
      }
      held.push({ message, reply });
    }
  };
  const client = createOfflineClient(fixture);
  const registering = client.register();
  const waitFor = async type => {
    while (!held.some(request => request.message.type === type)) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return held.find(request => request.message.type === type);
  };
  const check = await waitFor('CHECK_FOR_UPDATE');
  const downloading = client.download();
  assert.equal(client.getState().status, 'downloading');

  check.reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: null }, updateAvailable: true });
  await registering;
  assert.equal(client.getState().status, 'downloading');

  (await waitFor('DOWNLOAD_OFFLINE'))
    .reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: 'v2', stagedComplete: true } });
  const state = await downloading;
  assert.equal(state.status, 'update-ready');
  assert.deepEqual(held.map(request => request.message.type), ['CHECK_FOR_UPDATE', 'DOWNLOAD_OFFLINE']);
});

test('a staged package still downloading is not offered for applying', async () => {
  // stagedVersion is claimed at download start, so a reload mid-update showed
  // an Apply button for a package that was not on disk yet.
  const fixture = browserFixture({ worker: respondingWorker(() => ({
    state: { activeVersion: 'v1', stagedVersion: 'v2', stagedComplete: false },
    updateAvailable: true
  })) });
  const client = createOfflineClient(fixture);
  const state = await client.register();
  assert.equal(state.status, 'download-paused');
  assert.equal(state.stagedComplete, false);
});

test('resuming a download drops the staged version its progress no longer belongs to', async () => {
  // A resume can land on a newer package than the one staged here; keeping
  // the old version made the progress guard reject every event.
  const worker = controlledWorker();
  const fixture = browserFixture({ worker });
  const client = createOfflineClient(fixture);
  await client.register();
  const download = client.download();
  fixture.listeners.get('message')({ data: {
    type: 'OFFLINE_PROGRESS', version: 'v2',
    state: { stagedVersion: 'v2', completedAssets: 3, totalAssets: 10 }
  } });
  assert.equal(client.getState().completedAssets, 3);
  assert.equal(client.getState().stagedVersion, 'v2');
  worker.requests.find(request => request.message.type === 'DOWNLOAD_OFFLINE')
    .reply({ ok: true, state: { activeVersion: 'v2', stagedVersion: null } });
  await download;
});

test('an apply slower than the ordinary reply timeout still activates and reloads', async () => {
  // Sweeping a 60 MB cache outruns the 5 s reply timeout on an iPad. The
  // client showed "failed" and never reloaded, while the worker had in fact
  // activated the update — old JS, new package hash.
  let reloads = 0;
  const worker = {
    postMessage(message, ports) {
      const reply = () => ports?.[0]?.postMessage({
        requestId: message.requestId,
        ok: true,
        state: message.type === 'APPLY_UPDATE'
          ? { activeVersion: 'v2', stagedVersion: null }
          : { activeVersion: 'v1', stagedVersion: 'v2', stagedComplete: true }
      });
      if (message.type === 'APPLY_UPDATE') setTimeout(reply, 40);
      else queueMicrotask(reply);
    }
  };
  const fixture = browserFixture({ worker });
  fixture.windowRef.location.reload = () => { reloads += 1; };
  const client = createOfflineClient({ ...fixture, timeoutMs: 10, applyTimeoutMs: 5_000 });
  await client.register();
  const state = await client.applyUpdate();
  assert.equal(state.status, 'ready');
  assert.equal(state.activeVersion, 'v2');
  assert.equal(reloads, 1);
});

test('an apply reloads even when the worker takes over before the page is listening', async () => {
  // controllerchange fired between send and subscribe reached nobody, and the
  // page sat on the old package for good.
  let reloads = 0;
  const fixture = browserFixture({ worker: respondingWorker(() => ({
    state: { activeVersion: 'v2', stagedVersion: null }
  })) });
  fixture.registration.waiting = {
    postMessage(message, ports) {
      // Hand over immediately, before the reply that would let a
      // listener-attached-after implementation subscribe.
      fixture.listeners.get('controllerchange')?.();
      queueMicrotask(() => ports?.[0]?.postMessage({ requestId: message.requestId, ok: true }));
    }
  };
  fixture.windowRef.location.reload = () => { reloads += 1; };
  const client = createOfflineClient({ ...fixture, controllerChangeTimeoutMs: 50 });
  await client.register();
  await client.applyUpdate();
  assert.equal(reloads, 1);
});

test('an apply whose worker never hands over reloads anyway', async () => {
  let reloads = 0;
  const fixture = browserFixture({ worker: respondingWorker(() => ({
    state: { activeVersion: 'v2', stagedVersion: null }
  })) });
  fixture.registration.waiting = respondingWorker();
  fixture.windowRef.location.reload = () => { reloads += 1; };
  const client = createOfflineClient({ ...fixture, controllerChangeTimeoutMs: 20 });
  await client.register();
  await client.applyUpdate();
  assert.equal(reloads, 1);
});

test('a manual update check that cannot reach the network leaves the installed package alone', async () => {
  // Publishing 'failed' made the card say "The offline download failed" about
  // a package sitting healthy on disk.
  let allowCheck = true;
  const fixture = browserFixture({ worker: {
    postMessage(message, ports) {
      const reply = response => ports?.[0]?.postMessage({ requestId: message.requestId, ...response });
      if (message.type === 'CHECK_FOR_UPDATE' && !allowCheck) {
        queueMicrotask(() => reply({ ok: false, error: 'network unavailable' }));
        return;
      }
      queueMicrotask(() => reply({ ok: true, state: { activeVersion: 'v1', stagedVersion: null }, updateAvailable: false }));
    }
  } });
  const client = createOfflineClient(fixture);
  await client.register();
  assert.equal(client.getState().status, 'ready');

  allowCheck = false;
  const state = await client.checkForUpdate();
  assert.equal(state.status, 'ready');
  assert.equal(state.activeVersion, 'v1');
  assert.equal(state.checkFailed, true);
  assert.equal(state.error, null);
});

test('the client only ever publishes statuses the offline card knows how to render', async () => {
  const source = await readFile(new URL('../src/offline-client.js', import.meta.url), 'utf8');
  const published = [...source.matchAll(/status: '([a-z-]+)'/g)].map(match => match[1]);
  assert.ok(published.length >= 5);
  for (const status of published) {
    assert.ok(OFFLINE_STATUSES.includes(status), `${status} is published but not declared`);
  }
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
