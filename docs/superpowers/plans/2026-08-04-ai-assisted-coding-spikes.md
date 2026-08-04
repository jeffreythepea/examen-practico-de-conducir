# AI-Assisted Coding Spikes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run and compare one browser moving-road spike and one SwiftUI simulator spike without changing the production game.

**Architecture:** The experiments live under `experiments/` and remain excluded from the deterministic runtime package. A versioned lab record is the authoritative recovery and comparison ledger; the two technical spikes have separate implementation plans so either can be reviewed, stopped, or resumed independently.

**Tech Stack:** Browser-native ES modules, HTML/CSS/SVG, Node test runner, Swift 6, SwiftUI, AVFoundation, Xcode/iOS Simulator, XcodeGen.

## Global Constraints

- Read `AGENTS.md` before acting.
- Use the existing checkout at `/Users/jeffreypease/Projects/examen-practico-de-conducir`; do not clone over it.
- Inspect and preserve uncommitted work before any pull.
- Each implementation spike has a hard two-to-three-hour timebox.
- Production source, runtime packaging, service worker behavior, and GitHub Pages deployment remain unchanged.
- Commands and audio remain Spanish; every interface string exists in English and Spanish.
- Stable command, action, phrasing, surface, and provenance IDs never change.
- Credentials never enter Git, experimental browser files, or app resources.
- No spending or Apple Developer enrollment without Jeffrey's separate approval.
- Essential state must exist in tracked repository files, not only chat history or ignored files.
- Jeffrey authorizes checkpoint commits and pushes without another approval pause.

---

### Task 1: Establish the Shared Lab and Recovery Contract

**Files:**
- Create: `experiments/README.md`
- Create: `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`
- Create: `tests/experiment-isolation.test.js`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: approved design `docs/superpowers/specs/2026-08-04-ai-assisted-coding-spikes-design.md`
- Produces: one tracked recovery ledger used by both spike plans and an automated production-package isolation gate

- [ ] **Step 1: Write the failing isolation test**

Add `tests/experiment-isolation.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectRuntimeAssets } from '../scripts/runtime-package.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('experimental spikes remain outside the verified runtime package', async () => {
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
  const paths = await collectRuntimeAssets({ root: ROOT, catalog, audioManifest });

  assert.ok(paths.every(path => !path.startsWith('experiments/')));
  assert.ok(paths.every(path => !path.startsWith('docs/experiments/')));
});
```

- [ ] **Step 2: Run the isolation test**

Run:

```bash
node --test tests/experiment-isolation.test.js
```

Expected: PASS. This is a characterization gate, not a deliberately failing product test; it proves the existing allowlist already provides the required isolation.

- [ ] **Step 3: Create the experiment index**

Create `experiments/README.md` with:

```markdown
# Experimental Spikes

These projects are AI-assisted coding experiments, not production features.
They are excluded from the verified runtime package and GitHub Pages release.

- `moving-road-spike/`: browser-native moving junction comprehension drill
- `swiftui-spike/`: native catalog/audio proof for the iOS Simulator

Authoritative design, plans, progress, commands, and results are recorded in
`../docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`.

## Recovery on Jeffrey's Mac mini

1. Use `/Users/jeffreypease/Projects/examen-practico-de-conducir`.
2. Read `AGENTS.md`.
3. Run `git status -sb`; preserve uncommitted work.
4. Read the design, three implementation plans, and lab record.
5. Pull with `--ff-only` only when the checkout is safe.
```

- [ ] **Step 4: Create the lab template**

Create `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md` with these exact top-level sections:

```markdown
# AI-Assisted Coding Spikes Lab

## Recovery Snapshot

- Checkout: `/Users/jeffreypease/Projects/examen-practico-de-conducir`
- Current checkpoint: planning
- Current commit: recorded after this file is committed
- Working tree: recorded at every checkpoint
- Exact next task: Moving-road plan, Task 1
- Blocker: Full Xcode.app is absent; Swift CLI alone cannot run iOS Simulator

## Shared Rubric

For each spike record proof achieved, elapsed clock time, automated tests,
manual setup burden, human interventions, defects, reusable work, recovery
quality, model/account, delegated work, and visible token usage.

## Moving-Road Spike

### Checkpoints

### Final Result

## SwiftUI Spike

### Toolchain Preflight

### Checkpoints

### Final Result

## Comparison and Recommendation
```

- [ ] **Step 5: Record the planning checkpoint**

Append a dated entry to `.superpowers/sdd/progress.md` containing the design path, all three plan paths, current commit, next task, Xcode absence, and the lab path. Do not claim either spike has started.

