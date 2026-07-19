# Stage 2 Action Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan one task at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Stage 1's arbitrary response choices with reproducible, landscape-iPad spatial, vehicle-control, and Toyota Yaris Hybrid 2019 precheck surfaces that preserve the existing training engine and stable IDs.

**Architecture:** Pure seeded generators produce serializable `SurfaceModel` objects; focused renderers convert those models into SVG/HTML controls and return normalized result IDs. The app stores the model's version and seed with each attempt, while the existing training engine continues to own selection, timing, scoring, mastery, and summaries.

**Tech Stack:** Static HTML/CSS, browser-native ES modules, inline SVG, Node.js 20 built-in test runner, JSON data, no runtime dependencies.

## Global Constraints

- Primary device is an iPad in landscape orientation; Mac pointer and keyboard equivalents remain supported.
- The driver's vehicle enters spatial diagrams from the bottom and travels upward.
- Tapping is the primary response; route tracing and road simulation remain deferred.
- Commands and generated command audio remain Spanish.
- Every interface string exists in English and Spanish.
- Existing command, action, phrasing, surface, and provenance IDs remain stable.
- API keys and provider credentials never enter Git or browser-delivered files.
- Interactive targets are at least 44 by 44 CSS pixels and never overlap.
- Unsupported or invalid surfaces are excluded with diagnostics; they never fall back silently to unrelated choices.
- Tests gate every task. Jeffrey reviews and commits; collaborators do not stage, commit, push, or publish.

---

## File Structure

**Create:**

- `src/surface-model.js` — validates immutable serializable surface models and derives deterministic seeded randomness.
- `src/surface-geometry.js` — driver-relative points, target boxes, overlap checks, restrained angle variation, and SVG path helpers.
- `src/spatial-surfaces.js` — junction and four/five-exit roundabout generators/renderers.
- `src/manoeuvre-surfaces.js` — U-turn, overtaking, parking, and voluntary-stopping generators/renderers.
- `src/control-surfaces.js` — steering-wheel centering and Yaris securing-sequence models/renderers.
- `src/yaris-surfaces.js` — original Yaris schematic definitions, stable hotspots, locate/operate behavior, and renderers.
- `tests/surface-model.test.js`
- `tests/surface-geometry.test.js`
- `tests/spatial-surfaces.test.js`
- `tests/manoeuvre-surfaces.test.js`
- `tests/control-surfaces.test.js`
- `tests/yaris-surfaces.test.js`

**Modify:**

- `src/surfaces.js` — registry/orchestration only; retain honest Stage 1 semantic exceptions.
- `src/app.js` — create one model per trial, preserve it through replay/reveal, and pass provenance to scoring.
- `src/training.js` — persist surface version, seed, expected target, and selected target.
- `src/storage.js` — validate the additive Stage 2 attempt fields without rejecting compatible Stage 1 saves.
- `src/i18n.js` — localized surface instructions, errors, and reveal labels.
- `data/commands.json` — map eligible commands to explicit Stage 2 surface IDs while retaining stable command/action/phrasing IDs.
- `styles.css` — landscape stage, road/control targets, reveal paths, and reduced-motion behavior.
- `tests/surfaces.test.js`, `tests/app-state.test.js`, `tests/app-smoke.test.js`, `tests/training.test.js`, `tests/storage.test.js`, `tests/i18n.test.js`, `tests/release-audit.test.js`
- `README.md`, `CHANGELOG.md`, `docs/design.md`

---

### Task 1: Serializable Seeded Surface Contract

**Files:**
- Create: `src/surface-model.js`
- Create: `tests/surface-model.test.js`
- Modify: `src/training.js`
- Modify: `src/storage.js`
- Modify: `tests/training.test.js`
- Modify: `tests/storage.test.js`

**Interfaces:**
- Consumes: command `{ id, actionId, acceptedResult, surfaceId }` and a 32-bit unsigned seed.
- Produces: `seededRandom(seed): () => number`, `createSurfaceModel(input): Readonly<SurfaceModel>`, and `validateSurfaceModel(model): true`.
- `SurfaceModel` is `{ id, family, version, seed, expectedResult, targets, geometry, meta }`; each target is `{ id, resultId, x, y, width, height, kind }`.

- [ ] **Step 1: Write the failing model tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceModel, seededRandom, validateSurfaceModel } from '../src/surface-model.js';

test('seeded randomness is reproducible and seed-sensitive', () => {
  const first = seededRandom(42);
  const second = seededRandom(42);
  const other = seededRandom(43);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  assert.notEqual(seededRandom(42)(), other());
});

