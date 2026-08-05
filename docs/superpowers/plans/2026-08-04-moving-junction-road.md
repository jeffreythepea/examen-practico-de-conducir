# Moving Junction Road Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, default-on six-second camera push-in to the realistic four-way-junction questions while preserving the existing language, scoring, accessibility, offline, and static-surface behavior.

**Architecture:** A pure `junction-motion` module owns trial-local phase and progress calculations. The existing junction renderer places its photograph, SVG route, and targets inside one transformable layer; the app reducer coordinates audio-start, audio-complete, answer, timeout, and animation-end events without persisting live animation state.

**Tech Stack:** JavaScript ES modules, HTML/CSS transforms and keyframes, Node built-in test runner, existing static PWA/runtime packager.

## Global Constraints

- Only realistic `junction-v2` questions move in this release.
- Use the existing `four-way-intersection-photo-v1` asset; add no image, video, canvas, physics engine, runtime dependency, or network request.
- The approach duration is exactly `6000` milliseconds and ends at scale `1.34`.
- Road movement is a bilingual setup option, defaults On, persists locally, and is restored with resumable sessions.
- `prefers-reduced-motion: reduce` overrides an On preference and retains the current static exercise.
- Initial Spanish playback and road motion begin together; targets remain disabled until initial playback completes.
- Replay repeats audio without changing road progress.
- Timing Off waits indefinitely at the junction; Timing On retains the existing countdown beginning after initial playback.
- No command ID, action ID, phrasing ID, Spanish text, English text, surface ID, accepted result, scoring rule, readiness record, or lesson-flag behavior changes.
- All new interface copy exists in English and Spanish.
- No API key, provider credential, or runtime secret enters Git or browser-delivered files.
- The bilingual AI-generated-voice disclosure remains visible.
- The saved-state schema remains version 3; missing `roadMovement` values are normalized to `true` for backward compatibility.
- Do not commit, stage, or push. Jeffrey reviews and performs Git mutations.
- After every task, update `.superpowers/sdd/progress.md` with tests, files, current base commit, and the exact next task so another local account can resume safely.

---

## File Map

- Create `src/junction-motion.js`: pure immutable state/progress calculations; no DOM, timers, audio objects, or persistence.
- Create `tests/junction-motion.test.js`: direct state-machine and progress tests.
- Modify `src/audio.js`: optional initial-playback lifecycle callback that fires exactly once when recorded or fallback playback begins.
- Modify `tests/audio.test.js`: recorded, fallback, failure, callback-exception, and replay lifecycle coverage.
- Modify `src/storage.js`: backward-compatible `settings.roadMovement` default and validation.
- Modify `src/active-session.js`: resumable-session normalization and validation for `roadMovement`.
- Modify `src/i18n.js`: bilingual setup and initial-audio status copy.
- Modify `src/spatial-surfaces.js`: one transformable junction scene layer driven by a render-only motion view.
- Modify `src/surfaces.js`: forward motion render options to the spatial renderer.
- Modify `src/app.js`: setup control, audio-start coordination, reducer events, animation-end binding, target locking, timer sequencing, and reduced-motion override.
- Modify `styles.css`: junction-only transform animation, fixed crop, waiting/frozen treatment, and reduced-motion override.
- Modify `tests/storage.test.js`, `tests/active-session.test.js`, `tests/i18n.test.js`: settings compatibility and copy.
- Modify `tests/spatial-surfaces.test.js`: transformed-layer structure, target/route co-location, and static regression.
- Modify `tests/app-state.test.js`: pure controller transitions and unchanged scoring.
- Modify `tests/app-smoke.test.js`: setup/controller integration contracts.
- Modify `README.md`, `CHANGELOG.md`: user-visible setting and release status.
- Modify `.superpowers/sdd/progress.md`: recovery checkpoints.

---

### Task 1: Persisted Bilingual Road-Movement Preference

**Files:**
- Modify: `src/storage.js`
- Modify: `src/active-session.js`
- Modify: `src/i18n.js`
- Modify: `src/app.js`
- Test: `tests/storage.test.js`
- Test: `tests/active-session.test.js`
- Test: `tests/i18n.test.js`
- Test: `tests/app-smoke.test.js`

**Interfaces:**
- Produces: `settings.roadMovement: boolean` in fresh, imported, saved, and resumable settings.
- Produces translation keys: `setting.roadMovement`, `roadMovement.on`, `roadMovement.off`, and `status.audioPlaying`.
- Preserves: schema version 3 and version-1 active-session compatibility.

