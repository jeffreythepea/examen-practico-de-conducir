import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ambienceEligible,
  buildManifestIndex,
  captureFocusSnapshot,
  commandOnsetDelayMs,
  createSavedPostAnswerMotion,
  effectiveSessionSettings,
  feedbackCueForTransition,
  focusScreen,
  generateSurfaceWithRetries,
  localizedVehicleAnswer,
  mockResultStatus,
  nextSurfaceSeed,
  promptControlsDisabled,
  reduceScreen,
  resolveSessionExperience,
  resolvePhrasing,
  restoreFocusSnapshot,
  restoreOrDeferFocus,
  selectPlaybackVariant,
  sessionIdentityData,
  sessionStartEligibility
} from '../src/app.js';
import { createPostAnswerMotion } from '../src/post-answer-motion.js';
import { EXAMINERS, selectTodaysExaminer } from '../src/examiners.js';
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
const motionCommands = Object.freeze([
  [
    Object.freeze({
      id: 'c-der',
      actionId: 'turn-right',
      phase: 'driving',
      acceptedResult: 'turn-right',
      surfaceId: 'junction-v2',
      phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha', en: 'turn right' }]
    }),
    'four-way-intersection-photo-v1'
  ],
  [
    Object.freeze({
      id: 'c-rot2',
      actionId: 'roundabout-exit-2',
      phase: 'driving',
      acceptedResult: 'roundabout-exit-2',
      surfaceId: 'roundabout-v2',
      phrasings: [{ id: 'c-rot2-canonical', es: 'Segunda salida', en: 'second exit' }]
    }),
    'roundabout-four-photo-v2'
  ],
  [
    Object.freeze({
      id: 'c-sentido',
      actionId: 'change-direction',
      phase: 'driving',
      acceptedResult: 'change-direction',
      surfaceId: 'u-turn-v1',
      phrasings: [{ id: 'c-sentido-canonical', es: 'Cambio de sentido', en: 'turn around' }]
    }),
    'u-turn-photo-v1'
  ],
  [
    Object.freeze({
      id: 'c-adel',
      actionId: 'overtake',
      phase: 'driving',
      acceptedResult: 'overtake',
      surfaceId: 'overtake-v1',
      phrasings: [{ id: 'c-adel-canonical', es: 'Adelantamiento', en: 'overtake' }]
    }),
    'overtaking-photo-v1'
  ],
  [
    Object.freeze({
      id: 'c-est',
      actionId: 'park',
      phase: 'driving',
      acceptedResult: 'park',
      surfaceId: 'parking-v1',
      phrasings: [{ id: 'c-est-canonical', es: 'Estacione', en: 'park' }]
    }),
    'parallel-parking-gap-photo-v1'
  ],
  [
    Object.freeze({
      id: 'c-parada',
      actionId: 'voluntary-stop',
      phase: 'driving',
      acceptedResult: 'voluntary-stop',
      surfaceId: 'stopping-v1',
      phrasings: [{ id: 'c-parada-canonical', es: 'Realice una parada', en: 'stop' }]
    }),
    'urban-roadside-photo-v2'
  ]
]);

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

test('moving junction starts at scene start, locks choices, then unlocks the same surface', () => {
  const loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  let model = reduceScreen(loading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });

  assert.equal(model.screen, 'prompt');
  assert.equal(model.initialAudioPending, true);
  assert.equal(model.promptStartedAt, null);
  assert.equal(model.activeSurfaceModel.family, 'junction');
  assert.equal(model.roadMotion.phase, 'approaching-locked');
  assert.equal(promptControlsDisabled(model), true);
  assert.strictEqual(
    reduceScreen(model, {
      type: 'SURFACE_EVENT',
      surfaceEvent: { type: 'select-target', targetId: 'right' },
      completedAt: 1_500
    }),
    model
  );

  const surface = model.activeSurfaceModel;
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED',
    variant: rightVariant,
    completedAt: 2_000
  });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.initialAudioPending, false);
  assert.equal(model.promptStartedAt, 2_000);
  assert.equal(model.roadMotion.phase, 'approaching-interactive');
  assert.equal(promptControlsDisabled(model), false);
  assert.strictEqual(model.activeSurfaceModel, surface);
});

test('audio start on a pending prompt merges the variant without regenerating the surface', () => {
  const loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  const scene = reduceScreen(loading, {
    type: 'SCENE_STARTED',
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });
  assert.equal(scene.screen, 'prompt');
  assert.equal(scene.initialAudioPending, true);

  const started = reduceScreen(scene, {
    type: 'AUDIO_STARTED',
    variant: rightVariant,
    startedAt: 2_200,
    seed: 999,
    motionEnabled: true
  });
  assert.strictEqual(started.activeSurfaceModel, scene.activeSurfaceModel);
  assert.strictEqual(started.roadMotion, scene.roadMotion);
  assert.equal(started.initialAudioPending, true);
  assert.equal(started.promptStartedAt, null);
  assert.deepEqual(started.variant, rightVariant);
});

