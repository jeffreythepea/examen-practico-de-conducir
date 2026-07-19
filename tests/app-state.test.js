import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureFocusSnapshot,
  focusScreen,
  generateSurfaceWithRetries,
  localizedVehicleAnswer,
  nextSurfaceSeed,
  promptControlsDisabled,
  reduceScreen,
  restoreFocusSnapshot,
  restoreOrDeferFocus,
  selectAudioVariant
} from '../src/app.js';
import { defaultState, loadState, saveState } from '../src/storage.js';
import { renderSurfaceModel } from '../src/surfaces.js';
import { recordAttempt } from '../src/training.js';

const settings = Object.freeze({
  locale: 'en', phase: 'driving', speed: 0.9, hintPolicy: 'available', timed: false, length: 'short'
});
const session = Object.freeze([
  Object.freeze({
    id: 'c-der', actionId: 'turn-right', phase: 'driving', acceptedResult: 'turn-right',
    surfaceId: 'junction-v2', phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha', en: 'turn right' }]
  }),
  Object.freeze({
    id: 'c-izq', actionId: 'turn-left', phase: 'driving', acceptedResult: 'turn-left',
    surfaceId: 'junction-v2', phrasings: [{ id: 'c-izq-canonical', es: 'Gire a la izquierda', en: 'turn left' }]
  })
]);
const rightVariant = Object.freeze({
  id: 'right-roger', commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'roger', speed: 0.9,
  path: 'audio/right.mp3'
});
const wheelCommand = Object.freeze({
  id: 'c-volante',
  actionId: 'steering-straight',
  phase: 'driving',
  acceptedResult: 'steering-straight',
  surfaceId: 'wheel-center-v1',
  phrasings: [{ id: 'c-volante-canonical', es: 'Enderece el volante', en: 'straighten the wheel' }]
});
const secureCommand = Object.freeze({
  id: 'c-inmov',
  actionId: 'secure-vehicle',
  phase: 'driving',
  acceptedResult: 'secure-vehicle',
  surfaceId: 'secure-yaris-v1',
  phrasings: [{ id: 'c-inmov-canonical', es: 'Inmovilice el vehículo', en: 'secure the vehicle' }]
});

function setupModel() {
  return { screen: 'setup', settings, session: [], index: 0 };
}

function promptModel({ textShown = false } = {}) {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000, seed: 123 });
  if (textShown) model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  return model;
}

function controlPrompt(command, seed) {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session: [command] });
  return reduceScreen(model, {
    type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000, seed
  });
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test('a trial creates one immutable surface model and preserves its reference through same-trial events', () => {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000, seed: 123
  });
  const activeSurfaceModel = model.activeSurfaceModel;

  assert.equal(activeSurfaceModel.seed, 123);
  assert.equal(Object.isFrozen(activeSurfaceModel), true);
  model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  assert.strictEqual(model.activeSurfaceModel, activeSurfaceModel);
  model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 9 });
  assert.strictEqual(model.activeSurfaceModel, activeSurfaceModel);
  model = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 9, completedAt: 1_100 });
  assert.strictEqual(model.activeSurfaceModel, activeSurfaceModel);
  model = reduceScreen(model, { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' });
  assert.strictEqual(model.activeSurfaceModel, activeSurfaceModel);
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_200, seed: 999
  });
  assert.strictEqual(model.activeSurfaceModel, activeSurfaceModel, 'same-trial retry must not regenerate');
});

test('empty taps and incomplete surface responses never leave the prompt or become scoreable', () => {
  const active = controlPrompt(wheelCommand, 4);
  const empty = reduceScreen(active, { type: 'SURFACE_EMPTY_TAPPED' });
  const partial = reduceScreen(active, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'set-wheel', degrees: 18 }
  });

  assert.strictEqual(empty, active);
  assert.equal(partial.screen, 'prompt');
  assert.strictEqual(partial.activeSurfaceModel, active.activeSurfaceModel);
  assert.deepEqual(partial.surfaceResponse, { complete: false, wheelDegrees: 18 });
  assert.equal(partial.outcome, null);
});

