const freezeState = state => Object.freeze({ ...state });

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
  timeoutMs = 5_000
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
    completedAssets: 0,
    totalAssets: 0,
    completedBytes: 0,
    totalBytes: 0,
    error: null
  });

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

  function send(type, payload = {}, target = workerTarget()) {
    if (!target || !MessageChannelCtor) return Promise.reject(new Error('Offline worker is not ready'));
    const id = requestId();
    const channel = new MessageChannelCtor();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Offline worker timed out: ${type}`)), timeoutMs);
      channel.port1.onmessage = event => {
        if (event.data?.requestId !== id) return;
        clearTimeout(timer);
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

  async function register() {
    if (!supported) return state;
    try {
      registration = await navigatorRef.serviceWorker.register('./sw.js', {
        scope: './',
        type: 'module',
        updateViaCache: 'none'
      });
      navigatorRef.serviceWorker.addEventListener?.('message', onWorkerMessage);
      const response = await send('GET_OFFLINE_STATE');
      let installed = publish({
        status: response.state?.activeVersion ? 'ready' : 'online-only',
        ...responseChanges(response),
        error: null
      });
      if (installed.activeVersion && installed.previousVersion && installed.activeConfirmed === false) {
        const confirmed = await send('CONFIRM_ACTIVE', { version: installed.activeVersion });
        installed = publish({ status: 'ready', ...responseChanges(confirmed), error: null });
      }
      try {
        const available = await send('CHECK_FOR_UPDATE');
        const changes = responseChanges(available);
        return publish({
          status: changes.stagedVersion
            ? 'update-ready'
            : changes.activeVersion && changes.updateAvailable
              ? 'update-available'
              : changes.activeVersion ? 'ready' : 'online-only',
          ...changes,
          error: null
        });
      } catch {
        return installed;
      }
    } catch (error) {
      return publish({ status: 'online-only', error: error?.message ?? String(error) });
    }
  }

  async function command(type, pendingStatus, payload) {
    publish({ status: pendingStatus, error: null });
    try {
      const response = await send(type, payload);
      const changes = responseChanges(response);
      const nextStatus = changes.activeVersion
        ? changes.stagedVersion
          ? 'update-ready'
          : changes.updateAvailable ? 'update-available' : 'ready'
        : changes.stagedVersion ? 'download-paused' : 'online-only';
      return publish({ status: nextStatus, ...changes, error: null });
    } catch (error) {
      return publish({ status: 'failed', error: error?.message ?? String(error) });
    }
  }

  async function applyUpdate() {
    const version = state.stagedVersion;
    const response = await command('APPLY_UPDATE', 'applying-update', { version });
    if (response.status === 'failed') return response;
    if (!registration?.waiting) return response;
    await send('SKIP_WAITING', {}, registration.waiting);
    await new Promise(resolve => navigatorRef.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    windowRef.location.reload();
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
    download: () => command('DOWNLOAD_OFFLINE', 'downloading'),
    checkForUpdate: () => command('CHECK_FOR_UPDATE', 'checking-update'),
    applyUpdate,
    cancelDownload: () => command('CANCEL_DOWNLOAD', 'cancelling'),
    storageEstimate
  });
}