test('audio start on loading-audio remains a retry fallback that keeps an existing surface', () => {
  const loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  const fresh = reduceScreen(loading, {
    type: 'AUDIO_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });
  assert.equal(fresh.screen, 'prompt');
  assert.equal(fresh.initialAudioPending, true);
  assert.equal(fresh.activeSurfaceModel.seed, 123);

  const failed = { ...fresh, screen: 'loading-audio', initialAudioPending: false, audioError: 'error' };
  const retried = reduceScreen(failed, {
    type: 'AUDIO_STARTED',
    variant: rightVariant,
    startedAt: 3_000,
    seed: 999,
    motionEnabled: true
  });
  assert.equal(retried.screen, 'prompt');
  assert.strictEqual(retried.activeSurfaceModel, fresh.activeSurfaceModel, 'retry must not regenerate');
  assert.equal(retried.initialAudioPending, true);
});

test('command onset delay draws from the motion or static range under an injected rng', () => {
  assert.equal(commandOnsetDelayMs(true, () => 0), 0);
  assert.equal(commandOnsetDelayMs(true, () => 1), 2_500);
  assert.equal(commandOnsetDelayMs(true, () => 0.5), 1_250);
  assert.equal(commandOnsetDelayMs(false, () => 0), 400);
  assert.equal(commandOnsetDelayMs(false, () => 1), 1_500);
  for (let i = 0; i < 20; i += 1) {
    const motion = commandOnsetDelayMs(true);
    const still = commandOnsetDelayMs(false);
    assert.ok(motion >= 0 && motion <= 2_500);
    assert.ok(still >= 400 && still <= 1_500);
  }
});

test('every approved photo-backed road family starts one generic locked motion lifecycle', () => {
  for (const [command, expectedSceneId] of motionCommands) {
    const loading = reduceScreen(setupModel(), {
      type: 'START_SESSION',
      session: [command]
    });
    const model = reduceScreen(loading, {
      type: 'SCENE_STARTED',
      variant: rightVariant,
      startedAt: 1_000,
      seed: 123,
      motionEnabled: true
    });

    assert.equal(model.screen, 'prompt', command.surfaceId);
    assert.equal(model.activeSurfaceModel.geometry.sceneId, expectedSceneId, command.surfaceId);
    assert.equal(model.roadMotion.sceneId, expectedSceneId, command.surfaceId);
    assert.equal(model.roadMotion.phase, 'approaching-locked', command.surfaceId);
    assert.equal(promptControlsDisabled(model), true, command.surfaceId);
  }
});

test('scene start shows every surface before audio, with motion only where eligible', () => {
  const junctionLoading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  const staticJunction = reduceScreen(junctionLoading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: false
  });
  assert.equal(staticJunction.screen, 'prompt');
  assert.ok(staticJunction.activeSurfaceModel);
  assert.equal(staticJunction.initialAudioPending, true);
  assert.equal(staticJunction.roadMotion, null);
  assert.equal(staticJunction.promptStartedAt, null);

  const controlLoading = reduceScreen(setupModel(), {
    type: 'START_SESSION',
    session: [wheelCommand]
  });
  const staticControl = reduceScreen(controlLoading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });
  assert.equal(staticControl.screen, 'prompt');
  assert.ok(staticControl.activeSurfaceModel);
  assert.equal(staticControl.initialAudioPending, true);
  assert.equal(staticControl.roadMotion, null, 'a surface without a motion profile never gets road motion');

  const completed = reduceScreen(staticControl, {
    type: 'AUDIO_COMPLETED',
    variant: rightVariant,
    completedAt: 2_000
  });
  assert.equal(completed.screen, 'prompt');
  assert.equal(completed.initialAudioPending, false);
  assert.equal(completed.promptStartedAt, 2_000);
  assert.equal(completed.roadMotion, null);

  const failed = reduceScreen(junctionLoading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  }, {
    surfaceGenerator() {
      throw new Error('invalid geometry');
    }
  });
  assert.strictEqual(failed, junctionLoading);
});

test('moving junction waits at approach end and freezes on answers and timeouts', () => {
  const loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  let model = reduceScreen(loading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED',
    variant: rightVariant,
    completedAt: 2_000
  });

  const replayMotion = model.roadMotion;
  const replaying = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 9 });
  assert.strictEqual(replaying.roadMotion, replayMotion);
  const replayed = reduceScreen(replaying, {
    type: 'REPLAY_COMPLETED',
    operationId: 9,
    completedAt: 2_500
  });
  assert.strictEqual(replayed.roadMotion, replayMotion);

  const waiting = reduceScreen(replayed, {
    type: 'ROAD_APPROACH_ENDED',
    completedAt: 7_000
  });
  assert.equal(waiting.roadMotion.phase, 'waiting');

  const correctTarget = model.activeSurfaceModel.targets.find(target =>
    target.resultId === model.activeSurfaceModel.expectedResult
  );
  const revealed = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: correctTarget.id },
    completedAt: 4_000
  });
  assert.equal(revealed.screen, 'reveal');
  assert.equal(revealed.roadMotion.phase, 'waiting');
  assert.equal(revealed.roadMotion.frozenProgress, 0.5);

  const timed = reduceScreen(model, { type: 'TIMEOUT', completedAt: 5_500 });
  assert.equal(timed.screen, 'reveal');
  assert.equal(timed.roadMotion.phase, 'waiting');
  assert.equal(timed.roadMotion.frozenProgress, 0.75);
});

test('saved correct immediate reveals alone qualify for bounded post-answer movement', () => {
  const revealed = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  const correctAttempt = { outcome: 'unaided' };
  const assistedAttempt = { outcome: 'assisted' };

  // The four-way junction scene is clip-backed, which itself suppresses the
  // glyph; the positive path needs a scene without a registered turn clip.
  const clipless = {
    ...revealed,
    activeSurfaceModel: {
      ...revealed.activeSurfaceModel,
      geometry: { ...revealed.activeSurfaceModel.geometry, sceneId: 'junction-plate-v1' }
    }
  };

  for (const attempt of [correctAttempt, assistedAttempt]) {
    const motion = createSavedPostAnswerMotion({
      screenModel: clipless,
      attempt,
      roadMovement: true,
      reducedMotion: false,
      startedAt: 2_000
    });
    assert.equal(motion.phase, 'running');
    assert.equal(motion.family, 'junction');
    assert.notStrictEqual(motion.route, revealed.activeSurfaceModel.geometry.correctRoute);
    assert.deepEqual(motion.route, revealed.activeSurfaceModel.geometry.correctRoute);
  }

  for (const override of [
    { attempt: { outcome: 'incorrect' } },
    { attempt: null },
    { roadMovement: false },
    { reducedMotion: true },
    { screenModel: { ...clipless, screen: 'mock-transition' } },
    { screenModel: { ...clipless, experience: { revealPolicy: 'session-end' } } },
    { screenModel: { ...clipless, activeSurfaceModel: { family: 'wheel', geometry: clipless.activeSurfaceModel.geometry } } },
    // The untouched reveal keeps its clip-backed scene: motion video
    // supersedes the glyph outright.
    { screenModel: revealed }
  ]) {
    const motion = createSavedPostAnswerMotion({
      screenModel: clipless,
      attempt: correctAttempt,
      roadMovement: true,
      reducedMotion: false,
      startedAt: 2_000,
      ...override
    });
    assert.equal(motion.phase, 'static');
  }
});