- [ ] **Step 1: Write failing storage and active-session tests**

Update the fresh-state expectation to include:

```js
roadMovement: true
```

Add this storage test:

```js
test('road movement defaults on, round-trips false, and rejects invalid values', () => {
  const disabled = {
    ...defaultState(),
    settings: { ...defaultState().settings, roadMovement: false }
  };
  assert.equal(importState(exportState(disabled)).settings.roadMovement, false);

  const older = defaultState();
  delete older.settings.roadMovement;
  assert.equal(importState(JSON.stringify(older)).settings.roadMovement, true);

  assert.throws(
    () => importState(JSON.stringify({
      ...defaultState(),
      settings: { ...defaultState().settings, roadMovement: 'on' }
    })),
    /Invalid settings\.roadMovement/
  );
});
```

Add `roadMovement: true` to the active-session test fixture settings. Add a test that deletes it from a cloned version-1 session, validates the session, and expects the normalized setting to be `true`; also expect an explicit `false` to survive and a string value to throw.

- [ ] **Step 2: Write failing bilingual-copy and setup-contract tests**

Add the four new translation keys to `requiredKeys` in `tests/i18n.test.js` and assert:

```js
assert.equal(translate('en', 'setting.roadMovement'), 'Road movement');
assert.equal(translate('es', 'setting.roadMovement'), 'Movimiento de la carretera');
assert.equal(translate('en', 'roadMovement.on'), 'On');
assert.equal(translate('es', 'roadMovement.on'), 'Activado');
assert.equal(translate('en', 'roadMovement.off'), 'Off');
assert.equal(translate('es', 'roadMovement.off'), 'Desactivado');
assert.equal(translate('en', 'status.audioPlaying'), 'Listen to the Spanish command.');
assert.equal(translate('es', 'status.audioPlaying'), 'Escuche la orden en español.');
```

Extend the setup smoke test to require:

```js
assert.match(source, /selectControl\('roadMovement', 'setting\.roadMovement'/);
assert.match(source, /setting === 'roadMovement'/);
assert.match(source, /roadMovement/);
```

- [ ] **Step 3: Run the focused tests to verify RED**

Run:

```bash
node --test tests/storage.test.js tests/active-session.test.js tests/i18n.test.js tests/app-smoke.test.js
```

Expected: failures for missing `roadMovement` defaults/validation, translation keys, and setup control.

- [ ] **Step 4: Implement backward-compatible settings normalization**

In `src/storage.js`, add `roadMovement: true` beside the other boolean defaults and extend `validateSettings` exactly as follows:

```js
if (settings.roadMovement === undefined) settings.roadMovement = true;
if (typeof settings.roadMovement !== 'boolean') throw new Error('Invalid settings.roadMovement');
```

In `src/active-session.js`, normalize before validating:

```js
if (settings.roadMovement === undefined) settings.roadMovement = true;
if (typeof settings.roadMovement !== 'boolean') {
  throw new Error('Invalid activeSession.settings.roadMovement');
}
```

Do not increment `SCHEMA_VERSION` or the active-session version.

- [ ] **Step 5: Add exact bilingual copy and setup plumbing**

Add to `ENGLISH`:

```js
'setting.roadMovement': 'Road movement',
'roadMovement.on': 'On',
'roadMovement.off': 'Off',
'status.audioPlaying': 'Listen to the Spanish command.',
```

Add to `SPANISH`:

```js
'setting.roadMovement': 'Movimiento de la carretera',
'roadMovement.on': 'Activado',
'roadMovement.off': 'Desactivado',
'status.audioPlaying': 'Escuche la orden en español.',
```

Render the setup selector beside the other setup choices:

```js
${selectControl('roadMovement', 'setting.roadMovement', [
  [true, 'roadMovement.on'], [false, 'roadMovement.off']
])}
```

Parse it as a boolean in `bindSetupEvents` together with `timed` and `feedbackSounds`. Include it in `resumableSettings`:

```js
function resumableSettings(settings) {
  const { phase, speed, hintPolicy, timed, feedbackSounds, roadMovement, length } = settings;
  return {
    phase, speed, hintPolicy, timed, feedbackSounds, roadMovement,
    length, mode: practiceMode(settings.mode)
  };
}
```

