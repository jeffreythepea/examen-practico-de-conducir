# Moving-Road Browser Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while executing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a timeboxed browser-native moving-junction comprehension drill using real catalog commands and packaged Spanish audio.

**Architecture:** A pure immutable reducer owns progress, pause, decision availability, answer, and reveal state. A thin browser controller loads the real catalog/audio manifest, drives `requestAnimationFrame`, renders an SVG road, and plays the selected recorded command.

**Tech Stack:** JavaScript ES modules, Node test runner, HTML, CSS, SVG, Web Audio via `HTMLAudioElement`.

## Global Constraints

- Hard implementation timebox: two to three hours.
- Experiment only; no production `src/`, `data/`, runtime-package, service-worker, or GitHub Pages changes.
- Use stable commands `c-izq`, `c-recto`, and `c-der` and their existing `acceptedResult` values.
- Use canonical Roger recordings at speed `0.9` from `data/audio-manifest.json`.
- Every visible string exists in English and Spanish.
- Reduced-motion mode uses static stages and remains fully answerable.
- No new dependency or generated media.

---

### Task 1: Pure Moving-Road State Machine

**Files:**
- Create: `experiments/moving-road-spike/moving-road-state.js`
- Create: `experiments/moving-road-spike/tests/moving-road-state.test.js`

**Interfaces:**
- Produces: `ROAD_PHASES`, `createMovingRoadState(config)`, and `reduceMovingRoad(state, event)`
- State shape: `{ phase, commandId, acceptedResult, elapsedMs, durationMs, decisionAtMs, paused, reducedMotion, selectedResult, outcome, replayCount }`
- Events: `{ type: 'TICK', deltaMs }`, `{ type: 'TOGGLE_PAUSE' }`, `{ type: 'ANSWER', resultId }`, `{ type: 'REPLAY' }`, `{ type: 'RESET' }`

- [ ] **Step 1: Write failing reducer tests**

Create tests that assert:

```js
const base = createMovingRoadState({
  commandId: 'c-der',
  acceptedResult: 'turn-right',
  durationMs: 6000,
  decisionAtMs: 3000,
  reducedMotion: false
});

assert.equal(base.phase, 'approaching');
assert.equal(reduceMovingRoad(base, { type: 'TICK', deltaMs: 2999 }).phase, 'approaching');
assert.equal(reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 }).phase, 'decision-open');
assert.equal(reduceMovingRoad(base, { type: 'ANSWER', resultId: 'turn-right' }).phase, 'approaching');

const open = reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 });
const correct = reduceMovingRoad(open, { type: 'ANSWER', resultId: 'turn-right' });
assert.equal(correct.phase, 'reveal');
assert.equal(correct.outcome, 'correct');
assert.equal(
  reduceMovingRoad(open, { type: 'ANSWER', resultId: 'turn-left' }).outcome,
  'incorrect'
);
```

Also assert:

- `TICK` is ignored while paused or revealed;
- elapsed time clamps at `durationMs`;
- reduced motion starts in `decision-open`;
- pre-decision answers are ignored;
- `REPLAY` increments only before reveal;
- returned state and nested-free values are frozen;
- invalid config, negative ticks, unknown results, and unknown events throw;
- `RESET` returns a fresh equivalent trial with replay count zero.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
node --test experiments/moving-road-spike/tests/moving-road-state.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the minimal reducer**

Use:

```js
export const ROAD_PHASES = Object.freeze({
  APPROACHING: 'approaching',
  DECISION_OPEN: 'decision-open',
  REVEAL: 'reveal'
});

const RESULT_IDS = new Set(['turn-left', 'continue-forward', 'turn-right']);

export function createMovingRoadState(config) {
  // Validate stable IDs and finite timing.
  // Set phase to decision-open when reducedMotion is true.
  // Return Object.freeze(state).
}

export function reduceMovingRoad(state, event) {
  // Return the identical state for legal ignored events.
  // Return a new frozen object for accepted transitions.
  // ANSWER is accepted only in decision-open and transitions directly to reveal.
}
```

