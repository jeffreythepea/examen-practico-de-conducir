# Expanded Road Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the accepted six-second camera push-in from four-way junctions
to every appropriate photo-backed driving exercise while preserving all scoring,
target, audio, and static-fallback behavior.

**Architecture:** Replace the junction-specific motion domain with one generic
road-motion module containing a frozen, scene-keyed calibration registry. The app
owns one `roadMotion` lifecycle independent of surface family, while the spatial
and manoeuvre renderers wrap their photograph, SVG overlay, and target buttons in
one transformed scene using the selected calibration profile.

**Tech Stack:** Browser-native ES modules, semantic HTML, CSS custom properties
and keyframes, Node's built-in test runner.

## Global Constraints

- Motion applies only to photo-backed junction, roundabout, U-turn, overtaking,
  parking, and voluntary-stopping exercises.
- The existing Road movement setting controls every supported motion profile.
- Audio and motion start together; choices unlock when audio ends; motion may
  continue to the six-second endpoint; unanswered prompts then wait without
  scoring.
- Replaying audio never restarts or rewinds motion.
- Reduced-motion users and disabled/invalid motion profiles receive the existing
  static exercise.
- Use the browser-audited end calibrations: junction `1.06 / 50% 82%`;
  four-exit roundabout `1.03 / 50% 80%`; five-exit roundabout
  `1.03 / 50% 80%`; U-turn `1.05 / 50% 84%`; overtaking
  `1.18 / 54% 86%`; parking `1.06 / 65% 84%`; stopping
  `1.06 / 66% 84%`.
- Photograph, route overlay, restrictions, and target buttons always share one
  transformed coordinate system.
- Do not change command/action/phrasing IDs, accepted results, target geometry,
  scoring, session length, audio assets, Spanish text, or English text.
- Add no dependency, asset, network request, or credential.
- Tests gate every task. Run focused tests before the full suite.

---

### Task 1: Generic road-motion domain and calibration registry

**Files:**
- Create: `src/road-motion.js`
- Create: `tests/road-motion.test.js`
- Modify: `tests/runtime-package.test.js`

**Interfaces:**
- Consumes: a motion request `{ enabled, startedAt, sceneId }`.
- Produces:
  - `ROAD_APPROACH_MS: 6000`
  - `ROAD_MOTION_PHASES`
  - `ROAD_MOTION_PROFILES`
  - `roadMotionProfile(sceneId): Readonly<{ endScale, originX, originY }> | null`
  - `createRoadMotion({ enabled, startedAt, sceneId }): Readonly<object>`
  - `reduceRoadMotion(state, event): Readonly<object>`
  - `roadMotionView(state, now): Readonly<object>`

- [x] **Step 1: Write failing domain and registry tests**

Create `tests/road-motion.test.js` by retaining the existing lifecycle cases and
adding exact scene profile coverage:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD_APPROACH_MS,
  ROAD_MOTION_PROFILES,
  createRoadMotion,
  reduceRoadMotion,
  roadMotionProfile,
  roadMotionView
} from '../src/road-motion.js';

const EXPECTED = {
  'four-way-intersection-photo-v1': [1.06, 50, 82],
  'roundabout-four-photo-v1': [1.03, 50, 80],
  'roundabout-five-photo-v1': [1.03, 50, 80],
  'u-turn-photo-v1': [1.05, 50, 84],
  'overtaking-photo-v1': [1.18, 54, 86],
  'parallel-parking-gap-photo-v1': [1.06, 65, 84],
  'urban-roadside-photo-v1': [1.06, 66, 84]
};

test('road motion exposes every approved immutable scene calibration', () => {
  assert.equal(ROAD_APPROACH_MS, 6_000);
  assert.deepEqual(Object.keys(ROAD_MOTION_PROFILES).sort(), Object.keys(EXPECTED).sort());
  for (const [sceneId, values] of Object.entries(EXPECTED)) {
    const profile = roadMotionProfile(sceneId);
    assert.deepEqual([profile.endScale, profile.originX, profile.originY], values);
    assert.equal(Object.isFrozen(profile), true);
  }
  assert.equal(roadMotionProfile('unknown-photo-v1'), null);
});