test('post-answer motion reducer state survives locale rerender and clears on Continue', () => {
  const revealed = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  const motion = createPostAnswerMotion({
    eligible: true,
    family: 'junction',
    route: revealed.activeSurfaceModel.geometry.correctRoute,
    startedAt: 2_000,
    durationMs: 1_300
  });
  const started = reduceScreen(revealed, { type: 'POST_ANSWER_MOTION_STARTED', motion });
  assert.strictEqual(started.postAnswerMotion, motion);
  assert.strictEqual(reduceScreen(started, { type: 'SET_LOCALE', locale: 'es' }).postAnswerMotion, motion);
  assert.equal(reduceScreen(started, { type: 'CONTINUE' }).postAnswerMotion.phase, 'static');
  assert.strictEqual(
    reduceScreen(promptModel(), { type: 'POST_ANSWER_MOTION_STARTED', motion }).postAnswerMotion.phase,
    'static'
  );
});

test('initial moving audio failure is unscored and all trial resets clear motion fields', () => {
  const loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  const started = reduceScreen(loading, {
    type: 'SCENE_STARTED',
    variant: rightVariant,
    startedAt: 1_000,
    seed: 123,
    motionEnabled: true
  });

  for (const event of [
    { type: 'AUDIO_FAILED', reason: 'error' },
    { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' }
  ]) {
    const failed = reduceScreen(started, event);
    assert.equal(failed.screen, 'loading-audio');
    assert.equal(failed.outcome, null);
    assert.equal(failed.initialAudioPending, false);
    assert.equal(failed.roadMotion, null);
    assert.equal(failed.activeSurfaceModel, null);
  }

  const prompted = reduceScreen(started, {
    type: 'AUDIO_COMPLETED',
    variant: rightVariant,
    completedAt: 2_000
  });
  const target = prompted.activeSurfaceModel.targets.find(candidate =>
    candidate.resultId === prompted.activeSurfaceModel.expectedResult
  );
  const reveal = reduceScreen(prompted, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: target.id },
    completedAt: 3_000
  });
  const next = reduceScreen(reveal, { type: 'CONTINUE' });
  assert.equal(next.initialAudioPending, false);
  assert.equal(next.roadMotion, null);
  assert.equal(reduceScreen(next, { type: 'GO_TO_SETUP' }).roadMotion, null);
});

test('resuming starts at the next unscored index or opens completed results', () => {
  const resumed = reduceScreen(setupModel(), { type: 'RESUME_SESSION', session, index: 1 });
  assert.equal(resumed.screen, 'loading-audio');
  assert.equal(resumed.index, 1);
  assert.equal(resumed.session[1].id, 'c-izq');

  const completed = reduceScreen(setupModel(), { type: 'RESUME_SESSION', session, index: session.length });
  assert.equal(completed.screen, 'results');
  assert.equal(completed.index, session.length);
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
      selectedTargetId: 'manual-gear'
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
    ready: false,
    selectedResult: null,
    selectedTargetId: 'parking-brake',
    engineStopped: false,
    parkingBrakeApplied: true,
    selectedGear: null
  });
  const engineStopped = reduceScreen(parkingBrakeSet, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'engine-stop' },
    completedAt: 1_375
  });
  const secured = reduceScreen(engineStopped, {
    type: 'SURFACE_EVENT',
    surfaceEvent: {
      type: 'select-gear',
      targetId: 'manual-gear',
      gear: secure.activeSurfaceModel.meta.requiredGear
    },
    completedAt: 1_500
  });
  assert.equal(secured.screen, 'prompt');
  const submitted = reduceScreen(secured, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'submit-secure' },
    completedAt: 1_600
  });
  assert.equal(submitted.screen, 'reveal');
  assert.equal(submitted.correct, true);
  assert.equal(submitted.selectedResult, 'secure-vehicle');
  assert.equal(submitted.selectedTargetId, 'manual-gear');
  assert.deepEqual(submitted.surfaceResponse, {
    complete: true,
    ready: true,
    selectedResult: 'secure-vehicle',
    selectedTargetId: 'manual-gear',
    engineStopped: true,
    parkingBrakeApplied: true,
    selectedGear: secure.activeSurfaceModel.meta.requiredGear
  });
});

test('a fully configured manual sequence with the wrong slope gear reveals an incorrect answer', () => {
  let model = controlPrompt(secureCommand, 5);
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'engine-stop' },
    completedAt: 1_200
  });
  assert.equal(model.screen, 'prompt');
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'parking-brake' },
    completedAt: 1_300
  });
  const wrongGear = model.activeSurfaceModel.meta.requiredGear === 'first' ? 'reverse' : 'first';
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-gear', targetId: 'manual-gear', gear: wrongGear },
    completedAt: 1_500
  });
  assert.equal(model.screen, 'prompt');
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'submit-secure' },
    completedAt: 1_600
  });

  assert.equal(model.screen, 'reveal');
  assert.equal(model.outcome, 'incorrect');
  assert.equal(model.correct, false);
  assert.equal(model.selectedTargetId, 'manual-gear');
  assert.equal(model.surfaceResponse.incorrect, true);
  assert.equal(model.surfaceResponse.selectedGear, wrongGear);
});

test('driving-only c-inmov prompt and reveal both expose the accessible generic-manual notice', () => {
  let model = controlPrompt(secureCommand, 5);
  assert.equal(model.settings.phase, 'driving');
  const promptMarkup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'en', {
    disabled: false
  });
  assert.match(promptMarkup, /role="note"[^>]+data-command="c-inmov"/);
  assert.match(promptMarkup, /generic manual-car practice/i);
  assert.doesNotMatch(promptMarkup.match(/<aside[\s\S]*?<\/aside>/)[0], /selector P|automatic/i);

  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'activate', targetId: 'parking-brake' }
  });
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'activate', targetId: 'engine-stop' }
  });
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: {
      type: 'select-gear',
      targetId: 'manual-gear',
      gear: model.activeSurfaceModel.meta.requiredGear
    }
  });
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT', surfaceEvent: { type: 'submit-secure' }
  });
  assert.equal(model.textShown, false);
  assert.equal(model.outcome, 'unaided');
  const revealMarkup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'es', {
    disabled: true,
    reveal: true,
    selectedTargetId: model.selectedTargetId
  });
  assert.match(revealMarkup, /role="note"[^>]+data-command="c-inmov"/);
  assert.match(revealMarkup, /procedimiento genérico para (?:un )?coche manual/i);
  assert.match(revealMarkup.match(/<aside[\s\S]*?<\/aside>/)[0], /artículo 92.*freno de estacionamiento/i);
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

