# Offline iPad Release A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish an installable Home Screen web app that downloads and verifies the complete Examen Práctico runtime, runs fully offline on iPad, stages safe between-session updates, migrates existing saves, and resumes interrupted sessions without scoring the interrupted command.

**Architecture:** Keep the existing no-build browser application, but add a release-only asset pipeline, a deterministic runtime package manifest, and a root-scoped service worker. The service worker serves one integrity-verified active cache selected through a small metadata pointer; downloads go to a separate staging cache and become active only after complete verification and explicit setup-screen confirmation. Persist only stable active-session identifiers in schema version 2, leaving live audio, timers, and surface objects ephemeral.

**Tech Stack:** Plain HTML/CSS/ES modules, Node.js 20 test runner, Sharp as a development-only image optimizer, Service Worker/Cache/Storage APIs, GitHub Actions and GitHub Pages, existing ElevenLabs generation tooling.

## Global Constraints

- Supported baseline remains current Safari on iPadOS and macOS plus current Chromium on macOS.
- Commands and generated command audio always remain Spanish.
- Every interface string must exist in English and Spanish.
- API keys and credentials never enter Git, the deployment artifact, Cache Storage, or browser-delivered files.
- Stable command, action, phrasing, surface, result, and provenance IDs are invariants.
- Runtime photographs must preserve their exact aspect ratio and target-coordinate geometry.
- The installed app must remain usable if staging or activation of an update fails.
- The app may show **Ready offline** only when the complete recorded 324-clip corpus and every other runtime asset are cached and integrity-verified.
- Browser speech remains an emergency fallback and does not satisfy offline readiness.
- Repository tests gate every task; run `npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test` before review.
- Collaborators prepare diffs and checkpoints; Jeffrey performs commits and pushes unless he explicitly authorizes otherwise.
- Public onboarding, accounts, cloud sync, native SwiftUI work, readiness dashboards, lesson flags, simulation, and retention mechanics are outside Release A.

---

## File Structure

### New production files

- `manifest.webmanifest` — stable Home Screen identity, display mode, colors, orientation intent, and icon inventory.
- `offline.html` — bilingual minimal recovery page used before a complete active package exists.
- `sw.js` — root-scoped service-worker adapter for package messages and active-cache fetches.
- `src/offline-cache.js` — testable cache download, integrity, pointer, activation, and cleanup logic shared by the worker.
- `src/offline-client.js` — browser registration, state subscription, install detection, download/update commands, and storage estimates.
- `src/active-session.js` — pure serialization and resolution of resumable session state.
- `scripts/optimize-runtime-images.mjs` — deterministic source-PNG to runtime-WebP conversion.
- `scripts/runtime-package.mjs` — runtime allowlist discovery, integrity calculation, corpus-completeness validation, and `dist/` assembly.
- `scripts/build-runtime-package.mjs` — CLI entry point for the release artifact.
- `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon-180.png` — installed-app icons.
- `.github/workflows/pages.yml` — tested deployment of `dist/` only.

### New tests

- `tests/runtime-images.test.js`
- `tests/web-app-manifest.test.js`
- `tests/runtime-package.test.js`
- `tests/offline-cache.test.js`
- `tests/offline-client.test.js`
- `tests/active-session.test.js`
- `tests/pages-workflow.test.js`

### Existing files modified

- `package.json`, new `package-lock.json`, `.gitignore`
- `index.html`, `styles.css`
- `src/app.js`, `src/i18n.js`, `src/storage.js`
- `src/driving-scenes.js`, `src/precheck-scenes.js`
- `tests/app-smoke.test.js`, `tests/app-state.test.js`, `tests/i18n.test.js`, `tests/storage.test.js`, `tests/release-audit.test.js`, `tests/driving-scenes.test.js`, `tests/precheck-scenes.test.js`
- `README.md`, `CHANGELOG.md`, `docs/design.md`

---

### Task 1: Optimize Runtime Photographs Without Moving Targets

**Files:**
- Create: `scripts/optimize-runtime-images.mjs`
- Create: `tests/runtime-images.test.js`
- Create: `assets/driving/*.webp`
- Create: `assets/precheck/*.webp`
- Modify: `package.json`
- Create: `package-lock.json`
- Modify: `.gitignore`
- Modify: `src/driving-scenes.js`
- Modify: `src/precheck-scenes.js`
- Modify: `tests/driving-scenes.test.js`
- Modify: `tests/precheck-scenes.test.js`

**Interfaces:**
- Consumes: `DRIVING_SCENES` from `src/driving-scenes.js`; `PRECHECK_SCENES` from `src/precheck-scenes.js`.
- Produces: `optimizeRuntimeImages({ root, quality? }): Promise<ReadonlyArray<{ source, output, sourceBytes, outputBytes }>>`.
- Produces: scene `asset` values ending in `.webp`, with all IDs, aspect ratios, target coordinates, and provenance unchanged.

- [ ] **Step 1: Add the development-only image dependency**

Run:

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir install --save-dev sharp@0.34.5
```

Expected: `package.json` gains `devDependencies.sharp`, `package-lock.json` is created, and no runtime import references Sharp. Add `node_modules/` and `dist/` to `.gitignore`.

- [ ] **Step 2: Write the failing runtime-image test**

Create `tests/runtime-images.test.js` with these assertions:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const scenes = [...Object.values(DRIVING_SCENES), ...Object.values(PRECHECK_SCENES)];

test('every photo scene uses a smaller same-size WebP runtime derivative', async () => {
  for (const scene of scenes) {
    assert.match(scene.asset, /\.webp$/);
    const runtimePath = resolve(ROOT, scene.asset.replace(/^\.\//, ''));
    const sourcePath = runtimePath.replace(/\.webp$/, '.png');
    const [runtimeMeta, sourceMeta, runtimeStat, sourceStat] = await Promise.all([
      sharp(runtimePath).metadata(), sharp(sourcePath).metadata(), stat(runtimePath), stat(sourcePath)
    ]);
    assert.equal(runtimeMeta.width, sourceMeta.width, scene.id);
    assert.equal(runtimeMeta.height, sourceMeta.height, scene.id);
    assert.ok(runtimeStat.size < sourceStat.size * 0.6, `${scene.id} must shrink by at least 40%`);
  }
});
```