test('surface models are immutable, serializable, and require their expected target', () => {
  const model = createSurfaceModel({
    id: 'roundabout-v2:42', family: 'roundabout', version: 2, seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [{ id: 'exit-3', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit' }],
    geometry: { entry: 'bottom', exits: 4 }, meta: {}
  });
  assert.equal(validateSurfaceModel(model), true);
  assert.equal(Object.isFrozen(model), true);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  assert.throws(() => createSurfaceModel({ ...model, targets: [] }), /expected target/i);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/surface-model.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/surface-model.js`.

- [ ] **Step 3: Implement the contract and deterministic PRNG**

```js
export function seededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Surface seed must be uint32');
  let state = seed || 0x6d2b79f5;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSurfaceModel(input) {
  const model = structuredClone(input);
  validateSurfaceModel(model);
  for (const target of model.targets) Object.freeze(target);
  Object.freeze(model.targets);
  Object.freeze(model.geometry);
  Object.freeze(model.meta);
  return Object.freeze(model);
}

export function validateSurfaceModel(model) {
  if (!model || typeof model !== 'object') throw new Error('Invalid surface model');
  for (const field of ['id', 'family', 'expectedResult']) {
    if (typeof model[field] !== 'string' || !model[field]) throw new Error(`Invalid surface ${field}`);
  }
  if (!Number.isSafeInteger(model.version) || model.version < 1) throw new Error('Invalid surface version');
  if (!Number.isInteger(model.seed) || model.seed < 0 || model.seed > 0xffffffff) throw new Error('Invalid surface seed');
  if (!Array.isArray(model.targets) || !model.targets.some(target => target.resultId === model.expectedResult)) {
    throw new Error('Surface model is missing its expected target');
  }
  for (const target of model.targets) validateTarget(target);
  return true;
}

function validateTarget(target) {
  for (const field of ['id', 'resultId', 'kind']) {
    if (typeof target[field] !== 'string' || !target[field]) throw new Error(`Invalid target ${field}`);
  }
  for (const field of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(target[field])) throw new Error(`Invalid target ${field}`);
  }
}
```

- [ ] **Step 4: Add optional Stage 2 provenance to scored attempts**

Extend `scoreAttempt` so an input containing `surfaceModel` adds:

```js
surfaceVersion: input.surfaceModel.version,
surfaceSeed: input.surfaceModel.seed,
expectedResult: input.surfaceModel.expectedResult,
selectedTargetId: input.selectedTargetId ?? null
```

Extend storage validation only when these fields are present:

```js
if (attempt.surfaceVersion !== undefined && (!Number.isSafeInteger(attempt.surfaceVersion) || attempt.surfaceVersion < 1)) throw new Error(`Invalid ${path}.surfaceVersion`);
if (attempt.surfaceSeed !== undefined && (!Number.isInteger(attempt.surfaceSeed) || attempt.surfaceSeed < 0 || attempt.surfaceSeed > 0xffffffff)) throw new Error(`Invalid ${path}.surfaceSeed`);
if (attempt.expectedResult !== undefined) requireNonEmptyString(attempt.expectedResult, `${path}.expectedResult`);
if (attempt.selectedTargetId !== undefined && attempt.selectedTargetId !== null) requireNonEmptyString(attempt.selectedTargetId, `${path}.selectedTargetId`);
```

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/surface-model.test.js tests/training.test.js tests/storage.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Jeffrey review checkpoint**

Report the model fields, additive storage compatibility, test counts, and proposed commit message `Add seeded Stage 2 surface model` without staging or committing.

---

### Task 2: Driver-Relative Geometry Utilities

**Files:**
- Create: `src/surface-geometry.js`
- Create: `tests/surface-geometry.test.js`

**Interfaces:**
- Consumes: seeded RNG and normalized 0–100 coordinates.
- Produces: `polarPoint`, `targetBox`, `boxesOverlap`, `assertNonOverlappingTargets`, `jitterAngle`, and `svgRoadPath`.

- [ ] **Step 1: Write failing geometry tests**

```js
test('target boxes meet the 44px-equivalent normalized minimum and reject overlap', () => {
  const a = targetBox('a', 'turn-left', 20, 50, { stageWidth: 400, stageHeight: 300 });
  const b = targetBox('b', 'turn-right', 80, 50, { stageWidth: 400, stageHeight: 300 });
  assert.ok(a.width >= 11);
  assert.ok(a.height >= 14.67);
  assert.equal(boxesOverlap(a, b), false);
  assert.throws(() => assertNonOverlappingTargets([a, { ...a, id: 'copy' }]), /overlap/i);
});

test('angle jitter stays inside its restrained bound', () => {
  const values = [0, 0.5, 0.999].map(value => jitterAngle(90, 8, () => value));
  assert.deepEqual(values.map(Math.round), [82, 90, 98]);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/surface-geometry.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement bounded geometry helpers**

```js
export function polarPoint(cx, cy, radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return { x: cx + Math.cos(radians) * radius, y: cy + Math.sin(radians) * radius };
}

export function jitterAngle(base, maximum, rng) {
  return base + (rng() * 2 - 1) * maximum;
}

export function targetBox(id, resultId, x, y, { stageWidth, stageHeight, kind = 'road-exit' }) {
  return { id, resultId, x, y, width: 4400 / stageWidth, height: 4400 / stageHeight, kind };
}

export function boxesOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height;
}

export function assertNonOverlappingTargets(targets) {
  for (let left = 0; left < targets.length; left += 1) {
    for (let right = left + 1; right < targets.length; right += 1) {
      if (boxesOverlap(targets[left], targets[right])) throw new Error(`Targets overlap: ${targets[left].id}, ${targets[right].id}`);
    }
  }
  return true;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/surface-geometry.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Jeffrey review checkpoint**

Report coordinate conventions, touch-size calculation, overlap behavior, and proposed commit `Add driver-relative surface geometry`.

---

### Task 3: Junction and Roundabout Surfaces

**Files:**
- Create: `src/spatial-surfaces.js`
- Create: `tests/spatial-surfaces.test.js`
- Modify: `src/surfaces.js`
- Modify: `tests/surfaces.test.js`
- Modify: `data/commands.json`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `generateSpatialSurface(command, seed, options?)` with action IDs `turn-left`, `turn-right`, and `roundabout-exit-1` through `roundabout-exit-5`.
- Produces: `generateSpatialSurface`, `renderSpatialSurface(model, locale, state)`, and registry IDs `junction-v2`, `roundabout-v2`.

- [ ] **Step 1: Write failing distribution and ordering tests**

```js
test('roundabouts normally have four exits and five-exit maps do not imply exit five', () => {
  const counts = { four: 0, five: 0, fiveWithNonFiveTarget: 0 };
  for (let seed = 1; seed <= 500; seed += 1) {
    const action = `roundabout-exit-${(seed % 4) + 1}`;
    const model = generateSpatialSurface(command(action), seed);
    counts[model.geometry.exitCount === 4 ? 'four' : 'five'] += 1;
    if (model.geometry.exitCount === 5 && action !== 'roundabout-exit-5') counts.fiveWithNonFiveTarget += 1;
  }
  assert.ok(counts.four > counts.five * 2);
  assert.ok(counts.fiveWithNonFiveTarget > 0);
  assert.equal(generateSpatialSurface(command('roundabout-exit-5'), 99).geometry.exitCount, 5);
});

test('entry stays at bottom and exit order follows counterclockwise circulation from the driver entry', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17, { exitCount: 4 });
  assert.equal(model.geometry.entry, 'bottom');
  assert.deepEqual(model.targets.map(target => target.resultId), [
    'roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-exit-4'
  ]);
  assertNonOverlappingTargets(model.targets);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/spatial-surfaces.test.js`

Expected: FAIL because `generateSpatialSurface` is unavailable.

- [ ] **Step 3: Implement compatible seeded generation**

Use fixed driver-relative ordinal bases and at most ±8 degrees of jitter:

```js
const FOUR_EXIT_ANGLES = Object.freeze([-18, -90, -162, -228]);
const FIVE_EXIT_ANGLES = Object.freeze([-12, -55, -98, -141, -184]);

export function generateSpatialSurface(command, seed, options = {}) {
  if (command.surfaceId === 'junction-v2') return generateJunction(command, seed);
  if (command.surfaceId !== 'roundabout-v2') throw new Error(`Unsupported spatial surface: ${command.surfaceId}`);
  const rng = seededRandom(seed);
  const ordinal = Number(command.acceptedResult.slice('roundabout-exit-'.length));
  const exitCount = options.exitCount ?? (ordinal === 5 || rng() < 0.2 ? 5 : 4);
  if (ordinal > exitCount) throw new Error('Requested roundabout exit is unavailable');
  const angles = (exitCount === 5 ? FIVE_EXIT_ANGLES : FOUR_EXIT_ANGLES).map(angle => jitterAngle(angle, 8, rng));
  const targets = angles.map((angle, index) => roadExitTarget(index + 1, angle));
  assertNonOverlappingTargets(targets);
  return createSurfaceModel({
    id: `roundabout-v2:${seed}`, family: 'roundabout', version: 2, seed,
    expectedResult: command.acceptedResult, targets,
    geometry: { entry: 'bottom', exitCount, angles }, meta: { commandId: command.id }
  });
}
```

`generateJunction` creates only the left and right outgoing-road targets for the corresponding command; it does not expose `steering-straight` or `change-direction` as unrelated junction distractors.

- [ ] **Step 4: Render unlabeled roads and normalized target buttons**

`renderSpatialSurface` returns one `.surface-stage` containing an aria-hidden SVG road drawing and one localized, visually unlabeled button per model target:

```html
<button class="road-target" type="button" data-target="exit-2" data-result="roundabout-exit-2" aria-label="Select this road"></button>
```

When `state.reveal` is true, add an SVG path with `data-correct-route`, a localized visible result label, and `aria-current="true"` on the correct target. When disabled, every target receives `disabled`.

- [ ] **Step 5: Export explicit v2 surface IDs without activating the legacy command renderer**

Export `junction-v2` and `roundabout-v2` from the new spatial module, but leave `data/commands.json` and the legacy `SUPPORTED_SURFACE_IDS` registry unchanged in this task. The current `renderSurface(command, options, locale)` interface has no retained seed/model and cannot activate v2 safely. Task 7 migrates `c-der`, `c-izq`, and `c-rot1` through `c-rot5` atomically with the new model-aware registry. Add a regression proving the production catalog remains renderable throughout this intermediate task.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/spatial-surfaces.test.js tests/surfaces.test.js tests/catalog.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Intermediate rendering check and Jeffrey review checkpoint**

Inspect generated v2 markup at the equivalent 1024×768 and 1366×768 stage sizes and verify entry at bottom, subtle variation, four/five-exit behavior, target sizing, disabled state, and reveal layout. Add a regression proving every current production command remains supported and renderable while activation is deferred. The real browser checks for tap behavior, replay lock, wrong-answer reveal, and console errors occur in Task 7 after the model-aware app path activates v2 atomically. Report findings and proposed commit `Add junction and roundabout action surfaces`.

---

### Task 4: Action-Matched Road Manoeuvres

**Files:**
- Create: `src/manoeuvre-surfaces.js`
- Create: `tests/manoeuvre-surfaces.test.js`
- Modify: `src/surfaces.js`
- Modify: `data/commands.json`
- Modify: `styles.css`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Consumes actions `change-direction`, `overtake`, `park`, and `voluntary-stop`.
- Produces `generateManoeuvreSurface(command, seed)` and `renderManoeuvreSurface(model, locale, state)` under explicit IDs `u-turn-v1`, `overtake-v1`, `parking-v1`, `stopping-v1`.

- [ ] **Step 1: Write failing scenario tests**

```js
test('manoeuvre surfaces expose only defensible spatial targets', () => {
  const park = generateManoeuvreSurface(command('park', 'parking-v1'), 10);
  assert.equal(park.expectedResult, 'park');
  assert.ok(park.targets.some(target => target.kind === 'legal-space' && target.resultId === 'park'));
  assert.ok(park.targets.some(target => target.kind === 'illegal-space'));

  const stop = generateManoeuvreSurface(command('voluntary-stop', 'stopping-v1'), 11);
  assert.ok(stop.targets.some(target => target.kind === 'legal-stop'));
  assert.ok(stop.targets.some(target => target.kind === 'restricted-stop'));
});

test('the same seed reproduces the complete manoeuvre model', () => {
  assert.deepEqual(
    generateManoeuvreSurface(command('overtake', 'overtake-v1'), 88),
    generateManoeuvreSurface(command('overtake', 'overtake-v1'), 88)
  );
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/manoeuvre-surfaces.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement four bounded scenario generators**

Each generator chooses from a small audited template set and applies only restrained positional jitter. Each template declares the target semantics explicitly:

```js
const STOPPING_TEMPLATES = Object.freeze([
  {
    id: 'urban-curb-clear',
    features: ['curb', 'driveway', 'crosswalk'],
    targets: [
      { id: 'clear-curb', resultId: 'voluntary-stop', kind: 'legal-stop', x: 78, y: 34 },
      { id: 'driveway', resultId: 'blocked-access', kind: 'restricted-stop', x: 78, y: 57 },
      { id: 'crosswalk', resultId: 'crosswalk', kind: 'restricted-stop', x: 50, y: 18 }
    ]
  }
]);
```

Do not encode legal claims in a free-form procedural generator. Every accepted and rejected location must come from an audited template that tests name directly.

- [ ] **Step 4: Render scenario-specific SVG with localized reveal copy**

Add English/Spanish strings for `surface.selectRoad`, `surface.selectSpace`, `surface.correctRoute`, `surface.correctControl`, and each visible restricted-location explanation. Pre-response targets remain visually unlabeled.

- [ ] **Step 5: Export IDs and preserve atomic activation**

Export `u-turn-v1`, `overtake-v1`, `parking-v1`, and `stopping-v1` from the new module, but leave the production catalog and legacy registry unchanged until Task 7 can activate them with the model-aware renderer. Task 7 migrates only `c-sentido`, `c-adel`, `c-est`, and `c-parada`. Retain `option-grid-v1` for `c-adapte`, `c-detencion`, and `c-final` as declared semantic exceptions, and add the three-exception registry assertion during Task 7 activation.

- [ ] **Step 6: Run tests**

Run: `node --test tests/manoeuvre-surfaces.test.js tests/surfaces.test.js tests/i18n.test.js tests/catalog.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 7: Jeffrey review checkpoint**

Provide representative seeded layouts for each scenario, call out that stopping legality is provisional, list the three semantic exceptions, and propose commit `Add action-matched road manoeuvres`.

---

### Task 5: Steering and Vehicle-Securing Controls

**Files:**
- Create: `src/control-surfaces.js`
- Create: `tests/control-surfaces.test.js`
- Modify: `src/surfaces.js`
- Modify: `src/app.js`
- Modify: `data/commands.json`
- Modify: `styles.css`
- Modify: `src/i18n.js`

**Interfaces:**
- Consumes actions `steering-straight` and `secure-vehicle`.
- Produces `generateControlSurface(command, seed)`, `reduceControlResponse(model, responseState, event)`, and `renderControlSurface(model, responseState, locale, disabled)`.
- Multi-step response state is trial-local and is not scored until `complete === true`.

- [ ] **Step 1: Write failing reducer tests**

```js
test('wheel centering completes only inside the centered tolerance', () => {
  const model = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 4);
  assert.equal(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 18 }).complete, false);
  assert.deepEqual(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 2 }), {
    complete: true, selectedResult: 'steering-straight', selectedTargetId: 'wheel-center', wheelDegrees: 2
  });
});

test('secure vehicle requires the declared Yaris sequence and rejects reversed steps', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  const first = reduceControlResponse(model, {}, { type: 'activate', targetId: model.meta.sequence[0] });
  assert.equal(first.complete, false);
  const complete = reduceControlResponse(model, first, { type: 'activate', targetId: model.meta.sequence[1] });
  assert.equal(complete.selectedResult, 'secure-vehicle');
  assert.equal(reduceControlResponse(model, {}, { type: 'activate', targetId: model.meta.sequence[1] }).incorrect, true);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/control-surfaces.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement model and reducer with explicit sequence data**

The securing sequence lives in one named constant derived from the Yaris reference, not in renderer event handlers:

```js
export const YARIS_SECURE_SEQUENCE = Object.freeze(['parking-brake', 'selector-park']);
export const WHEEL_CENTER_TOLERANCE_DEGREES = 5;
```

The sequence is grounded in `PZ49X-52A96-EN`, page 236: with the brake pedal depressed, set the parking brake and then shift the selector to P. Page 269 identifies the hand-operated parking-brake lever. If the practical instructor requires additional steps for the exam response, revise the declared sequence after the lesson rather than guessing.

- [ ] **Step 4: Render accessible controls and integrate incomplete responses**

The wheel is a native range input with a visible wheel graphic. The securing controls are native buttons with `aria-pressed`. `src/app.js` routes `data-control-event` through `reduceControlResponse`; incomplete responses rerender without timing/scoring, completed or explicitly incorrect responses enter the existing reveal flow.

- [ ] **Step 5: Export IDs and preserve atomic activation**

Export `wheel-center-v1` and `secure-yaris-v1`, but leave `c-volante`, `c-inmov`, the production catalog, and legacy registry unchanged until Task 7 activates the model-aware response path. The verified manual sequence supports migrating both commands in Task 7; if later evidence invalidates it, exclude `c-inmov` with a diagnostic instead of guessing.

- [ ] **Step 6: Run tests and browser check**

Run: `node --test tests/control-surfaces.test.js tests/app-state.test.js tests/surfaces.test.js tests/i18n.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

On landscape iPad sizing, verify the wheel can be centered without edge gestures, controls remain locked during replay, incomplete sequences do not score, and focus stays on the active control.

- [ ] **Step 7: Jeffrey review checkpoint**

Report the confirmed Yaris sequence or explicit exclusion, interaction results, and proposed commit `Add action-matched vehicle controls`.

---

### Task 6: Original Yaris Precheck Schematics

**Files:**
- Create: `src/yaris-surfaces.js`
- Create: `tests/yaris-surfaces.test.js`
- Modify: `src/surfaces.js`
- Modify: `data/commands.json`
- Modify: `styles.css`
- Modify: `src/i18n.js`
- Modify: `references/fermin-atomic-command-inventory.md`
- Modify: `README.md`

**Interfaces:**
- Consumes current `yaris-manual-v1-*` commands and stable command IDs.
- Produces `YARIS_DIAGRAMS`, `generateYarisSurface(command, seed)`, `reduceYarisResponse(model, state, event)`, and `renderYarisSurface(model, state, locale, disabled)`.
- Diagram IDs: `yaris-dashboard-v2`, `yaris-climate-v2`, `yaris-door-v2`, `yaris-body-v2`, `yaris-engine-bay-v2`.

- [ ] **Step 1: Write failing coverage and hotspot tests**

```js
test('every precheck command maps to one stable non-overlapping Yaris hotspot', () => {
  for (const command of precheckCommands) {
    const model = generateYarisSurface(command, 7);
    assert.equal(model.meta.commandId, command.id);
    assert.ok(model.targets.some(target => target.resultId === command.acceptedResult));
    assertNonOverlappingTargets(model.targets);
  }
});

test('locate and operate commands have explicit response modes', () => {
  assert.equal(generateYarisSurface(byId('c-pre-bateria'), 1).meta.responseMode, 'locate');
  assert.equal(generateYarisSurface(byId('c-pre-desempanar-delantera'), 1).meta.responseMode, 'operate');
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/yaris-surfaces.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Define original schematic topology and cited hotspots**

Each diagram definition contains original SVG primitives plus stable normalized hotspots and a reference citation:

```js
export const YARIS_DIAGRAMS = Object.freeze({
  'yaris-engine-bay-v2': {
    viewBox: '0 0 400 300',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, engine compartment diagram',
    hotspots: {
      'engine-oil': { x: 29, y: 58, width: 12, height: 16, kind: 'fluid-location' },
      coolant: { x: 69, y: 38, width: 12, height: 16, kind: 'fluid-location' },
      'washer-fluid': { x: 82, y: 68, width: 12, height: 16, kind: 'fluid-location' }
    }
  }
});
```

Use this complete command-to-hotspot contract; coordinates are normalized percentages within the original schematic and must retain the current v1 location unless the cited manual contradicts it:

| Diagram | Command | Hotspot ID | Mode |
| --- | --- | --- | --- |
| `yaris-engine-bay-v2` | `c-pre-aceite` | `engine-oil` | locate |
| `yaris-engine-bay-v2` | `c-pre-refrigerante` | `coolant` | locate |
| `yaris-body-v2` | `c-pre-bateria` | `battery-under-rear-right-seat` | locate |
| `yaris-body-v2` | `c-pre-capo` | `bonnet-release` | operate |
| `yaris-dashboard-v2` | `c-pre-combustible` | `fuel-gauge` | locate |
| `yaris-dashboard-v2` | `c-pre-temperatura` | `temperature-gauge` | locate |
| `yaris-door-v2` | `c-pre-bloquear-elevalunas` | `window-lock` | operate |
| `yaris-door-v2` | `c-pre-desbloquear-elevalunas` | `window-lock` | operate |
| `yaris-climate-v2` | `c-pre-desempanar-delantera` | `front-demist` | operate |
| `yaris-climate-v2` | `c-pre-desempanar-trasera` | `rear-demist` | operate |
| `yaris-dashboard-v2` | `c-pre-largo-alcance` | `high-beam` | operate |
| `yaris-dashboard-v2` | `c-pre-niebla-delantera` | `front-fog` | operate |
| `yaris-dashboard-v2` | `c-pre-niebla-trasera` | `rear-fog` | operate |
| `yaris-body-v2` | `c-pre-maletero` | `boot-release` | operate |

Implement all five diagrams and every row in this table. Do not copy manual SVG, raster art, labels, or page layout.

The engine-bay diagram follows manual page 485. The 12-volt battery must not appear in the engine bay: manual page 493 places it beneath the rear-right seat, represented on `yaris-body-v2` by hotspot `battery-under-rear-right-seat`.

- [ ] **Step 4: Implement locate/operate reducers and renderers**

Locate mode completes on one hotspot tap. Operate mode toggles the depicted control and completes only when its target state matches the command. Renderers display no hotspot label until reveal; accessible names remain localized and available to assistive technology.

- [ ] **Step 5: Export v2 diagram IDs and preserve atomic activation**

Export all five v2 diagram IDs, but leave the production precheck catalog and v1 renderer unchanged in this task. Task 7 maps every precheck command to its v2 diagram atomically with the model-aware registry; remove the v1 renderer only after the integrated tests prove every migrated command is supported.

- [ ] **Step 6: Document provisional schematic provenance and photo replacement**

README and reference inventory state that diagrams are original manual-derived schematics for the confirmed test vehicle. Actual-vehicle photographs may replace backgrounds later while retaining diagram/hotspot IDs.

- [ ] **Step 7: Run tests and inspect every diagram**

Run: `node --test tests/yaris-surfaces.test.js tests/surfaces.test.js tests/catalog.test.js tests/i18n.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

Render every Yaris diagram at 1024×768 and verify hotspot size, lack of overlap, locate/operate behavior, reveal labels, and console cleanliness.

- [ ] **Step 8: Jeffrey review checkpoint**

Provide one screenshot per diagram family, cite the manual locations used, list any uncertain control, and propose commit `Add Yaris-specific precheck schematics`.

---

### Task 7: Trial Lifecycle, Reveal, and Backward-Compatible App Integration

**Files:**
- Modify: `src/app.js`
- Modify: `src/surfaces.js`
- Modify: `src/storage.js`
- Modify: `src/i18n.js`
- Modify: `styles.css`
- Modify: `tests/app-state.test.js`
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/storage.test.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Consumes all registered v2 surface generators/renderers.
- Produces one immutable `activeSurfaceModel` per trial and one normalized `{ selectedResult, selectedTargetId }` completion event.

- [ ] **Step 1: Write failing lifecycle tests**

```js
test('a trial creates one surface model and preserves it through hint and replay', () => {
  const started = reduce(initialState(), { type: 'TRIAL_AUDIO_ENDED', seed: 123 });
  const replaying = reduce(started, { type: 'REPLAY_STARTED', operationId: 9 });
  const replayed = reduce(replaying, { type: 'REPLAY_ENDED', operationId: 9 });
  assert.equal(started.activeSurfaceModel.seed, 123);
  assert.strictEqual(replaying.activeSurfaceModel, started.activeSurfaceModel);
  assert.strictEqual(replayed.activeSurfaceModel, started.activeSurfaceModel);
});

test('empty taps and incomplete controls never score', () => {
  const empty = reduce(activeTrial(), { type: 'SURFACE_EMPTY_TAPPED' });
  const partial = reduce(activeTrial(), { type: 'SURFACE_RESPONSE_UPDATED', response: { complete: false } });
  assert.equal(empty.screen, 'prompt');
  assert.equal(partial.screen, 'prompt');
  assert.equal(empty.sessionAttempts.length, 0);
  assert.equal(partial.sessionAttempts.length, 0);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/app-state.test.js tests/app-smoke.test.js`

Expected: FAIL because `activeSurfaceModel` and surface response events are absent.

- [ ] **Step 3: Generate and retain the model at trial start**

Generate a cryptographically available uint32 seed in the browser, with injected seed support for tests:

```js
function nextSurfaceSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0];
}
```

Store the model in reducer state. Hint, timer, replay-start, replay-end, backgrounding, and same-trial retry preserve it. Advancing or abandoning the trial clears it.

- [ ] **Step 4: Route simple and multi-step response events**

`src/surfaces.js` exposes:

```js
export function generateSurface(command, seed) {
  if (['junction-v2', 'roundabout-v2'].includes(command.surfaceId)) return generateSpatialSurface(command, seed);
  if (['u-turn-v1', 'overtake-v1', 'parking-v1', 'stopping-v1'].includes(command.surfaceId)) return generateManoeuvreSurface(command, seed);
  if (['wheel-center-v1', 'secure-yaris-v1'].includes(command.surfaceId)) return generateControlSurface(command, seed);
  if (command.surfaceId.startsWith('yaris-') && command.surfaceId.endsWith('-v2')) return generateYarisSurface(command, seed);
  if (command.surfaceId === 'option-grid-v1') return generateSemanticSurface(command, seed);
  throw new Error(`Unsupported surface: ${command.surfaceId}`);
}

export function reduceSurfaceResponse(model, responseState, event) {
  if (['wheel', 'secure-yaris'].includes(model.family)) return reduceControlResponse(model, responseState, event);
  if (model.family === 'yaris') return reduceYarisResponse(model, responseState, event);
  if (event.type !== 'select-target') return responseState;
  const target = model.targets.find(candidate => candidate.id === event.targetId);
  if (!target) return responseState;
  return { complete: true, selectedResult: target.resultId, selectedTargetId: target.id };
}

export function renderSurfaceModel(model, responseState, locale, options) {
  if (['junction', 'roundabout'].includes(model.family)) return renderSpatialSurface(model, locale, options);
  if (['u-turn', 'overtake', 'parking', 'stopping'].includes(model.family)) return renderManoeuvreSurface(model, locale, options);
  if (['wheel', 'secure-yaris'].includes(model.family)) return renderControlSurface(model, responseState, locale, options.disabled);
  if (model.family === 'yaris') return renderYarisSurface(model, responseState, locale, options.disabled);
  return renderSemanticSurface(model, locale, options);
}
```

The app scores only responses with `complete: true` or `incorrect: true`. It passes `surfaceModel`, `selectedResult`, and `selectedTargetId` to `scoreAttempt`.

In the same atomic change, register all completed Stage 2 surface IDs and migrate their eligible catalog entries. This includes `c-der`, `c-izq`, and `c-rot1` through `c-rot5` from Task 3; `c-sentido`, `c-adel`, `c-est`, and `c-parada` from Task 4; and `c-volante` plus `c-inmov` from Task 5. Their migrations were deliberately deferred so the legacy renderer never accepts a command it cannot render. Assert that `c-adapte`, `c-detencion`, and `c-final` are the only Stage 2 driving commands retaining `option-grid-v1`.

Also register the five Yaris v2 diagram IDs from Task 6 and map every precheck command according to Task 6's command-to-hotspot table. Retain the v1 precheck renderer until the complete integrated catalog/render test passes; then remove it in the same change.

- [ ] **Step 5: Implement reveal and error states**

Reveal receives the frozen model plus selected target and renders the correct trace/control and wrong selection. A bounded generator tries the requested seed and then `(seed + attempt * 0x9e3779b9) >>> 0` for attempts 1 and 2. Exhaustion displays localized `surface.error` and `surface.retry` copy and records no attempt.

- [ ] **Step 6: Preserve Stage 1 saves and imports**

Stage 1 attempts without v2 surface fields remain valid and export unchanged. Invalid present fields reject atomically. A future unsupported `surfaceVersion` may remain in an additive historical attempt, but an imported active-session surface model is never restored.

- [ ] **Step 7: Run tests**

Run: `node --test tests/app-state.test.js tests/app-smoke.test.js tests/storage.test.js tests/i18n.test.js`

Expected: PASS.

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 8: Browser matrix and Jeffrey review checkpoint**

Exercise English/Spanish, all surface families, hint, replay, empty taps, correct/wrong reveal, incomplete controls, export/import, and results at 1024×768 and 1366×768. Verify no console errors and focus remains coherent. Propose commit `Integrate Stage 2 surfaces into practice trials`.

---

### Task 8: Stage 2 Release Audit and Documentation

**Files:**
- Modify: `tests/release-audit.test.js`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `package.json` only if a deterministic audit script is needed

**Interfaces:**
- Consumes completed Stage 2 app.
- Produces reproducible test/run instructions, recorded limitations, and a static release gate.

- [ ] **Step 1: Write failing release assertions**

Add tests that prove:

```js
assert.equal(catalog.filter(command => command.phase === 'driving' && command.surfaceId === 'option-grid-v1').map(command => command.id).sort(), ['c-adapte', 'c-detencion', 'c-final']);
assert.ok(catalog.filter(command => command.surfaceId === 'roundabout-v2').length === 5);
assert.ok(catalog.filter(command => command.phase === 'precheck').every(command => command.surfaceId.startsWith('yaris-') && command.surfaceId.endsWith('-v2')));
assert.match(readme, /Toyota Yaris Hybrid 2019/i);
assert.match(readme, /manual-derived original schematics/i);
assert.match(changelog, /Stage 2 action surfaces/i);
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/release-audit.test.js`

Expected: FAIL naming missing Stage 2 release documentation.

- [ ] **Step 3: Complete documentation**

README documents the new response model, landscape iPad baseline, the three intentional semantic exceptions, provisional stopping/parking scenarios, manual-derived Yaris schematics, later photo replacement, and same-Wi-Fi serving:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve:lan
```

CHANGELOG adds a Stage 2 section without rewriting v0.1.0 history. Design status changes to Stage 2 implemented for review and keeps simulation/phrasing/mastery deferrals explicit.

- [ ] **Step 4: Run the complete standalone release gate**

Run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir diff --check
git -C /Users/jeffreypease/Projects/examen-practico-de-conducir status --short
```

Expected: all tests PASS, no whitespace errors, and only intended Stage 2 files changed.

- [ ] **Step 5: Run extraction regression gates**

Run:

```sh
node /Users/jeffreypease/Projects/piso-asturiano/tests/core.test.js
node /Users/jeffreypease/Projects/piso-asturiano/tests/levels.test.js
node /Users/jeffreypease/Projects/piso-asturiano/tests/commands.test.js
node /Users/jeffreypease/Projects/piso-asturiano/tests/drill.test.js
```

Expected: all four Piso Asturiano gates PASS.

- [ ] **Step 6: Final independent review and Jeffrey commit checkpoint**

Request a specification and code-quality review. Resolve all Critical and Important findings with focused red/green tests, rerun both release gates, and report the final diff plus proposed commit `Add Stage 2 action-matched response surfaces`. Do not stage, commit, push, change hosting, or publish.

---

## Stage 2 Completion Checkpoint

Use the new surfaces for several sessions before planning road simulation or phrasing variation. Collect command confusions, target-selection errors, misleading seeds, stopping/parking corrections, Yaris mismatches observed during lessons, response times, and hint/replay dependence. Begin a moving-road prototype only if static spatial responses remain the limiting factor.
