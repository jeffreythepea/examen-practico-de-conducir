const freezeState = state => Object.freeze({ ...state });

// Every status this client can publish. The offline card renders from this
// list, so a status added here without a card branch fails its test rather
// than silently falling through to the "Online only" copy and its live
// Download button.
export const OFFLINE_STATUSES = Object.freeze([
  'unsupported',
  'online-only',
  'downloading',
  'download-paused',
  'cancelling',
  'ready',
  'checking-update',
  'update-available',
  'update-ready',
  'applying-update',
  'failed'
]);

function isSupported(navigatorRef, windowRef) {
  const hostname = windowRef?.location?.hostname ?? '';
  const secure = windowRef?.isSecureContext === true || ['localhost', '127.0.0.1', '::1'].includes(hostname);
  return secure && Boolean(navigatorRef?.serviceWorker?.register);
}

function requestId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function createOfflineClient({
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
  MessageChannelCtor = globalThis.MessageChannel,
  timeoutMs = 5_000,
  // Activation sweeps a 60 MB cache asset by asset; on an iPad that outruns
  // the ordinary reply timeout, and a timed-out apply left the card claiming
  // failure while the worker had in fact activated the update.
  applyTimeoutMs = 120_000,
  controllerChangeTimeoutMs = 3_000
} = {}) {
  const supported = isSupported(navigatorRef, windowRef);
  const standalone = Boolean(
    navigatorRef?.standalone
    || windowRef?.matchMedia?.('(display-mode: standalone)')?.matches
  );
  const subscribers = new Set();
  let registration = null;
  let state = freezeState({
    status: supported ? 'online-only' : 'unsupported',
    activeVersion: null,
    availableVersion: null,
    updateAvailable: false,
    stagedVersion: null,
    stagedComplete: false,
    completedAssets: 0,
    totalAssets: 0,
    completedBytes: 0,
    totalBytes: 0,
    checkFailed: false,
    error: null
  });
  let operationGeneration = 0;
  let activeDownloadOperation = 0;

  function publish(changes) {
    state = freezeState({ ...state, ...changes });
    for (const listener of subscribers) listener(state);
    return state;
  }

  function workerTarget() {
    return navigatorRef?.serviceWorker?.controller
      ?? registration?.active
      ?? registration?.waiting
      ?? registration?.installing
      ?? null;
  }

  function send(type, payload = {}, target = workerTarget(), replyTimeoutMs = timeoutMs) {
    if (!target || !MessageChannelCtor) return Promise.reject(new Error('Offline worker is not ready'));
    const id = requestId();
    const channel = new MessageChannelCtor();
    return new Promise((resolve, reject) => {
      // A timeout of 0 disables the timer: the download command only replies
      // once the whole package has downloaded (minutes), and timing it out
      // dropped the completion reply — the card stayed on "downloading"
      // until a reload re-read the staged state.
      const timer = replyTimeoutMs > 0
        ? setTimeout(() => reject(new Error(`Offline worker timed out: ${type}`)), replyTimeoutMs)
        : null;
      channel.port1.onmessage = event => {
        if (event.data?.requestId !== id) return;
        if (timer !== null) clearTimeout(timer);
        channel.port1.close?.();
        if (!event.data.ok) reject(new Error(event.data.error ?? 'Offline worker failed'));
        else resolve(event.data);
      };
      channel.port1.start?.();
      target.postMessage({ type, requestId: id, ...payload }, [channel.port2]);
    });
  }

  function onWorkerMessage(event) {
    if (event.data?.type !== 'OFFLINE_PROGRESS' || !event.data.state) return;
    if (activeDownloadOperation !== operationGeneration || state.status !== 'downloading') return;
    if (state.stagedVersion && event.data.version && event.data.version !== state.stagedVersion) return;
    publish({ status: 'downloading', ...event.data.state });
  }

  function responseChanges(response) {
    const available = response.availablePackage;
    return {
      ...response.state,
      updateAvailable: Boolean(response.updateAvailable),
      ...(available ? {
        availableVersion: available.version,
        totalAssets: available.totalAssets,
        totalBytes: available.totalBytes,
        recordedCorpusComplete: available.recordedCorpusComplete
      } : {})
    };
  }

  // A staged version alone only says a download claimed the slot; without
  // stagedComplete the package on disk is a partial one, and offering Apply
  // for it hands activation a package that is not there.
  function statusForChanges(changes) {
    if (changes.stagedVersion && changes.stagedComplete) return 'update-ready';
    if (changes.stagedVersion) return 'download-paused';
    if (!changes.activeVersion) return 'online-only';
    return changes.updateAvailable ? 'update-available' : 'ready';
  }

  async function register() {
    if (!supported) return state;
    // Registration is slow and its update check slower; a Download tapped
    // while it runs owns the card from then on, so a late registration
    // publish must not overwrite 'downloading' with a pre-download snapshot.
    const generation = operationGeneration;
    const superseded = () => generation !== operationGeneration;
    try {
      registration = await navigatorRef.serviceWorker.register('./sw.js', {
        scope: './',
        type: 'module',
        updateViaCache: 'none'
      });
      navigatorRef.serviceWorker.addEventListener?.('message', onWorkerMessage);
      const response = await send('GET_OFFLINE_STATE');
      if (superseded()) return state;
      let installed = publish({
        status: response.state?.activeVersion ? 'ready' : 'online-only',
        ...responseChanges(response),
        error: null
      });
      if (installed.activeVersion && installed.previousVersion && installed.activeConfirmed === false) {
        const confirmed = await send('CONFIRM_ACTIVE', { version: installed.activeVersion });
        if (superseded()) return state;
        installed = publish({ status: 'ready', ...responseChanges(confirmed), error: null });
      }
      try {
        const available = await send('CHECK_FOR_UPDATE');
        if (superseded()) return state;
        const changes = responseChanges(available);
        return publish({ status: statusForChanges(changes), ...changes, error: null });
      } catch {
        return superseded() ? state : installed;
      }
    } catch (error) {
      if (superseded()) return state;
      return publish({ status: 'online-only', error: error?.message ?? String(error) });
    }
  }

  async function command(type, pendingStatus, payload, replyTimeoutMs = timeoutMs, operation = ++operationGeneration) {
    const isDownload = type === 'DOWNLOAD_OFFLINE';
    activeDownloadOperation = isDownload ? operation : 0;
    publish({
      status: pendingStatus,
      error: null,
      checkFailed: false,
      // A resume may move to a newer package version than the one staged
      // here; keeping the old one would make the progress guard discard
      // every event the new download broadcasts.
      ...(isDownload ? { stagedVersion: null, stagedComplete: false } : {})
    });
    try {
      const response = await send(type, payload, workerTarget(), replyTimeoutMs);
      if (operation !== operationGeneration) return state;
      const changes = responseChanges(response);
      return publish({ status: statusForChanges(changes), ...changes, error: null });
    } catch (error) {
      if (operation !== operationGeneration) return state;
      return publish({ status: 'failed', error: error?.message ?? String(error) });
    }
  }

  async function checkForUpdate() {
    const operation = ++operationGeneration;
    // An installed package is no less installed for the network being down.
    // Failing the whole card claimed "the offline download failed" about a
    // package sitting healthy on disk.
    const restore = { status: state.status, error: state.error };
    publish({ status: 'checking-update', error: null, checkFailed: false });
    try {
      const response = await send('CHECK_FOR_UPDATE');
      if (operation !== operationGeneration) return state;
      const changes = responseChanges(response);
      return publish({ status: statusForChanges(changes), ...changes, error: null, checkFailed: false });
    } catch {
      if (operation !== operationGeneration) return state;
      return publish({ ...restore, checkFailed: true });
    }
  }

  async function applyUpdate() {
    const version = state.stagedVersion;
    const operation = ++operationGeneration;
    const response = await command('APPLY_UPDATE', 'applying-update', { version }, applyTimeoutMs, operation);
    if (operation !== operationGeneration) return response;
    if (response.status === 'failed') return response;
    // The worker now serves the newly activated package, but this page is still
    // running the JS it loaded from the old one. sw.js is almost never part of
    // an update — a package-only update leaves no waiting worker at all — so
    // the reload must not be conditional on one, or the new assets get judged
    // against old code while the card truthfully reports the new hash.
    const waiting = registration?.waiting;
    if (waiting) {
      // Listen before asking: a worker that claims its clients between the
      // send and the subscribe fires controllerchange into nobody, and the
      // page never reloads. The timer covers the handover never happening.
      const handover = new Promise(resolve => {
        navigatorRef.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
      try {
        await send('SKIP_WAITING', {}, waiting);
      } catch {
        // A worker that will not step aside still must not strand the page on
        // the old package: reload onto whatever the worker is serving.
      }
      await Promise.race([
        handover,
        new Promise(resolve => setTimeout(resolve, controllerChangeTimeoutMs))
      ]);
    }
    try {
      windowRef.location.reload();
    } catch (error) {
      // Say so rather than leaving the card on "Applying the update" forever.
      if (operation !== operationGeneration) return state;
      return publish({ status: 'failed', error: error?.message ?? String(error) });
    }
    return response;
  }

  async function storageEstimate() {
    const storage = navigatorRef?.storage;
    if (!storage) return { usage: null, quota: null, available: null, persisted: null, persistResult: null };
    const estimate = await storage.estimate?.() ?? {};
    const usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
    const quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
    const persisted = storage.persisted ? await storage.persisted() : null;
    const persistResult = persisted === false && storage.persist ? await storage.persist() : persisted;
    return {
      usage,
      quota,
      available: usage !== null && quota !== null ? Math.max(0, quota - usage) : null,
      persisted,
      persistResult
    };
  }

  return Object.freeze({
    supported,
    standalone,
    getState: () => state,
    subscribe(listener) { subscribers.add(listener); return () => subscribers.delete(listener); },
    register,
    download: () => command('DOWNLOAD_OFFLINE', 'downloading', {}, 0),
    checkForUpdate,
    applyUpdate,
    cancelDownload: () => command('CANCEL_DOWNLOAD', 'cancelling'),
    storageEstimate
  });
}