- [ ] **Step 3: Run the focused test and verify failure**

Run:

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-images.test.js
```

Expected: FAIL because scene assets still reference PNG files.

- [ ] **Step 4: Implement deterministic image optimization**

Create `scripts/optimize-runtime-images.mjs` with this public shape:

```js
import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';

export async function optimizeRuntimeImages({ root, quality = 82 }) {
  const sources = [...new Set(
    [...Object.values(DRIVING_SCENES), ...Object.values(PRECHECK_SCENES)]
      .map(scene => scene.asset.replace(/^\.\//, '').replace(/\.webp$/, '.png'))
  )].sort();
  const results = [];
  for (const source of sources) {
    const output = source.replace(/\.png$/, '.webp');
    const sourcePath = resolve(root, source);
    const outputPath = resolve(root, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await sharp(sourcePath).webp({ quality, effort: 6 }).toFile(outputPath);
    results.push(Object.freeze({
      source,
      output,
      sourceBytes: (await stat(sourcePath)).size,
      outputBytes: (await stat(outputPath)).size
    }));
  }
  return Object.freeze(results);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(new URL('..', import.meta.url).pathname);
  const results = await optimizeRuntimeImages({ root });
  console.log(`Optimized ${results.length} runtime photographs.`);
}
```

Add `"optimize:images": "node scripts/optimize-runtime-images.mjs"` to `package.json`, run it once, then change every scene registry asset suffix from `.png` to `.webp`. Do not change target coordinates, stable IDs, dimensions, or provenance.

- [ ] **Step 5: Run focused geometry and image tests**

Run:

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-images.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/driving-scenes.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/precheck-scenes.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/manoeuvre-surfaces.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/spatial-surfaces.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/yaris-surfaces.test.js
```

Expected: PASS; all scene paths resolve to WebP; all target sweeps remain unchanged.

- [ ] **Step 6: Perform the visual checkpoint**

Serve the app and capture the seven driving and seven precheck photo scenes at 1024×768. Compare them with their source PNGs at original resolution. Reject compression that makes control symbols, road mouths, vehicle edges, signs, or fluid anchors materially less clear. Browser warnings/errors must be empty.

- [ ] **Step 7: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  package.json package-lock.json .gitignore scripts/optimize-runtime-images.mjs \
  tests/runtime-images.test.js tests/driving-scenes.test.js tests/precheck-scenes.test.js \
  src/driving-scenes.js src/precheck-scenes.js assets/driving assets/precheck
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Optimize runtime photographs"
```

---

### Task 2: Add Home Screen Identity and Installable App Metadata

**Files:**
- Create: `manifest.webmanifest`
- Create: `offline.html`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Create: `icons/icon-maskable-512.png`
- Create: `icons/apple-touch-icon-180.png`
- Create: `tests/web-app-manifest.test.js`
- Modify: `index.html`
- Modify: `tests/app-smoke.test.js`

**Interfaces:**
- Produces: a relative-scope manifest with stable app ID `./` and standalone display.
- Produces: a text-free icon family derived from one approved 1024×1024 source design.
- Produces: a bilingual static recovery document that contains no application data or credential.

- [ ] **Step 1: Write the failing manifest and icon test**

Create `tests/web-app-manifest.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('manifest defines one relative standalone landscape app identity', async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'landscape');
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512', '512x512']);
  assert.equal(manifest.icons.at(-1).purpose, 'maskable');
});

test('all declared and Apple icons exist at exact dimensions', async () => {
  const expected = new Map([
    ['icons/icon-192.png', [192, 192]],
    ['icons/icon-512.png', [512, 512]],
    ['icons/icon-maskable-512.png', [512, 512]],
    ['icons/apple-touch-icon-180.png', [180, 180]]
  ]);
  for (const [path, [width, height]] of expected) {
    assert.ok((await stat(resolve(ROOT, path))).size > 0);
    const metadata = await sharp(resolve(ROOT, path)).metadata();
    assert.deepEqual([metadata.width, metadata.height], [width, height]);
  }
});
```

- [ ] **Step 2: Run the test and verify failure**

Run:

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/web-app-manifest.test.js
```

Expected: FAIL because the manifest and icons do not exist.

- [ ] **Step 3: Create and approve the app icon**

Use the image-generation workflow to create one original 1024×1024 icon with this exact brief: dark forest-green rounded-square field; a cream simplified roundabout/road loop; one small golden directional route arrow; flat high-contrast geometry; no letters, flags, gradients, photographs, steering-wheel clip art, or fine detail. Show the icon to Jeffrey before deriving sizes.

After approval, use Sharp to create the four exact PNG files. The maskable version must keep all meaningful geometry within the central 80% safe zone.

- [ ] **Step 4: Create the manifest and recovery page**

Create `manifest.webmanifest`:

```json
{
  "id": "./",
  "name": "Examen Práctico de Conducir",
  "short_name": "Examen Práctico",
  "description": "Práctica bilingüe de las órdenes del examen práctico de conducir",
  "lang": "es",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#f5f5f3",
  "theme_color": "#1f6f50",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Create `offline.html` as a valid minimal document with English and Spanish headings stating that the initial offline package has not yet been completed and the user should reconnect and reopen the app. It must not pretend progress was lost.

- [ ] **Step 5: Link app metadata from `index.html`**

Add these head entries without removing the existing viewport and Apple standalone entries:

```html
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" sizes="180x180" href="./icons/apple-touch-icon-180.png">
<meta name="apple-mobile-web-app-title" content="Examen Práctico">
```

Extend `tests/app-smoke.test.js` to require all three entries and relative paths.

- [ ] **Step 6: Run focused tests**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/web-app-manifest.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-smoke.test.js
```

Expected: PASS.

- [ ] **Step 7: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  manifest.webmanifest offline.html icons index.html \
  tests/web-app-manifest.test.js tests/app-smoke.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Add Home Screen app identity"
```

---

### Task 3: Build a Deterministic Runtime-Only Release Artifact

**Files:**
- Create: `scripts/runtime-package.mjs`
- Create: `scripts/build-runtime-package.mjs`
- Create: `tests/runtime-package.test.js`
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `tests/release-audit.test.js`

**Interfaces:**
- Produces: `collectRuntimeAssets({ root, catalog, audioManifest }): Promise<string[]>`.
- Produces: `buildRuntimePackage({ root, outDir }): Promise<{ schemaVersion: 1, version: string, totalBytes: number, recordedCorpusComplete: boolean, assets: AssetRecord[] }>`.
- `AssetRecord` is `{ path: string, bytes: number, sha256: string }`, sorted by `path`.
- Produces: `dist/offline-package.json` and copies only approved runtime files into `dist/`.

- [ ] **Step 1: Write failing package-builder tests**

Create tests that build into a temporary directory and assert:

```js
assert.equal(result.schemaVersion, 1);
assert.match(result.version, /^[a-f0-9]{64}$/);
assert.deepEqual(result.assets, result.assets.toSorted((a, b) => a.path.localeCompare(b.path)));
assert.ok(result.assets.some(asset => asset.path === 'index.html'));
assert.ok(result.assets.some(asset => asset.path === 'data/commands.json'));
assert.ok(result.assets.some(asset => asset.path === 'manifest.webmanifest'));
assert.ok(result.assets.every(asset => !asset.path.startsWith('tests/')));
assert.ok(result.assets.every(asset => !asset.path.startsWith('docs/')));
assert.ok(result.assets.every(asset => !asset.path.endsWith('.png') || asset.path.startsWith('icons/')));
assert.equal(result.assets.some(asset => asset.path.includes('.superpowers')), false);
assert.equal(result.assets.some(asset => asset.path.includes('audio-expansion-recovery')), false);
```

Also mutate one fixture byte and assert the version changes. Delete one referenced scene asset and assert the build rejects it by path. Supply a deliberately incomplete audio manifest and assert `recordedCorpusComplete === false` without making the artifact invalid for online deployment.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-package.test.js
```

Expected: FAIL because the builder module does not exist.

- [ ] **Step 3: Implement runtime discovery and corpus coverage**

`collectRuntimeAssets` must include exactly:

```js
const STATIC_RUNTIME = Object.freeze([
  'index.html',
  'offline.html',
  'styles.css',
  'manifest.webmanifest',
  'data/commands.json',
  'data/audio-manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png'
]);
```

Add all `.js` files directly inside `src/`, every scene asset referenced by `DRIVING_SCENES` and `PRECHECK_SCENES`, and every `path` in `data/audio-manifest.json`. Normalize away a leading `./`, reject absolute paths, dot segments, symlinks, directories, duplicates, and any resolved path outside `root`.

Derive corpus completeness from the catalog, while pinning the already-approved voice and speed inventory:

```js
const EXPECTED_VOICE_IDS = Object.freeze([
  'CwhRBWXzGAHq8TQ4Fs17',
  'EXAVITQu4vr4xnSDxMaL'
]);
const EXPECTED_SPEEDS = Object.freeze([0.75, 0.9, 1]);
const required = catalog.flatMap(command => command.phrasings.flatMap(phrasing =>
  EXPECTED_VOICE_IDS.flatMap(voiceId => EXPECTED_SPEEDS.map(speed =>
    `${command.id}|${phrasing.id}|${voiceId}|${speed}`
  ))
));
const present = new Set(audioManifest.map(item =>
  `${item.commandId}|${item.phrasingId}|${item.voiceId}|${item.speed}`
));
const recordedCorpusComplete = required.length === 324
  && present.size === required.length
  && required.every(key => present.has(key));
```

Require the manifest's unique voice IDs and speeds to equal those pinned inventories exactly; otherwise set completeness false. Reject duplicate variant keys independently instead of allowing a duplicate record to masquerade as coverage.

- [ ] **Step 4: Implement integrity and `dist/` assembly**

For each sorted path, read bytes once, compute SHA-256 with `node:crypto`, copy the exact bytes to `outDir`, and record byte count and digest. Compute `version` as SHA-256 of the UTF-8 JSON serialization of `{ schemaVersion: 1, recordedCorpusComplete, assets }`. Write `offline-package.json` with a trailing newline after all copies succeed. Build into a temporary sibling directory and rename it over `dist/` only after validation so a failed build never leaves a partial artifact.

`scripts/build-runtime-package.mjs` must call the exported builder using the repository root and `dist/`, print version, asset count, byte total, and corpus-completeness status, and set a nonzero exit code on failure.

Add scripts:

```json
"build:runtime": "node scripts/build-runtime-package.mjs",
"release:check": "npm test && npm run build:runtime && git diff --check"
```

- [ ] **Step 5: Extend the credential and release audit to `dist/`**

Reuse `candidateTextFiles(dist)` after the build and apply the existing credential-shaped-text scan. Add assertions that `dist/` contains no `tests`, `docs`, `references`, `.git`, `.superpowers`, generation scripts, source PNG photographs, or provider recovery files.

- [ ] **Step 6: Run the package and release tests**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-package.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/release-audit.test.js
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run build:runtime
```

Expected: tests PASS; `dist/offline-package.json` is deterministic; `recordedCorpusComplete` remains false until Task 8.

- [ ] **Step 7: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  package.json .gitignore scripts/runtime-package.mjs scripts/build-runtime-package.mjs \
  tests/runtime-package.test.js tests/release-audit.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Build runtime-only release package"
```

---

### Task 4: Implement Integrity-Verified Active and Staging Caches

**Files:**
- Create: `src/offline-cache.js`
- Create: `sw.js`
- Create: `tests/offline-cache.test.js`
- Modify: `scripts/runtime-package.mjs`
- Modify: `tests/runtime-package.test.js`

**Interfaces:**
- Produces: `OFFLINE_PROTOCOL_VERSION = 1`.
- Produces: `downloadPackage({ packageManifest, packageUrl, cacheStorage, fetchImpl, onProgress }): Promise<OfflineState>`.
- Produces: `readOfflineState(cacheStorage): Promise<OfflineState>`.
- Produces: `activatePackage({ cacheStorage, version }): Promise<OfflineState>`.
- Produces: `confirmActivePackage({ cacheStorage, version }): Promise<OfflineState>`.
- Produces: `matchActiveRequest({ cacheStorage, request }): Promise<Response | undefined>`.
- Produces: `cleanupObsoletePackages({ cacheStorage, keepVersions }): Promise<void>`.
- `OfflineState` is `{ protocolVersion, activeVersion, previousVersion, activeConfirmed, stagedVersion, recordedCorpusComplete, completedAssets, totalAssets, completedBytes, totalBytes, error }`.
- Worker messages: `GET_OFFLINE_STATE`, `DOWNLOAD_OFFLINE`, `CHECK_FOR_UPDATE`, `APPLY_UPDATE`, `CONFIRM_ACTIVE`, `CANCEL_DOWNLOAD`, and `SKIP_WAITING`.

- [ ] **Step 1: Write failing cache-engine tests**

Use in-memory fakes for `CacheStorage`, `Cache`, and `fetch`. Cover these exact cases:

```js
test('download verifies bytes and sha256 before reporting a staged version');
test('resumed download reuses verified staged assets and fetches only missing assets');
test('corrupt or missing response deletes staging but leaves active pointer unchanged');
test('activation changes one metadata pointer only after staging is complete');
test('active request matching never reads a staging cache');
test('scope-root navigation resolves to cached index.html');
test('failed activation preserves the prior active version');
test('prior active cache is retained until the new version is confirmed');
test('missing active entries are reported as needing a new download');
test('cleanup retains active, staged, metadata, and explicitly protected prior versions');
test('progress is monotonic and ends at exact assets and bytes');
test('an incomplete recorded corpus can stage but cannot become offline ready');
```

The corrupt-response test must start with `activeVersion: 'old'`, stage a manifest containing one bad digest, reject, and then assert the metadata still names `old` and its cache still exists.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/offline-cache.test.js
```

Expected: FAIL because `src/offline-cache.js` does not exist.

- [ ] **Step 3: Implement names, metadata, and digest verification**

Use these stable names and metadata path:

```js
export const OFFLINE_PROTOCOL_VERSION = 1;
export const META_CACHE = 'examen-practico-meta-v1';
export const SHELL_CACHE = 'examen-practico-shell-v1';
export const META_REQUEST = new Request('./__offline-state__');
export const PACKAGE_MANIFEST_REQUEST = new Request('./__offline-package__');
export const runtimeCacheName = version => `examen-practico-runtime-${version}`;
```

The default state is:

```js
Object.freeze({
  protocolVersion: 1,
  activeVersion: null,
  previousVersion: null,
  activeConfirmed: false,
  stagedVersion: null,
  recordedCorpusComplete: false,
  completedAssets: 0,
  totalAssets: 0,
  completedBytes: 0,
  totalBytes: 0,
  error: null
});
```

Resolve every asset path against `packageUrl`, require the resulting URL to remain inside the package base directory and on the same origin, then fetch with `{ cache: 'no-store' }`. Require `response.ok`, read one `ArrayBuffer`, require exact byte count, compute `crypto.subtle.digest('SHA-256', bytes)`, compare lowercase hex, then place a reconstructed `Response` with the original status/statusText/headers into the version cache. Limit concurrency to three assets and emit progress only after successful `cache.put`.

When the same package version already has partial staging state, re-read and verify each cached entry against the new manifest before counting it as complete. Fetch only absent entries. Preserve verified entries and progress after cancellation or ordinary network loss so **Resume download** is real; delete the candidate cache on a schema/version mismatch, byte/hash corruption, or a server response that fails integrity.

After all assets verify, store the canonical package-manifest JSON in that staging cache under `PACKAGE_MANIFEST_REQUEST`. This internal record is not a fetchable runtime asset and is the authoritative inventory used during activation; never reconstruct activation requirements from mutable UI state.

Write metadata through one `metaCache.put(META_REQUEST, jsonResponse(state))`. Never update `activeVersion` from the download function.

- [ ] **Step 4: Implement activation and fetch isolation**

`activatePackage` must:

1. Read metadata.
2. Require `stagedVersion === version`.
3. Read `PACKAGE_MANIFEST_REQUEST` from the version cache, validate its schema and version, and verify every listed path is present.
4. Require `recordedCorpusComplete === true` before first activation may produce **Ready offline**.
5. Write metadata with the prior active version retained in `previousVersion`, the new active version, `activeConfirmed: false`, and no staged version.
6. Return the new immutable state.

`matchActiveRequest` reads the metadata pointer, opens only the named active cache, and matches by canonical same-origin URL. For a navigation request to the service-worker scope root (with or without the trailing slash), it matches the cached `index.html`. It returns `undefined` when there is no active package or no match.

`readOfflineState` validates that the active cache and its stored manifest still contain every expected entry. If iPadOS has evicted any part, clear the invalid active pointer, retain ordinary app data, and return a stable `OFFLINE_FILES_MISSING` error for bilingual UI mapping.

`confirmActivePackage` requires the expected active version, sets `activeConfirmed: true`, and only then permits cleanup of `previousVersion`. A failed new-code bootstrap never sends confirmation, so the prior cache remains available for recovery and diagnosis.

- [ ] **Step 5: Create the root service-worker adapter**

Create `sw.js` as an ES-module worker that imports the cache functions. Its event behavior is:

```js
self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.add('./offline.html')));
  // Deliberately no skipWaiting on updates.
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
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
```

Message handling calls `event.waitUntil`, replies to `event.source` and any supplied `MessagePort`, and broadcasts progress to same-origin window clients. `SKIP_WAITING` is honored only when explicitly messaged.

The shell cache contains only `offline.html`, exists so an interrupted first install has an honest bilingual recovery page, and never qualifies as **Ready offline**. `cleanupObsoletePackages` does not remove the metadata or shell caches.

- [ ] **Step 6: Include worker files in runtime packaging**

Add `sw.js` to the deploy artifact but not the active cache's asset inventory; the browser owns service-worker script updates. Add `src/offline-cache.js` through the existing `src/*.js` discovery. Add tests asserting `dist/sw.js` exists and `offline-package.json` does not list `sw.js` as a cached runtime asset.

- [ ] **Step 7: Run focused tests**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/offline-cache.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-package.test.js
```

Expected: PASS.

- [ ] **Step 8: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  src/offline-cache.js sw.js scripts/runtime-package.mjs \
  tests/offline-cache.test.js tests/runtime-package.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Add verified offline package cache"
```

---

### Task 5: Add Offline Download, Install, and Update UI

**Files:**
- Create: `src/offline-client.js`
- Create: `tests/offline-client.test.js`
- Modify: `src/app.js`
- Modify: `src/i18n.js`
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/app-state.test.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Produces: `createOfflineClient({ navigatorRef, windowRef, fetchImpl }): OfflineClient`.
- `OfflineClient` exposes `supported`, `standalone`, `getState()`, `subscribe(listener)`, `register()`, `download()`, `checkForUpdate()`, `applyUpdate()`, `cancelDownload()`, and `storageEstimate()`.
- App consumes immutable offline state and renders setup-only actions; practice reducers remain unaware of cache implementation.

- [ ] **Step 1: Write failing offline-client lifecycle tests**

Cover:

```js
test('unsupported service workers retain online play and report unsupported status');
test('registration uses ./sw.js with root-relative project scope and module type');
test('state requests use MessageChannel and time out without mutating the last state');
test('download progress notifies subscribers with immutable snapshots');
test('apply update messages waiting worker first and reloads only after controllerchange');
test('standalone detects navigator.standalone or display-mode standalone');
test('storage estimate returns usage, quota, available, persisted, and persist result');
```

Use fakes; do not require an actual service worker in Node.

- [ ] **Step 2: Write failing bilingual UI smoke assertions**

Extend app and i18n tests to require keys for:

```text
offline.title
offline.onlineOnly
offline.unsupported
offline.download
offline.resumeDownload
offline.downloading
offline.ready
offline.updateDownloading
offline.updateReady
offline.applyUpdate
offline.redownload
offline.insufficientStorage
offline.failedRetained
offline.installTitle
offline.installSafari
offline.transferProgress
offline.cancel
offline.bytes
```

Require setup markup with `role="status"`, `aria-live="polite"`, progress `<progress>`, and buttons keyed by `data-offline-action`. Require the existing bilingual AI-voice disclosure to remain present.

- [ ] **Step 3: Run the focused tests and verify failure**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/offline-client.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-smoke.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/i18n.test.js
```

Expected: FAIL on the missing client and copy.

- [ ] **Step 4: Implement the isolated browser client**

`createOfflineClient` must never throw during app initialization. Unsupported and registration-failure states are returned as data. Register exactly:

```js
await navigatorRef.serviceWorker.register('./sw.js', {
  scope: './',
  type: 'module',
  updateViaCache: 'none'
});
```

Resolve project-relative URLs against `document.baseURI`, not `/`, so GitHub Pages repository subpaths work. Use a unique request ID and `MessageChannel` for commands. Ignore stale progress whose `version` no longer matches the current operation.

`storageEstimate()` feature-detects `navigator.storage.estimate`, `persisted`, and `persist`; calculates `available = max(0, quota - usage)` when both are finite; and returns null fields when unsupported.

After the application has completed catalog, manifest, storage, player, and surface initialization against the controlling version, send `CONFIRM_ACTIVE` with that version. Do not send it earlier. This confirmation allows the worker to remove the previous runtime cache after a successful updated-code boot.

- [ ] **Step 5: Register only after core app initialization succeeds**

In `bootstrap`, construct the offline client after catalog, audio manifest, storage, audio player, and feedback player validate. Render setup immediately, then call `offlineClient.register()` without blocking online gameplay. Subscribe once and rerender only when offline state materially changes.

Do not register a service worker on non-secure non-localhost development origins. Show the online-only state instead.

- [ ] **Step 6: Render one compact setup status card**

The card must:

- Show install guidance only when not standalone.
- Show exact package size before download.
- Disable **Download for offline use** when `recordedCorpusComplete` is false and explain that recorded audio is incomplete.
- Offer **Resume download** after cancellation or recoverable network loss and retain verified progress.
- Show monotonic asset/byte progress.
- Show **Ready offline** only for an active complete corpus.
- Show **Update ready** only for a complete staged version different from active.
- Apply updates only from setup, never prompt/reveal/results.
- Preserve current app version and ordinary online Start behavior on failure.
- When running in Safari with existing progress, explain that the user should export a backup before adding the app to the Home Screen; when running standalone without progress, offer the corresponding import guidance. Do not imply the two contexts share local storage.

Bind actions through `data-offline-action` and keep focus stable across progress rerenders. Format bytes with `Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 })` or an equivalent tested formatter.

- [ ] **Step 7: Coordinate waiting service-worker activation**

On **Apply update**:

1. Confirm `model.screen === 'setup'`.
2. Send `APPLY_UPDATE` to the controlling worker and await success.
3. If `registration.waiting` exists, send `SKIP_WAITING` to it.
4. Await one `controllerchange` event.
5. Reload once.

Never reload from a progress event or while a session is active.

For the first complete download, where there is no active package to replace, activate the verified staging package automatically and show **Ready offline**. The explicit **Apply update** tap is required only when replacing an existing active package.

- [ ] **Step 8: Run focused tests and a browser smoke**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/offline-client.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-smoke.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-state.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/i18n.test.js
```

Serve `dist/` on loopback with the hardened project server extended to accept an explicit root argument in tests only, or use the approved brainstorming preview server. Verify English and Spanish setup status at 1024×768, online Start remains enabled, focus is stable during progress, and warnings/errors are empty.

- [ ] **Step 9: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  src/offline-client.js src/app.js src/i18n.js styles.css index.html \
  tests/offline-client.test.js tests/app-smoke.test.js tests/app-state.test.js tests/i18n.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Add offline install and update controls"
```

---

### Task 6: Migrate Storage and Resume Interrupted Sessions

**Files:**
- Create: `src/active-session.js`
- Create: `tests/active-session.test.js`
- Modify: `src/storage.js`
- Modify: `src/app.js`
- Modify: `src/i18n.js`
- Modify: `styles.css`
- Modify: `tests/storage.test.js`
- Modify: `tests/app-state.test.js`
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Storage schema becomes version 2.
- Produces: `migrateState(value): object` with ordered `1 -> 2` migration.
- Produces: `createActiveSession({ id, startedAt, items, index, attemptIds, settings }): ActiveSession`.
- Produces: `advanceActiveSession(session, { nextIndex, attemptId }): ActiveSession`.
- Produces: `resolveActiveSession(session, { commands, audioManifest }): { sessionItems, index, attemptIds, settings }` or throws.
- `ActiveSession` stores only schema version, ID, timestamps, ordered stable command/audio-variant identifiers, next unscored index, completed attempt IDs, and a validated settings snapshot.

- [ ] **Step 1: Write failing schema-migration tests**

Add exact coverage:

```js
test('schema 1 save migrates to schema 2 with activeSession null');
test('schema 2 round-trips a valid active session');
test('migration validates atomically and does not write an invalid candidate');
test('future schema remains rejected without mutation');
test('unknown additive fields survive migration and export');
```

The schema-1 fixture must be a copy of the current valid backup shape, not a hand-waved partial object.

- [ ] **Step 2: Write failing active-session tests**

Cover:

```js
test('active session serializes stable command and audio variant IDs but no live surface, timer, DOM, or audio objects');
test('advancing appends one attempt and moves to the next unscored command');
test('resolution rejects duplicate, missing, or unsupported command or audio variant IDs');
test('resolution restores the exact selected phrasing, voice, and speed');
test('resolution accepts a completed session whose index equals command count');
test('discard returns state with activeSession null and leaves attempts unchanged');
```

- [ ] **Step 3: Run the focused tests and verify failure**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/storage.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/active-session.test.js
```

Expected: FAIL because schema 2 and active-session helpers do not exist.

- [ ] **Step 4: Implement sequential migration**

Use:

```js
export const SCHEMA_VERSION = 2;

const MIGRATIONS = new Map([
  [1, state => ({ ...state, schemaVersion: 2, activeSession: null })]
]);

export function migrateState(value) {
  let candidate = clone(value);
  while (candidate.schemaVersion < SCHEMA_VERSION) {
    const migrate = MIGRATIONS.get(candidate.schemaVersion);
    if (!migrate) throw new Error(`No migration from schema ${candidate.schemaVersion}`);
    candidate = migrate(candidate);
  }
  return validateState(candidate);
}
```

`loadState` and `importState` call `migrateState`; `saveState` accepts only current schema. Preserve the current corrupt-save recovery behavior. `defaultState()` includes `activeSession: null`.

- [ ] **Step 5: Implement the active-session value object**

The stored shape is exactly:

```js
{
  version: 1,
  id: 'cryptographic-uuid',
  startedAt: 1784500000000,
  items: [
    {
      commandId: 'c-der',
      phrasingId: 'c-der-canonical',
      voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
      speed: 0.9
    },
    {
      commandId: 'c-pre-aceite',
      phrasingId: 'c-pre-aceite-canonical',
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      speed: 0.9
    }
  ],
  nextIndex: 1,
  attemptIds: ['attempt-uuid'],
  settings: {
    phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
    feedbackSounds: true, length: 'medium', mode: 'weakest-first'
  }
}
```

Deep-clone and freeze returns. Require one item per selected command, supported command and phrasing IDs, an audio-manifest record matching every command/phrasing/voice/speed tuple, `0 <= nextIndex <= items.length`, unique nonempty attempt IDs, finite `startedAt`, and the existing validated settings vocabulary. A repeated command ID is invalid for the current session generator. Do not persist surface seed, prompt time, pending replay, or partial control state; an interrupted command restarts from the same immutable Spanish audio variant with a newly generated response surface and remains unscored.

- [ ] **Step 6: Persist session progress at scoring boundaries**

When Start succeeds, select the command order and every immutable audio variant, then save the new active session before playing command 1. After `recordAttempt` succeeds, atomically save both the new attempt and `activeSession` advanced to `before.index + 1` with the new attempt ID. This ensures an app termination on the reveal screen does not repeat and rescore the completed command.

When a session reaches Results, keep the completed active session until the user returns to setup; then clear it. **Discard session** clears only `activeSession`, never attempt history.

- [ ] **Step 7: Add setup Resume and Discard actions**

At bootstrap, resolve `state.activeSession` against supported catalog commands and the current audio manifest. If valid and incomplete, setup shows:

- **Resume session** / **Reanudar sesión**
- Current position and total
- **Discard session** / **Descartar sesión**

Resume reconstructs the session-item array, sets the reducer to `loading-audio` at `nextIndex`, restores `sessionAttemptIds`, and plays the exact stored phrasing/voice/speed variant. If `nextIndex === items.length`, Resume opens Results using the recorded attempt IDs.

If resolution fails because catalog data changed, clear only the active-session field, show a bilingual recovery notice, and keep all settings and attempts.

- [ ] **Step 8: Run focused and full state tests**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/storage.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/active-session.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-state.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/app-smoke.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/i18n.test.js
```

Expected: PASS, including existing old-backup and unknown-field tests.

- [ ] **Step 9: Browser-test kill and resume semantics**

Start a 10-command Mixed session, answer two commands, begin the third, reload while it is waiting for a response, and choose Resume. Verify the third command restarts from audio, no attempt was recorded for the interruption, the first two attempt IDs remain in the eventual Results summary, and Discard never deletes completed history. Repeat in English and Spanish with zero console warnings/errors.

- [ ] **Step 10: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  src/active-session.js src/storage.js src/app.js src/i18n.js styles.css \
  tests/active-session.test.js tests/storage.test.js tests/app-state.test.js \
  tests/app-smoke.test.js tests/i18n.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Resume interrupted practice sessions"
```

---

### Task 7: Deploy Only the Verified Runtime to GitHub Pages

**Files:**
- Create: `.github/workflows/pages.yml`
- Create: `tests/pages-workflow.test.js`
- Modify: `scripts/serve-options.mjs`
- Modify: `scripts/serve.mjs`
- Modify: `tests/serve.test.js`
- Modify: `package.json`
- Modify: `tests/release-audit.test.js`

**Interfaces:**
- Produces: `npm run serve:dist`, serving only a previously built `dist/` root on loopback.
- Produces: a GitHub Pages workflow that runs tests, builds `dist/`, uploads only `dist/`, and deploys after build success.
- Deployment URL: `https://jeffreythepea.github.io/examen-practico-de-conducir/`.

- [ ] **Step 1: Write failing server-root and workflow tests**

Extend server-option tests to require:

```js
assert.equal(parseServerOptions([]).root, 'project');
assert.equal(parseServerOptions(['--root', 'dist']).root, 'dist');
assert.throws(() => parseServerOptions(['--root', '..']), /root/i);
assert.throws(() => parseServerOptions(['--root', '/tmp']), /root/i);
```

Create `tests/pages-workflow.test.js` to read `.github/workflows/pages.yml` and require:

```js
assert.match(workflow, /push:[\s\S]*branches:[\s\S]*main/);
assert.match(workflow, /npm ci/);
assert.match(workflow, /npm run release:check/);
assert.match(workflow, /actions\/upload-pages-artifact@v4/);
assert.match(workflow, /path:\s*dist/);
assert.match(workflow, /actions\/deploy-pages@v4/);
assert.match(workflow, /pages:\s*write/);
assert.match(workflow, /id-token:\s*write/);
assert.doesNotMatch(workflow, /path:\s*['"]?\.[/'"]?\s*$/m);
```

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/serve.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/pages-workflow.test.js
```

Expected: FAIL because `--root dist` and the workflow do not exist.

- [ ] **Step 3: Add a constrained distribution-server root**

`parseServerOptions` accepts only `project` and `dist`; it never accepts arbitrary filesystem paths. `serve.mjs` resolves `dist` as `resolve(PROJECT_ROOT, 'dist')`, verifies it is a directory, then applies the existing realpath containment and dotfile rejection policy inside that root.

Add:

```json
"serve:dist": "npm run build:runtime && node scripts/serve.mjs --root dist"
```

Keep `serve` and `serve:lan` behavior unchanged. LAN serving continues to serve the project development root unless a future separately reviewed requirement changes it.

- [ ] **Step 4: Create the Pages workflow**

Create `.github/workflows/pages.yml` with this structure:

```yaml
name: Deploy verified runtime to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run release:check
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy verified runtime
        id: deployment
        uses: actions/deploy-pages@v4
```

The workflow must not generate provider audio, read secrets, or upload the repository root.

- [ ] **Step 5: Run local deployment tests**

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run release:check
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve:dist
```

Expected: release check PASS; the loopback server reports its URL; `manifest.webmanifest`, `offline-package.json`, optimized images, and ordinary gameplay load from `dist/`; `/tests/` and `/docs/` return 404.

- [ ] **Step 6: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  .github/workflows/pages.yml tests/pages-workflow.test.js \
  scripts/serve-options.mjs scripts/serve.mjs tests/serve.test.js \
  package.json tests/release-audit.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Deploy verified runtime to Pages"
```

- [ ] **Step 7: Enable GitHub Pages only after Jeffrey approves deployment**

Authenticate `gh`, configure the repository Pages source as GitHub Actions, push the approved commits, and watch the workflow. This changes external repository state and therefore requires Jeffrey's explicit approval at execution time.

After deployment, verify these exact public URLs return HTTPS 200:

```text
https://jeffreythepea.github.io/examen-practico-de-conducir/
https://jeffreythepea.github.io/examen-practico-de-conducir/manifest.webmanifest
https://jeffreythepea.github.io/examen-practico-de-conducir/offline-package.json
```

Verify a repository-only URL such as `/tests/app-state.test.js` returns 404.

---

### Task 8: Complete and Publish the Recorded Offline Audio Corpus

**Files:**
- Modify: `audio/**`
- Modify: `data/audio-manifest.json`
- Modify: `tests/release-audit.test.js`
- Modify: `tests/audio.test.js`
- Modify: `tests/runtime-package.test.js`
- Update checkpoint ledger: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: ignored recovery state `.superpowers/sdd/audio-expansion-recovery/audio-expansion/`.
- Produces: 324 validated MP3s covering 54 phrasings × 2 voices × 3 speeds.
- Produces: `recordedCorpusComplete === true` in `offline-package.json`.

- [ ] **Step 1: Add the failing release assertion for the full corpus**

Change the release audit from 180 to 324 and independently derive the complete Cartesian coverage from catalog phrasings, the two manifest voice IDs, and speeds `[0.75, 0.9, 1]`. For every record, continue to require a nonempty file, exact `integrity.bytes`, and exact SHA-256. Add:

```js
assert.equal(manifest.length, 324);
assert.equal(new Set(manifest.map(item => item.id)).size, 324);
assert.equal(requiredVariantKeys.size, 324);
assert.deepEqual(new Set(manifest.map(toVariantKey)), requiredVariantKeys);
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

```bash
node --test \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/audio.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/release-audit.test.js \
  /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-package.test.js
```

Expected: FAIL because the published production manifest still contains 180 records and the runtime package reports incomplete audio.

- [ ] **Step 3: Resume the exact approved ElevenLabs generation plan**

Run the existing generator with the Keychain-held credential injected only into the child process and both approved voices. The credential wrapper already exists in the task's approved execution-permission profile and is deliberately not duplicated in repository text. Its non-secret generator portion is:

```bash
node scripts/generate-audio.mjs --provider elevenlabs \
  --voice CwhRBWXzGAHq8TQ4Fs17 --voice EXAVITQu4vr4xnSDxMaL
```

At execution time, use the approved Keychain wrapper around that command; do not paste, print, log, or persist the credential and do not add a credential assignment example to any repository file.

Expected when provider access is available: reuse 180 production and 136 recovery clips, generate the remaining eight, validate all 324, then atomically replace production `audio/` and `data/audio-manifest.json`.

If the provider again returns 401 or a quota error, record the exact remaining variants in `.superpowers/sdd/progress.md`, leave production untouched, and continue all non-audio implementation work. Do not mark Release A ready, weaken the 324 assertion, synthesize substitute recordings, or spend money without Jeffrey's explicit approval.

- [ ] **Step 4: Verify the published corpus and offline eligibility**

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run build:runtime
```

Expected: 324 audio records and files validate; `dist/offline-package.json` has `recordedCorpusComplete: true`; total bytes include every MP3; no credential-shaped text exists.

- [ ] **Step 5: Perform a listening spot-check**

On Mac, play both voices for `c-pre-posicion` and `c-pre-cruce` at every generated speed. Confirm the exact Spanish text, no truncation, no silence, no corrupted file, and acceptable volume. Then run one session that reaches each command and verify Replay retains its exact phrasing, voice, and speed.

- [ ] **Step 6: Prepare Jeffrey's checkpoint commit**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  audio data/audio-manifest.json tests/audio.test.js \
  tests/release-audit.test.js tests/runtime-package.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add -f .superpowers/sdd/progress.md
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Publish complete offline audio corpus"
```

---

### Task 9: Document, Release-Audit, and Validate on iPad

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `tests/release-audit.test.js`
- Create: `.superpowers/sdd/offline-ipad-release-a-review.md`

**Interfaces:**
- Produces: location-independent install, update, backup-transfer, recovery, and development commands.
- Produces: final release evidence for automated gates and the physical iPad matrix.

- [ ] **Step 1: Write failing documentation audit assertions**

Require README and design documentation to state:

- The public HTTPS Pages URL.
- Safari **Add to Home Screen** installation.
- One explicit **Download for offline use** step.
- Full recorded audio is required for **Ready offline**.
- Safari and Home Screen progress may need backup/export and import transfer.
- Staged updates apply only from setup.
- iPadOS may evict cached website data under storage pressure.
- Browser speech is not the offline guarantee.
- `serve:lan` remains the only documented same-Wi-Fi development route.
- `serve:dist` is the loopback distribution-preview command.

Reject claims that offline storage is permanent or that the PWA is a native app.

- [ ] **Step 2: Run the release audit and verify failure**

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/release-audit.test.js
```

Expected: FAIL until documentation is updated.

- [ ] **Step 3: Update product and operator documentation**

In `README.md`, lead iPad users with the hosted URL and installation steps before local Mac serving. Keep absolute, location-independent terminal commands. Explain backup transfer, update status, cache restoration, and offline limits plainly.

In `docs/design.md`, record the active/staging/pointer architecture, runtime allowlist, storage schema 2, interrupted-session rule, and Release A acceptance evidence. In `CHANGELOG.md`, list user-visible offline installation, status, update, resume, and optimized-media changes without claiming a native app.

- [ ] **Step 4: Run every automated release gate**

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run release:check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir status --short
```

Expected: all tests PASS; runtime build succeeds; 324 recordings validate; credential scan covers repository and `dist/`; whitespace check is clean; status contains only intended Release A documentation/review changes.

- [ ] **Step 5: Execute the physical iPad acceptance matrix**

On Jeffrey's iPad in landscape:

1. Open the GitHub Pages URL in Safari.
2. Export any Safari progress that should be retained.
3. Add the app to the Home Screen and launch it standalone.
4. Import the Safari backup and verify settings and attempt counts.
5. Download the complete offline package and verify the exact size/progress UI.
6. Enable Airplane Mode, cold-launch, and complete a 15-command Mixed session with recorded audio and photographs.
7. Terminate during an unanswered command, relaunch, Resume, and confirm the interrupted command restarts unscored.
8. Return online, stage a new package version, remain on the current version during practice, and apply the update from setup.
9. Interrupt a staged download and verify the active version still works.
10. Verify English and Spanish status/install/recovery copy, touch targets, safe areas, replay, Show Spanish, feedback sounds, and zero Web Inspector warnings/errors.

- [ ] **Step 6: Record evidence and remaining limits**

Write `.superpowers/sdd/offline-ipad-release-a-review.md` with:

- Commit and deployed package version
- Public URL
- Runtime asset count and total bytes
- Original PNG total versus deployed WebP total
- Audio record/file count
- Automated test count and commands
- Each iPad matrix result
- Storage estimate and persistence result
- Browser/OS versions
- Any remaining manual or provider dependency

Do not mark Release A complete if any Airplane Mode, recorded-audio, resume, update rollback, or backup-transfer step fails.

- [ ] **Step 7: Prepare Jeffrey's final Release A commit and push**

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add \
  README.md CHANGELOG.md docs/design.md tests/release-audit.test.js
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir add -f \
  .superpowers/sdd/offline-ipad-release-a-review.md
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --cached --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir commit -m "Document offline iPad Release A"
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir push origin main
```

After GitHub Pages reports success, repeat a cold Airplane Mode launch from the Home Screen before declaring the release complete.