- [ ] **Step 6: Run focused tests and record the checkpoint**

Run:

```bash
node --test tests/storage.test.js tests/active-session.test.js tests/i18n.test.js tests/app-smoke.test.js
git diff --check
```

Expected: all focused tests pass and whitespace check is clean. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 2: Audio-Playback Start Lifecycle

**Files:**
- Modify: `src/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Produces: `player.play(variant, speechRequest, lifecycle = {})`.
- `lifecycle.onStarted()` fires at most once for the initial play, after recorded `audio.play()` resolves or immediately before browser-speech playback is requested.
- `player.replay()` retains its current signature and does not receive or repeat the lifecycle callback.
- Callback exceptions never change audio scoring or fallback behavior.

- [ ] **Step 1: Write failing recorded-playback lifecycle tests**

Add:

```js
test('initial recorded playback announces one successful start before ending', async () => {
  const fixture = audioFixture();
  const player = createAudioPlayer(fixture.dependencies);
  let starts = 0;
  const result = player.play(variant, undefined, { onStarted: () => { starts += 1; } });

  await fixture.instances[0].started;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts, 1);

  fixture.instances[0].emit('ended');
  assert.deepEqual(await result, { scored: true, replays: 0 });
  assert.equal(starts, 1);
});
```

Add a test where `onStarted` throws and assert recorded playback still resolves scored after `ended`.

- [ ] **Step 2: Write failing fallback and replay lifecycle tests**

Use the existing fallback fixture to assert:

```js
test('fallback announces one start and replay never repeats the initial lifecycle callback', async () => {
  const audio = audioFixture();
  const fallback = fallbackFixture();
  const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });
  let starts = 0;

  const initial = player.play(
    { ...variant, provider: 'browser-speech', path: null },
    { text: 'Gire a la derecha', speed: 0.9 },
    { onStarted: () => { starts += 1; } }
  );
  assert.deepEqual(await initial, { scored: true, replays: 0 });
  assert.equal(starts, 1);

  assert.deepEqual(await player.replay(), { scored: true, replays: 1 });
  assert.equal(starts, 1);
});
```

Also assert total initial failure never invokes `onStarted` when neither recorded playback nor fallback can begin.

- [ ] **Step 3: Run audio tests to verify RED**

Run:

```bash
node --test tests/audio.test.js
```

Expected: lifecycle callback assertions fail because `play` currently ignores its third argument.

- [ ] **Step 4: Implement a guarded one-shot notifier**

Change `play` and `start` signatures:

```js
function play(variant, speechRequest, lifecycle = {}) {
  lastPlayback = null;
  replayCount = 0;
  return start(variant, speechRequest, false, null, lifecycle);
}

function replay() {
  if (!lastPlayback) return Promise.resolve({ scored: false, reason: 'no-audio' });
  return start(lastPlayback.variant, lastPlayback.speechRequest, true, lastPlayback.mode, {});
}

