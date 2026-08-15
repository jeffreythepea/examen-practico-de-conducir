import { parseByteRange } from './byte-range.js';

export const OFFLINE_PROTOCOL_VERSION = 1;
export const META_CACHE = 'examen-practico-meta-v1';
export const SHELL_CACHE = 'examen-practico-shell-v1';
export const META_REQUEST = 'https://offline.examen-practico.invalid/__offline-state__';
export const PACKAGE_MANIFEST_REQUEST = 'https://offline.examen-practico.invalid/__offline-package__';
export const runtimeCacheName = version => `examen-practico-runtime-${version}`;

const DEFAULT_STATE = Object.freeze({
  protocolVersion: OFFLINE_PROTOCOL_VERSION,
  activeVersion: null,
  previousVersion: null,
  activeConfirmed: false,
  stagedVersion: null,
  // stagedVersion is claimed the moment a download starts, so on its own it
  // cannot tell "fully downloaded, waiting to be applied" from "half a
  // package in the cache". Only the manifest write at the end sets this.
  stagedComplete: false,
  recordedCorpusComplete: false,
  completedAssets: 0,
  totalAssets: 0,
  completedBytes: 0,
  totalBytes: 0,
  error: null
});

const freezeState = state => Object.freeze({ ...DEFAULT_STATE, ...state });
const jsonResponse = value => new Response(JSON.stringify(value), {
  headers: { 'content-type': 'application/json' }
});

// Memoized per cacheStorage instance (in the real SW there's exactly one —
// `caches` — for the worker's whole lifetime, so this behaves like a single
// SW-global variable there; keying on the instance instead of a flat module
// global just keeps independent cacheStorage instances — e.g. one per test —
// from bleeding state into each other).
const stateMemo = new WeakMap();
// Tracks which cacheStorage instances have completed at least one full
// asset-presence sweep this "lifetime". readOfflineState trusts the memoized
// state once this is set, only re-sweeping after activatePackage changes
// which version is active.
const verifiedLifetimes = new WeakSet();

async function readRawState(cacheStorage) {
  if (stateMemo.has(cacheStorage)) return stateMemo.get(cacheStorage);
  const cache = await cacheStorage.open(META_CACHE);
  const response = await cache.match(META_REQUEST);
  let state = DEFAULT_STATE;
  if (response) {
    try {
      const parsed = await response.json();
      if (parsed.protocolVersion === OFFLINE_PROTOCOL_VERSION) state = freezeState(parsed);
    } catch {
      state = DEFAULT_STATE;
    }
  }
  stateMemo.set(cacheStorage, state);
  return state;
}

async function writeState(cacheStorage, state) {
  const next = freezeState(state);
  const cache = await cacheStorage.open(META_CACHE);
  await cache.put(META_REQUEST, jsonResponse(next));
  stateMemo.set(cacheStorage, next);
  return next;
}

export function assertPackageManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1 || !/^[A-Za-z0-9._-]+$/.test(manifest.version ?? '')) {
    throw new Error('Invalid offline package manifest');
  }
  if (!Array.isArray(manifest.assets) || !Number.isFinite(manifest.totalBytes)) {
    throw new Error('Invalid offline package asset inventory');
  }
  const paths = new Set();
  for (const asset of manifest.assets) {
    if (typeof asset.path !== 'string' || paths.has(asset.path)
      || !Number.isInteger(asset.bytes) || asset.bytes < 0
      || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '')) {
      throw new Error(`Invalid offline asset record: ${asset?.path ?? 'unknown'}`);
    }
    paths.add(asset.path);
  }
  if (manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0) !== manifest.totalBytes) {
    throw new Error('Offline package byte total does not match its assets');
  }
}

function packageBase(packageUrl) {
  const manifestUrl = new URL(packageUrl);
  return new URL('.', manifestUrl);
}

function assetUrl(asset, base) {
  const url = new URL(asset.path, base);
  if (url.origin !== base.origin || !url.href.startsWith(base.href)) {
    throw new Error(`Offline asset escapes package scope: ${asset.path}`);
  }
  return url.href;
}

async function digestHex(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifiedResponse(response, asset) {
  if (!response?.ok) {
    const error = new Error(`Offline asset response failed: ${asset.path}`);
    error.offlineIntegrityFailure = true;
    throw error;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes || await digestHex(bytes) !== asset.sha256) {
    const error = new Error(`Offline asset integrity failed: ${asset.path}`);
    error.offlineIntegrityFailure = true;
    throw error;
  }
  return { bytes, response: new Response(bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  }) };
}