test('motion view uses its scene profile without changing the six-second lifecycle', () => {
  const state = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: 'overtaking-photo-v1'
  });
  const end = roadMotionView(state, 7_000);
  assert.equal(end.progress, 1);
  assert.equal(end.scale, 1.18);
  assert.equal(end.endScale, 1.18);
  assert.deepEqual(end.origin, { x: 54, y: 86 });
});
```

Retain equivalent cases for locked/interactive/waiting/static phases,
`AUDIO_COMPLETED`, `APPROACH_ENDED`, `ANSWERED`, `FAILED`, replay-independent
state, frozen returns, and invalid timestamps.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/road-motion.test.js
```

Expected: FAIL because `src/road-motion.js` does not exist.

- [x] **Step 3: Implement the generic domain**

Move the lifecycle logic from `src/junction-motion.js` into
`src/road-motion.js`, rename public symbols from `JUNCTION_*` to `ROAD_*`, add
the exact frozen profile registry, and store `sceneId` in non-static state:

```js
export const ROAD_APPROACH_MS = 6_000;

export const ROAD_MOTION_PROFILES = deepFreeze({
  'four-way-intersection-photo-v1': { endScale: 1.06, originX: 50, originY: 82 },
  'roundabout-four-photo-v1': { endScale: 1.03, originX: 50, originY: 80 },
  'roundabout-five-photo-v1': { endScale: 1.03, originX: 50, originY: 80 },
  'u-turn-photo-v1': { endScale: 1.05, originX: 50, originY: 84 },
  'overtaking-photo-v1': { endScale: 1.18, originX: 54, originY: 86 },
  'parallel-parking-gap-photo-v1': { endScale: 1.06, originX: 65, originY: 84 },
  'urban-roadside-photo-v1': { endScale: 1.06, originX: 66, originY: 84 }
});

export function roadMotionProfile(sceneId) {
  return ROAD_MOTION_PROFILES[sceneId] ?? null;
}
```

`createRoadMotion` must return static motion when disabled or when `sceneId`
has no profile. `roadMotionView` must interpolate from `1` to the selected
profile's `endScale` and return:

```js
Object.freeze({
  phase,
  progress,
  scale,
  endScale: profile.endScale,
  origin: Object.freeze({ x: profile.originX, y: profile.originY }),
  locked,
  moving,
  elapsedMs,
  remainingMs
});
```

- [x] **Step 4: Update runtime packaging while retaining temporary compatibility**

Change `tests/runtime-package.test.js` to require `src/road-motion.js`.
Temporarily retain `src/junction-motion.js` and its test so the current app
remains green until Task 2 migrates every import and model property.

- [x] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/road-motion.test.js tests/runtime-package.test.js
npm test
```

Expected: all tests PASS.

- [x] **Step 6: Record the checkpoint**

Append the completed Task 1 interface, test count, and exact next task to
`.superpowers/sdd/progress.md`.

### Task 2: App-wide road-motion lifecycle

**Files:**
- Modify: `src/app.js`
- Delete after migration: `src/junction-motion.js`
- Modify: `tests/app-state.test.js`
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/surfaces.test.js`
- Delete after migration: `tests/junction-motion.test.js`
- Modify: `tests/runtime-package.test.js`

**Interfaces:**
- Consumes Task 1's `createRoadMotion`, `reduceRoadMotion`, and
  `roadMotionView`.
- Produces model property `roadMotion` and renderer option
  `{ motion: roadMotionView(...) }` for every supported photo scene.

- [x] **Step 1: Write failing app-state tests**

Replace junction-only assertions with table-driven coverage of the seven
supported scene IDs:

```js
for (const [surfaceId, sceneId] of SUPPORTED_MOTION_CASES) {
  test(`${surfaceId} starts road motion with its photo scene`, () => {
    const model = beginPromptForSurface(surfaceId, 1_000);
    assert.equal(model.roadMotion.sceneId, sceneId);
    assert.equal(model.roadMotion.phase, 'approaching-locked');
  });
}
```

Add cases proving:

- unsupported/non-photo surfaces keep `roadMotion === null`;
- Road movement Off and reduced motion remain static;
- initial audio failure clears motion and returns to the unscored retry screen;
- audio completion unlocks choices without requiring six seconds;
- `ROAD_APPROACH_ENDED` freezes at the endpoint;
- answer/timeout freezes current progress;
- replay retains the identical `roadMotion` object.