function start(variant, speechRequest, isReplay, retainedMode = null, lifecycle = {}) {
```

Inside `start`, add:

```js
let startNotified = false;
const notifyStarted = () => {
  if (startNotified) return;
  startNotified = true;
  try {
    lifecycle.onStarted?.();
  } catch {
    // UI lifecycle observers must never alter audio scoring or fallback.
  }
};
```

Call `notifyStarted()` immediately before `fallbackPlayer.play(speechRequest)`. Replace the recorded start continuation with:

```js
Promise.resolve(audio.play())
  .then(notifyStarted)
  .catch(onError);
```

Do not invoke it from `finish`, `replay`, or a failed branch with no playable fallback.

- [ ] **Step 5: Run audio tests and record the checkpoint**

Run:

```bash
node --test tests/audio.test.js
git diff --check
```

Expected: all audio tests pass. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 3: Pure Junction-Motion State and Progress

**Files:**
- Create: `src/junction-motion.js`
- Create: `tests/junction-motion.test.js`

**Interfaces:**
- Produces constants `JUNCTION_APPROACH_MS`, `JUNCTION_END_SCALE`, and `JUNCTION_MOTION_PHASES`.
- Produces `createJunctionMotion({ enabled, startedAt })`.
- Produces `reduceJunctionMotion(state, event)`.
- Produces `junctionMotionView(state, now)`.
- Events are `{ type: 'AUDIO_COMPLETED'|'APPROACH_ENDED'|'ANSWERED'|'FAILED', at }`.
- State and returned view records are frozen; no function accesses the DOM or creates a timer.

- [ ] **Step 1: Write failing state and progress tests**

Create `tests/junction-motion.test.js` with these core assertions:

```js
const motion = createJunctionMotion({ enabled: true, startedAt: 1_000 });
assert.equal(motion.phase, JUNCTION_MOTION_PHASES.APPROACHING_LOCKED);

assert.deepEqual(junctionMotionView(motion, 1_000), {
  phase: 'approaching-locked',
  progress: 0,
  scale: 1,
  locked: true,
  moving: true,
  elapsedMs: 0,
  remainingMs: 6000
});

const midway = junctionMotionView(motion, 4_000);
assert.equal(midway.progress, 0.5);
assert.equal(midway.scale, 1.17);
assert.equal(midway.elapsedMs, 3000);
assert.equal(midway.remainingMs, 3000);

const interactive = reduceJunctionMotion(motion, { type: 'AUDIO_COMPLETED', at: 2_000 });
assert.equal(interactive.phase, JUNCTION_MOTION_PHASES.APPROACHING_INTERACTIVE);
assert.equal(junctionMotionView(interactive, 2_000).locked, false);

const answered = reduceJunctionMotion(interactive, { type: 'ANSWERED', at: 4_000 });
assert.equal(answered.phase, JUNCTION_MOTION_PHASES.WAITING);
assert.equal(junctionMotionView(answered, 8_000).progress, 0.5);
```

Also assert:

- disabled creation returns the static phase at scale 1;
- progress clamps from 0 to 1;
- locked motion that reaches six seconds is visually stopped but remains locked;
- completing audio after six seconds produces Waiting at progress 1;
- `APPROACH_ENDED` changes interactive motion to Waiting at progress 1;
- `ANSWERED` against Waiting returns the identical state;
- `FAILED` returns Static;
- invalid `startedAt`, `now`, event type, and event time throw;
- every returned record is frozen.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node --test tests/junction-motion.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the complete pure module**

Use these public constants:

```js
export const JUNCTION_APPROACH_MS = 6000;
export const JUNCTION_END_SCALE = 1.34;
export const JUNCTION_MOTION_PHASES = Object.freeze({
  STATIC: 'static',
  APPROACHING_LOCKED: 'approaching-locked',
  APPROACHING_INTERACTIVE: 'approaching-interactive',
  WAITING: 'waiting'
});
```

Use this state shape:

```js
// Active
{ phase, startedAt, frozenProgress: null }

// Static or Waiting
{ phase, startedAt: null, frozenProgress: 0..1 }
```

Calculate clamped timeline progress and elapsed time as:

```js
const progress = Math.min(1, Math.max(0, (now - state.startedAt) / JUNCTION_APPROACH_MS));
const elapsedMs = progress * JUNCTION_APPROACH_MS;
```

For a frozen or static render, compute `scale` from the standard CSS
`ease-in-out` curve (`cubic-bezier(0.42, 0, 0.58, 1)`) at `progress`, then map
that eased value from scale 1 to `JUNCTION_END_SCALE`. Implement the Bézier
solver locally with bounded bisection; do not add a dependency. Assert scale 1
at progress 0, 1.17 at progress 0.5, and 1.34 at progress 1. This keeps an
answer-time frozen reveal aligned with the browser animation.

Transition rules:

```text
Static + any legal event -> identical Static
Approaching locked + AUDIO_COMPLETED before end -> Approaching interactive
Approaching locked + AUDIO_COMPLETED at/after end -> Waiting(1)
Approaching locked + APPROACH_ENDED -> identical state (view clamps and stops at 1)
Approaching interactive + APPROACH_ENDED -> Waiting(1)
Approaching interactive + ANSWERED -> Waiting(progress at event.at)
Waiting + ANSWERED or APPROACH_ENDED -> identical Waiting
Any non-static phase + FAILED -> Static
```

`junctionMotionView` returns `elapsedMs`, sets `moving` only while progress is
less than 1 and the phase is an approaching phase, and sets `locked` only for
Approaching locked.

- [ ] **Step 4: Run focused tests and record the checkpoint**

Run:

```bash
node --test tests/junction-motion.test.js
git diff --check
```

Expected: all motion tests pass. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 4: Transformable Junction Scene Layer

**Files:**
- Modify: `src/spatial-surfaces.js`
- Modify: `src/surfaces.js`
- Modify: `styles.css`
- Test: `tests/spatial-surfaces.test.js`
- Test: `tests/surfaces.test.js`

**Interfaces:**
- Consumes render option `motion`, the frozen record returned by `junctionMotionView`.
- Produces a junction-only `.junction-motion-scene` containing the photograph, SVG route, and all three target buttons.
- Produces `data-junction-motion`, `data-junction-motion-running`, `--junction-motion-scale`, and `--junction-motion-elapsed`.
- Roundabout and static render output remain functionally unchanged.

- [ ] **Step 1: Write failing renderer-structure tests**

For a junction and this view:

```js
const motion = Object.freeze({
  phase: 'approaching-interactive',
  progress: 0.25,
  scale: 1.085,
  locked: false,
  moving: true,
  elapsedMs: 1500,
  remainingMs: 4500
});
```

Assert the renderer output has:

```js
assert.match(markup, /class="junction-motion-scene"/);
assert.match(markup, /data-junction-motion="approaching-interactive"/);
assert.match(markup, /data-junction-motion-running="true"/);
assert.match(markup, /--junction-motion-scale:1\.085/);
assert.match(markup, /--junction-motion-elapsed:1500ms/);
```

Extract the `.junction-motion-scene` substring and assert it contains the scene image, SVG, exactly three `.road-target` buttons, and—during reveal—the `data-correct-route` path. Assert `.surface-result-label` remains outside the transformed layer.

Add static and roundabout assertions:

```js
assert.doesNotMatch(renderSpatialSurface(junction, 'en'), /junction-motion-scene/);
assert.doesNotMatch(renderSpatialSurface(roundabout, 'en', { motion }), /junction-motion-scene/);
```

Extend `tests/surfaces.test.js` to prove `renderSurfaceModel(..., { motion })` forwards the exact motion view to a junction render.

- [ ] **Step 2: Write failing CSS-contract tests**

Assert `styles.css` contains:

```text
.surface-stage.junction-motion-stage { overflow: hidden; }
.junction-motion-scene { position: absolute; inset: 0; transform-origin: 50% 76%; }
.junction-motion-scene[data-junction-motion-running="true"] { animation: ... }
@keyframes junction-camera-push
@media (prefers-reduced-motion: reduce)
```

Also require the reduced-motion rule to set `animation: none` and `transform: none` for `.junction-motion-scene`.

- [ ] **Step 3: Run renderer tests to verify RED**

Run:

```bash
node --test tests/spatial-surfaces.test.js tests/surfaces.test.js
```

Expected: failures for missing motion wrapper, render option forwarding, and CSS.

- [ ] **Step 4: Render one shared transformed coordinate layer**

In `renderSurfaceModel`, keep passing the full state object to `renderSpatialSurface`.

In `renderSpatialSurface`, enable motion only when `model.family === 'junction'` and `state.motion` exists. Build:

```js
const moving = model.family === 'junction' ? state.motion : null;
const motionAttributes = moving
  ? ` data-junction-motion="${escapeAttribute(moving.phase)}"`
    + ` data-junction-motion-running="${moving.moving}"`
    + ` style="--junction-motion-scale:${moving.scale};--junction-motion-elapsed:${moving.elapsedMs}ms"`
  : '';
const sceneContents = `${sceneImage}
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    ${roadDrawing(model)}
    ${route}
  </svg>
  ${targets}`;
const renderedScene = moving
  ? `<div class="junction-motion-scene"${motionAttributes}>${sceneContents}</div>`
  : sceneContents;
```

Add `junction-motion-stage` to the outer stage only when `moving` exists. Keep `resultLabel` outside `renderedScene`.

- [ ] **Step 5: Add junction-only transform CSS**

Use:

```css
.surface-stage.junction-motion-stage {
  overflow: hidden;
}

.junction-motion-scene {
  position: absolute;
  inset: 0;
  transform: scale(var(--junction-motion-scale, 1));
  transform-origin: 50% 76%;
}

.junction-motion-scene[data-junction-motion-running="true"] {
  animation-name: junction-camera-push;
  animation-duration: 6000ms;
  animation-delay: calc(-1 * var(--junction-motion-elapsed, 0ms));
  animation-timing-function: ease-in-out;
  animation-fill-mode: forwards;
}

@keyframes junction-camera-push {
  from { transform: scale(1); }
  to { transform: scale(1.34); }
}
```

The negative delay resumes the original global six-second easing curve after
audio-completion, replay, locale, or other same-screen rerenders. It must not
restart an ease-in curve from the current scale.

Inside the existing reduced-motion media block, add:

```css
.junction-motion-scene {
  animation: none !important;
  transform: none !important;
}
```

Do not change global `.driving-photo-stage`, roundabout, manoeuvre, or precheck transforms.

- [ ] **Step 6: Run renderer tests and record the checkpoint**

Run:

```bash
node --test tests/spatial-surfaces.test.js tests/surfaces.test.js
git diff --check
```

Expected: all focused tests pass. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 5: Reducer-Owned Initial-Audio Lock and Motion Lifecycle

**Files:**
- Modify: `src/app.js`
- Test: `tests/app-state.test.js`

**Interfaces:**
- Consumes: `createJunctionMotion`, `reduceJunctionMotion`.
- Adds trial-local model fields: `initialAudioPending: boolean`, `junctionMotion: object|null`.
- Adds reducer events:
  - `{ type: 'AUDIO_STARTED', variant, startedAt, seed, motionEnabled }`
  - `{ type: 'JUNCTION_APPROACH_ENDED', completedAt }`
- Preserves existing `AUDIO_COMPLETED`, `AUDIO_FAILED`, `AUDIO_INTERRUPTED`, replay, surface-event, timeout, reveal, and continue contracts.

- [ ] **Step 1: Write failing early-prompt and lock tests**

Starting from a loading model, dispatch:

```js
model = reduceScreen(model, {
  type: 'AUDIO_STARTED',
  variant: rightVariant,
  startedAt: 1_000,
  seed: 123,
  motionEnabled: true
});
```

Assert:

```js
assert.equal(model.screen, 'prompt');
assert.equal(model.initialAudioPending, true);
assert.equal(model.activeSurfaceModel.family, 'junction');
assert.equal(model.junctionMotion.phase, 'approaching-locked');
assert.equal(promptControlsDisabled(model), true);
assert.strictEqual(
  reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: 'right' },
    completedAt: 1_500
  }),
  model
);
```

Then dispatch `AUDIO_COMPLETED` at `2_000` and assert the same retained surface reference, `initialAudioPending === false`, `promptStartedAt === 2_000`, interactive motion, and enabled prompt controls.

- [ ] **Step 2: Write failing static, waiting, replay, answer, and failure tests**

Cover these exact cases:

- `AUDIO_STARTED` with `motionEnabled: false` returns the identical loading model; subsequent `AUDIO_COMPLETED` follows the existing static path.
- `AUDIO_STARTED` for a non-junction command returns the identical loading model.
- `JUNCTION_APPROACH_ENDED` changes interactive motion to Waiting.
- `REPLAY_STARTED` and `REPLAY_COMPLETED` preserve the exact motion object.
- A correct or incorrect `SURFACE_EVENT` freezes motion at event time and carries it into Reveal.
- `TIMEOUT` carries frozen motion into Reveal.
- `AUDIO_FAILED` or `AUDIO_INTERRUPTED` during `initialAudioPending` returns to unscored loading state with `junctionMotion === null`.
- `CONTINUE`, setup, and next-trial reset clear both new fields.
- Surface generation failure during `AUDIO_STARTED` leaves the model loading so normal completion can use the current static retry path.

- [ ] **Step 3: Run reducer tests to verify RED**

Run:

```bash
node --test tests/app-state.test.js
```

Expected: failures because the reducer does not recognize `AUDIO_STARTED`, motion, or the initial-audio lock.

- [ ] **Step 4: Add motion-aware reducer transitions**

Import:

```js
import {
  createJunctionMotion,
  reduceJunctionMotion
} from './junction-motion.js';
```

Add `AUDIO_STARTED` before the existing `AUDIO_COMPLETED` branch. Accept it only when:

```js
event.motionEnabled === true
&& model.screen === 'loading-audio'
&& model.session[model.index]?.surfaceId === 'junction-v2'
```

Generate or reuse the surface with the existing bounded retry helper. If generation fails, return the identical loading model. On success return Prompt with the retained variant/surface, `initialAudioPending: true`, `promptStartedAt: null`, and:

```js
junctionMotion: createJunctionMotion({
  enabled: true,
  startedAt: event.startedAt
})
```

Split `AUDIO_COMPLETED` handling:

- Existing Loading path remains the static path.
- Prompt plus `initialAudioPending` unlocks the retained trial, sets `promptStartedAt`, and applies:

```js
reduceJunctionMotion(model.junctionMotion, {
  type: 'AUDIO_COMPLETED',
  at: event.completedAt
})
```

Extend `promptControlsDisabled`:

```js
return model.screen !== 'prompt'
  || Boolean(model.initialAudioPending)
  || Boolean(model.replayPending)
  || !model.activeSurfaceModel;