Do not add timers or DOM access to this module.

- [ ] **Step 4: Run reducer tests to verify GREEN**

Run:

```bash
node --test experiments/moving-road-spike/tests/moving-road-state.test.js
```

Expected: all reducer tests PASS.

- [ ] **Step 5: Update the recovery ledger**

Record elapsed time, test count, files, current commit, exact next task, and any departures in `docs/experiments/2026-08-04-ai-assisted-spikes-lab.md`.

---

### Task 2: Real Catalog and Audio Selection

**Files:**
- Create: `experiments/moving-road-spike/moving-road-data.js`
- Create: `experiments/moving-road-spike/tests/moving-road-data.test.js`

**Interfaces:**
- Consumes: production arrays from `data/commands.json` and `data/audio-manifest.json`
- Produces: `selectMovingRoadTrials(commands, manifest)` returning exactly three frozen records with `{ commandId, phrasingId, es, en, acceptedResult, audioPath }`

- [ ] **Step 1: Write failing data-contract tests**

Load the real JSON files and assert the returned records equal:

```js
[
  {
    commandId: 'c-izq',
    phrasingId: 'c-izq-canonical',
    es: 'Gire a la izquierda cuando pueda',
    en: 'turn left when you can',
    acceptedResult: 'turn-left',
    audioPath: '../../audio/c-izq/c-izq-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  },
  {
    commandId: 'c-recto',
    phrasingId: 'c-recto-canonical',
    es: 'Siga todo recto',
    en: 'continue straight ahead',
    acceptedResult: 'continue-forward',
    audioPath: '../../audio/c-recto/c-recto-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  },
  {
    commandId: 'c-der',
    phrasingId: 'c-der-canonical',
    es: 'Gire a la derecha cuando pueda',
    en: 'turn right when you can',
    acceptedResult: 'turn-right',
    audioPath: '../../audio/c-der/c-der-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  }
]
```

Also assert duplicate/missing command IDs, mismatched manifest records, or a non-ElevenLabs record throw descriptive errors.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
node --test experiments/moving-road-spike/tests/moving-road-data.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement exact selection**

Select only canonical phrasing, voice `CwhRBWXzGAHq8TQ4Fs17`, and speed `0.9`. Prefix the manifest path with `../../` for the experiment page. Freeze each record and the returned array. Never alter or rewrite catalog text.

- [ ] **Step 4: Run data and reducer tests**

Run:

```bash
node --test experiments/moving-road-spike/tests/*.test.js
```

Expected: all tests PASS.

---

### Task 3: Bilingual Animated Browser Proof

**Files:**
- Create: `experiments/moving-road-spike/index.html`
- Create: `experiments/moving-road-spike/styles.css`
- Create: `experiments/moving-road-spike/moving-road-copy.js`
- Create: `experiments/moving-road-spike/moving-road.js`
- Create: `experiments/moving-road-spike/tests/moving-road-ui.test.js`

**Interfaces:**
- Consumes: reducer and three trial records from Tasks 1–2
- Produces: experiment page at `/experiments/moving-road-spike/`

- [ ] **Step 1: Write failing UI-contract tests**

Read the HTML, CSS, and modules as text. Assert:

- `index.html` has `lang="en"`, an `#app` mount, stylesheet, module script, and viewport meta;
- the copy dictionary contains exact EN/ES labels for title, instruction, Replay, Pause, Resume, left, straight, right, correct, incorrect, Try another, and the AI-generated-voice disclosure;
- CSS contains `@media (prefers-reduced-motion: reduce)`, `min-height: 44px`, `:focus-visible`, and no remote `url(http`;
- controller imports `createMovingRoadState`, `reduceMovingRoad`, and `selectMovingRoadTrials`;
- controller fetches `../../data/commands.json` and `../../data/audio-manifest.json`;
- SVG output contains one fixed learner car, a road, a moving junction group, and non-color result text.