test('native surface events normalize correct and incorrect reveal provenance', () => {
  const active = promptModel();
  const correctTarget = active.activeSurfaceModel.targets.find(target =>
    target.resultId === active.activeSurfaceModel.expectedResult
  );
  const wrongTarget = active.activeSurfaceModel.targets.find(target => target.id !== correctTarget.id);

  const correct = reduceScreen(active, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: correctTarget.id },
    completedAt: 1_500
  });
  assert.equal(correct.screen, 'reveal');
  assert.equal(correct.selectedResult, correctTarget.resultId);
  assert.equal(correct.selectedTargetId, correctTarget.id);
  assert.strictEqual(correct.activeSurfaceModel, active.activeSurfaceModel);

  const incorrect = reduceScreen(active, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: wrongTarget.id },
    completedAt: 1_500
  });
  assert.equal(incorrect.screen, 'reveal');
  assert.equal(incorrect.outcome, 'incorrect');
  assert.equal(incorrect.selectedTargetId, wrongTarget.id);
});

test('first scored response saves and reveal-renders when randomUUID is absent but getRandomValues is available', () => {
  const before = promptModel();
  const target = before.activeSurfaceModel.targets.find(candidate =>
    candidate.resultId === before.activeSurfaceModel.expectedResult
  );
  const after = reduceScreen(before, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: target.id },
    completedAt: 1_500
  });
  const cryptoRef = {
    getRandomValues(values) {
      for (let index = 0; index < values.length; index += 1) values[index] = index;
      return values;
    }
  };

  const result = recordAttempt(defaultState(), {
    audio: { scored: true },
    commandId: before.session[before.index].id,
    actionId: before.session[before.index].actionId,
    phrasingId: before.variant.phrasingId,
    voiceId: before.variant.voiceId,
    speed: before.variant.speed,
    phase: before.session[before.index].phase,
    surfaceId: before.session[before.index].surfaceId,
    surfaceModel: before.activeSurfaceModel,
    selectedResult: after.selectedResult,
    selectedTargetId: after.selectedTargetId,
    correct: after.correct,
    textShown: after.textShown,
    responseMs: after.responseMs,
    replays: after.replays,
    timed: false,
    timeout: after.timeout
  }, {
    now: () => 2_000,
    randomUUID: null,
    cryptoRef
  });

  assert.equal(result.attempt.id, '00010203-0405-4607-8809-0a0b0c0d0e0f');
  const storage = memoryStorage();
  saveState(storage, result.state);
  assert.equal(loadState(storage).attempts[0].id, result.attempt.id);
  const markup = renderSurfaceModel(before.activeSurfaceModel, after.surfaceResponse, 'en', {
    disabled: true,
    reveal: true,
    selectedTargetId: after.selectedTargetId
  });
  assert.match(markup, new RegExp(`data-target="${after.selectedTargetId}"`));
  assert.match(markup, /aria-current="true"/);
});

test('forged, mismatched, and targetless completion events remain unscored', () => {
  const active = promptModel();
  const correctTarget = active.activeSurfaceModel.targets.find(target =>
    target.resultId === active.activeSurfaceModel.expectedResult
  );
  const wrongTarget = active.activeSurfaceModel.targets.find(target => target.id !== correctTarget.id);

  assert.strictEqual(reduceScreen(active, {
    type: 'SELECT_RESULT', selectedResult: 'not-a-real-result', completedAt: 1_500
  }), active);
  assert.strictEqual(reduceScreen(active, {
    type: 'SURFACE_RESPONSE_UPDATED',
    response: {
      complete: true,
      selectedResult: correctTarget.resultId,
      selectedTargetId: wrongTarget.id
    },
    completedAt: 1_500
  }), active);
  assert.strictEqual(reduceScreen(active, {
    type: 'SURFACE_RESPONSE_UPDATED',
    response: { complete: true, selectedResult: correctTarget.resultId, selectedTargetId: null },
    completedAt: 1_500
  }), active);

  const exhausted = { ...active, activeSurfaceModel: null, surfaceError: 'invalid geometry' };
  assert.strictEqual(reduceScreen(exhausted, {
    type: 'SELECT_RESULT', selectedResult: correctTarget.resultId, completedAt: 1_500
  }), exhausted);
});