- [x] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test tests/app-state.test.js tests/app-smoke.test.js tests/surfaces.test.js
```

Expected: FAIL on the old `junctionMotion` property/imports and junction-only
eligibility.

- [x] **Step 3: Generalize app imports, state, and eligibility**

Replace all `junctionMotion` names in `src/app.js` with `roadMotion`. Import
Task 1's generic symbols. Replace `movingJunctionEnabled(command)` with:

```js
function roadMotionEnabled(surfaceModel) {
  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  return Boolean(
    state.settings.roadMovement
    && !reducedMotion
    && roadMotionProfile(surfaceModel?.geometry?.sceneId)
  );
}
```

Generate the surface before starting motion, then call:

```js
createRoadMotion({
  enabled: roadMotionEnabled(generated.model),
  startedAt: event.startedAt,
  sceneId: generated.model.geometry.sceneId
});
```

Rename `JUNCTION_APPROACH_ENDED` to `ROAD_APPROACH_ENDED`. Preserve all
existing audio, response, timer, failure, replay, and reveal semantics.
After the migration tests pass, delete `src/junction-motion.js` and
`tests/junction-motion.test.js`, and make `tests/runtime-package.test.js`
reject the obsolete source path.

- [x] **Step 4: Generalize render and animation-end binding**

Pass `roadMotionView(model.roadMotion, Date.now())` to both prompt and reveal
rendering. Bind once to:

```js
app.querySelector('.road-motion-scene[data-road-motion-running="true"]')
```

and dispatch `ROAD_APPROACH_ENDED` only when
`event.animationName === 'road-camera-push'`.

- [x] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/app-state.test.js tests/app-smoke.test.js tests/surfaces.test.js
npm test
```

Expected: all tests PASS.

- [x] **Step 6: Record the checkpoint**

Append Task 2 behavior, test count, and the renderer task as the exact next
step to `.superpowers/sdd/progress.md`.

### Task 3: Shared transformed scene for spatial and manoeuvre surfaces

**Files:**
- Modify: `src/spatial-surfaces.js`
- Modify: `src/manoeuvre-surfaces.js`
- Modify: `styles.css`
- Modify: `tests/spatial-surfaces.test.js`
- Modify: `tests/manoeuvre-surfaces.test.js`

**Interfaces:**
- Consumes renderer state
  `{ motion?: { phase, moving, scale, endScale, origin, elapsedMs } }`.
- Produces generic `.road-motion-stage`, `.road-motion-viewport`, and
  `.road-motion-scene` markup for every supported photo scene.

- [x] **Step 1: Write failing spatial renderer tests**

Add table-driven cases for junction, four-exit roundabout, and five-exit
roundabout. For each, assert the photograph, SVG route layer, and every target
button occur inside the same `.road-motion-scene`; result text remains outside
the clipped viewport; and no wrapper renders without `state.motion`.

Expected markup attributes:

```html
<div class="road-motion-scene"
     data-road-motion="approaching-interactive"
     data-road-motion-running="true"
     style="--road-motion-scale:1.11;--road-motion-end-scale:1.22;--road-motion-origin-x:50%;--road-motion-origin-y:80%;--road-motion-elapsed:3000ms">
```

- [x] **Step 2: Write failing manoeuvre renderer tests**

Add equivalent cases for U-turn, overtaking, parking, and stopping. Assert the
correct route and restriction drawings share the transformed scene with their
photo and controls. Assert reveal result/restriction labels remain outside the
viewport and readable.

- [x] **Step 3: Run renderer tests and verify RED**

Run:

```bash
node --test tests/spatial-surfaces.test.js tests/manoeuvre-surfaces.test.js
```

Expected: FAIL because only junctions support motion wrappers.

- [x] **Step 4: Add one small shared markup helper**

Create an internal `renderRoadMotionScene(sceneContents, motion)` helper in
each renderer (do not add a cross-module abstraction for two short template
functions). It must escape the phase, serialize only finite numeric values,
and return unwrapped contents if motion is absent.

Use this exact structure:

```js
return `<div class="road-motion-viewport">
  <div class="road-motion-scene"
    data-road-motion="${escapeAttribute(motion.phase)}"
    data-road-motion-running="${motion.moving === true}"
    style="--road-motion-scale:${Number(motion.scale)};--road-motion-end-scale:${Number(motion.endScale)};--road-motion-origin-x:${Number(motion.origin.x)}%;--road-motion-origin-y:${Number(motion.origin.y)}%;--road-motion-elapsed:${Number(motion.elapsedMs)}ms">
    ${sceneContents}
  </div>