test('partial manual securing state survives timeout so reveal identifies the remaining controls', () => {
  let model = controlPrompt(secureCommand, 5);
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'activate', targetId: 'parking-brake' }
  });
  model = reduceScreen(model, { type: 'TIMEOUT', completedAt: 9_000 });

  assert.equal(model.screen, 'reveal');
  assert.deepEqual(model.surfaceResponse, {
    complete: true,
    ready: false,
    selectedResult: null,
    selectedTargetId: null,
    engineStopped: false,
    parkingBrakeApplied: true,
    selectedGear: null
  });
  const markup = renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, 'en', {
    disabled: true,
    reveal: true,
    selectedTargetId: model.selectedTargetId
  });
  assert.match(markup, /data-target="parking-brake"[^>]+aria-pressed="true"/);
  assert.doesNotMatch(markup, /data-target="parking-brake"[^>]+aria-current="true"/);
  assert.match(markup, /data-target="engine-stop"[^>]+aria-current="true"/);
  assert.match(markup, new RegExp(`data-target="manual-gear" data-gear="${model.activeSurfaceModel.meta.requiredGear}"[^>]+aria-current="true"`));
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

test('accepted answer transitions choose correct and incorrect feedback cues but timeouts stay silent', () => {
  const unaidedBefore = promptModel();
  const unaidedEvent = {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  };
  const unaidedAfter = reduceScreen(unaidedBefore, unaidedEvent);
  assert.equal(feedbackCueForTransition(unaidedBefore, unaidedAfter, unaidedEvent), 'correct');

  const assistedBefore = reduceScreen(promptModel(), { type: 'SHOW_SPANISH' });
  const assistedEvent = {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  };
  const assistedAfter = reduceScreen(assistedBefore, assistedEvent);
  assert.equal(feedbackCueForTransition(assistedBefore, assistedAfter, assistedEvent), 'correct');

  const incorrectBefore = promptModel();
  const incorrectEvent = {
    type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 1_500
  };
  const incorrectAfter = reduceScreen(incorrectBefore, incorrectEvent);
  assert.equal(feedbackCueForTransition(incorrectBefore, incorrectAfter, incorrectEvent), 'incorrect');

  const timeoutBefore = promptModel();
  const timeoutEvent = { type: 'TIMEOUT', completedAt: 9_000 };
  const timeoutAfter = reduceScreen(timeoutBefore, timeoutEvent);
  assert.equal(feedbackCueForTransition(timeoutBefore, timeoutAfter, timeoutEvent), null);
});

test('cabin ambience is eligible only mid-session, in Mock or a continuous drive, with the setting on', () => {
  const eligible = { screen: 'prompt', settings: { experienceMode: 'mock', ambience: true } };
  assert.equal(ambienceEligible(eligible), true);

  for (const screen of ['loading-audio', 'reveal', 'mock-transition']) {
    assert.equal(ambienceEligible({ ...eligible, screen }), true);
  }
  for (const screen of ['setup', 'readiness', 'results']) {
    assert.equal(ambienceEligible({ ...eligible, screen }), false);
  }

  assert.equal(
    ambienceEligible({ ...eligible, settings: { experienceMode: 'practice', ambience: true } }),
    false,
    'Practice mode without continuity never gets ambience, even with the setting on'
  );
  assert.equal(
    ambienceEligible({ ...eligible, settings: { experienceMode: 'learn', ambience: true } }),
    false
  );
  assert.equal(
    ambienceEligible({
      ...eligible,
      continuityActive: true,
      settings: { experienceMode: 'practice', ambience: true }
    }),
    true,
    'A continuous-drive session is eligible in any mode with the setting on'
  );
  assert.equal(
    ambienceEligible({
      ...eligible,
      continuityActive: true,
      settings: { experienceMode: 'practice', ambience: false }
    }),
    false,
    'Continuity never overrides the opt-in setting'
  );
  assert.equal(
    ambienceEligible({ ...eligible, settings: { experienceMode: 'mock', ambience: false } }),
    false,
    'Off by default: Mock mode alone is not enough without the setting'
  );

  assert.equal(ambienceEligible(null), false);
  assert.equal(ambienceEligible({ screen: 'prompt' }), false);
});

test('Spanish-hint feedback occurs only for the first accepted reveal of trial-local text', () => {
  const before = promptModel();
  const event = { type: 'SHOW_SPANISH' };
  const after = reduceScreen(before, event);
  assert.equal(feedbackCueForTransition(before, after, event), 'spanish-hint');

  const repeatedAfter = reduceScreen(after, event);
  assert.equal(feedbackCueForTransition(after, repeatedAfter, event), null);

  const replayPending = reduceScreen(before, { type: 'REPLAY_STARTED', operationId: 7 });
  const rejected = reduceScreen(replayPending, event);
  assert.strictEqual(rejected, replayPending);
  assert.equal(feedbackCueForTransition(replayPending, rejected, event), null);
});

test('non-feedback transitions never request a cue', () => {
  const setup = setupModel();
  const localeEvent = { type: 'SET_LOCALE', locale: 'es' };
  const localized = reduceScreen(setup, localeEvent);
  assert.equal(feedbackCueForTransition(setup, localized, localeEvent), null);

  const reveal = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  const continueEvent = { type: 'CONTINUE' };
  const continued = reduceScreen(reveal, continueEvent);
  assert.equal(feedbackCueForTransition(reveal, continued, continueEvent), null);
});

test('available Spanish hint is trial-local and resets for the next command', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  assert.equal(model.textShown, true);

  model = reduceScreen(model, {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  assert.equal(model.outcome, 'assisted');

  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.textShown, false);

  const leftVariant = {
    ...rightVariant,
    id: 'left-roger',
    commandId: 'c-izq',
    phrasingId: 'c-izq-canonical'
  };
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED', variant: leftVariant, completedAt: 2_000, seed: 2
  });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.textShown, false);
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
  const command = session.find(c => c.id === selection.commandId);

  const roger = selectPlaybackVariant(manifest, command, selection.speed, false, [], () => 0);
  const sarah = selectPlaybackVariant(manifest, command, selection.speed, false, [], () => 0.999);
  assert.equal(roger.voiceId, 'roger');
  assert.equal(sarah.voiceId, 'sarah');
  assert.ok(Object.isFrozen(roger));
  assert.throws(() => selectPlaybackVariant(manifest, command, 0.75, false, [], () => 0), /Audio unavailable/);
});