- [ ] **Step 6: Verify and commit the shared contract**

Run:

```bash
node --test tests/experiment-isolation.test.js
npm test
git diff --check
git status --short
```

Expected: isolation test PASS, complete suite PASS, whitespace clean, and only the four intended Task 1 files are modified/untracked.

Commit:

```bash
git add experiments/README.md docs/experiments/2026-08-04-ai-assisted-spikes-lab.md tests/experiment-isolation.test.js .superpowers/sdd/progress.md docs/superpowers/plans/
git commit -m "Plan AI-assisted coding spike lab"
git push origin main
```

Immediately replace the lab's `Current commit` with the resulting commit in the next checkpoint rather than amending history.

---

### Task 2: Execute the Moving-Road Spike

**Files:**
- Follow exactly: `docs/superpowers/plans/2026-08-04-moving-road-spike.md`
- Update after every bounded task: `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`
- Update checkpoint: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: shared lab/recovery contract from Task 1
- Produces: tested browser proof committed and pushed independently of native work

- [ ] **Step 1: Record the timebox start**

Before editing spike code, record ISO start time, model/account, current commit, clean/dirty status, and the exact first task in the lab.

- [ ] **Step 2: Execute the moving-road plan**

Complete `docs/superpowers/plans/2026-08-04-moving-road-spike.md` in order. Stop when the elapsed implementation time reaches three hours even if later tasks remain.

- [ ] **Step 3: Record and publish the result**

Record completed scope, omitted scope, elapsed time, tests, browser evidence, interventions, defects, and exact next task. Commit and push the bounded result using the commit named in the moving-road plan.

---

### Task 3: Execute the SwiftUI Spike

**Files:**
- Follow exactly: `docs/superpowers/plans/2026-08-04-swiftui-spike.md`
- Update after every bounded task: `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`
- Update checkpoint: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: shared lab/recovery contract and the moving-road evidence
- Produces: either a tested simulator proof or a reproducible, timeboxed failure record

- [ ] **Step 1: Record the timebox start and run the toolchain preflight**

Record the ISO start time before running any toolchain command. Xcode
installation, component downloads, XcodeGen installation, and implementation
all count toward the same three-hour spike timebox.

Run:

```bash
test -d /Applications/Xcode.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -version
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun simctl list devices available
```

Current known result on 2026-08-04: `/Applications/Xcode.app` is absent and `xcode-select -p` points to `/Library/Developer/CommandLineTools`.

If Xcode remains absent, ask Jeffrey for the one unavoidable manual action:
install the current Xcode from the Mac App Store. Record download/install time
as setup burden inside the timebox. If the timebox expires before preflight
passes, stop the Swift spike and record a reproducible toolchain failure rather
than silently extending it.

- [ ] **Step 2: Record the successful toolchain boundary**

After the three preflight commands succeed, record Xcode version, available
iPad simulator, elapsed setup time, remaining timebox, model/account, current
commit, and exact first implementation task.

- [ ] **Step 3: Execute the SwiftUI plan**

Complete `docs/superpowers/plans/2026-08-04-swiftui-spike.md` in order. Stop at three implementation hours.

- [ ] **Step 4: Record and publish the result**

Record achieved proof or failure, elapsed setup and implementation time separately, tests, simulator evidence, interventions, defects, and exact next task. Commit and push the bounded result using the commit named in the Swift plan.

---

### Task 4: Compare the Two Spikes and Close the Lab

**Files:**
- Modify: `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: the final moving-road and SwiftUI lab entries
- Produces: descriptive comparison and a recommendation to continue neither, one, or both

- [ ] **Step 1: Complete the shared rubric**

For both spikes, fill every rubric field. Use `not visible` for unavailable token counts rather than estimating false precision.

- [ ] **Step 2: Write the comparison**

Write short findings under:

```markdown
### What the familiar web stack made easy
### What native tooling made difficult
### Where AI assistance was strongest
### Where human judgment remained essential
### Reusable artifacts
### Recommendation
```

Do not calculate a composite score.

- [ ] **Step 3: Run final safety verification**

Run:

```bash
node --test experiments/moving-road-spike/tests/*.test.js
npm test
npm run build:runtime
git diff --check
git status --short
```

Inspect `dist/offline-package.json` and verify no asset path begins with `experiments/` or `docs/experiments/`. Verify the production setup still displays the bilingual AI-voice disclosure.

- [ ] **Step 4: Commit and push the final comparison**

```bash
git add docs/experiments/2026-08-04-ai-assisted-spikes-lab.md .superpowers/sdd/progress.md
git commit -m "Compare AI-assisted coding spikes"
git push origin main
```
