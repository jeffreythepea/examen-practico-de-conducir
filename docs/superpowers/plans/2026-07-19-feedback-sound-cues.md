# Feedback Sound Cues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add locally synthesized correct, incorrect, and Spanish-hint feedback sounds with a persisted bilingual on/off setting and no effect on scoring or examiner audio.

**Architecture:** A new `feedback-audio` module owns the Web Audio context and accepts only semantic cue names. A pure application helper maps successful reducer transitions to cue names, while setup/storage/localization own the independent persisted setting. Playback remains best-effort and outside reducer state.

**Tech Stack:** Browser Web Audio API, ES modules, Node.js test runner, existing immutable screen reducer and storage schema

## Global Constraints

- Correct and assisted-correct responses share one bright rising chime.
- User-selected incorrect responses use one restrained low buzzer; timeouts remain silent.
- A successful `SHOW_SPANISH` transition uses one playful coin-plink/reveal cue.
- Every cue is synthesized locally, contains no sampled or branded melody, and lasts less than 600 milliseconds.
- Feedback-sound failure never affects scoring, timing, focus, navigation, or examiner audio.
- `Feedback sounds` defaults on, persists independently, and never mutes examiner-command playback.
- All new interface copy exists in English and Spanish.
- Older version-1 backups without the additive setting import with the safe default of on.
- Jeffrey reviews, commits, and pushes; leave all changes uncommitted.

---

### Task 1: Pure Feedback Audio Engine

**Files:**
- Create: `src/feedback-audio.js`
- Create: `tests/feedback-audio.test.js`

**Interfaces:**
- Produces: `FEEDBACK_CUES`, `CUE_DEFINITIONS`, and `createFeedbackCuePlayer({ contextFactory })`
- `player.play(cue, { enabled, busy })` resolves to `true` only after a valid schedule is created
- `player.stop()` stops and clears every active oscillator without throwing

- [ ] **Step 1: Write failing tests for cue vocabulary and scheduling**

Test that the frozen cue list is exactly `['correct', 'incorrect', 'spanish-hint']`; every tone has positive frequency, gain, start, and duration bounds; each definition ends before 0.6 seconds; disabled, busy, and unsupported requests do not create a context; valid requests create oscillators; and `stop()` stops active oscillators.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/feedback-audio.test.js`

Expected: FAIL because `src/feedback-audio.js` does not exist.

- [ ] **Step 3: Implement the minimal cue engine**

Use deterministic tone schedules:

```js
export const FEEDBACK_CUES = Object.freeze(['correct', 'incorrect', 'spanish-hint']);

export const CUE_DEFINITIONS = deepFreeze({
  correct: [
    { frequency: 523.25, type: 'sine', start: 0, duration: 0.18, gain: 0.16 },
    { frequency: 659.25, type: 'sine', start: 0.11, duration: 0.28, gain: 0.14 }
  ],
  incorrect: [
    { frequency: 145, type: 'sawtooth', start: 0, duration: 0.34, gain: 0.09 },
    { frequency: 112, type: 'square', start: 0.08, duration: 0.30, gain: 0.035 }
  ],
  'spanish-hint': [
    { frequency: 880, type: 'sine', start: 0, duration: 0.10, gain: 0.11 },
    { frequency: 1108.73, type: 'sine', start: 0.08, duration: 0.11, gain: 0.10 },
    { frequency: 1318.51, type: 'sine', start: 0.16, duration: 0.12, gain: 0.09 },
    { frequency: 1760, type: 'triangle', start: 0.23, duration: 0.24, gain: 0.035 }
  ]
});
```

Construct the audio context lazily. For each tone, create oscillator and gain nodes, schedule a short attack and release, connect to `context.destination`, and remove the oscillator from the active set on `ended`. Catch context creation, resume, scheduling, and stopping errors and return `false` instead of throwing.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/feedback-audio.test.js`

Expected: PASS.

### Task 2: Persisted Bilingual Setting