```

Apply `ANSWERED` inside `reveal` using `completedAt`, apply `APPROACH_ENDED` for the new reducer event, and apply `FAILED` in initial-audio failure/interruption branches. Reset both fields in `resetTrial`.

- [ ] **Step 5: Run reducer tests and record the checkpoint**

Run:

```bash
node --test tests/app-state.test.js tests/junction-motion.test.js
git diff --check
```

Expected: all focused tests pass and all pre-existing scoring/replay assertions remain green. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 6: Browser Controller, Timer, Rendering, and Reduced Motion

**Files:**
- Modify: `src/app.js`
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/i18n.test.js`

**Interfaces:**
- Consumes: audio `onStarted`, reducer events from Task 5, and `junctionMotionView`.
- Produces: early locked Prompt only for eligible moving junctions.
- Produces: one `animationend` dispatch for the active junction approach.
- Keeps: existing loading screen for static/reduced-motion junctions and every non-junction command.

- [ ] **Step 1: Write failing controller-source contracts**

Require:

```js
assert.match(source, /junctionMotionView\(model\.junctionMotion, Date\.now\(\)\)/);
assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
assert.match(source, /onStarted/);
assert.match(source, /type: 'AUDIO_STARTED'/);
assert.match(source, /type: 'JUNCTION_APPROACH_ENDED'/);
assert.match(source, /initialAudioPending/);
assert.match(source, /status\.audioPlaying/);
assert.match(source, /if \(model\.initialAudioPending\) return;/);
```