test('audio selection samples all playable phrasings at the requested speed', () => {
  const manifest = [
    rightVariant,
    { ...rightVariant, id: 'right-alt-roger', phrasingId: 'c-der-alt-1', path: 'audio/right-alt.mp3' },
    { ...rightVariant, id: 'right-alt-fast', phrasingId: 'c-der-alt-1', speed: 1 }
  ];
  const selection = { commandId: 'c-der', speed: 0.9 };
  const command = session.find(c => c.id === selection.commandId);

  assert.equal(selectPlaybackVariant(manifest, command, selection.speed, true, [], () => 0).phrasingId, 'c-der-canonical');
  assert.equal(selectPlaybackVariant(manifest, command, selection.speed, true, [], () => 0.999).phrasingId, 'c-der-alt-1');
  assert.throws(() => selectPlaybackVariant(manifest, command, 0.75, false, [], () => 0), /Audio unavailable/);
});

test('playback selection prefers recordings and creates a stable browser-speech descriptor only when needed', () => {
  const command = {
    id: 'c-pre-cruce',
    phrasings: [
      { id: 'c-pre-cruce-canonical', es: 'Encienda las luces de cruce' },
      { id: 'c-pre-cruce-alt-1', es: 'Conecte las luces de cruce' }
    ]
  };
  const recorded = {
    ...rightVariant,
    id: 'cruce-roger',
    commandId: command.id,
    phrasingId: command.phrasings[0].id,
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2'
  };

  assert.strictEqual(
    selectPlaybackVariant([recorded], command, 0.9, true, [], () => 0).id,
    recorded.id
  );
  assert.deepEqual(selectPlaybackVariant([], command, 0.9, true, [], () => 0), {
    id: 'browser-speech--c-pre-cruce--c-pre-cruce-canonical--0.9',
    commandId: 'c-pre-cruce',
    phrasingId: 'c-pre-cruce-canonical',
    voiceId: 'browser-speech',
    speed: 0.9,
    provider: 'browser-speech',
    model: 'web-speech-api',
    path: null
  });
  assert.equal(
    selectPlaybackVariant([], command, 0.9, true, [], () => 0.999).phrasingId,
    'c-pre-cruce-alt-1'
  );
  assert.throws(
    () => selectPlaybackVariant([], command, 0.9, false, [], () => 0),
    /Audio unavailable/
  );
  assert.ok(Object.isFrozen(selectPlaybackVariant([], command, 0.9, true, [], () => 0)));
});

test('playback selection prefers the least-exposed recorded phrasing and voice across speeds', () => {
  const command = {
    id: 'c-der',
    phrasings: [
      { id: 'c-der-canonical', es: 'Gire a la derecha' },
      { id: 'c-der-alt-1', es: 'La próxima a la derecha' }
    ]
  };
  const variants = [
    { ...rightVariant, id: 'canonical-roger', phrasingId: 'c-der-canonical', voiceId: 'roger' },
    { ...rightVariant, id: 'alternate-sarah', phrasingId: 'c-der-alt-1', voiceId: 'sarah' }
  ];
  const attempts = [{
    commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'roger', speed: 0.75
  }];

  assert.equal(
    selectPlaybackVariant(variants, command, 0.9, true, attempts, () => 0).id,
    'alternate-sarah'
  );
});

test('session experience resolves Today once from injected local date parts and preserves fixed or Mixed choices', () => {
  const base = {
    experienceMode: 'practice', examinerChoice: 'today', themeId: 'city-circuit'
  };
  const dateParts = { year: 2026, month: 8, day: 6 };
  const today = resolveSessionExperience(base, dateParts);

  assert.deepEqual(today, {
    modeId: 'practice',
    challengeId: null,
    examinerChoice: 'today',
    resolvedExaminerId: selectTodaysExaminer(dateParts).id,
    themeId: 'city-circuit',
    replayPolicy: 'unlimited',
    revealPolicy: 'immediate',
    simulated: false
  });
  assert.equal(Object.isFrozen(today), true);
  assert.equal(resolveSessionExperience({ ...base, examinerChoice: 'mixed' }, dateParts).resolvedExaminerId, null);
  assert.equal(resolveSessionExperience({ ...base, examinerChoice: 'roger' }, dateParts).resolvedExaminerId, 'roger');
});

test('session identity presents stable mode, theme, and examiner metadata without treating Mixed as one person', () => {
  const fixed = sessionIdentityData({
    modeId: 'learn', examinerChoice: 'today', resolvedExaminerId: 'george',
    themeId: 'city-circuit', replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  });
  assert.equal(fixed.modeTitleKey, 'experience.learn.title');
  assert.equal(fixed.themeTitleKey, 'theme.city-circuit.title');
  assert.equal(fixed.examinerTitleKey, 'examiner.george.name');
  assert.equal(fixed.examinerDescriptionKey, 'examiner.george.description');
  assert.deepEqual(fixed.visualTokens, ['amber']);
  assert.equal(Object.isFrozen(fixed.visualTokens), true);
  assert.equal(Object.isFrozen(fixed), true);

  const mixed = sessionIdentityData({
    modeId: 'practice', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: null, challengeId: null, replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  });
  assert.equal(mixed.themeTitleKey, 'theme.adaptive.title');
  assert.equal(mixed.examinerTitleKey, 'examiner.mixed.title');
  assert.equal(mixed.examinerDescriptionKey, 'examiner.mixed.description');
  assert.equal(mixed.visualTokens.length, EXAMINERS.length);
});

