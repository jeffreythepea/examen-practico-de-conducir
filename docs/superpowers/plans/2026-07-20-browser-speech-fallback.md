# Browser Spanish Speech Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every supported command playable and normally scoreable by automatically using browser `es-ES` speech when a static MP3 is missing or fails.

**Architecture:** Add a focused Web Speech wrapper with the same scored/unscored lifecycle as recorded audio, then compose it behind the existing audio player. App-level playback selection continues to prefer manifest recordings and creates an in-memory browser-speech descriptor only when no recording exists; the exact descriptor and phrasing remain stable through replay, hint, reveal, and attempt logging.

**Tech Stack:** Browser-native ES modules, Web Speech API (`speechSynthesis` and `SpeechSynthesisUtterance`), HTML audio, Node.js 20+ test runner.

## Global Constraints

- Pre-generated ElevenLabs MP3s remain the preferred source.
- Commands and generated/fallback speech remain Spanish.
- No provider credential, backend, or paid runtime API enters the browser.
- All introduced interface copy exists in English and Spanish.
- Stable command, action, phrasing, surface, and attempt provenance is preserved.
- Failed, interrupted, unsupported, or backgrounded speech remains unscored.
- Tests gate every change; run the focused test before and after each implementation step.

---

### Task 1: Browser speech lifecycle

**Files:**
- Create: `src/browser-speech.js`
- Create: `tests/browser-speech.test.js`

**Interfaces:**
- Consumes: `{ text: string, speed: 0.75 | 0.9 | 1 }`, injected `speechSynthesis`, `UtteranceCtor`, and `document`.
- Produces: `supportsBrowserSpeech(dependencies): boolean` and `createBrowserSpeechPlayer(dependencies): { play(request): Promise<PlaybackResult>, cancel(reason): void }`, where `PlaybackResult` is `{ scored: true }` or `{ scored: false, reason: string }`.

- [ ] **Step 1: Write failing support and voice-selection tests**

Add fixtures with `es-ES`, `es-MX`, and English voices and assertions equivalent to:

```js
assert.equal(supportsBrowserSpeech({ speechSynthesis, UtteranceCtor }), true);
assert.equal(supportsBrowserSpeech({ speechSynthesis: null, UtteranceCtor }), false);

const result = player.play({ text: 'Encienda las luces de cruce', speed: 0.9 });
assert.equal(utterances[0].lang, 'es-ES');
assert.equal(utterances[0].voice.lang, 'es-ES');
assert.equal(utterances[0].rate, 0.9);
utterances[0].onend();
assert.deepEqual(await result, { scored: true });
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/browser-speech.test.js`

Expected: FAIL because `src/browser-speech.js` does not exist.

- [ ] **Step 3: Implement support detection, Spanish voice preference, and successful completion**

Implement the public boundary with these rules:

```js
export function supportsBrowserSpeech({ speechSynthesis, UtteranceCtor }) {
  return Boolean(speechSynthesis?.speak && speechSynthesis?.cancel && UtteranceCtor);
}

function selectSpanishVoice(voices) {
  return voices.find(voice => voice.lang?.toLowerCase() === 'es-es')
    ?? voices.find(voice => voice.lang?.toLowerCase().startsWith('es-'))
    ?? null;
}
```

`play()` must create one utterance, assign its text, `lang`, rate, and preferred voice, call `speechSynthesis.speak()`, and resolve only from the utterance `end` event.

- [ ] **Step 4: Add failing interruption and error tests**

Cover `error`, `document.hidden` plus `visibilitychange`, explicit `cancel('replaced')`, unsupported construction, and synchronous `speak()` failure. Assert `speechSynthesis.cancel()` is invoked and each result is unscored with its exact reason.

- [ ] **Step 5: Implement fail-closed cleanup**

Use a single idempotent `finish(result)` closure. Remove event and document listeners, cancel speech for unscored outcomes, clear the active operation, and never allow a late `end` to overwrite an earlier failure.

- [ ] **Step 6: Run the focused test and verify GREEN**

Run: `node --test tests/browser-speech.test.js`

Expected: all browser-speech lifecycle tests pass.

- [ ] **Step 7: Create a local checkpoint commit**

```sh
git add src/browser-speech.js tests/browser-speech.test.js
git commit -m "Add browser Spanish speech player"
```

### Task 2: Recorded-audio-first composite playback

**Files:**
- Modify: `src/audio.js`
- Modify: `tests/audio.test.js`