test('forged terminal wheel and secure responses leave the identical prompt state', () => {
  const wheel = controlPrompt(wheelCommand, 4);
  assert.strictEqual(reduceScreen(wheel, {
    type: 'SURFACE_RESPONSE_UPDATED',
    response: {
      complete: true,
      selectedResult: 'steering-straight',
      selectedTargetId: 'wheel-center',
      wheelDegrees: 18
    },
    completedAt: 1_500
  }), wheel);
  assert.strictEqual(reduceScreen(wheel, {
    type: 'SELECT_RESULT', selectedResult: 'steering-straight', completedAt: 1_500
  }), wheel, 'legacy result-only events cannot bypass wheel tolerance');

  const secure = controlPrompt(secureCommand, 5);
  assert.strictEqual(reduceScreen(secure, {
    type: 'SURFACE_RESPONSE_UPDATED',
    response: {
      complete: true,
      selectedResult: 'secure-vehicle',
      selectedTargetId: 'selector-park'
    },
    completedAt: 1_500
  }), secure);
  assert.strictEqual(reduceScreen(secure, {
    type: 'SELECT_RESULT', selectedResult: 'secure-vehicle', completedAt: 1_500
  }), secure, 'legacy result-only events cannot bypass the secure sequence');
});

test('reducer-owned native events score authentic centered wheel and complete secure sequence responses', () => {
  const wheel = controlPrompt(wheelCommand, 4);
  const centered = reduceScreen(wheel, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'set-wheel', degrees: 0 },
    completedAt: 1_500
  });
  assert.equal(centered.screen, 'reveal');
  assert.equal(centered.correct, true);
  assert.equal(centered.selectedResult, 'steering-straight');
  assert.equal(centered.selectedTargetId, 'wheel-center');

  const secure = controlPrompt(secureCommand, 5);
  const parkingBrakeSet = reduceScreen(secure, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'parking-brake' },
    completedAt: 1_250
  });
  assert.equal(parkingBrakeSet.screen, 'prompt');
  assert.deepEqual(parkingBrakeSet.surfaceResponse, {
    complete: false,
    completedSteps: ['parking-brake'],
    nextStepIndex: 1
  });
  const secured = reduceScreen(parkingBrakeSet, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'selector-park' },
    completedAt: 1_500
  });
  assert.equal(secured.screen, 'reveal');
  assert.equal(secured.correct, true);
  assert.equal(secured.selectedResult, 'secure-vehicle');
  assert.equal(secured.selectedTargetId, 'selector-park');
  assert.deepEqual(secured.surfaceResponse.completedSteps, ['parking-brake', 'selector-park']);
});

test('driving-only c-inmov prompt and reveal both expose the accessible provisional notice', () => {
  let model = controlPrompt(secureCommand, 5);
  assert.equal(model.settings.phase, 'driving');
  const promptMarkup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'en', {
    disabled: false
  });
  assert.match(promptMarkup, /role="note"[^>]+data-command="c-inmov"/);
  assert.match(promptMarkup, /provisional automatic-hybrid reference/i);
  assert.doesNotMatch(promptMarkup.match(/<aside[\s\S]*?<\/aside>/)[0], /parking|brake|selector|→/i);

  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'activate', targetId: 'parking-brake' }
  });
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'activate', targetId: 'selector-park' }
  });
  assert.equal(model.textShown, false);
  assert.equal(model.outcome, 'unaided');
  const revealMarkup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'es', {
    disabled: true,
    reveal: true,
    selectedTargetId: model.selectedTargetId
  });
  assert.match(revealMarkup, /role="note"[^>]+data-command="c-inmov"/);
  assert.match(revealMarkup, /referencia provisional del híbrido automático/i);
  assert.match(revealMarkup.match(/<aside[\s\S]*?<\/aside>/)[0], /freno de estacionamiento.*selector P/i);
});