test('effective session settings preserve visible Practice controls and apply only preset-owned Learn fields', () => {
  const base = {
    locale: 'es', phase: 'driving', speed: 0.75, hintPolicy: 'unavailable', timed: true,
    feedbackSounds: false, roadMovement: false, length: 'all', mode: 'free',
    experienceMode: 'practice', examinerChoice: 'roger', themeId: 'city-circuit'
  };

  const practice = effectiveSessionSettings(base);
  assert.deepEqual(practice, base);
  assert.notStrictEqual(practice, base);
  assert.equal(Object.isFrozen(practice), true);

  const learn = effectiveSessionSettings({ ...base, experienceMode: 'learn' });
  assert.deepEqual(learn, {
    ...base,
    experienceMode: 'learn',
    speed: 0.9,
    hintPolicy: 'shown',
    timed: false
  });
  assert.equal(learn.phase, 'driving');
  assert.equal(learn.length, 'all');
  assert.equal(learn.mode, 'free');
  assert.equal(Object.isFrozen(learn), true);

  const mock = effectiveSessionSettings({ ...base, experienceMode: 'mock' });
  assert.equal(mock.speed, 1);
  assert.equal(mock.hintPolicy, 'unavailable');
  assert.equal(mock.timed, true);
});

test('Mock blocks replay and Spanish hints, withholds reveal, and advances through a neutral frame', () => {
  const experience = Object.freeze({
    modeId: 'mock', examinerChoice: 'mixed', resolvedExaminerId: null, themeId: null, challengeId: null,
    replayPolicy: 'none', revealPolicy: 'session-end', simulated: true
  });
  const mockSettings = { ...settings, speed: 1, hintPolicy: 'unavailable', timed: true };
  let model = reduceScreen(
    { ...setupModel(), settings: mockSettings },
    { type: 'START_SESSION', session, experience }
  );
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED', variant: { ...rightVariant, speed: 1 }, completedAt: 1_000, seed: 123
  });

  assert.equal(model.textShown, false);
  assert.strictEqual(reduceScreen(model, { type: 'SHOW_SPANISH' }), model);
  assert.strictEqual(reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 1 }), model);

  model = reduceScreen(model, {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  assert.equal(model.screen, 'mock-transition');
  assert.equal(model.outcome, 'unaided', 'evidence remains available for session-end reconstruction');

  model = reduceScreen(model, { type: 'MOCK_CONTINUE' });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 1);
  model = reduceScreen(model, {
    type: 'AUDIO_COMPLETED',
    variant: { ...rightVariant, id: 'left', commandId: 'c-izq', phrasingId: 'c-izq-canonical', speed: 1 },
    completedAt: 2_000,
    seed: 2
  });
  model = reduceScreen(model, { type: 'TIMEOUT', completedAt: 10_000 });
  assert.equal(model.screen, 'mock-transition');
  model = reduceScreen(model, { type: 'MOCK_CONTINUE' });
  assert.equal(model.screen, 'results');
  assert.equal(model.index, 2);
});

test('Full Mock continuity synchronizes transition, command, and completed route screens', () => {
  const experience = Object.freeze({
    modeId: 'mock', examinerChoice: 'mixed', resolvedExaminerId: null, themeId: 'full-mock',
    replayPolicy: 'none', revealPolicy: 'session-end', simulated: true
  });
  let model = reduceScreen(
    setupModel(),
    { type: 'START_SESSION', session, experience, stepKind: 'transition' }
  );
  assert.equal(model.screen, 'mock-transition');
  assert.equal(model.index, 0);

  model = reduceScreen(model, { type: 'CONTINUITY_SYNC', index: 0 });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 0);

  model = { ...model, screen: 'mock-transition' };
  model = reduceScreen(model, { type: 'CONTINUITY_SYNC', index: 1, stepKind: 'transition' });
  assert.equal(model.screen, 'mock-transition');
  assert.equal(model.index, 1);

  model = reduceScreen(model, { type: 'CONTINUITY_SYNC', index: 2 });
  assert.equal(model.screen, 'results');
  assert.equal(model.index, 2);
});

test('immediate-reveal Continue can enter a continuity transition before the next command', () => {
  const revealed = reduceScreen(promptModel(), { type: 'TIMEOUT', completedAt: 5_000 });
  assert.equal(revealed.screen, 'reveal');

  const atTransition = reduceScreen(revealed, { type: 'CONTINUE', stepKind: 'transition' });
  assert.equal(atTransition.screen, 'mock-transition');
  assert.equal(atTransition.index, 1);
  assert.equal(atTransition.selectedResult, null);

  const synced = reduceScreen(atTransition, { type: 'CONTINUITY_SYNC', index: 1 });
  assert.equal(synced.screen, 'loading-audio');
  assert.equal(synced.index, 1);

  const legacy = reduceScreen(revealed, { type: 'CONTINUE' });
  assert.equal(legacy.screen, 'loading-audio');
  assert.equal(legacy.index, 1);
});

test('a trailing continuity transition after the last reveal still reaches results', () => {
  let model = reduceScreen(promptModel(), { type: 'TIMEOUT', completedAt: 5_000 });
  model = { ...model, index: model.session.length - 1 };
  model = reduceScreen(model, { type: 'CONTINUE', stepKind: 'transition' });
  assert.equal(model.screen, 'mock-transition');
  assert.equal(model.index, model.session.length);

  model = reduceScreen(model, {
    type: 'CONTINUITY_SYNC', index: model.session.length
  });
  assert.equal(model.screen, 'results');
});

test('resuming Full Mock continuity can restore an unscored transition', () => {
  const model = reduceScreen(setupModel(), {
    type: 'RESUME_SESSION', session, index: 1, stepKind: 'transition'
  });
  assert.equal(model.screen, 'mock-transition');
  assert.equal(model.index, 1);
});

test('Continue can enter a silent null event whose straight tap confirms and records nothing', () => {
  const revealed = reduceScreen(promptModel(), { type: 'TIMEOUT', completedAt: 5_000 });
  const entered = reduceScreen(revealed, {
    type: 'CONTINUE', stepKind: 'null-event', seed: 123, startedAt: 9_000, motionEnabled: true
  });
  assert.equal(entered.screen, 'null-event');
  assert.equal(entered.index, 1);
  assert.equal(entered.initialAudioPending, false);
  assert.equal(entered.variant, null, 'no audio variant is ever selected for a null event');
  assert.equal(entered.nullEvent.state, 'active');
  assert.equal(entered.activeSurfaceModel.family, 'junction');
  assert.equal(entered.activeSurfaceModel.expectedResult, 'continue-forward');
  assert.equal(entered.roadMotion.phase, 'approaching-interactive');
  assert.equal(entered.roadMotion.sceneId, 'four-way-intersection-photo-v1');

  const straight = entered.activeSurfaceModel.targets.find(target => target.resultId === 'continue-forward');
  const confirmed = reduceScreen(entered, {
    type: 'NULL_EVENT_SELECT', targetId: straight.id, completedAt: 10_000
  });
  assert.equal(confirmed.screen, 'null-event');
  assert.equal(confirmed.nullEvent.state, 'correct');
  assert.equal(confirmed.nullEvent.selectedTargetId, straight.id);
  assert.equal(confirmed.roadMotion.phase, 'waiting');
  assert.equal(confirmed.outcome, null, 'a null event never becomes a scored attempt');
  assert.equal(confirmed.selectedResult, null);

  const synced = reduceScreen(confirmed, { type: 'CONTINUITY_SYNC', index: 1 });
  assert.equal(synced.screen, 'loading-audio');
  assert.equal(synced.index, 1);
  assert.equal(synced.nullEvent, null);
});