**Interfaces:**
- Consumes: recorded `variant`, `{ text, speed }`, and a `fallbackPlayer` implementing Task 1's interface.
- Produces: `createAudioPlayer(...).play(variant, speechRequest)`, `replay()`, `cancel()`, and `supportsFallback()`.

- [ ] **Step 1: Write failing recorded-preference and fallback tests**

Extend the audio fixture with a fake fallback player and verify:

```js
const result = player.play(recordedVariant, { text: 'Gire a la derecha', speed: 0.9 });
audio.emit('ended');
assert.deepEqual(await result, { scored: true, replays: 0 });
assert.equal(fallback.calls.length, 0);
```

Then cover an audio `error`, rejected `audio.play()`, and an in-memory variant with `provider: 'browser-speech'` and `path: null`. Each must call fallback once with the exact Spanish text and speed.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/audio.test.js`

Expected: FAIL because the current player returns the MP3 error directly and constructs `Audio` for every descriptor.

- [ ] **Step 3: Implement composite playback**

Import `createBrowserSpeechPlayer` and `supportsBrowserSpeech`. Construct the injected/default fallback once. Recorded variants start with `Audio`; missing-path or `browser-speech` variants start with speech. On recorded `error`, `abort`, or rejected `play()`, clean up the media operation and start fallback unless the operation was explicitly cancelled or the document became hidden.

Expose:

```js
return Object.freeze({
  play,
  replay,
  cancel,
  supportsFallback: () => supportsBrowserSpeech(fallbackDependencies)
});
```

- [ ] **Step 4: Write failing replay-mode and total-failure tests**

Verify that a recorded attempt which succeeded through fallback replays directly through speech without retrying the broken MP3, retains the same text and speed, and increments replay count only after successful speech. If both sources fail, assert the final result is unscored.

- [ ] **Step 5: Implement stable replay state**

Store the last successful `{ variant, speechRequest, mode }`. `replay()` must invoke that mode directly. Clear it before a new command and after a failed initial playback so a prior command can never replay.

- [ ] **Step 6: Run focused audio tests and verify GREEN**

Run: `node --test tests/audio.test.js tests/browser-speech.test.js`

Expected: all static and fallback player tests pass.

- [ ] **Step 7: Create a local checkpoint commit**

```sh
git add src/audio.js tests/audio.test.js
git commit -m "Fall back when recorded audio fails"
```

### Task 3: Fallback-aware trial selection and session availability

**Files:**
- Modify: `src/app.js`
- Modify: `tests/app-state.test.js`
- Modify: `tests/app-smoke.test.js`

**Interfaces:**
- Consumes: catalog `command.phrasings`, audio manifest, requested speed, `player.supportsFallback()`, and RNG.
- Produces: `selectPlaybackVariant(manifest, command, speed, fallbackSupported, rng)` returning either a frozen manifest record or a frozen in-memory browser-speech descriptor.

- [ ] **Step 1: Write failing selection tests**

Preserve the existing `selectAudioVariant` tests, then add:

```js
const variant = selectPlaybackVariant([], command, 0.9, true, () => 0);
assert.deepEqual(variant, {
  id: 'browser-speech--c-pre-cruce--c-pre-cruce-canonical--0.9',
  commandId: 'c-pre-cruce',
  phrasingId: 'c-pre-cruce-canonical',
  voiceId: 'browser-speech',
  speed: 0.9,
  provider: 'browser-speech',
  model: 'web-speech-api',
  path: null
});
assert.throws(() => selectPlaybackVariant([], command, 0.9, false), /Audio unavailable/);
```

Also assert manifest candidates remain preferred and randomized when they exist.

- [ ] **Step 2: Run app-state tests and verify RED**

Run: `node --test tests/app-state.test.js`

Expected: FAIL because `selectPlaybackVariant` is not exported.

- [ ] **Step 3: Implement fallback descriptor selection**

Add `selectPlaybackVariant`. It calls `selectAudioVariant` when candidates exist. Otherwise it requires fallback support, selects one catalog phrasing by RNG, and returns the frozen descriptor above. It must not mutate or append to the validated manifest.

- [ ] **Step 4: Write failing setup and playback-wiring smoke tests**

Assert source wiring contains:

```js
pool.every(command => hasAudio(command, speed) || player.supportsFallback())
selectPlaybackVariant(manifest, command, state.settings.speed, player.supportsFallback())
player.play(variant, { text: phrasing.es, speed: variant.speed })
```

Verify the complete 36-command catalog is session-eligible with the current 180-record manifest when fallback support is true, and remains fail-closed when fallback support is false.

- [ ] **Step 5: Implement fallback-aware setup and exact-text playback**

Replace direct trial selection with `selectPlaybackVariant`. Resolve the chosen phrasing before playback and pass its exact Spanish text to the player. Change setup availability only as specified; do not weaken `validateAudioManifest` or static-asset integrity validation.

- [ ] **Step 6: Run focused app tests and verify GREEN**

Run: `node --test tests/app-state.test.js tests/app-smoke.test.js tests/audio.test.js tests/browser-speech.test.js`

Expected: all selection, setup, exact-text, and player tests pass.

- [ ] **Step 7: Create a local checkpoint commit**

```sh
git add src/app.js tests/app-state.test.js tests/app-smoke.test.js
git commit -m "Enable fallback-backed practice sessions"
```

### Task 4: Preserve fallback provenance in attempts

**Files:**
- Modify: `src/app.js`
- Modify: `src/training.js`
- Modify: `src/storage.js`
- Modify: `tests/training.test.js`
- Modify: `tests/storage.test.js`

**Interfaces:**
- Consumes: `before.variant.provider` from the retained playback descriptor.
- Produces: optional persisted `audioProvider` on new attempt records; old backups without it remain valid.

- [ ] **Step 1: Write failing attempt and backward-compatibility tests**

Pass `audioProvider: 'browser-speech'` to `recordAttempt` and assert the scored attempt retains it. Assert storage round-trips that value, accepts old attempts without `audioProvider`, and rejects a present non-string/empty value.

- [ ] **Step 2: Run focused persistence tests and verify RED**

Run: `node --test tests/training.test.js tests/storage.test.js`

Expected: FAIL because attempts currently omit and do not validate provider provenance.

- [ ] **Step 3: Implement optional provider provenance**

Add `audioProvider: input.audioProvider` to newly recorded attempts. In storage validation, require a nonempty string only when the property is present. Pass `before.variant.provider` from `completeTrial` in `src/app.js`.

- [ ] **Step 4: Run focused persistence tests and verify GREEN**

Run: `node --test tests/training.test.js tests/storage.test.js tests/app-state.test.js`

Expected: all attempt, migration, and reducer tests pass.

- [ ] **Step 5: Create a local checkpoint commit**

```sh
git add src/app.js src/training.js src/storage.js tests/training.test.js tests/storage.test.js
git commit -m "Record fallback audio provenance"
```

### Task 5: Documentation, release gates, and iPad review

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `tests/release-audit.test.js`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: completed Tasks 1-4 and the existing 180 published plus 136 recovered static clips.
- Produces: a review-ready fallback-capable build whose static corpus can still be completed and atomically published later.

- [ ] **Step 1: Write failing release-documentation assertions**

Require documentation to state that static MP3 is preferred, browser `es-ES` speech is automatic for missing/failed playback, completed fallback is scored normally, total failure remains unscored, and no runtime credential/backend is used.

- [ ] **Step 2: Run release-audit tests and verify RED**

Run: `node --test tests/release-audit.test.js`

Expected: FAIL until fallback behavior is documented.

- [ ] **Step 3: Update documentation and recovery ledger**

Revise the in-progress expansion notes so they no longer say the final eight clips block the app. Keep the exact static-corpus recovery state and explain that future completion replaces browser speech for those variants without changing scoring or IDs. Record checkpoint commits and verification commands in `.superpowers/sdd/progress.md`.

- [ ] **Step 4: Run complete automated verification**

Run:

```sh
npm test
npm run release:check
git diff --check
```

Expected: all repository tests and release checks pass; no credential-shaped text or whitespace errors appear.

- [ ] **Step 5: Perform browser review at 1024×768**

With the incomplete static manifest, verify a Mixed 10-command session can start, a recorded command still uses MP3, a missing command reaches prompt through browser speech, Show Spanish/reveal match the spoken phrasing, replay repeats it, the bilingual AI disclosure remains visible, and browser warnings/errors are empty. If automated browser speech is unavailable in the test browser, verify the fail-closed setup state there and leave the successful speech-policy check for Jeffrey's iPad smoke.

- [ ] **Step 6: Write the final checkpoint and create a local commit**

Record exact test counts, browser results, the remaining eight ElevenLabs variants, the recovery path, and the manual iPad smoke requirement. Then stage only the intended build files and commit:

```sh
git add README.md CHANGELOG.md docs/design.md tests/release-audit.test.js .superpowers/sdd/progress.md
git commit -m "Document browser speech fallback"
```

Do not push without Jeffrey's separate authorization.