test('bounded surface generation uses exactly three deterministic seeds and exposes unscored exhaustion', () => {
  const attemptedSeeds = [];
  const generated = generateSurfaceWithRetries(session[0], 7, (_command, seed) => {
    attemptedSeeds.push(seed);
    if (attemptedSeeds.length < 3) throw new Error('invalid geometry');
    return Object.freeze({ seed });
  });
  assert.deepEqual(attemptedSeeds, [
    7,
    (7 + 0x9e3779b9) >>> 0,
    (7 + 2 * 0x9e3779b9) >>> 0
  ]);
  assert.deepEqual(generated, { model: Object.freeze({ seed: attemptedSeeds[2] }), error: null });
  assert.throws(() => generateSurfaceWithRetries(session[0], -1), /uint32/);
  assert.throws(() => generateSurfaceWithRetries(session[0], 1.5), /uint32/);
  assert.throws(() => generateSurfaceWithRetries(session[0], 0x1_0000_0000), /uint32/);

  let loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  loading = reduceScreen(loading, {
    type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000, seed: 7
  }, {
    surfaceGenerator() { throw new Error('still invalid'); }
  });
  assert.equal(loading.screen, 'prompt');
  assert.equal(loading.activeSurfaceModel, null);
  assert.match(loading.surfaceError, /still invalid/);
  assert.equal(loading.outcome, null);
  assert.strictEqual(reduceScreen(loading, { type: 'TIMEOUT', completedAt: 9_000 }), loading);
});

test('surface seeds come from one cryptographic uint32 and advancing clears trial-local surface state', () => {
  const cryptoRef = {
    getRandomValues(values) {
      values[0] = 0xfedcba98;
      return values;
    }
  };
  assert.equal(nextSurfaceSeed(cryptoRef), 0xfedcba98);

  const active = promptModel();
  const target = active.activeSurfaceModel.targets.find(candidate =>
    candidate.resultId === active.activeSurfaceModel.expectedResult
  );
  const revealed = reduceScreen(active, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: target.id }
  });
  const next = reduceScreen(revealed, { type: 'CONTINUE' });
  assert.equal(next.activeSurfaceModel, null);
  assert.deepEqual(next.surfaceResponse, {});
  assert.equal(next.selectedTargetId, null);
  assert.equal(next.correct, false);

  const abandoned = reduceScreen(revealed, { type: 'GO_TO_SETUP' });
  assert.equal(abandoned.screen, 'setup');
  assert.equal(abandoned.activeSurfaceModel, null);
  assert.deepEqual(abandoned.surfaceResponse, {});
  assert.equal(abandoned.selectedTargetId, null);
  assert.equal(abandoned.correct, false);
});

test('secure first step survives timeout so reveal identifies selector P as the remaining control', () => {
  let model = controlPrompt(secureCommand, 5);
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'parking-brake' }
  });
  model = reduceScreen(model, { type: 'TIMEOUT', completedAt: 9_000 });

  assert.equal(model.screen, 'reveal');
  assert.deepEqual(model.surfaceResponse, {
    complete: true,
    completedSteps: ['parking-brake'],
    nextStepIndex: 1,
    selectedResult: null,
    selectedTargetId: null
  });
  const markup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'en', {
    disabled: true,
    reveal: true,
    selectedTargetId: model.selectedTargetId
  });
  assert.match(markup, /data-target="parking-brake"[^>]+aria-pressed="true"/);
  assert.doesNotMatch(markup, /data-target="parking-brake"[^>]+aria-current="true"/);
  assert.match(markup, /data-target="selector-park"[^>]+aria-current="true"/);
});

test('partial wheel position survives timeout and reveal keeps it distinct from the centered reference', () => {
  let model = controlPrompt(wheelCommand, 4);
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'set-wheel', degrees: 18 }
  });
  model = reduceScreen(model, { type: 'TIMEOUT', completedAt: 9_000 });

  assert.equal(model.correct, false);
  assert.deepEqual(model.surfaceResponse, {
    complete: true,
    wheelDegrees: 18,
    selectedResult: null,
    selectedTargetId: null
  });
  const markup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'en', {
    disabled: true,
    reveal: true,
    selectedTargetId: model.selectedTargetId
  });
  assert.match(markup, /data-wheel-position="learner" data-selection-state="wrong"/);
  assert.match(markup, /data-wheel-position="correct-reference"/);
  assert.match(markup, /style="--wheel-degrees:18deg"/);
  assert.match(markup, /style="--wheel-degrees:0deg"/);
});

