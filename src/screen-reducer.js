// The screen reducer: every transition of the in-drive model, as pure
// functions over (model, event). Extracted from app.js so the rules of the
// drive can be read and tested without the controller, the DOM, or a browser
// around them.
import { generateSurface, reduceSurfaceResponse } from './surfaces.js';
import {
  createRoadMotion,
  reduceRoadMotion,
  roadMotionProfile,
  roadMotionView
} from './road-motion.js';

export const MISS_REASONS = Object.freeze(['hearing', 'meaning', 'mapping', 'target', 'accidental', 'other']);
// C: a null event is a silent junction — no command, no audio, never a scored
// attempt. The synthetic command exists only to drive the junction surface
// generator toward the straight-ahead target; it never reaches recordAttempt.
export const NULL_EVENT_COMMAND = Object.freeze({
  id: 'null-event',
  actionId: 'continue-forward',
  acceptedResult: 'continue-forward',
  surfaceId: 'junction-v2'
});
const SURFACE_RETRY_INCREMENT = 0x9e3779b9;
const RESULT_ONLY_SURFACE_FAMILIES = Object.freeze([
  'junction',
  'roundabout',
  'u-turn',
  'overtake',
  'parking',
  'stopping',
  'semantic'
]);
export function nextSurfaceSeed(cryptoRef = globalThis.crypto) {
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('Cryptographic surface seed generation is unavailable');
  }
  const values = new Uint32Array(1);
  cryptoRef.getRandomValues(values);
  return values[0];
}