Require setup boolean parsing to include `roadMovement`. Require both Prompt and Reveal render calls to pass a `motion` option.

- [ ] **Step 2: Run controller tests to verify RED**

Run:

```bash
node --test tests/app-smoke.test.js tests/i18n.test.js
```

Expected: failures for missing lifecycle coordination, motion rendering, and timer guard.

- [ ] **Step 3: Add one environment eligibility helper**

Inside `bootstrap`, add:

```js
function movingJunctionEnabled(command) {
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return command?.surfaceId === 'junction-v2'
    && state.settings.roadMovement
    && !reducedMotion;
}
```

Evaluate this for each initial command start. Do not persist the media-query result and do not add a media-query listener.

- [ ] **Step 4: Start motion from the actual audio-start lifecycle**

Call:

```js
const result = await player.play(
  variant,
  { text: phrasing.es, speed: variant.speed },
  {
    onStarted: () => {
      if (operation !== audioOperation || !movingJunctionEnabled(command)) return;
      const before = model;
      try {
        model = reduceScreen(model, {
          type: 'AUDIO_STARTED',
          variant,
          startedAt: Date.now(),
          seed: nextSurfaceSeed(),
          motionEnabled: true
        });
      } catch {
        model = before;
      }
      if (model !== before) render();
    }
  }
);
```