test('screen reducer follows setup to loading, prompt, reveal, the next prompt, and results only through Continue', () => {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 0);

  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000 });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.promptStartedAt, 1_000);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_900 });
  assert.equal(model.screen, 'reveal');
  assert.equal(model.outcome, 'unaided');
  assert.equal(model.responseMs, 900);
  assert.equal(model.index, 0, 'answer reveal must not advance automatically');

  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 1);

  const leftVariant = { ...rightVariant, id: 'left-roger', commandId: 'c-izq', phrasingId: 'c-izq-canonical' };
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: leftVariant, completedAt: 2_000 });
  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 2_300 });
  assert.equal(model.screen, 'reveal');
  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.screen, 'results');
});

test('Spanish hint stays in the prompt and makes a later correct response assisted', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.textShown, true);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500 });
  assert.equal(model.outcome, 'assisted');
});

test('replay locks the prompt, ignores stale completion, and counts one matching completion exactly once', () => {
  let model = promptModel();
  const chosen = model.variant;
  model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 7 });
  assert.equal(model.replayPending, true);
  assert.equal(promptControlsDisabled(model), true);
  assert.strictEqual(reduceScreen(model, { type: 'SHOW_SPANISH' }), model);
  assert.strictEqual(
    reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_050 }),
    model
  );

  const wrongOperation = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 6, completedAt: 1_100 });
  assert.strictEqual(wrongOperation, model);
  model = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 7, completedAt: 1_100 });
  assert.equal(model.replayPending, false);
  assert.equal(model.replays, 1);
  assert.strictEqual(model.variant, chosen);
  const duplicate = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 7, completedAt: 1_200 });
  assert.strictEqual(duplicate, model);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_250 });
  const revealed = model;
  model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId: 7, reason: 'error' });
  assert.strictEqual(model, revealed, 'a stale replay failure must not leave or rescore the reveal');
});

test('a matching replay failure returns the still-active prompt to unscored retry', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 8 });
  model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId: 8, reason: 'error' });
  assert.equal(model.replays, 0);
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.outcome, null);
});

test('wrong answers and timeouts reveal an optional six-reason diagnosis', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 1_250 });
  assert.equal(model.outcome, 'incorrect');
  assert.deepEqual(model.allowedMissReasons, ['hearing', 'meaning', 'mapping', 'target', 'accidental', 'other']);
  model = reduceScreen(model, { type: 'SET_MISS_REASON', reason: 'meaning' });
  assert.equal(model.missReason, 'meaning');

  let timed = promptModel();
  timed = reduceScreen(timed, { type: 'TIMEOUT', completedAt: 9_000 });
  assert.equal(timed.outcome, 'incorrect');
  assert.equal(timed.timeout, true);
  assert.equal(timed.selectedResult, null);
});

