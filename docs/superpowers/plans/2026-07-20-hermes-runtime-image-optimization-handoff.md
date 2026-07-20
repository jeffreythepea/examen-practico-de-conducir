# Hermes Runtime Image Optimization Handoff

> **Executor:** Hermes Agent using Nemotron Ultra. Work test-first and return an uncommitted diff for primary-agent review.

**Goal:** Replace the 14 runtime PNG photograph references with visually equivalent WebP derivatives while preserving every scene ID, hotspot coordinate, aspect ratio, and provenance value.

**Architecture:** Source PNGs remain checked-in development assets. A deterministic Node/Sharp script generates same-dimension WebP runtime derivatives, and the two scene registries reference only those derivatives. This packet deliberately excludes service workers, offline caching, deployment, audio, storage, and application behavior.

**Tech Stack:** Node.js 20+, ES modules, Node test runner, Sharp 0.34.5.

## Starting State and Ownership

- Repository: `/Users/jeffreypease/Projects/examen-practico-de-conducir`
- Baseline branch: `main`
- Baseline commit: `b38c0c67d16e34a7f17f93f93895813f06caef87`
- The primary agent owns these untracked files; do not edit, stage, delete, or overwrite them:
  - `docs/superpowers/specs/2026-07-20-offline-readiness-native-roadmap-design.md`
  - `docs/superpowers/plans/2026-07-20-offline-ipad-release-a.md`
  - This handoff packet
- Prefer a separate worktree or clone at the baseline commit. If operating in the shared checkout, preserve all pre-existing changes.
- Do not use `git clean`, `git reset`, `git checkout --`, or any destructive command.
- Do not commit, push, open a pull request, or modify external state. Return an uncommitted diff for review.

## Project Invariants

- Run `npm test` before handoff.
- Commands and generated command audio remain Spanish.
- Every interface string remains bilingual; this task adds no interface copy.
- No credentials enter Git or browser-delivered files.
- Stable command, action, phrasing, surface, result, scene, and provenance IDs must not change.
- Do not change hotspot coordinates, response geometry, surface behavior, scoring, or accessibility behavior.
- Keep every source PNG. Add WebP derivatives; do not replace or delete the sources.
- Do not touch any file outside the explicit scope below.

## Allowed File Scope

**Create:**

- `scripts/optimize-runtime-images.mjs`
- `tests/runtime-images.test.js`
- `package-lock.json`
- `assets/driving/*.webp`
- `assets/precheck/*.webp`

**Modify:**

- `package.json`
- `.gitignore`
- `src/driving-scenes.js`
- `src/precheck-scenes.js`
- `tests/driving-scenes.test.js` only if an existing path assertion requires the new suffix
- `tests/precheck-scenes.test.js` only if an existing path assertion requires the new suffix

Anything else is out of scope. Stop and report rather than expanding scope.

## Required Interface

Create:

```js
optimizeRuntimeImages({ root, quality? })
```

It returns:

```js
Promise<ReadonlyArray<{
  source: string,
  output: string,
  sourceBytes: number,
  outputBytes: number
}>>
```

The records and returned array must be frozen. Paths are repository-relative and use `/` separators. Results are sorted by source path and contain one record per unique source photograph.

## Implementation Steps

- [ ] **Step 1: Establish the clean baseline**

Run:

```bash
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir status --short
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
```

Expected: the only pre-existing changes are the three planning documents named above; the existing suite reports 232 passing tests. If the baseline differs, report it before editing.

- [ ] **Step 2: Add the development dependency and ignores**

Run:

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir install --save-dev sharp@0.34.5
```

Expected: `package.json` gains `devDependencies.sharp`, `package-lock.json` is created, and Sharp is not imported by browser code.

Add these exact ignore entries without removing existing entries:

```gitignore
node_modules/
dist/
```

- [ ] **Step 3: Write the failing runtime-image test**

Create `tests/runtime-images.test.js`:

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
    assert.match(scene.asset, /\.webp$/, scene.id);
    const runtimePath = resolve(ROOT, scene.asset.replace(/^\.\//, ''));
    const sourcePath = runtimePath.replace(/\.webp$/, '.png');
    const [runtimeMeta, sourceMeta, runtimeStat, sourceStat] = await Promise.all([
      sharp(runtimePath).metadata(),
      sharp(sourcePath).metadata(),
      stat(runtimePath),
      stat(sourcePath)
    ]);
    assert.equal(runtimeMeta.width, sourceMeta.width, scene.id);
    assert.equal(runtimeMeta.height, sourceMeta.height, scene.id);
    assert.ok(runtimeStat.size < sourceStat.size * 0.6,
      `${scene.id} must shrink by at least 40%`);
  }
});
```

- [ ] **Step 4: Prove the test fails for the intended reason**

Run:

```bash
node --test /Users/jeffreypease/Projects/examen-practico-de-conducir/tests/runtime-images.test.js
```

Expected: FAIL because the scene registries still reference PNG assets. Do not weaken the assertion.

- [ ] **Step 5: Implement deterministic optimization**

Create `scripts/optimize-runtime-images.mjs`:

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

Add this script to `package.json` without changing existing scripts:

```json
"optimize:images": "node scripts/optimize-runtime-images.mjs"
```

- [ ] **Step 6: Generate derivatives and update references**

Run:

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run optimize:images
```

Expected: `Optimized 14 runtime photographs.` and exactly 14 new WebP files.

Change only the `asset` suffixes in `src/driving-scenes.js` and `src/precheck-scenes.js` from `.png` to `.webp`. Preserve each path's existing leading-`./` style. Do not change any other field.

- [ ] **Step 7: Run focused regression tests**

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

Expected: all focused tests PASS. If a 40% reduction assertion fails, report the specific asset and both byte counts; do not lower quality or the threshold without review.

- [ ] **Step 8: Run the full gate and scope audit**

Run:

```bash
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir status --short
```

Expected: 233 passing tests, clean whitespace, and changes restricted to the allowed file scope plus the three pre-existing planning documents.

- [ ] **Step 9: Return evidence for primary-agent review**

Do not perform the visual acceptance checkpoint and do not commit. Return:

1. A concise implementation summary.
2. Exact focused and full-test results.
3. `git status --short`.
4. A 14-row table with source path, source bytes, WebP bytes, and reduction percentage.
5. Any warnings or unexpected behavior.
6. This explicit line: **Visual comparison at 1024×768 remains pending primary-agent review.**

The primary agent will inspect the diff, rerun tests, and conduct the visual comparison before accepting the work.

## Stop Conditions

Stop and report without improvising if:

- The baseline has changes beyond the three planning documents.
- Dependency installation requires modifying files outside the allowed scope.
- Any source PNG is missing.
- The optimizer produces anything other than 14 unique derivatives.
- Any derivative changes width or height.
- Any derivative fails the 40% reduction threshold at quality 82.
- Any existing test fails.
- A required fix would change coordinates, IDs, provenance, runtime behavior, or another subsystem.