The callback failure path intentionally leaves Loading unchanged; when playback completes, the existing static `AUDIO_COMPLETED` path runs.

Keep operation-ID checks around completion. Ensure `AUDIO_FAILED` is accepted whether the eligible trial is still Loading or is an early locked Prompt.

- [ ] **Step 5: Pass fresh render-only motion views**

In Prompt and Reveal:

```js
const motion = model.junctionMotion
  ? junctionMotionView(model.junctionMotion, Date.now())
  : null;
```

Pass `motion` to `renderSurfaceModel`. While `initialAudioPending`, use `status.audioPlaying`; after completion use `status.audioReady`. Existing prompt actions and targets receive the shared `controlsDisabled` value.

Do not store the view object in persisted state or the active session.

- [ ] **Step 6: Bind animation completion without a second timer**

In `bindPromptEvents`, bind the current running scene:

```js
app.querySelector('.junction-motion-scene[data-junction-motion-running="true"]')
  ?.addEventListener('animationend', event => {
    if (event.animationName !== 'junction-camera-push') return;
    const before = model;
    model = reduceScreen(model, {
      type: 'JUNCTION_APPROACH_ENDED',
      completedAt: Date.now()
    });
    if (model !== before) render();
  }, { once: true });
```

This event only freezes the view; it never scores. Add `if (model.initialAudioPending) return;` to `startTimer` so Timing begins only after successful initial playback. Preserve the current replay stop/restart behavior for the explicit Timing option.