test('failed or interrupted audio returns to retry without creating a scoreable answer', () => {
  let loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  loading = reduceScreen(loading, { type: 'AUDIO_FAILED', reason: 'error' });
  assert.equal(loading.screen, 'loading-audio');
  assert.equal(loading.audioError, 'error');
  assert.equal(loading.outcome, null);

  let prompt = promptModel();
  prompt = reduceScreen(prompt, { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' });
  assert.equal(prompt.screen, 'loading-audio');
  assert.equal(prompt.audioError, 'visibilitychange');
  assert.equal(prompt.outcome, null);
});

test('switching interface language preserves the active command and selected audio', () => {
  const model = promptModel();
  const changed = reduceScreen(model, { type: 'SET_LOCALE', locale: 'es' });
  assert.equal(changed.settings.locale, 'es');
  assert.strictEqual(changed.session, model.session);
  assert.strictEqual(changed.variant, model.variant);
  assert.equal(changed.index, model.index);
});

test('audio selection randomly chooses between available voices and returns one immutable trial variant', () => {
  const manifest = [
    rightVariant,
    { ...rightVariant, id: 'right-sarah', voiceId: 'sarah', path: 'audio/right-sarah.mp3' },
    { ...rightVariant, id: 'right-fast', speed: 1 }
  ];
  const selection = { commandId: 'c-der', phrasingId: 'c-der-canonical', speed: 0.9 };

  const roger = selectAudioVariant(manifest, selection, () => 0);
  const sarah = selectAudioVariant(manifest, selection, () => 0.999);
  assert.equal(roger.voiceId, 'roger');
  assert.equal(sarah.voiceId, 'sarah');
  assert.ok(Object.isFrozen(roger));
  assert.throws(() => selectAudioVariant(manifest, { ...selection, speed: 0.75 }, () => 0), /Audio unavailable/);
});

test('vehicle procedures select an explicit locale field without mixing languages', () => {
  const command = {
    vehicle: {
      answer: 'Abra el capó.',
      answerEn: 'Open the bonnet.'
    }
  };
  assert.equal(localizedVehicleAnswer(command, 'en'), 'Open the bonnet.');
  assert.equal(localizedVehicleAnswer(command, 'es'), 'Abra el capó.');
});

test('screen focus moves only on screen transitions', () => {
  let focusCalls = 0;
  const target = { focus(options) { focusCalls += 1; assert.deepEqual(options, { preventScroll: true }); } };
  const documentRef = { querySelector(selector) { assert.equal(selector, '[data-screen-focus]'); return target; } };

  assert.equal(focusScreen(documentRef, { previousScreen: 'prompt', nextScreen: 'reveal' }), true);
  assert.equal(focusCalls, 1);
  assert.equal(focusScreen(documentRef, { previousScreen: 'reveal', nextScreen: 'reveal' }), false);
  assert.equal(focusCalls, 1);
});

function focusElement(attributes, options = {}) {
  return {
    disabled: false,
    ...options,
    getAttribute(name) {
      return attributes[name] ?? null;
    }
  };
}

function focusFixture(activeElement, replacements, { insideApp = true } = {}) {
  const queries = [];
  const app = {
    contains(element) {
      return insideApp && element === activeElement;
    },
    querySelector(selector) {
      queries.push(selector);
      return replacements.get(selector) ?? null;
    }
  };
  return { app, documentRef: { activeElement }, queries };
}

test('same-screen setup and locale rerenders restore the equivalent replacement control', () => {
  for (const [attribute, value] of [['data-setting', 'phase'], ['data-locale', 'es']]) {
    const oldControl = focusElement({ [attribute]: value });
    let focused = 0;
    const newControl = focusElement({ [attribute]: value }, {
      focus(options) {
        focused += 1;
        assert.deepEqual(options, { preventScroll: true });
      }
    });
    const selector = `[${attribute}="${value}"]`;
    const { app, documentRef } = focusFixture(oldControl, new Map([[selector, newControl]]));

    const snapshot = captureFocusSnapshot(app, documentRef);
    assert.equal(restoreFocusSnapshot(app, snapshot), true);
    assert.equal(focused, 1);
  }
});

test('same-screen hint and diagnosis rerenders restore a usable prompt/reveal control', () => {
  const oldHint = focusElement({ 'data-action': 'show-spanish' });
  let replayFocused = 0;
  const newReplay = focusElement({ 'data-action': 'replay' }, {
    focus() { replayFocused += 1; }
  });
  const hintFixture = focusFixture(oldHint, new Map([
    ['[data-action="show-spanish"]', null],
    ['[data-action="replay"]', newReplay]
  ]));
  const hintSnapshot = captureFocusSnapshot(hintFixture.app, hintFixture.documentRef);
  assert.equal(restoreFocusSnapshot(hintFixture.app, hintSnapshot), true);
  assert.equal(replayFocused, 1, 'a removed Show Spanish control falls back to Replay');

  const oldReason = focusElement({ 'data-miss-reason': 'meaning' });
  let reasonFocused = 0;
  const newReason = focusElement({ 'data-miss-reason': 'meaning' }, {
    focus() { reasonFocused += 1; }
  });
  const reasonSelector = '[data-miss-reason="meaning"]';
  const reasonFixture = focusFixture(oldReason, new Map([[reasonSelector, newReason]]));
  const reasonSnapshot = captureFocusSnapshot(reasonFixture.app, reasonFixture.documentRef);
  assert.equal(restoreFocusSnapshot(reasonFixture.app, reasonSnapshot), true);
  assert.equal(reasonFocused, 1);
});

test('focus restoration preserves text selection and never steals focus from outside the app', () => {
  const oldInput = focusElement({ id: 'notes' }, {
    selectionStart: 2,
    selectionEnd: 5,
    selectionDirection: 'backward'
  });
  let restoredSelection;
  const newInput = focusElement({ id: 'notes' }, {
    focus() {},
    setSelectionRange(...selection) { restoredSelection = selection; }
  });
  const selector = '[id="notes"]';
  const inside = focusFixture(oldInput, new Map([[selector, newInput]]));
  assert.equal(restoreFocusSnapshot(inside.app, captureFocusSnapshot(inside.app, inside.documentRef)), true);
  assert.deepEqual(restoredSelection, [2, 5, 'backward']);

  let outsideFocused = 0;
  const outside = focusFixture(oldInput, new Map([[selector, {
    disabled: false,
    focus() { outsideFocused += 1; }
  }]]), { insideApp: false });
  assert.equal(captureFocusSnapshot(outside.app, outside.documentRef), null);
  assert.equal(restoreFocusSnapshot(outside.app, null), false);
  assert.equal(outsideFocused, 0);
  assert.deepEqual(outside.queries, []);
});

test('replay focus survives its disabled render and returns when replay completes', () => {
  const body = focusElement({ id: 'body' });
  const oldReplay = focusElement({ 'data-action': 'replay' });
  const disabledReplay = focusElement({ 'data-action': 'replay' }, { disabled: true });
  let enabledReplayFocused = 0;
  const documentRef = { activeElement: oldReplay, body, documentElement: focusElement({ id: 'html' }) };
  const app = {
    replacement: disabledReplay,
    contains(element) {
      return [oldReplay, disabledReplay, this.replacement].includes(element);
    },
    querySelector(selector) {
      assert.equal(selector, '[data-action="replay"]');
      return this.replacement;
    }
  };

  const replaySnapshot = captureFocusSnapshot(app, documentRef);
  documentRef.activeElement = body;
  let deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: replaySnapshot,
    deferredSnapshot: null
  });
  assert.strictEqual(deferred, replaySnapshot, 'disabled replay retains its focus identity across playback');
  assert.strictEqual(documentRef.activeElement, body);

  const enabledReplay = focusElement({ 'data-action': 'replay' }, {
    focus(options) {
      enabledReplayFocused += 1;
      assert.deepEqual(options, { preventScroll: true });
      documentRef.activeElement = enabledReplay;
    }
  });
  app.replacement = enabledReplay;
  const completionSnapshot = captureFocusSnapshot(app, documentRef);
  assert.equal(completionSnapshot, null, 'body focus has no new control identity');
  deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: completionSnapshot,
    deferredSnapshot: deferred
  });
  assert.equal(deferred, null);
  assert.equal(enabledReplayFocused, 1);
  assert.strictEqual(documentRef.activeElement, enabledReplay, 'completion must not leave focus on body');
});

test('deferred replay restoration does not override a deliberate move outside the app', () => {
  const body = focusElement({ id: 'body' });
  const outsideControl = focusElement({ id: 'outside' });
  const replaySnapshot = {
    selector: '[data-action="replay"]',
    fallbackSelectors: [],
    selection: null
  };
  let replayFocused = 0;
  const enabledReplay = focusElement({ 'data-action': 'replay' }, {
    focus() { replayFocused += 1; }
  });
  const documentRef = {
    activeElement: outsideControl,
    body,
    documentElement: focusElement({ id: 'html' })
  };
  const app = {
    contains() { return false; },
    querySelector() { return enabledReplay; }
  };

  const deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: null,
    deferredSnapshot: replaySnapshot
  });
  assert.equal(deferred, null);
  assert.equal(replayFocused, 0);
  assert.strictEqual(documentRef.activeElement, outsideControl);
});