</div>`;
```

The spatial stage and manoeuvre stage receive `road-motion-stage` only when
the wrapper exists.

- [x] **Step 5: Replace junction-specific CSS with generic CSS**

Rename selectors and keyframes to:

```css
.surface-stage.road-motion-stage { overflow: visible; border-radius: 1.25rem; }
.road-motion-viewport { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; }
.road-motion-scene {
  position: absolute;
  inset: 0;
  transform: scale(var(--road-motion-scale, 1));
  transform-origin: var(--road-motion-origin-x, 50%) var(--road-motion-origin-y, 82%);
}
.road-motion-scene[data-road-motion-running="true"] {
  animation-name: road-camera-push;
  animation-duration: 6000ms;
  animation-delay: calc(-1 * var(--road-motion-elapsed, 0ms));
  animation-timing-function: ease-in-out;
  animation-fill-mode: forwards;
}
@keyframes road-camera-push {
  from { transform: scale(1); }
  to { transform: scale(var(--road-motion-end-scale, var(--road-motion-scale, 1))); }
}
```

Set `--road-motion-end-scale` from the motion view's `endScale` (its `scale`
is the timeline-resolved current value). Preserve the existing reduced-motion
rule under the generic class names.

- [x] **Step 6: Run renderer, CSS, and full tests**

Run:

```bash
node --test tests/spatial-surfaces.test.js tests/manoeuvre-surfaces.test.js tests/surfaces.test.js
npm test
```

Expected: all tests PASS.

- [x] **Step 7: Record the checkpoint**

Append exact supported families, CSS class names, and test count to
`.superpowers/sdd/progress.md`.

### Task 4: Browser acceptance, release audit, and reversible handoff

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `.superpowers/sdd/progress.md`
- Test: `tests/release-audit.test.js`

**Interfaces:**
- Consumes the complete generic motion implementation.
- Produces a reviewable build with an explicit rollback record.

- [x] **Step 1: Add failing release-documentation assertions**

In `tests/release-audit.test.js`, require the design and changelog to state:

- Road movement covers all seven photo-backed driving scene families;
- motion lasts six seconds but answers unlock at audio completion;
- reduced-motion and Road movement Off remain static;
- scoring and target geometry do not change.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/release-audit.test.js
```

Expected: FAIL until the release documentation is updated.

- [x] **Step 3: Update design and changelog**

Add the accepted behavior to `docs/design.md` and the in-progress release
section in `CHANGELOG.md`. Keep both concise and do not claim native road
simulation or post-selection manoeuvre animation.

- [x] **Step 4: Run automated release gates**

Run:

```bash
npm test
npm run release:check
git diff --check
```

Expected:

- all tests PASS;
- release check PASS;
- diff check emits no output;
- the release check's credential audit finds no provider credential or
  credential-shaped repository text;
- bilingual AI-voice disclosure assertions remain green.

- [x] **Step 5: Run desktop browser acceptance**

Serve the verified build and exercise Road movement On and Off for:

1. junction;
2. four- and five-exit roundabouts;
3. U-turn;
4. overtaking;
5. parking;
6. voluntary stopping.

Verify each photo, route, restriction, and target stays registered during the
push-in; choices unlock when audio ends; no answer waits safely; replay does
not restart motion; reveal freezes at answer time.

- [ ] **Step 6: Run iPad landscape acceptance**

On physical iPad Safari, verify no target is clipped or displaced, scrolling
does not break the stage, Road movement Off is fully static, and reduced
motion is static. Only small origin calibration changes are permitted; do not
alter duration, lifecycle, IDs, geometry, scoring, or route semantics.

- [x] **Step 7: Record rollback and review checkpoint**

Record in `.superpowers/sdd/progress.md`:

- the pre-feature code rollback commit `7d85fa9`;
- the design checkpoint `db41db8`;
- final test/release counts;
- any remaining visual-only calibration notes;
- exact local/LAN review URL;
- that removing one registry profile reverts only that scene to static.

Stop for Jeffrey's visual review before any implementation commit or push.