- [ ] **Step 7: Run focused integration tests and record the checkpoint**

Run:

```bash
node --test tests/audio.test.js tests/junction-motion.test.js tests/spatial-surfaces.test.js tests/surfaces.test.js tests/app-state.test.js tests/app-smoke.test.js tests/storage.test.js tests/active-session.test.js tests/i18n.test.js
git diff --check
```

Expected: all focused tests pass. Update `.superpowers/sdd/progress.md`; do not stage or commit.

---

### Task 7: Release Documentation, Runtime Verification, and Manual Review

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `.superpowers/sdd/progress.md`
- Test: `tests/runtime-package.test.js`
- Test: `tests/release-audit.test.js`

**Interfaces:**
- Produces: documented Road movement setup behavior and bounded release status.
- Verifies: the new source module is automatically included by deterministic runtime discovery.
- Verifies: no experiment assets, credentials, or remote dependencies enter `dist/`.

- [ ] **Step 1: Update user and release documentation**

Add a short README paragraph:

```markdown
Four-way-junction questions can use a six-second moving-road approach. Road
movement defaults on and can be disabled in Practice setup; browsers requesting
reduced motion automatically receive the existing static junction.
```

Add a top CHANGELOG section:

```markdown
## Moving junction experiment — in progress

- Added an optional, default-on camera push-in to realistic four-way-junction
  questions while retaining static reduced-motion behavior, existing scoring,
  and the explicit Timing setting.
```

Do not claim physical-iPad acceptance before Jeffrey completes it.

- [ ] **Step 2: Run the complete automated gate**

Run:

```bash
npm test
npm run build:runtime
git diff --check
```

Expected:

- all repository tests pass;
- runtime-package output reports `recordedCorpusComplete: true`;
- `dist/src/junction-motion.js` exists;
- deterministic asset discovery contains the new module;
- the bilingual AI-voice disclosure remains present;
- no credential-shaped text or experiment asset is published.

- [ ] **Step 3: Start a verified runtime preview**

Run from the repository root:

```bash
PORT=4201 npm run serve:dist
```

Open `http://127.0.0.1:4201/`. Use a separate port only if 4201 is occupied and record the chosen URL in the progress ledger.

- [ ] **Step 4: Complete desktop browser acceptance**

Verify in both EN and ES:

1. Setup shows Road movement and defaults On.
2. Left, straight, and right junction commands begin moving with initial Spanish audio.
3. All three targets are disabled until initial audio completes.
4. A target can be chosen during the remaining approach.
5. With no answer, the photograph holds before the junction.
6. Replay does not reset the road position.
7. Correct and incorrect reveal routes remain aligned at early, middle, and waiting positions.
8. Timing Off waits indefinitely; Timing On still times out after targets unlock.
9. Road movement Off restores the current static junction.
10. Emulated reduced motion restores the current static junction.
11. Roundabouts, overtaking, parking, stopping, U-turn, and prechecks remain static.
12. Browser console has no warnings or errors and no horizontal overflow appears.

- [ ] **Step 5: Complete physical iPad review**

On the installed GitHub Pages app after publication, verify landscape and portrait:

- recorded audio;
- browser speech fallback;
- Road movement On and Off;
- target alignment and 44px-capable touch areas;
- answer during movement and after waiting;
- replay;
- Timing On and Off;
- reduced-motion behavior if the iPad setting is available;
- offline launch and one complete junction trial.

Record results in `.superpowers/sdd/progress.md`. Failed physical checks remain open; do not rewrite them as passed.

- [ ] **Step 6: Prepare the final review handoff**

Run again immediately before handoff:

```bash
npm test
npm run build:runtime
git diff --check
git status --short
```

Report:

- exact passing test count;
- runtime version, asset count, byte count, and corpus completeness;
- modified/untracked files;
- desktop and physical-iPad results separately;
- any open issue;
- confirmation that the bilingual AI-voice disclosure remains visible;
- confirmation that no credential is present in repository or browser-delivered files.

Stop for Jeffrey's review. Do not stage, commit, push, or deploy.