async function readStoredManifest(cache) {
  const response = await cache.match(PACKAGE_MANIFEST_REQUEST);
  if (!response) return null;
  try {
    const manifest = await response.json();
    assertPackageManifest(manifest);
    return manifest;
  } catch {
    return null;
  }
}

export async function downloadPackage({
  packageManifest,
  packageUrl,
  cacheStorage,
  fetchImpl,
  onProgress = () => {},
  signal
}) {
  assertPackageManifest(packageManifest);
  const base = packageBase(packageUrl);
  const prior = await readRawState(cacheStorage);
  // Every write re-reads first and contributes only download-owned fields: an
  // activation can land between two of these writes, and spreading the state
  // captured at entry would resurrect the activeVersion it replaced.
  const writeDownloadState = async fields => writeState(cacheStorage, {
    ...await readRawState(cacheStorage),
    ...fields
  });
  if (prior.stagedVersion && prior.stagedVersion !== packageManifest.version
    && prior.stagedVersion !== prior.activeVersion) {
    await cacheStorage.delete(runtimeCacheName(prior.stagedVersion));
  }
  const cacheName = runtimeCacheName(packageManifest.version);
  const cache = await cacheStorage.open(cacheName);
  let completedAssets = 0;
  let completedBytes = 0;
  const missing = [];

  try {
    for (const asset of packageManifest.assets) {
      const url = assetUrl(asset, base);
      const existing = await cache.match(url);
      if (!existing) {
        missing.push([asset, url]);
        continue;
      }
      await verifiedResponse(existing, asset);
      completedAssets += 1;
      completedBytes += asset.bytes;
    }

    let state = await writeDownloadState({
      stagedVersion: packageManifest.version,
      stagedComplete: false,
      recordedCorpusComplete: Boolean(packageManifest.recordedCorpusComplete),
      completedAssets,
      totalAssets: packageManifest.assets.length,
      completedBytes,
      totalBytes: packageManifest.totalBytes,
      error: null
    });
    onProgress(state);

    for (const [asset, url] of missing) {
      if (signal?.aborted) {
        const error = new Error('Offline download cancelled');
        error.name = 'AbortError';
        throw error;
      }
      const fetched = await fetchImpl(url, { cache: 'no-store', signal });
      const verified = await verifiedResponse(fetched, asset);
      await cache.put(url, verified.response);
      completedAssets += 1;
      completedBytes += asset.bytes;
      state = await writeDownloadState({
        completedAssets,
        completedBytes,
        error: null
      });
      onProgress(state);
    }

    await cache.put(PACKAGE_MANIFEST_REQUEST, jsonResponse({
      ...packageManifest,
      packageBaseUrl: base.href
    }));
    // Only now is the staged package answerable for: the manifest is stored
    // and every asset it lists has been fetched and verified.
    return writeDownloadState({ stagedComplete: true });
  } catch (error) {
    if (error.offlineIntegrityFailure) {
      await cacheStorage.delete(cacheName);
      await writeDownloadState({
        stagedVersion: null,
        stagedComplete: false,
        error: 'OFFLINE_INTEGRITY_FAILED'
      });
    } else {
      await writeDownloadState({
        stagedVersion: packageManifest.version,
        stagedComplete: false,
        recordedCorpusComplete: Boolean(packageManifest.recordedCorpusComplete),
        completedAssets,
        totalAssets: packageManifest.assets.length,
        completedBytes,
        totalBytes: packageManifest.totalBytes,
        error: error.name === 'AbortError' ? 'OFFLINE_DOWNLOAD_CANCELLED' : 'OFFLINE_DOWNLOAD_FAILED'
      });
    }
    throw error;
  }
}