export function generateSurfaceWithRetries(command, requestedSeed, surfaceGenerator = generateSurface) {
  if (!Number.isInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 0xffff_ffff) {
    throw new Error('Surface seed must be a uint32');
  }
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seed = (requestedSeed + attempt * SURFACE_RETRY_INCREMENT) >>> 0;
    try {
      return { model: surfaceGenerator(command, seed), error: null };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  return { model: null, error: lastError };
}

function enterNullEventScreen(model, index, event, surfaceGenerator) {
  const base = resetTrial({ ...model, screen: 'null-event' }, index);
  let generated;
  try {
    generated = generateSurfaceWithRetries(
      NULL_EVENT_COMMAND,
      event.seed ?? nextSurfaceSeed(),
      surfaceGenerator
    );
  } catch (error) {
    generated = { model: null, error };
  }
  const sceneId = generated.model?.geometry?.sceneId;
  const motionEligible = event.motionEnabled === true && Boolean(roadMotionProfile(sceneId));
  return {
    ...base,
    activeSurfaceModel: generated.model,
    surfaceError: generated.error?.message ?? null,
    nullEvent: { state: 'active', selectedTargetId: null },
    // No audio ever plays here, so the approach starts already interactive —
    // the locked phase only exists to wait for command audio.
    roadMotion: motionEligible
      ? reduceRoadMotion(
        createRoadMotion({
          enabled: true,
          startedAt: event.startedAt ?? 0,
          sceneId
        }),
        { type: 'AUDIO_COMPLETED', at: event.startedAt ?? 0 }
      )
      : null
  };
}

export function reduceScreen(model, event, { surfaceGenerator = generateSurface } = {}) {
  if (event.type === 'SET_LOCALE') {
    return { ...model, settings: { ...model.settings, locale: event.locale } };
  }
  if (event.type === 'GO_TO_SETUP') {
    return resetTrial({ ...model, screen: 'setup', settings: model.settings, session: [] }, 0);
  }
  if (event.type === 'START_SESSION') {
    const base = {
      ...model,
      session: [...event.session],
      experience: event.experience ?? model.experience ?? null,
      continuityActive: event.continuityActive === true
    };
    if (event.stepKind === 'null-event') return enterNullEventScreen(base, 0, event, surfaceGenerator);
    return resetTrial({
      ...base,
      screen: event.stepKind === 'transition' ? 'mock-transition' : 'loading-audio'
    }, 0);
  }
  if (event.type === 'RESUME_SESSION') {
    if (!Array.isArray(event.session) || !Number.isSafeInteger(event.index)
        || event.index < 0 || event.index > event.session.length) return model;
    const base = {
      ...model,
      session: [...event.session],
      experience: event.experience ?? model.experience ?? null,
      continuityActive: event.continuityActive === true
    };
    if (event.stepKind === 'null-event' && event.index < event.session.length) {
      return enterNullEventScreen(base, event.index, event, surfaceGenerator);
    }
    const screen = event.stepKind === 'transition'
      ? 'mock-transition'
      : event.index === event.session.length ? 'results' : 'loading-audio';
    return resetTrial({ ...base, screen }, event.index);
  }
  if (['SCENE_STARTED', 'AUDIO_STARTED'].includes(event.type) && model.screen === 'loading-audio') {
    const continuingTrial = event.type === 'AUDIO_STARTED' && Boolean(model.activeSurfaceModel);
    let generated;
    try {
      generated = continuingTrial
        ? { model: model.activeSurfaceModel, error: null }
        : generateSurfaceWithRetries(
            model.session[model.index],
            event.seed ?? nextSurfaceSeed(),
            surfaceGenerator
          );
    } catch {
      return model;
    }
    if (!generated.model) return model;
    const sceneId = generated.model.geometry?.sceneId;
    const motionEligible = event.motionEnabled === true && Boolean(roadMotionProfile(sceneId));
    return {
      ...model,
      screen: 'prompt',
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      activeSurfaceModel: generated.model,
      surfaceResponse: continuingTrial ? model.surfaceResponse : {},
      surfaceError: null,
      textShown: continuingTrial ? model.textShown : model.settings.hintPolicy === 'shown',
      replays: continuingTrial ? model.replays : 0,
      promptStartedAt: null,
      initialAudioPending: true,
      roadMotion: motionEligible
        ? createRoadMotion({
          enabled: true,
          startedAt: event.startedAt,
          sceneId
        })
        : null,
      ...trialResetFields()
    };
  }
  if (event.type === 'AUDIO_STARTED' && model.screen === 'prompt' && model.initialAudioPending) {
    return {
      ...model,
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant
    };
  }
  if (event.type === 'AUDIO_COMPLETED'
      && model.screen === 'prompt'
      && model.initialAudioPending) {
    return {
      ...model,
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      promptStartedAt: event.completedAt,
      initialAudioPending: false,
      roadMotion: model.roadMotion
        ? reduceRoadMotion(model.roadMotion, {
          type: 'AUDIO_COMPLETED',
          at: event.completedAt
        })
        : null
    };
  }
  if (['AUDIO_COMPLETED', 'TRIAL_AUDIO_ENDED'].includes(event.type) && model.screen === 'loading-audio') {
    const continuingTrial = Boolean(model.activeSurfaceModel);
    const generated = continuingTrial
      ? { model: model.activeSurfaceModel, error: null }
      : generateSurfaceWithRetries(
          model.session[model.index],
          event.seed ?? nextSurfaceSeed(),
          surfaceGenerator
        );
    return {
      ...model,
      screen: 'prompt',
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      activeSurfaceModel: generated.model,
      surfaceResponse: continuingTrial ? model.surfaceResponse : {},
      surfaceError: generated.error?.message ?? null,
      textShown: continuingTrial ? model.textShown : model.settings.hintPolicy === 'shown',
      replays: continuingTrial ? model.replays : 0,
      promptStartedAt: event.completedAt,
      initialAudioPending: false,
      roadMotion: continuingTrial ? model.roadMotion : null,
      ...trialResetFields()
    };
  }
  if (event.type === 'AUDIO_FAILED'
      && (model.screen === 'loading-audio' || (model.screen === 'prompt' && model.initialAudioPending))) {
    const initialMotionFailed = model.screen === 'prompt' && model.initialAudioPending;
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'error',
      variant: initialMotionFailed ? null : model.variant,
      activeSurfaceModel: initialMotionFailed ? null : model.activeSurfaceModel,
      surfaceResponse: initialMotionFailed ? {} : model.surfaceResponse,
      surfaceError: initialMotionFailed ? null : model.surfaceError,
      initialAudioPending: false,
      roadMotion: initialMotionFailed ? null : model.roadMotion,
      ...trialResetFields()
    };
  }
  if (event.type === 'AUDIO_INTERRUPTED' && ['prompt', 'loading-audio'].includes(model.screen)) {
    const initialMotionFailed = model.screen === 'prompt' && model.initialAudioPending;
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'interrupted',
      variant: initialMotionFailed ? null : model.variant,
      activeSurfaceModel: initialMotionFailed ? null : model.activeSurfaceModel,
      surfaceResponse: initialMotionFailed ? {} : model.surfaceResponse,
      surfaceError: initialMotionFailed ? null : model.surfaceError,
      initialAudioPending: false,
      roadMotion: initialMotionFailed ? null : model.roadMotion,
      ...trialResetFields()
    };
  }
  if (event.type === 'RETRY_AUDIO' && model.screen === 'loading-audio') {
    return { ...model, audioError: null };
  }
  if (event.type === 'RETRY_SURFACE'
      && model.screen === 'prompt'
      && model.surfaceError
      && !model.activeSurfaceModel) {
    const generated = generateSurfaceWithRetries(
      model.session[model.index],
      event.seed ?? nextSurfaceSeed(),
      surfaceGenerator
    );
    return {
      ...model,
      activeSurfaceModel: generated.model,
      surfaceResponse: {},
      surfaceError: generated.error?.message ?? null,
      promptStartedAt: event.startedAt ?? model.promptStartedAt
    };
  }
  if (event.type === 'REPLAY_STARTED'
      && model.screen === 'prompt'
      && !model.replayPending
      && model.experience?.replayPolicy !== 'none') {
    return { ...model, replayPending: true, replayOperationId: event.operationId };
  }
  if (event.type === 'REPLAY_FAILED'
      && model.screen === 'prompt'
      && model.replayPending
      && model.replayOperationId === event.operationId) {
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'error',
      ...trialResetFields()
    };
  }
  if (event.type === 'SHOW_SPANISH'
      && model.screen === 'prompt'
      && !model.replayPending
      && model.settings.hintPolicy !== 'unavailable') {
    return { ...model, textShown: true };
  }
  if (event.type === 'REPLAY_COMPLETED'
      && model.screen === 'prompt'
      && model.replayPending
      && model.replayOperationId === event.operationId) {
    return {
      ...model,
      replays: model.replays + 1,
      promptStartedAt: event.completedAt ?? model.promptStartedAt,
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'SELECT_RESULT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && RESULT_ONLY_SURFACE_FAMILIES.includes(model.activeSurfaceModel.family)
      && !model.initialAudioPending
      && !model.replayPending) {
    const selectedTarget = model.activeSurfaceModel.targets
      .find(target => target.resultId === event.selectedResult);
    if (!selectedTarget) return model;
    const selectedResult = selectedTarget.resultId;
    const selectedTargetId = selectedTarget.id;
    const correct = selectedResult === model.activeSurfaceModel.expectedResult;
    return reveal(model, {
      selectedResult,
      selectedTargetId,
      surfaceResponse: { complete: true, selectedResult, selectedTargetId },
      correct,
      timeout: false,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'SURFACE_EVENT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && !model.initialAudioPending
      && !model.replayPending) {
    let response;
    try {
      response = reduceSurfaceResponse(
        model.activeSurfaceModel,
        model.surfaceResponse,
        event.surfaceEvent
      );
    } catch {
      return model;
    }
    if (!response || typeof response !== 'object' || response === model.surfaceResponse) return model;
    if (!response.complete && !response.incorrect) return { ...model, surfaceResponse: { ...response } };
    if (response.complete && response.incorrect) return model;
    const selectedTargetId = response.selectedTargetId ?? null;
    const selectedTarget = model.activeSurfaceModel.targets
      .find(target => target.id === selectedTargetId);
    if (!selectedTarget) return model;
    const selectedResult = response.selectedResult ?? null;
    if (response.complete && selectedResult !== selectedTarget.resultId) return model;
    const correct = !response.incorrect && selectedResult === model.activeSurfaceModel.expectedResult;
    return reveal(model, {
      selectedResult,
      selectedTargetId,
      surfaceResponse: { ...response },
      correct,
      timeout: false,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'TIMEOUT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && !model.initialAudioPending
      && !model.replayPending) {
    return reveal(model, {
      selectedResult: null,
      selectedTargetId: null,
      surfaceResponse: {
        ...model.surfaceResponse,
        complete: true,
        selectedResult: null,
        selectedTargetId: null
      },
      correct: false,
      timeout: true,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'ROAD_APPROACH_ENDED'
      && ['prompt', 'null-event'].includes(model.screen)
      && model.roadMotion) {
    const roadMotion = reduceRoadMotion(model.roadMotion, {
      type: 'APPROACH_ENDED',
      at: event.completedAt
    });
    return roadMotion === model.roadMotion ? model : { ...model, roadMotion };
  }
  if (event.type === 'SET_MISS_REASON' && model.screen === 'reveal' && model.outcome === 'incorrect') {
    if (!MISS_REASONS.includes(event.reason)) return model;
    return { ...model, missReason: event.reason };
  }
  if (event.type === 'CONTINUE' && model.screen === 'reveal') {
    const nextIndex = model.index + 1;
    if (event.stepKind === 'transition') {
      const turnThrough = turnThroughSource(model);
      return {
        ...resetTrial({ ...model, screen: 'mock-transition' }, nextIndex),
        turnThrough
      };
    }
    if (event.stepKind === 'null-event' && nextIndex < model.session.length) {
      return enterNullEventScreen(model, nextIndex, event, surfaceGenerator);
    }
    if (nextIndex >= model.session.length) return resetTrial({ ...model, screen: 'results' }, nextIndex);
    return resetTrial({ ...model, screen: 'loading-audio' }, nextIndex);
  }
  if (event.type === 'MOCK_CONTINUE' && model.screen === 'mock-transition') {
    const nextIndex = model.index + 1;
    if (nextIndex >= model.session.length) return resetTrial({ ...model, screen: 'results' }, nextIndex);
    return resetTrial({ ...model, screen: 'loading-audio' }, nextIndex);
  }
  if (event.type === 'CONTINUITY_SYNC' && ['mock-transition', 'null-event'].includes(model.screen)) {
    if (!Number.isSafeInteger(event.index) || event.index < 0 || event.index > model.session.length) {
      return model;
    }
    if (event.stepKind === 'null-event' && event.index < model.session.length) {
      return enterNullEventScreen(model, event.index, event, surfaceGenerator);
    }
    const screen = event.stepKind === 'transition'
      ? 'mock-transition'
      : event.index === model.session.length ? 'results' : 'loading-audio';
    const synced = resetTrial({ ...model, screen }, event.index);
    // A silent junction answered correctly is answered by driving straight on,
    // and that answer has a clip like any other. resetTrial clears turnThrough,
    // so carry it into the transition the way the reveal's CONTINUE does.
    return screen === 'mock-transition' && model.screen === 'null-event' && model.turnThrough
      ? { ...synced, turnThrough: model.turnThrough }
      : synced;
  }
  if (event.type === 'NULL_EVENT_SELECT'
      && model.screen === 'null-event'
      && model.activeSurfaceModel
      && ['active', 'hint'].includes(model.nullEvent?.state)) {
    const target = model.activeSurfaceModel.targets.find(candidate => candidate.id === event.targetId);
    if (!target) return model;
    const correct = target.resultId === model.activeSurfaceModel.expectedResult;
    const roadMotion = model.roadMotion && Number.isFinite(event.completedAt)
      ? reduceRoadMotion(model.roadMotion, { type: 'ANSWERED', at: event.completedAt })
      : model.roadMotion;
    return {
      ...model,
      nullEvent: { state: correct ? 'correct' : 'incorrect', selectedTargetId: target.id },
      roadMotion,
      // Driving straight on through a silent junction earns the same clip a
      // spoken "siga recto" does; a wrong answer earns none, as at any reveal.
      // Mock withholds it entirely: the intro pan only plays after a correct
      // answer, so its presence would leak what the neutral notice hides.
      turnThrough: correct && model.experience?.revealPolicy !== 'session-end'
        ? {
            sceneId: model.activeSurfaceModel.geometry?.sceneId ?? null,
            family: model.activeSurfaceModel.family,
            targetX: target.x,
            targetY: target.y,
            resultId: target.resultId ?? null,
            outcome: 'unaided',
            pose: frozenRoadMotionPose(roadMotion)
          }
        : null
    };
  }
  if (event.type === 'NULL_EVENT_HINT'
      && model.screen === 'null-event'
      && model.nullEvent?.state === 'active') {
    return { ...model, nullEvent: { ...model.nullEvent, state: 'hint' } };
  }
  return model;
}

function trialResetFields() {
  return {
    outcome: null,
    selectedResult: null,
    responseMs: null,
    timeout: false,
    missReason: null,
    allowedMissReasons: [],
    replayPending: false,
    replayOperationId: null
  };
}

function resetTrial(model, index) {
  return {
    ...model,
    index,
    variant: null,
    activeSurfaceModel: null,
    surfaceResponse: {},
    surfaceError: null,
    audioError: null,
    textShown: false,
    replays: 0,
    promptStartedAt: null,
    initialAudioPending: false,
    roadMotion: null,
    ...trialResetFields(),
    selectedTargetId: null,
    correct: false,
    nullEvent: null,
    turnThrough: null
  };
}

// Source data for the first-person turn-through intro on the next transition:
// pure presentation state, never persisted, correct answers only.
function turnThroughSource(model) {
  if (!['unaided', 'assisted'].includes(model.outcome)) return null;
  const surfaceModel = model.activeSurfaceModel;
  const target = surfaceModel?.targets?.find(candidate => candidate.id === model.selectedTargetId);
  if (!target) return null;
  return {
    sceneId: surfaceModel.geometry?.sceneId ?? null,
    family: surfaceModel.family,
    targetX: target.x,
    targetY: target.y,
    resultId: target.resultId ?? null,
    outcome: model.outcome,
    pose: frozenRoadMotionPose(model.roadMotion)
  };
}

// The pose the answered scene froze in (correct answers always reach the
// reveal with road motion frozen), so the turn-through can open from it.
function frozenRoadMotionPose(roadMotion) {
  if (!roadMotion) return null;
  try {
    const view = roadMotionView(roadMotion, Date.now());
    if (view.scale <= 1) return null;
    return { scale: view.scale, originX: view.origin.x, originY: view.origin.y };
  } catch {
    return null;
  }
}

function reveal(model, { selectedResult, selectedTargetId, surfaceResponse, correct, timeout, completedAt }) {
  const responseMs = Number.isFinite(completedAt) && Number.isFinite(model.promptStartedAt)
    ? Math.max(0, completedAt - model.promptStartedAt)
    : null;
  const outcome = correct ? (model.textShown ? 'assisted' : 'unaided') : 'incorrect';
  const roadMotion = model.roadMotion && Number.isFinite(completedAt)
    ? reduceRoadMotion(model.roadMotion, { type: 'ANSWERED', at: completedAt })
    : model.roadMotion;
  return {
    ...model,
    screen: model.experience?.revealPolicy === 'session-end'
      ? 'mock-transition'
      : 'reveal',
    selectedResult,
    selectedTargetId,
    surfaceResponse,
    correct,
    timeout,
    roadMotion,
    responseMs,
    outcome,
    missReason: null,
    allowedMissReasons: outcome === 'incorrect' ? [...MISS_REASONS] : []
  };
}