**Files:**
- Modify: `src/storage.js`
- Modify: `tests/storage.test.js`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.js`
- Modify: `src/app.js`
- Modify: `tests/app-smoke.test.js`

**Interfaces:**
- Consumes: existing `state.settings` update/save/import flow
- Produces: boolean `settings.feedbackSounds`, setup control `data-setting="feedbackSounds"`, and symmetric bilingual labels

- [ ] **Step 1: Write failing storage, localization, and setup tests**

Assert the default setting is `true`; false round-trips through save/export/import; missing `feedbackSounds` in an older version-1 backup is normalized to `true`; non-boolean values are rejected; dictionaries contain `setting.feedbackSounds`, `feedbackSounds.on`, and `feedbackSounds.off`; and setup renders the new setting with 44px-capable existing select styling.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/storage.test.js tests/i18n.test.js tests/app-smoke.test.js`

Expected: FAIL on the missing setting and copy.

- [ ] **Step 3: Implement storage normalization and UI copy**

Add `feedbackSounds: true` to `defaultState().settings`. In `validateSettings`, assign `true` only when the cloned input omits the field, then require a boolean. Add setup copy:

```js
// English
'setting.feedbackSounds': 'Feedback sounds',
'feedbackSounds.on': 'On',
'feedbackSounds.off': 'Off',

// Spanish
'setting.feedbackSounds': 'Sonidos de respuesta',
'feedbackSounds.on': 'Activados',
'feedbackSounds.off': 'Desactivados',
```

Render `selectControl('feedbackSounds', 'setting.feedbackSounds', [[true, 'feedbackSounds.on'], [false, 'feedbackSounds.off']])` and parse it with the same boolean branch as `timed`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/storage.test.js tests/i18n.test.js tests/app-smoke.test.js`

Expected: PASS.

### Task 3: Transition-to-Cue Integration

**Files:**
- Modify: `src/app.js`
- Modify: `tests/app-state.test.js`

**Interfaces:**
- Consumes: `createFeedbackCuePlayer`, reducer before/after models, accepted event, `settings.feedbackSounds`, and `audioBusy`
- Produces: `feedbackCueForTransition(before, after, event)` returning a cue name or `null`

- [ ] **Step 1: Write failing transition mapping tests**

Cover unaided and assisted reveal → `correct`; answered incorrect reveal → `incorrect`; timeout → `null`; first accepted `SHOW_SPANISH` → `spanish-hint`; repeated, forged, replay-pending, rerender, locale, and continue transitions → `null`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/app-state.test.js`

Expected: FAIL because `feedbackCueForTransition` is not exported.

- [ ] **Step 3: Implement pure transition mapping and browser integration**

```js
export function feedbackCueForTransition(before, after, event) {
  if (before === after) return null;
  if (event.type === 'SHOW_SPANISH' && !before.textShown && after.textShown) return 'spanish-hint';
  if (before.screen !== 'prompt' || after.screen !== 'reveal' || after.timeout) return null;
  return after.outcome === 'incorrect' ? 'incorrect' : 'correct';
}
```

Create one feedback player during bootstrap. In the Show Spanish handler and `completeTrial`, compute the cue only after `reduceScreen` accepts the transition, render first, then request best-effort playback with `{ enabled: state.settings.feedbackSounds, busy: audioBusy }`. Call `feedbackPlayer.stop()` immediately before starting a new examiner command. Do not await cue playback and do not store its result.

- [ ] **Step 4: Run focused integration tests and verify GREEN**

Run: `node --test tests/app-state.test.js tests/feedback-audio.test.js`

Expected: PASS.

### Task 4: Full Verification and Listening Review

**Files:**
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: Tasks 1–3
- Produces: an uncommitted review build and recovery checkpoint

- [ ] **Step 1: Run repository gates**

Run:

```bash
npm test
git diff --check
```

Expected: all tests PASS and whitespace check is silent.

- [ ] **Step 2: Perform local browser smoke**

At 1024×768, confirm the bilingual setting appears and persists, examiner audio still plays, Show Spanish sounds once, answered correct and incorrect outcomes sound once, timeout stays silent, and turning feedback sounds off suppresses all three cues. Confirm the AI-voice disclosure remains visible and browser logs contain no errors.

- [ ] **Step 3: Update the recovery ledger**

Record exact test totals, listening results, browser limitations, and that the build remains uncommitted.

- [ ] **Step 4: Present the review point**

Give Jeffrey the local game URL and request a short normal-volume listening review. Do not commit or push.