test('null-event wrong taps correct gently, settle once, and the approach end hints', () => {
  const revealed = reduceScreen(promptModel(), { type: 'TIMEOUT', completedAt: 5_000 });
  const entered = reduceScreen(revealed, {
    type: 'CONTINUE', stepKind: 'null-event', seed: 123, startedAt: 9_000, motionEnabled: false
  });
  assert.equal(entered.roadMotion, null, 'static null events run without road motion');

  const wrongTarget = entered.activeSurfaceModel.targets.find(target => target.resultId !== 'continue-forward');
  const corrected = reduceScreen(entered, {
    type: 'NULL_EVENT_SELECT', targetId: wrongTarget.id, completedAt: 10_000
  });
  assert.equal(corrected.nullEvent.state, 'incorrect');
  assert.strictEqual(
    reduceScreen(corrected, { type: 'NULL_EVENT_SELECT', targetId: wrongTarget.id, completedAt: 10_500 }),
    corrected,
    'a settled null event ignores further taps'
  );

  const hinted = reduceScreen(entered, { type: 'NULL_EVENT_HINT' });
  assert.equal(hinted.nullEvent.state, 'hint');
  assert.equal(
    reduceScreen(hinted, { type: 'NULL_EVENT_SELECT', targetId: wrongTarget.id, completedAt: 11_000 }).nullEvent.state,
    'incorrect',
    'the hint still requires a tap'
  );
  assert.strictEqual(reduceScreen(corrected, { type: 'NULL_EVENT_HINT' }), corrected);
});

test('continuity sync and resume can land on a null event without touching audio state', () => {
  let model = reduceScreen(setupModel(), {
    type: 'START_SESSION', session, stepKind: 'transition'
  });
  assert.equal(model.screen, 'mock-transition');
  model = reduceScreen(model, {
    type: 'CONTINUITY_SYNC', index: 0, stepKind: 'null-event', seed: 123, startedAt: 9_000, motionEnabled: true
  });
  assert.equal(model.screen, 'null-event');
  assert.equal(model.index, 0);
  assert.equal(model.initialAudioPending, false);
  assert.equal(model.nullEvent.state, 'active');

  const resumed = reduceScreen(setupModel(), {
    type: 'RESUME_SESSION', session, index: 1, stepKind: 'null-event', seed: 123, startedAt: 9_000, motionEnabled: false
  });
  assert.equal(resumed.screen, 'null-event');
  assert.equal(resumed.index, 1);
  assert.equal(resumed.nullEvent.state, 'active');
});

test('Mock result status is clean only when every expected response is unaided', () => {
  assert.equal(mockResultStatus([
    { outcome: 'unaided' }, { outcome: 'unaided' }
  ], 2), 'clean');
  assert.equal(mockResultStatus([{ outcome: 'unaided' }], 2), 'needs-practice');
  assert.equal(mockResultStatus([
    { outcome: 'unaided' }, { outcome: 'incorrect' }
  ], 2), 'needs-practice');
  assert.equal(mockResultStatus([
    { outcome: 'unaided' }, { outcome: 'assisted' }
  ], 2), 'needs-practice');
});

test('playback filters fixed and Today examiner candidates before coverage-aware selection while Mixed retains all voices', () => {
  const command = {
    id: 'c-der',
    phrasings: [
      { id: 'c-der-canonical', es: 'Gire a la derecha' },
      { id: 'c-der-alt-1', es: 'La próxima a la derecha' }
    ]
  };
  const variants = EXAMINERS.slice(0, 2).map((examiner, index) => ({
    ...rightVariant,
    id: `recorded-${examiner.id}`,
    phrasingId: index === 0 ? 'c-der-canonical' : 'c-der-alt-1',
    voiceId: examiner.voiceId
  }));
  const attempts = [{
    commandId: command.id,
    phrasingId: 'c-der-canonical',
    voiceId: EXAMINERS[0].voiceId,
    speed: 1
  }];

  assert.equal(
    selectPlaybackVariant(variants, command, 0.9, false, attempts, () => 0, {
      examinerChoice: EXAMINERS[0].id
    }).voiceId,
    EXAMINERS[0].voiceId
  );
  assert.equal(
    selectPlaybackVariant(variants, command, 0.9, false, attempts, () => 0, {
      examinerChoice: 'mixed'
    }).voiceId,
    EXAMINERS[1].voiceId
  );
  const dateParts = { year: 2026, month: 8, day: 6 };
  const today = selectTodaysExaminer(dateParts, EXAMINERS.slice(0, 2));
  assert.equal(
    selectPlaybackVariant(variants, command, 0.9, false, [], () => 0, {
      examinerChoice: 'today', dateParts, examinerRegistry: EXAMINERS.slice(0, 2)
    }).voiceId,
    today.voiceId
  );
  assert.throws(
    () => selectPlaybackVariant(variants, command, 0.9, true, [], () => 0, {
      examinerChoice: EXAMINERS[2].id
    }),
    /Audio unavailable for examiner/
  );
});