The copy dictionary must contain these exact values:

```js
export const MOVING_ROAD_COPY = Object.freeze({
  en: Object.freeze({
    title: 'Moving-road experiment',
    instruction: 'Listen, then choose the road before the junction.',
    start: 'Start',
    replay: 'Replay',
    pause: 'Pause',
    resume: 'Resume',
    left: 'Left',
    straight: 'Straight',
    right: 'Right',
    correct: 'Correct',
    incorrect: 'Incorrect',
    another: 'Try another',
    loadError: 'The experimental trial could not be loaded.',
    audioError: 'The Spanish recording could not be played.',
    disclosure: 'This Spanish voice is AI-generated.'
  }),
  es: Object.freeze({
    title: 'Experimento de carretera en movimiento',
    instruction: 'Escuche y elija la vía antes del cruce.',
    start: 'Empezar',
    replay: 'Repetir',
    pause: 'Pausar',
    resume: 'Continuar',
    left: 'Izquierda',
    straight: 'Recto',
    right: 'Derecha',
    correct: 'Correcto',
    incorrect: 'Incorrecto',
    another: 'Otra',
    loadError: 'No se pudo cargar el ejercicio experimental.',
    audioError: 'No se pudo reproducir la grabación en español.',
    disclosure: 'Esta voz en español ha sido generada por IA.'
  })
});
```

- [ ] **Step 2: Run UI tests to verify RED**

Run:

```bash
node --test experiments/moving-road-spike/tests/moving-road-ui.test.js
```

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Build the accessible page shell**

Use one header with EN/ES buttons, title, instruction, and bilingual AI-voice disclosure. Render a 16:9 SVG stage with:

- learner car fixed at bottom center;
- vertical road and dashed center line;
- junction group whose `translateY` is derived from `elapsedMs / durationMs`;
- three large answer buttons below the stage;
- Replay and Pause/Resume controls; and
- an `aria-live="polite"` result region.

Disable answer buttons until `phase === 'decision-open'`. In reduced-motion mode render the junction at the decision position immediately and omit the animation loop.

- [ ] **Step 4: Wire data, audio, animation, and scoring**

On load:

1. fetch both production JSON arrays;
2. call `selectMovingRoadTrials`;
3. choose a trial with injected/default `Math.random`;
4. construct `Audio(trial.audioPath)`;
5. start the state and playback only after the user presses **Start / Empezar**, preserving iOS user-gesture audio rules;
6. tick with `requestAnimationFrame`;
7. dispatch answer IDs from buttons;
8. render correct/incorrect text and stop animation at reveal; and
9. let **Try another / Otra** reset with the next trial.

If catalog/audio fetch or playback fails, show bilingual error text and leave scoring unavailable.

- [ ] **Step 5: Run all spike tests**

Run:

```bash
node --test experiments/moving-road-spike/tests/*.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Run browser review**

Start:

```bash
PORT=4180 npm run serve
```

Open:

`http://127.0.0.1:4180/experiments/moving-road-spike/`

At 1024×768:

- complete left, straight, and right trials;
- verify recorded Spanish audio and Replay;
- pause/resume during approach;
- verify answers are unavailable early and score correctly when open;
- switch EN/ES without changing the trial;
- emulate reduced motion and complete a static trial;
- verify 44px touch targets, keyboard focus, no horizontal scroll, and no console warnings/errors.

Capture one approach and one reveal screenshot in:

`docs/experiments/evidence/2026-08-04-moving-road/`

- [ ] **Step 7: Commit the bounded moving-road result**

Update the lab and `.superpowers/sdd/progress.md`, then run:

```bash
node --test experiments/moving-road-spike/tests/*.test.js
npm test
git diff --check
git status --short
```

Commit and push:

```bash
git add experiments/moving-road-spike docs/experiments .superpowers/sdd/progress.md
git commit -m "Add moving-road coding spike"
git push origin main
```