export async function activatePackage({ cacheStorage, version }) {
  const state = await readRawState(cacheStorage);
  if (state.stagedVersion !== version) throw new Error('Offline package is not staged');
  const cache = await cacheStorage.open(runtimeCacheName(version));
  const manifest = await readStoredManifest(cache);
  if (!manifest || manifest.version !== version) throw new Error('Staged package is incomplete');
  if (!manifest.recordedCorpusComplete) throw new Error('Recorded audio corpus is incomplete');
  for (const asset of manifest.assets) {
    if (!await cache.match(assetUrl(asset, new URL(manifest.packageBaseUrl)))) {
      throw new Error(`Staged package is missing ${asset.path}`);
    }
  }
  const next = await writeState(cacheStorage, {
    ...state,
    previousVersion: state.activeVersion,
    activeVersion: version,
    activeConfirmed: false,
    stagedVersion: null,
    stagedComplete: false,
    recordedCorpusComplete: true,
    completedAssets: manifest.assets.length,
    totalAssets: manifest.assets.length,
    completedBytes: manifest.totalBytes,
    totalBytes: manifest.totalBytes,
    error: null
  });
  // The newly active version hasn't had its own presence sweep yet this
  // lifetime — force readOfflineState to verify it once, even though this
  // function's own loop above already checked it synchronously. Cheap
  // (happens once per activation, not per fetch) and keeps "Ready offline"
  // reporting honest about the version actually now active.
  verifiedLifetimes.delete(cacheStorage);
  return next;
}

export async function readOfflineState(cacheStorage) {
  const state = await readRawState(cacheStorage);
  if (!state.activeVersion) return state;
  if (verifiedLifetimes.has(cacheStorage)) return state;
  const cache = await cacheStorage.open(runtimeCacheName(state.activeVersion));
  const manifest = await readStoredManifest(cache);
  if (manifest) {
    const base = new URL(manifest.packageBaseUrl);
    const entries = await Promise.all(manifest.assets.map(asset => cache.match(assetUrl(asset, base))));
    if (entries.every(Boolean)) {
      verifiedLifetimes.add(cacheStorage);
      return state;
    }
  }
  verifiedLifetimes.add(cacheStorage);
  return writeState(cacheStorage, {
    ...state,
    activeVersion: null,
    activeConfirmed: false,
    recordedCorpusComplete: false,
    error: 'OFFLINE_FILES_MISSING'
  });
}

export async function matchActiveRequest({ cacheStorage, request }) {
  const state = await readRawState(cacheStorage);
  if (!state.activeVersion) return undefined;
  const cache = await cacheStorage.open(runtimeCacheName(state.activeVersion));
  const direct = await cache.match(request);
  if (direct) return applyRequestByteRange(direct, request);
  if (request.mode === 'navigate' || request.headers?.get?.('accept')?.includes('text/html')) {
    const manifest = await readStoredManifest(cache);
    if (!manifest) return undefined;
    const requestUrl = new URL(request.url);
    const base = new URL(manifest.packageBaseUrl);
    if (requestUrl.origin === base.origin
      && (requestUrl.href === base.href || requestUrl.href === base.href.replace(/\/$/, ''))) {
      return cache.match(new URL('index.html', base).href);
    }
  }
  return undefined;
}

// The Cache API matches ranged requests against full stored responses, but
// iPadOS Safari's media stack only accepts 206 replies for ranged video
// loads, so cached hits synthesize the requested slice.
async function applyRequestByteRange(response, request) {
  const header = request.headers?.get?.('range');
  if (!header) return response;
  const body = await response.arrayBuffer();
  const range = parseByteRange(header, body.byteLength);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { 'content-range': `bytes */${body.byteLength}` }
    });
  }
  const headers = new Headers(response.headers);
  headers.set('accept-ranges', 'bytes');
  if (!range) {
    headers.set('content-length', String(body.byteLength));
    return new Response(body, { status: 200, headers });
  }
  headers.set('content-range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
  headers.set('content-length', String(range.end - range.start + 1));
  return new Response(body.slice(range.start, range.end + 1), { status: 206, headers });
}

export async function confirmActivePackage({ cacheStorage, version }) {
  const state = await readRawState(cacheStorage);
  if (state.activeVersion !== version) throw new Error('Active package version changed');
  const previousVersion = state.previousVersion;
  const confirmed = await writeState(cacheStorage, {
    ...state,
    activeConfirmed: true,
    previousVersion: null,
    error: null
  });
  if (previousVersion && previousVersion !== version) {
    await cacheStorage.delete(runtimeCacheName(previousVersion));
  }
  return confirmed;
}

export async function cleanupObsoletePackages({ cacheStorage, keepVersions = [] }) {
  const state = await readRawState(cacheStorage);
  const protectedNames = new Set([META_CACHE, SHELL_CACHE]);
  for (const version of [state.activeVersion, state.stagedVersion, state.previousVersion, ...keepVersions]) {
    if (version) protectedNames.add(runtimeCacheName(version));
  }
  for (const name of await cacheStorage.keys()) {
    if (name.startsWith('examen-practico-runtime-') && !protectedNames.has(name)) {
      await cacheStorage.delete(name);
    }
  }
}