test('session Start eligibility distinguishes empty theme combinations from unavailable examiner recordings', () => {
  const examiner = EXAMINERS[0];
  const command = {
    id: 'c-der', actionId: 'turn-right', phase: 'driving', surfaceId: 'junction-v2',
    phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha' }]
  };
  const manifest = [{
    id: 'c-der-roger', commandId: command.id, phrasingId: command.phrasings[0].id,
    voiceId: examiner.voiceId, speed: 0.9
  }];
  const settings = {
    phase: 'driving', speed: 0.9, experienceMode: 'practice',
    examinerChoice: examiner.id, themeId: null
  };

  assert.deepEqual(sessionStartEligibility([command], manifest, settings, false, {
    year: 2026, month: 8, day: 6
  }), { canStart: true, reason: null });
  assert.deepEqual(sessionStartEligibility([command], manifest, {
    ...settings, examinerChoice: EXAMINERS[1].id
  }, true, { year: 2026, month: 8, day: 6 }), {
    canStart: false, reason: 'examiner-audio'
  });
  assert.deepEqual(sessionStartEligibility([command], manifest, {
    ...settings, phase: 'precheck', themeId: 'roundabout-circuit'
  }, false, { year: 2026, month: 8, day: 6 }), {
    canStart: false, reason: 'no-commands'
  });
  assert.deepEqual(sessionStartEligibility([command], [], {
    ...settings, examinerChoice: 'mixed'
  }, true, { year: 2026, month: 8, day: 6 }), { canStart: true, reason: null });
});

test('sessionStartEligibility and selectPlaybackVariant read from a prebuilt manifest index instead of rescanning the raw manifest', () => {
  const command = { id: 'c-der', phase: 'driving', phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha' }] };
  const manifest = [
    { id: 'c-der-roger', commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'roger', speed: 0.9 }
  ];
  const manifestIndex = buildManifestIndex(manifest);
  const settings = { phase: 'driving', speed: 0.9, experienceMode: 'practice', examinerChoice: 'mixed', themeId: null };
  const dateParts = { year: 2026, month: 8, day: 6 };

  // Mutate the raw manifest so it no longer matches the (still-correct) prebuilt index.
  manifest.length = 0;

  assert.deepEqual(
    sessionStartEligibility([command], manifest, settings, false, dateParts, manifestIndex),
    { canStart: true, reason: null },
    'must use the prebuilt index, not the now-emptied raw manifest array'
  );
  assert.equal(
    selectPlaybackVariant(manifest, command, 0.9, false, [], () => 0, { manifestIndex }).id,
    'c-der-roger',
    'must use the prebuilt index, not the now-emptied raw manifest array'
  );

  // Omitting the index still works by building one from the (correct, unmutated) manifest.
  const freshManifest = [
    { id: 'c-der-roger', commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'roger', speed: 0.9 }
  ];
  assert.deepEqual(
    sessionStartEligibility([command], freshManifest, settings, false, dateParts),
    { canStart: true, reason: null }
  );
});

test('prompt and reveal phrasing resolves from the retained audio variant', () => {
  const command = {
    id: 'c-der',
    phrasings: [
      { id: 'c-der-canonical', es: 'Gire a la derecha', en: 'turn right' },
      { id: 'c-der-alt-1', es: 'Tome la primera a la derecha', en: 'take the first right' }
    ]
  };
  const variant = { ...rightVariant, phrasingId: 'c-der-alt-1' };

  assert.deepEqual(resolvePhrasing(command, variant), command.phrasings[1]);
  assert.deepEqual(resolvePhrasing(command, null), command.phrasings[0]);
  assert.throws(
    () => resolvePhrasing(command, { ...variant, phrasingId: 'missing' }),
    /Phrasing unavailable/
  );
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

test('a correct Continue into a transition carries turn-through source data', () => {
  const revealed = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  assert.equal(revealed.outcome, 'unaided');
  const target = revealed.activeSurfaceModel.targets
    .find(candidate => candidate.id === revealed.selectedTargetId);
  const transitioned = reduceScreen(revealed, { type: 'CONTINUE', stepKind: 'transition' });
  assert.equal(transitioned.screen, 'mock-transition');
  assert.deepEqual(transitioned.turnThrough, {
    sceneId: revealed.activeSurfaceModel.geometry.sceneId ?? null,
    family: 'junction',
    targetX: target.x,
    targetY: target.y,
    resultId: 'turn-right',
    outcome: 'unaided',
    pose: null
  });

  const assisted = reduceScreen(promptModel({ textShown: true }), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  assert.equal(
    reduceScreen(assisted, { type: 'CONTINUE', stepKind: 'transition' }).turnThrough.outcome,
    'assisted'
  );
});

test('a motion-enabled correct Continue carries the frozen road-motion pose', () => {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  model = reduceScreen(model, { type: 'SCENE_STARTED', seed: 123, motionEnabled: true, startedAt: 0 });
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000 });
  model = reduceScreen(model, {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 6_001
  });
  assert.equal(model.outcome, 'unaided');
  const transitioned = reduceScreen(model, { type: 'CONTINUE', stepKind: 'transition' });
  assert.deepEqual(transitioned.turnThrough.pose, { scale: 1.06, originX: 50, originY: 82 });
});

test('wrong answers and timeouts continue into a plain transition', () => {
  const incorrect = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 1_500
  });
  assert.equal(incorrect.outcome, 'incorrect');
  assert.equal(reduceScreen(incorrect, { type: 'CONTINUE', stepKind: 'transition' }).turnThrough, null);

  const timedOut = reduceScreen(promptModel(), { type: 'TIMEOUT', completedAt: 5_500 });
  assert.equal(reduceScreen(timedOut, { type: 'CONTINUE', stepKind: 'transition' }).turnThrough, null);
});

test('continuity sync and non-transition Continues never leave turn-through data behind', () => {
  const revealed = reduceScreen(promptModel(), {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  const transitioned = reduceScreen(revealed, { type: 'CONTINUE', stepKind: 'transition' });
  assert.ok(transitioned.turnThrough);
  const synced = reduceScreen(transitioned, { type: 'CONTINUITY_SYNC', index: 1, stepKind: 'transition' });
  assert.equal(synced.turnThrough, null);
  assert.equal(reduceScreen(revealed, { type: 'CONTINUE' }).turnThrough, null);
});

test('mock reveals withhold the turn-through because they bypass CONTINUE entirely', () => {
  const mockPrompt = { ...promptModel(), experience: { revealPolicy: 'session-end' } };
  const mockTransition = reduceScreen(mockPrompt, {
    type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500
  });
  assert.equal(mockTransition.screen, 'mock-transition');
  assert.equal(mockTransition.turnThrough, null, 'mock must never leak correctness through the intro');
});
