import { createAudioPlayer, validateAudioManifest } from './audio.js';
import {
  advanceActiveSession,
  advanceActiveSessionTransition,
  createActiveSession,
  discardActiveSession,
  resolveActiveSession
} from './active-session.js';
import {
  continuityEnabledForExperience,
  continuityTransitionViewModel,
  currentContinuityStep,
  prepareContinuitySession
} from './continuity-controller.js';
import {
  CONTINUITY_SCENE_FAMILIES,
  renderContinuityTransition
} from './continuity-transition-view.js';
import { commandsForPhase, validateCatalog } from './catalog.js';
import {
  ACCOMPLISHMENTS,
  ACCOMPLISHMENT_CHALLENGE_IDS,
  accomplishmentStatus,
  examinerEncounters,
  recordCompletion,
  themeCompletionStatus
} from './collection.js';
import { computeConfusionPairs, confusionDrillCommandIds } from './confusion-pairs.js';
import { createFeedbackCuePlayer } from './feedback-audio.js';
import { createAmbiencePlayer, pickAmbienceClip } from './ambience.js';
import {
  EXAMINERS,
  assignExaminerRotation,
  examinerById,
  filterVariantsForExaminer,
  selectTodaysExaminer
} from './examiners.js';
import { setDocumentLocale, translate } from './i18n.js';
import { createLessonFlag, updateLessonFlag } from './lesson-flags.js';
import {
  createRoadMotion,
  reduceRoadMotion,
  roadMotionProfile,
  roadMotionView
} from './road-motion.js';
import { createOfflineClient } from './offline-client.js';
import {
  POST_ANSWER_MOTION_FAMILIES,
  createPostAnswerMotion,
  postAnswerMotionView
} from './post-answer-motion.js';
import { compactAttempts } from './attempt-compaction.js';
import {
  challengeById,
  evaluateChallengeSession,
  evaluateCleanSession,
  personalBestKey,
  recordPersonalBest
} from './challenges.js';
import { readinessForCatalog } from './readiness.js';
import { renderLessonFlagEditor, renderReadinessView } from './readiness-view.js';
import { sessionPresetById } from './session-presets.js';
import { THEME_IDS, eligibleCommandsForTheme, SESSION_THEMES } from './session-themes.js';
import { renderSoloSetupView } from './solo-setup-view.js';
import { renderCollectionView } from './collection-view.js';
import {
  STORAGE_KEY,
  defaultState,
  exportState,
  importState,
  loadState,
  saveState
} from './storage.js';
import {
  generateSurface,
  reduceSurfaceResponse,
  renderSurfaceModel,
  supportedCommands
} from './surfaces.js';
import { SESSION_LENGTHS, createAttemptId, createSession, recordAttempt, summarizeSession } from './training.js';
import { selectCoverageAwareVariant } from './variant-coverage.js';

export const MISS_REASONS = Object.freeze(['hearing', 'meaning', 'mapping', 'target', 'accidental', 'other']);
export const TRIAL_TIME_MS = 8_000;
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
const ROAD_MOTION_SURFACE_IDS = new Set([
  'junction-v2',
  'roundabout-v2',
  'u-turn-v1',
  'overtake-v1',
  'join-traffic-v1',
  'parking-v1',
  'stopping-v1'
]);
const POST_ANSWER_MOTION_FAMILY_SET = new Set(POST_ANSWER_MOTION_FAMILIES);
// Hand-tuned per family for a natural-feeling pace, informed by each family's
// typical correctRoute path length (join-traffic's is a short lateral merge;
// u-turn's loops back on itself and is by far the longest route of any family).
const POST_ANSWER_MOTION_DURATIONS = Object.freeze({
  junction: 1_300,
  roundabout: 1_650,
  parking: 1_450,
  stopping: 1_350,
  'join-traffic': 1_100,
  overtake: 1_550,
  'u-turn': 1_800
});

export function promptControlsDisabled(model) {
  return model.screen !== 'prompt'
    || Boolean(model.initialAudioPending)
    || Boolean(model.replayPending)
    || !model.activeSurfaceModel;
}

export function createSavedPostAnswerMotion({
  screenModel,
  attempt,
  roadMovement,
  reducedMotion,
  startedAt
} = {}) {
  const surface = screenModel?.activeSurfaceModel;
  const family = surface?.family;
  const eligible = screenModel?.screen === 'reveal'
    && screenModel.correct === true
    && screenModel.timeout !== true
    && ['unaided', 'assisted'].includes(attempt?.outcome)
    && screenModel.experience?.revealPolicy !== 'session-end'
    && roadMovement === true
    && reducedMotion !== true
    && POST_ANSWER_MOTION_FAMILY_SET.has(family)
    && Array.isArray(surface?.geometry?.correctRoute);
  try {
    return createPostAnswerMotion({
      eligible,
      family,
      route: surface?.geometry?.correctRoute,
      startedAt,
      durationMs: POST_ANSWER_MOTION_DURATIONS[family]
    });
  } catch {
    return createPostAnswerMotion();
  }
}

export function feedbackCueForTransition(before, after, event) {
  if (before === after) return null;
  if (event.type === 'SHOW_SPANISH' && !before.textShown && after.textShown) {
    return 'spanish-hint';
  }
  if (before.screen !== 'prompt' || after.screen !== 'reveal' || after.timeout) return null;
  if (after.outcome === 'incorrect') return 'incorrect';
  if (after.outcome === 'unaided' || after.outcome === 'assisted') return 'correct';
  return null;
}

const AMBIENCE_ACTIVE_SCREENS = Object.freeze(['loading-audio', 'prompt', 'reveal', 'mock-transition']);

/**
 * Cabin ambience is strictly opt-in: it plays only while a session is actually
 * in progress, only in the simulated Mock experience or a continuous-drive
 * session, and only when the learner has turned it on. Any other screen, mode,
 * or setting state stops it.
 *
 * @param {{ screen: string, continuityActive?: boolean, settings: { experienceMode: string, ambience: boolean } }} model
 * @returns {boolean}
 */
/**
 * The primary setup card starts the fundamental use case — a simulated
 * precheck-plus-drive with hints optionally available — using the existing
 * Practice preset and Full mock theme rather than any new session concept.
 */
export const PRIMARY_DRIVE_RECIPE = Object.freeze({
  experienceMode: 'practice',
  themeId: 'full-mock',
  challengeId: null,
  phase: 'mixed'
});

export function ambienceEligible(model) {
  return AMBIENCE_ACTIVE_SCREENS.includes(model?.screen)
    && (model?.settings?.experienceMode === 'mock' || model?.continuityActive === true)
    && model?.settings?.ambience === true;
}

export function mockResultStatus(attempts, expectedCount) {
  return evaluateCleanSession(attempts, expectedCount);
}

// B: the scene appears first; the examiner's voice lands at a randomized moment
// during the approach. Moving-road trials draw from the front of the 6000 ms
// approach window so late commands still land with the junction visibly growing.
export const COMMAND_ONSET_RANGES_MS = Object.freeze({
  motion: Object.freeze({ min: 0, max: 2_500 }),
  static: Object.freeze({ min: 400, max: 1_500 })
});

export function commandOnsetDelayMs(motionEnabled, rng = Math.random) {
  const range = motionEnabled ? COMMAND_ONSET_RANGES_MS.motion : COMMAND_ONSET_RANGES_MS.static;
  return Math.round(range.min + rng() * (range.max - range.min));
}

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

export function localizedVehicleAnswer(command, locale) {
  if (!command.vehicle) return '';
  return locale === 'es' ? command.vehicle.answer : command.vehicle.answerEn;
}

const FOCUS_IDENTITY_ATTRIBUTES = Object.freeze([
  'data-setting',
  'data-locale',
  'data-action',
  'data-target',
  'data-control-event',
  'data-result',
  'data-miss-reason',
  'id',
  'name'
]);

export function captureFocusSnapshot(app, documentRef) {
  const activeElement = documentRef.activeElement;
  if (!activeElement || !app.contains(activeElement)) return null;
  const action = activeElement.getAttribute?.('data-action');
  const commandId = activeElement.getAttribute?.('data-command-id');
  const flagId = activeElement.getAttribute?.('data-flag-id');
  const identity = FOCUS_IDENTITY_ATTRIBUTES
    .map(attribute => [attribute, activeElement.getAttribute?.(attribute)])
    .find(([, value]) => value !== null && value !== '');
  if (!identity) return null;

  const [attribute, value] = identity;
  const selector = action
    ? [
        attributeSelector('data-action', action),
        commandId ? attributeSelector('data-command-id', commandId) : '',
        flagId ? attributeSelector('data-flag-id', flagId) : ''
      ].join('')
    : attributeSelector(attribute, value);
  const fallbackSelectors = [];
  if (action === 'show-spanish') fallbackSelectors.push('[data-action="replay"]');
  if (['resolve-lesson-flag', 'reopen-lesson-flag'].includes(action) && commandId && flagId) {
    const opposite = action === 'resolve-lesson-flag' ? 'reopen-lesson-flag' : 'resolve-lesson-flag';
    fallbackSelectors.push(
      `${attributeSelector('data-action', opposite)}${attributeSelector('data-command-id', commandId)}${attributeSelector('data-flag-id', flagId)}`
    );
  }
  if (action === 'save-lesson-flag' && commandId) {
    fallbackSelectors.push(
      `${attributeSelector('data-action', 'open-lesson-flag')}${attributeSelector('data-command-id', commandId)}${flagId ? attributeSelector('data-flag-id', flagId) : ''}`
    );
  }
  const selection = Number.isInteger(activeElement.selectionStart)
    && Number.isInteger(activeElement.selectionEnd)
    ? {
        start: activeElement.selectionStart,
        end: activeElement.selectionEnd,
        direction: activeElement.selectionDirection ?? 'none'
      }
    : null;
  return {
    selector,
    fallbackSelectors,
    selection
  };
}

export function lessonEditorDraftFromForm(form) {
  if (!form) return null;
  return {
    commandId: form.querySelector('[name="commandId"]')?.value ?? '',
    flagId: form.querySelector('[name="flagId"]')?.value ?? '',
    category: form.querySelector('[name="category"]')?.value ?? '',
    note: form.querySelector('[name="note"]')?.value ?? ''
  };
}

export function persistedActiveSessionAfterAttempt(session, { nextIndex, attemptId }) {
  const advanced = advanceActiveSession(session, { nextIndex, attemptId });
  return advanced.nextIndex === advanced.items.length ? null : advanced;
}

export function restoreFocusSnapshot(app, snapshot) {
  if (!snapshot) return false;
  const candidates = [snapshot.selector, ...snapshot.fallbackSelectors];
  const target = candidates
    .map(selector => app.querySelector(selector))
    .find(element => element && isEnabledFocusTarget(element));
  if (!target) return false;

  target.focus({ preventScroll: true });
  if (snapshot.selection && typeof target.setSelectionRange === 'function') {
    target.setSelectionRange(
      snapshot.selection.start,
      snapshot.selection.end,
      snapshot.selection.direction
    );
  }
  return true;
}

export function restoreOrDeferFocus(app, documentRef, { snapshot, deferredSnapshot }) {
  const activeElement = documentRef.activeElement;
  const focusIsNeutral = !activeElement
    || activeElement === documentRef.body
    || activeElement === documentRef.documentElement;
  if (!focusIsNeutral) return null;

  const candidate = snapshot ?? deferredSnapshot;
  if (!candidate) return null;
  return restoreFocusSnapshot(app, candidate) ? null : candidate;
}

export function focusScreen(documentRef, { previousScreen, nextScreen }) {
  if (previousScreen === nextScreen) return false;
  const target = documentRef.querySelector('[data-screen-focus]');
  if (!target) return false;
  target.focus({ preventScroll: true });
  return true;
}

export function reduceScreen(model, event, { surfaceGenerator = generateSurface } = {}) {
  if (event.type === 'SET_LOCALE') {
    return { ...model, settings: { ...model.settings, locale: event.locale } };
  }
  if (event.type === 'POST_ANSWER_MOTION_STARTED' && model.screen === 'reveal') {
    try {
      const view = postAnswerMotionView(event.motion, event.motion?.startedAt ?? 0);
      if (view.phase !== 'running') return model;
    } catch {
      return model;
    }
    return { ...model, postAnswerMotion: event.motion };
  }
  if (event.type === 'GO_TO_SETUP') {
    return resetTrial({ ...model, screen: 'setup', settings: model.settings, session: [] }, 0);
  }
  if (event.type === 'START_SESSION') {
    return resetTrial({
      ...model,
      screen: event.atTransition ? 'mock-transition' : 'loading-audio',
      session: [...event.session],
      experience: event.experience ?? model.experience ?? null,
      continuityActive: event.continuityActive === true
    }, 0);
  }
  if (event.type === 'RESUME_SESSION') {
    if (!Array.isArray(event.session) || !Number.isSafeInteger(event.index)
        || event.index < 0 || event.index > event.session.length) return model;
    const screen = event.atTransition
      ? 'mock-transition'
      : event.index === event.session.length ? 'results' : 'loading-audio';
    return resetTrial({
      ...model,
      screen,
      session: [...event.session],
      experience: event.experience ?? model.experience ?? null,
      continuityActive: event.continuityActive === true
    }, event.index);
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
      && model.screen === 'prompt'
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
    if (event.atTransition) return resetTrial({ ...model, screen: 'mock-transition' }, nextIndex);
    if (nextIndex >= model.session.length) return resetTrial({ ...model, screen: 'results' }, nextIndex);
    return resetTrial({ ...model, screen: 'loading-audio' }, nextIndex);
  }
  if (event.type === 'MOCK_CONTINUE' && model.screen === 'mock-transition') {
    const nextIndex = model.index + 1;
    if (nextIndex >= model.session.length) return resetTrial({ ...model, screen: 'results' }, nextIndex);
    return resetTrial({ ...model, screen: 'loading-audio' }, nextIndex);
  }
  if (event.type === 'CONTINUITY_SYNC' && model.screen === 'mock-transition') {
    if (!Number.isSafeInteger(event.index) || event.index < 0 || event.index > model.session.length) {
      return model;
    }
    const screen = event.atTransition
      ? 'mock-transition'
      : event.index === model.session.length ? 'results' : 'loading-audio';
    return resetTrial({ ...model, screen }, event.index);
  }
  return model;
}

export function manifestIndexKey(commandId, speed) {
  return `${commandId}|${speed}`;
}

export function buildManifestIndex(manifest) {
  const index = new Map();
  for (const variant of manifest) {
    const key = manifestIndexKey(variant.commandId, variant.speed);
    const bucket = index.get(key);
    if (bucket) bucket.push(variant);
    else index.set(key, [variant]);
  }
  return index;
}

export function selectPlaybackVariant(
  manifest,
  command,
  speed,
  fallbackSupported,
  attempts = [],
  rng = Math.random,
  {
    examinerChoice = 'mixed',
    dateParts,
    examinerRegistry = EXAMINERS,
    manifestIndex
  } = {}
) {
  const recorded = (manifestIndex ?? buildManifestIndex(manifest))
    .get(manifestIndexKey(command.id, speed)) ?? [];
  const eligibleRecorded = filterVariantsForExaminer(recorded, examinerChoice, {
    dateParts,
    registry: examinerRegistry
  });
  if (eligibleRecorded.length > 0) {
    return selectCoverageAwareVariant(eligibleRecorded, attempts, rng);
  }
  if (recorded.length > 0 && examinerChoice !== 'mixed') {
    throw new Error(`Audio unavailable for examiner: ${examinerChoice}`);
  }
  if (!fallbackSupported) throw new Error(`Audio unavailable for ${command.id}`);
  const phrasingIndex = Math.min(
    command.phrasings.length - 1,
    Math.floor(rng() * command.phrasings.length)
  );
  const phrasing = command.phrasings[phrasingIndex];
  return Object.freeze({
    id: `browser-speech--${command.id}--${phrasing.id}--${speed}`,
    commandId: command.id,
    phrasingId: phrasing.id,
    voiceId: 'browser-speech',
    speed,
    provider: 'browser-speech',
    model: 'web-speech-api',
    path: null
  });
}

export function resolveSessionExperience(settings, dateParts) {
  const challengeId = settings?.challengeId ?? null;
  const challenge = challengeId === null ? null : challengeById(challengeId);
  const preset = sessionPresetById(challenge ? challenge.basePresetId : settings?.experienceMode);
  const examinerChoice = settings?.examinerChoice;
  const resolvedExaminerId = examinerChoice === 'mixed'
    ? null
    : examinerChoice === 'today'
      ? selectTodaysExaminer(dateParts).id
      : examinerById(examinerChoice).id;
  return Object.freeze({
    modeId: preset.id,
    challengeId,
    examinerChoice,
    resolvedExaminerId,
    themeId: settings?.themeId ?? null,
    replayPolicy: challenge?.overrides.replayPolicy ?? preset.replayPolicy,
    revealPolicy: challenge?.overrides.revealPolicy ?? preset.revealPolicy,
    simulated: preset.simulated
  });
}

export function sessionIdentityData(experience) {
  const preset = sessionPresetById(experience?.modeId);
  const challenge = experience?.challengeId ? challengeById(experience.challengeId) : null;
  const theme = experience?.themeId === null
    ? null
    : SESSION_THEMES.find(candidate => candidate.id === experience?.themeId);
  if (experience?.themeId !== null && !theme) throw new Error(`Unknown theme: ${String(experience?.themeId)}`);
  const modeTitleKey = challenge?.titleKey ?? preset.titleKey;

  if (experience?.examinerChoice === 'mixed') {
    return Object.freeze({
      modeTitleKey,
      themeTitleKey: theme?.titleKey ?? 'theme.adaptive.title',
      examinerTitleKey: 'examiner.mixed.title',
      examinerDescriptionKey: 'examiner.mixed.description',
      visualTokens: Object.freeze(EXAMINERS.map(examiner => examiner.visualToken))
    });
  }

  const examiner = examinerById(experience?.resolvedExaminerId);
  return Object.freeze({
    modeTitleKey,
    themeTitleKey: theme?.titleKey ?? 'theme.adaptive.title',
    examinerTitleKey: examiner.nameKey,
    examinerDescriptionKey: examiner.descriptionKey,
    visualTokens: Object.freeze([examiner.visualToken])
  });
}

export function effectiveSessionSettings(settings) {
  const challengeId = settings?.challengeId ?? null;
  if (challengeId !== null) {
    const challenge = challengeById(challengeId);
    return Object.freeze({ ...settings, ...(challenge.overrides.settings ?? {}) });
  }
  const preset = sessionPresetById(settings?.experienceMode);
  if (preset.id === 'practice') return Object.freeze({ ...settings });
  return Object.freeze({
    ...settings,
    speed: preset.settings.speed,
    hintPolicy: preset.settings.hintPolicy,
    timed: preset.settings.timed
  });
}

export function localDateParts(now = new Date()) {
  return Object.freeze({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  });
}

export function sessionStartEligibility(
  commands,
  manifest,
  settings,
  fallbackSupported,
  dateParts,
  manifestIndex = buildManifestIndex(manifest)
) {
  const themed = settings.themeId === null
    ? commands
    : eligibleCommandsForTheme(commands, settings.themeId);
  const pool = commandsForPhase(themed, settings.phase);
  if (pool.length === 0) return Object.freeze({ canStart: false, reason: 'no-commands' });

  const experience = resolveSessionExperience(settings, dateParts);
  const examinerChoice = experience.resolvedExaminerId ?? 'mixed';
  const playable = pool.every(command => {
    const recorded = manifestIndex.get(manifestIndexKey(command.id, settings.speed)) ?? [];
    const eligible = filterVariantsForExaminer(recorded, examinerChoice);
    return eligible.length > 0
      || (examinerChoice === 'mixed' && recorded.length === 0 && fallbackSupported);
  });
  return Object.freeze({
    canStart: playable,
    reason: playable ? null : 'examiner-audio'
  });
}

export function resolvePhrasing(command, variant) {
  if (!variant) return command.phrasings[0];
  const phrasing = command.phrasings.find(candidate => candidate.id === variant.phrasingId);
  if (!phrasing) throw new Error(`Phrasing unavailable for ${command.id}: ${variant.phrasingId}`);
  return phrasing;
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
    postAnswerMotion: createPostAnswerMotion(),
    outcome: null,
    selectedResult: null,
    selectedTargetId: null,
    correct: false,
    responseMs: null,
    timeout: false,
    missReason: null,
    allowedMissReasons: [],
    replayPending: false,
    replayOperationId: null
  };
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

const COMMANDS_URL = new URL('../data/commands.json', import.meta.url);
const AUDIO_MANIFEST_URL = new URL('../data/audio-manifest.json', import.meta.url);

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  void bootstrap();
}

async function bootstrap() {
  const app = document.querySelector('#app');
  let commands;
  let selectableCommands;
  let manifest;
  let manifestIndex;
  let player;
  let feedbackPlayer;
  let ambiencePlayer;
  let ambienceClipId = null;
  let offlineClient;
  let offlineState;
  let state;
  let model;
  let resumableSession = null;
  let sessionRecoveryError = false;
  let importError = '';
  let recoveryError = '';
  let persistError = false;
  let audioBusy = false;
  let timerId = null;
  let timerTickId = null;
  let timerDeadline = null;
  let sessionAttemptIds = [];
  let currentAttemptId = null;
  let audioOperation = 0;
  let lastRenderedScreen = null;
  let deferredFocusSnapshot = null;
  let readinessFilters = { phase: 'mixed', state: 'all', flag: 'all', editor: null, noticeKey: '' };

  try {
    [commands, manifest] = await Promise.all([
      fetch(COMMANDS_URL).then(requireJsonResponse),
      fetch(AUDIO_MANIFEST_URL).then(requireJsonResponse)
    ]);
    validateCatalog(commands);
    validateAudioManifest(manifest, commands);
    manifestIndex = buildManifestIndex(manifest);
    selectableCommands = supportedCommands(commands, message => console.warn(message));
    const loaded = loadState(window.localStorage);
    recoveryError = loaded.recoveryError ?? '';
    const { recoveryError: _ignored, ...savedState } = loaded;
    state = {
      ...savedState,
      settings: { ...savedState.settings, mode: practiceMode(savedState.settings.mode) }
    };
    state = compactAttempts(state, Date.now());
    readinessFilters = { ...readinessFilters, phase: state.settings.phase };
    if (state.activeSession) {
      try {
        resumableSession = resolveActiveSession(state.activeSession, { commands: selectableCommands, audioManifest: manifest });
      } catch {
        state = discardActiveSession(state);
        persistState();
        sessionRecoveryError = true;
      }
    }
    model = { screen: 'title', settings: state.settings, session: [], index: 0 };
    player = createAudioPlayer({ AudioCtor: window.Audio, document });
    feedbackPlayer = createFeedbackCuePlayer();
    ambiencePlayer = createAmbiencePlayer({ AudioCtor: window.Audio });
    offlineClient = createOfflineClient({ navigatorRef: navigator, windowRef: window });
    offlineState = offlineClient.getState();
    offlineClient.subscribe(nextState => {
      offlineState = nextState;
      if (model.screen === 'setup') render();
    });
  } catch (error) {
    const locale = 'en';
    app.innerHTML = `<p class="notice error" role="alert">${escapeHtml(translate(locale, 'error.init'))}</p>`;
    console.error(error);
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !['prompt', 'loading-audio'].includes(model.screen)) return;
    stopTimer();
    player.cancel('visibilitychange');
    model = reduceScreen(model, { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' });
    render();
  });

  function locale() {
    return model.settings.locale;
  }

  function movingRoadEnabled(command) {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
    return ROAD_MOTION_SURFACE_IDS.has(command?.surfaceId)
      && state.settings.roadMovement
      && !reducedMotion;
  }

  function persistState() {
    try {
      saveState(window.localStorage, state);
      persistError = false;
    } catch {
      persistError = true;
    }
  }

  function render() {
    const previousScreen = lastRenderedScreen;
    const focusSnapshot = previousScreen === model.screen
      ? captureFocusSnapshot(app, document)
      : null;
    setDocumentLocale(locale());
    document.title = translate(locale(), 'app.title');
    document.querySelector('#skip-link').textContent = translate(locale(), 'app.skip');
    const screen = model.screen === 'title'
      ? renderTitle()
      : model.screen === 'setup'
      ? renderSetup()
      : model.screen === 'readiness'
        ? renderReadiness()
      : model.screen === 'collection'
        ? renderCollection()
      : model.screen === 'loading-audio'
        ? renderLoading()
        : model.screen === 'prompt'
          ? renderPrompt()
          : model.screen === 'reveal'
            ? renderReveal()
            : model.screen === 'mock-transition'
              ? renderMockTransition()
              : renderResults();
    app.innerHTML = `${renderHeader()}${screen}`;
    bindCommonEvents();
    if (model.screen === 'title') bindTitleEvents();
    if (model.screen === 'setup') bindSetupEvents();
    if (model.screen === 'readiness') bindReadinessEvents();
    if (model.screen === 'collection') bindCollectionEvents();
    if (model.screen === 'loading-audio') bindLoadingEvents();
    if (model.screen === 'prompt') bindPromptEvents();
    if (model.screen === 'reveal') bindRevealEvents();
    if (model.screen === 'mock-transition') bindMockTransitionEvents();
    if (model.screen === 'results') bindResultsEvents();
    refreshTimerText();
    if (previousScreen === model.screen) {
      deferredFocusSnapshot = restoreOrDeferFocus(app, document, {
        snapshot: focusSnapshot,
        deferredSnapshot: deferredFocusSnapshot
      });
    } else {
      deferredFocusSnapshot = null;
    }
    focusScreen(document, { previousScreen, nextScreen: model.screen });
    lastRenderedScreen = model.screen;
    syncAmbience();
  }

  function syncAmbience() {
    if (ambienceEligible(model)) {
      ambienceClipId ??= pickAmbienceClip();
      ambiencePlayer.start(ambienceClipId);
    } else {
      ambiencePlayer.stop();
      ambienceClipId = null;
    }
  }

  function renderHeader() {
    return `<header class="app-header">
      <div>
        <h1>${translate(locale(), 'app.shortTitle')}</h1>
        <p>${translate(locale(), 'app.subtitle')}</p>
        <p class="audio-disclosure">${translate(locale(), 'audio.disclosure')}</p>
      </div>
      <div class="language-switch" role="group" aria-label="${translate(locale(), 'setting.language')}">
        <button type="button" data-locale="en" aria-pressed="${locale() === 'en'}">EN</button>
        <button type="button" data-locale="es" aria-pressed="${locale() === 'es'}">ES</button>
      </div>
    </header>`;
  }

  function renderSessionIdentity() {
    if (!model.experience) return '';
    const identity = sessionIdentityData(model.experience);
    return `<aside class="session-identity" aria-label="${translate(locale(), 'session.identity')}">
      <div class="identity-chip"><span>${translate(locale(), 'session.mode')}</span><strong>${translate(locale(), identity.modeTitleKey)}</strong></div>
      <div class="identity-chip"><span>${translate(locale(), 'session.theme')}</span><strong>${translate(locale(), identity.themeTitleKey)}</strong></div>
      <div class="identity-chip examiner-identity">
        <span>${translate(locale(), 'session.examiner')}</span>
        <span class="examiner-token-stack" aria-hidden="true">${identity.visualTokens.map(token => `<i class="examiner-token ${token}"></i>`).join('')}</span>
        <strong>${translate(locale(), identity.examinerTitleKey)}</strong>
        <small>${translate(locale(), identity.examinerDescriptionKey)}</small>
      </div>
    </aside>`;
  }

  function renderTitle() {
    return `<section class="panel title-screen" aria-labelledby="title-screen-heading">
      <div class="title-scene">
        <img src="./assets/driving/urban-roadside-photo-v1.webp" alt="" aria-hidden="true">
        <div class="title-overlay">
          <h2 id="title-screen-heading" data-screen-focus tabindex="-1">${translate(locale(), 'app.title')}</h2>
          <p>${translate(locale(), 'app.subtitle')}</p>
          <button class="primary title-enter" type="button" data-action="enter">${translate(locale(), 'title.enter')}</button>
        </div>
      </div>
    </section>`;
  }

  function bindTitleEvents() {
    app.querySelector('[data-action="enter"]')?.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'GO_TO_SETUP' });
      render();
    });
  }

  function renderSetup() {
    const dateParts = localDateParts(new Date());
    const effectiveSettings = effectiveSessionSettings(state.settings);
    const isConfusionPairs = effectiveSettings.challengeId === 'confusion-pairs';
    const pool = isConfusionPairs
      ? confusionDrillSelection(effectiveSettings)
      : commandsForPhase(
        effectiveSettings.themeId === null
          ? selectableCommands
          : eligibleCommandsForTheme(selectableCommands, effectiveSettings.themeId),
        effectiveSettings.phase
      );
    const eligibility = isConfusionPairs
      ? Object.freeze({ canStart: pool.length > 0, reason: pool.length > 0 ? null : 'no-commands' })
      : sessionStartEligibility(
        selectableCommands,
        manifest,
        effectiveSettings,
        player.supportsFallback(),
        dateParts,
        manifestIndex
      );
    const startErrorKey = isConfusionPairs
      ? 'challenge.confusionPairs.unavailable'
      : eligibility.reason === 'no-commands'
        ? 'setup.start.noCommands'
        : 'setup.start.examinerAudio';
    return `<section class="panel" aria-labelledby="setup-title">
      <h2 id="setup-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.setup')}</h2>
      ${recoveryError ? `<p class="notice" role="alert">${translate(locale(), 'error.recovery')}</p>` : ''}
      ${sessionRecoveryError ? `<p class="notice" role="alert">${translate(locale(), 'resume.recovery')}</p>` : ''}
      ${persistError ? `<p class="notice" role="alert">${translate(locale(), 'error.persistence')} <button type="button" data-action="dismiss-persist-error">${translate(locale(), 'notice.dismiss')}</button></p>` : ''}
      ${renderResumeCard()}
      ${renderPrimaryDriveCard(dateParts)}
      <button type="button" data-action="open-readiness">${translate(locale(), 'screen.readiness')}</button>
      <button type="button" data-action="open-collection">${translate(locale(), 'screen.collection')}</button>
      <details class="setup-advanced">
        <summary>${translate(locale(), 'setup.advanced.title')}</summary>
        ${renderSoloSetupView({
          locale: locale(),
          t: (key, variables) => translate(locale(), key, variables),
          selectedPresetId: state.settings.experienceMode,
          selectedExaminerChoiceId: state.settings.examinerChoice,
          selectedThemeId: state.settings.themeId,
          selectedChallengeId: state.settings.challengeId,
          dateParts
        })}
        <details class="advanced-practice-disclosure" ${state.settings.experienceMode === 'practice' ? '' : 'data-preset-owned="true"'}>
          <summary>${translate(locale(), 'practice.advanced.title')}</summary>
          <p>${translate(locale(), state.settings.experienceMode === 'practice'
            ? 'practice.advanced.description'
            : 'practice.advanced.presetOwned')}</p>
          <div class="setup-grid">
            ${selectControl('phase', 'setting.phase', [
              ['driving', 'phase.driving'], ['precheck', 'phase.precheck'], ['mixed', 'phase.mixed']
            ])}
            ${selectControl('speed', 'setting.speed', [[0.75, '0.75×'], [0.9, '0.9×'], [1, '1×']], true)}
            ${selectControl('hintPolicy', 'setting.hint', [
              ['available', 'hint.available'], ['shown', 'hint.shown'], ['unavailable', 'hint.unavailable']
            ])}
            ${selectControl('timed', 'setting.timing', [[false, 'timing.off'], [true, 'timing.on']])}
            ${selectControl('feedbackSounds', 'setting.feedbackSounds', [
              [true, 'feedbackSounds.on'], [false, 'feedbackSounds.off']
            ])}
            ${selectControl('roadMovement', 'setting.roadMovement', [
              [true, 'roadMovement.on'], [false, 'roadMovement.off']
            ])}
            ${selectControl('continuousDrive', 'setting.continuousDrive', [
              [true, 'continuousDrive.on'], [false, 'continuousDrive.off']
            ])}
            ${selectControl('ambience', 'setting.ambience', [
              [false, 'ambience.off'], [true, 'ambience.on']
            ])}
            ${selectControl('length', 'setting.length', [
              ['short', 'length.short'], ['medium', 'length.medium'], ['all', 'length.all']
            ])}
            ${selectControl('mode', 'setting.mode', [['recommended', 'mode.recommended'], ['free', 'mode.free']])}
          </div>
        </details>
        <p class="pool-count">${translate(locale(), 'summary.count', { count: pool.length })}</p>
        <button class="primary" type="button" data-action="start" ${eligibility.canStart ? '' : 'disabled'}>${translate(locale(), 'setup.advanced.start')}</button>
        ${eligibility.canStart ? '' : `<p class="notice error" role="alert">${translate(locale(), startErrorKey)}</p>`}
        ${renderOfflineCard()}
        <details class="settings-disclosure">
          <summary><span aria-hidden="true">⚙️</span> ${translate(locale(), 'settings.title')}</summary>
          <div class="data-controls" role="group" aria-label="${translate(locale(), 'data.management')}">
            <button type="button" data-action="export">${translate(locale(), 'data.export')}</button>
            <button type="button" data-action="import">${translate(locale(), 'data.import')}</button>
            <button class="danger" type="button" data-action="reset">${translate(locale(), 'data.reset')}</button>
            <input type="file" data-import-file accept="application/json" hidden>
          </div>
        </details>
      </details>
      ${importError ? `<p class="notice error" role="alert">${importError}</p>` : ''}
    </section>`;
  }

  function renderPrimaryDriveCard(dateParts) {
    const recipeSettings = effectiveSessionSettings({
      ...state.settings,
      ...PRIMARY_DRIVE_RECIPE
    });
    const eligibility = sessionStartEligibility(
      selectableCommands,
      manifest,
      recipeSettings,
      player.supportsFallback(),
      dateParts,
      manifestIndex
    );
    const hintsOn = state.settings.hintPolicy !== 'unavailable';
    return `<section class="primary-drive-card" aria-labelledby="primary-drive-title">
      <h3 id="primary-drive-title">${translate(locale(), 'setup.primary.title')}</h3>
      <p>${translate(locale(), 'setup.primary.description')}</p>
      <label class="primary-drive-hint">
        <input type="checkbox" data-action="toggle-primary-hint" ${hintsOn ? 'checked' : ''}>
        <span>${translate(locale(), 'setup.primary.hint')}</span>
      </label>
      <button class="primary" type="button" data-action="start-drive" ${eligibility.canStart ? '' : 'disabled'}>${translate(locale(), 'setup.primary.start')}</button>
      ${eligibility.canStart ? '' : `<p class="notice error" role="alert">${translate(locale(), eligibility.reason === 'no-commands' ? 'setup.start.noCommands' : 'setup.start.examinerAudio')}</p>`}
    </section>`;
  }

  function renderReadiness() {
    return renderReadinessView({
      locale: locale(),
      t: (key, variables) => translate(locale(), key, variables),
      commands: selectableCommands,
      readiness: readinessForCatalog(selectableCommands, state.attempts, state.lessonFlags),
      lessonFlags: state.lessonFlags,
      filters: readinessFilters
    });
  }

  function renderCollection() {
    return renderCollectionView({
      locale: locale(),
      t: (key, variables) => translate(locale(), key, variables),
      accomplishments: accomplishmentStatus(state.completions),
      themes: themeCompletionStatus(state.completions, THEME_IDS).map(entry => ({
        ...entry,
        titleKey: SESSION_THEMES.find(theme => theme.id === entry.themeId)?.titleKey ?? entry.themeId
      })),
      examiners: examinerEncounters(state.attempts),
      personalBests: Object.entries(state.personalBests).map(([key, record]) => ({
        titleKey: key === 'adaptive' ? 'theme.adaptive.title' : `theme.${key}.title`,
        averageResponseMs: record.averageResponseMs
      }))
    });
  }

  function renderResumeCard() {
    if (!resumableSession) return '';
    const total = resumableSession.sessionItems.length;
    const current = Math.min(resumableSession.index + 1, total);
    return `<section class="resume-card" aria-labelledby="resume-title">
      <h3 id="resume-title">${translate(locale(), 'resume.title')}</h3>
      <p>${translate(locale(), 'resume.progress', { current, total })}</p>
      <div class="resume-actions">
        <button class="primary" type="button" data-action="resume-session">${translate(locale(), 'resume.action')}</button>
        <button type="button" data-action="discard-session">${translate(locale(), 'resume.discard')}</button>
      </div>
    </section>`;
  }

  function renderOfflineCard() {
    const status = offlineState?.status ?? 'unsupported';
    const completed = offlineState?.completedBytes ?? 0;
    const total = offlineState?.totalBytes ?? 0;
    const progress = total > 0 ? Math.min(completed, total) : 0;
    const isDownloading = status === 'downloading';
    const hasProgress = (offlineState?.completedAssets ?? 0) > 0;
    const messageKey = status === 'unsupported'
      ? 'offline.unsupported'
      : status === 'ready'
        ? 'offline.ready'
        : status === 'update-available'
          ? 'offline.updateAvailable'
        : status === 'update-ready'
          ? 'offline.updateReady'
          : status === 'failed'
            ? 'offline.failedRetained'
            : isDownloading
              ? 'offline.downloading'
              : 'offline.onlineOnly';
    const actions = status === 'update-ready'
      ? `<button type="button" data-offline-action="apply-update">${translate(locale(), 'offline.applyUpdate')}</button>`
      : status === 'update-available'
        ? `<button type="button" data-offline-action="download">${translate(locale(), 'offline.downloadUpdate')}</button>`
      : isDownloading
        ? `<button type="button" data-offline-action="cancel">${translate(locale(), 'offline.cancel')}</button>`
        : ['unsupported', 'ready'].includes(status)
          ? ''
          : `<button type="button" data-offline-action="download">${translate(locale(), hasProgress ? 'offline.resumeDownload' : 'offline.download')}</button>`;
    return `<section class="offline-card" aria-labelledby="offline-title">
      <h3 id="offline-title">${translate(locale(), 'offline.title')}</h3>
      <div role="status" aria-live="polite">
        <p>${translate(locale(), messageKey)}</p>
        ${total > 0 ? `<p>${translate(locale(), 'offline.bytes', { completed: formatBytes(completed), total: formatBytes(total) })}</p>` : ''}
      </div>
      <progress data-offline-progress value="${progress}" max="${total || 1}" ${total > 0 ? '' : 'hidden'}></progress>
      ${actions}
      ${offlineClient?.standalone ? '' : `<details>
        <summary>${translate(locale(), 'offline.installTitle')}</summary>
        <p>${translate(locale(), 'offline.installSafari')}</p>
        <p>${translate(locale(), 'offline.transferProgress')}</p>
      </details>`}
    </section>`;
  }

  function renderLoading() {
    return `<section class="panel loading" aria-labelledby="loading-title">
      <p class="progress">${progressText()}</p>
      <h2 id="loading-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.loading')}</h2>
      ${model.audioError
        ? `<p class="notice error" role="alert">${translate(locale(), 'error.audio')}</p>
           <button class="primary" type="button" data-action="retry">${translate(locale(), 'action.retry')}</button>`
        : '<div class="spinner" aria-hidden="true"></div>'}
    </section>`;
  }

  function renderPrompt() {
    const command = currentCommand();
    const phrasing = resolvePhrasing(command, model.variant);
    const controlsDisabled = promptControlsDisabled(model);
    const motion = model.roadMotion
      ? roadMotionView(model.roadMotion, Date.now())
      : null;
    return `<section class="panel prompt" aria-labelledby="prompt-title">
      ${renderSessionIdentity()}
      <div class="prompt-meta">
        <p class="progress">${progressText()}</p>
        ${model.settings.timed ? `<p class="timer" data-timer>${timerText()}</p>` : ''}
        <button type="button" data-action="end-session">${translate(locale(), 'session.end')}</button>
      </div>
      <div class="gameplay-layout prompt-layout">
        <div class="gameplay-copy">
          <h2 id="prompt-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.prompt')}</h2>
          <p>${translate(locale(), 'prompt.listen')}</p>
          <p class="sr-status" role="status">${translate(locale(), model.initialAudioPending ? 'status.audioPlaying' : 'status.audioReady')}</p>
          <div class="prompt-actions">
            ${model.experience?.replayPolicy !== 'none'
              ? `<button type="button" data-action="replay" ${controlsDisabled ? 'disabled' : ''}>🔊 ${translate(locale(), 'action.replay')}</button>`
              : ''}
            ${model.settings.hintPolicy === 'available' && !model.textShown
              ? `<button type="button" data-action="show-spanish" ${controlsDisabled ? 'disabled' : ''}>${translate(locale(), 'action.showSpanish')}</button>`
              : ''}
          </div>
          ${model.textShown ? `<p class="spanish-hint" lang="es">${escapeHtml(phrasing.es)}</p>` : ''}
          ${model.surfaceError
            ? `<div class="surface-error" role="alert">
                 <p>${translate(locale(), 'surface.error')}</p>
                 <button class="primary" type="button" data-action="surface-retry">${translate(locale(), 'surface.retry')}</button>
               </div>`
            : ''}
        </div>
        ${model.surfaceError
          ? ''
          : `<div class="gameplay-surface">${renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, locale(), {
              disabled: controlsDisabled,
              motion
            })}</div>`}
      </div>
    </section>`;
  }

  function renderReveal() {
    const command = currentCommand();
    const phrasing = resolvePhrasing(command, model.variant);
    const motion = model.roadMotion
      ? roadMotionView(model.roadMotion, Date.now())
      : null;
    const postAnswerMotion = model.postAnswerMotion
      ? postAnswerMotionView(model.postAnswerMotion, Date.now())
      : null;
    return `<section class="panel reveal" aria-labelledby="outcome-title">
      <p class="progress">${progressText()}</p>
      <h2 id="outcome-title" role="status" aria-live="polite" class="outcome ${model.outcome}" data-screen-focus tabindex="-1">${translate(locale(), `result.${model.outcome}`)}</h2>
      <div class="gameplay-layout reveal-layout">
        <div class="gameplay-surface">${renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, locale(), {
          disabled: true,
          reveal: true,
          selectedTargetId: model.selectedTargetId,
          motion,
          postAnswerMotion
        })}</div>
        <div class="gameplay-feedback">
          <dl class="answer-details">
            <div><dt>${translate(locale(), 'reveal.spanish')}</dt><dd lang="es">${escapeHtml(phrasing.es)}</dd></div>
            ${locale() === 'en' ? `<div><dt>${translate(locale(), 'reveal.meaning')}</dt><dd>${escapeHtml(phrasing.en)}</dd></div>` : ''}
            <div><dt>${translate(locale(), 'reveal.expected')}</dt><dd>${escapeHtml(translate(locale(), `actionResult.${command.acceptedResult}`))}</dd></div>
            ${command.vehicle ? `<div><dt>${translate(locale(), 'reveal.vehicle')}</dt><dd lang="${locale()}">${escapeHtml(localizedVehicleAnswer(command, locale()))}</dd></div>` : ''}
          </dl>
          ${model.outcome === 'incorrect' ? renderDiagnosis() : ''}
          <button type="button" data-action="open-reveal-lesson-flag">${translate(locale(), 'readiness.action.openFlag')}</button>
          ${renderLessonFlagEditor(
            readinessFilters.editor?.commandId === command.id ? readinessFilters.editor : null,
            (key, variables) => translate(locale(), key, variables)
          )}
          <button class="primary" type="button" data-action="continue">${translate(locale(), 'action.continue')}</button>
        </div>
      </div>
    </section>`;
  }

  function renderDiagnosis() {
    return `<fieldset class="diagnosis">
      <legend>${translate(locale(), 'miss.title')}</legend>
      <p>${translate(locale(), 'miss.optional')}</p>
      <div class="diagnosis-grid">
        ${MISS_REASONS.map(reason => `<button type="button" data-miss-reason="${reason}" aria-pressed="${model.missReason === reason}">${translate(locale(), `miss.${reason}`)}</button>`).join('')}
      </div>
    </fieldset>`;
  }

  function renderMockTransition() {
    const step = currentContinuityStep(state.activeSession);
    if (step?.kind === 'transition') {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      const transition = continuityTransitionViewModel(step, {
        motionEnabled: state.settings.roadMovement && !reducedMotion,
        progressText: continuityProgressText()
      });
      return `<section class="panel mock-transition" aria-label="${translate(locale(), 'screen.mockTransition')}">
        ${renderSessionIdentity()}
        ${renderContinuityTransition(transition, locale())}
        <p class="notice">${translate(locale(), 'mock.simulated')}</p>
        <button type="button" data-action="end-session">${translate(locale(), 'session.end')}</button>
      </section>`;
    }
    return `<section class="panel mock-transition" aria-labelledby="mock-transition-title">
      ${renderSessionIdentity()}
      <p class="progress">${progressText()}</p>
      <h2 id="mock-transition-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.mockTransition')}</h2>
      <p>${translate(locale(), 'mock.transition')}</p>
      <p class="notice">${translate(locale(), 'mock.simulated')}</p>
      <button type="button" data-action="end-session">${translate(locale(), 'session.end')}</button>
    </section>`;
  }

  function renderResults() {
    const attempts = state.attempts.filter(attempt => sessionAttemptIds.includes(attempt.id));
    const summary = summarizeSession(attempts, model.session);
    const isMock = model.experience?.revealPolicy === 'session-end';
    const mockStatus = isMock ? mockResultStatus(attempts, model.session.length) : null;
    const challengeId = model.experience?.challengeId ?? null;
    const challengeStatus = challengeId ? evaluateChallengeSession(challengeId, attempts, model.session.length) : null;
    const personalBestNotice = challengeId === 'personal-best'
      ? personalBestResultNotice(state.personalBests, model.experience.themeId, summary.averageResponseMs, challengeStatus)
      : null;
    return `<section class="panel results" aria-labelledby="results-title">
      <h2 id="results-title" role="status" aria-live="polite" aria-describedby="results-headline" data-screen-focus tabindex="-1">${translate(locale(), 'screen.results')}</h2>
      ${renderSessionIdentity()}
      <p id="results-headline" class="headline">${isMock
        ? translate(locale(), `mock.result.${mockStatus}`)
        : translate(locale(), 'summary.unaidedPercent', { percent: summary.unaidedPercentage })}</p>
      ${isMock ? `<p class="notice">${translate(locale(), 'mock.result.nonOfficial')}</p>` : ''}
      ${challengeId && challengeId !== 'personal-best' ? `<p class="notice">${translate(locale(), `challenge.result.${challengeStatus}`)}</p>` : ''}
      ${personalBestNotice ? `<p class="notice">${personalBestNotice}</p>` : ''}
      ${!isMock && summary.counts.assisted > summary.counts.unaided ? `<p class="notice">${translate(locale(), 'results.hintNotice')}</p>` : ''}
      <div class="result-counts">
        ${countCard('unaided', summary.counts.unaided)}
        ${countCard('assisted', summary.counts.assisted)}
        ${countCard('incorrect', summary.counts.incorrect)}
      </div>
      <dl class="summary-details">
        <div><dt>${translate(locale(), 'summary.averageTime')}</dt><dd>${summary.averageResponseMs === null ? '—' : translate(locale(), 'summary.milliseconds', { seconds: formatSeconds(summary.averageResponseMs) })}</dd></div>
        <div><dt>${translate(locale(), 'summary.replays')}</dt><dd>${summary.replayCount}</dd></div>
        <div><dt>${translate(locale(), 'summary.hints')}</dt><dd>${summary.hintCount}</dd></div>
      </dl>
      ${isMock ? renderMockReview(attempts) : `<h3>${translate(locale(), 'summary.weak')}</h3>
      ${summary.weakActions.length === 0
        ? `<p>${translate(locale(), 'summary.noWeak')}</p>`
        : `<ul class="weak-list">${summary.weakActions.slice(0, 5).map(item => {
            const command = selectableCommands.find(candidate => candidate.actionId === item.actionId);
            const phrasing = command.phrasings[0];
            return `<li>${escapeHtml(locale() === 'es' ? phrasing.es : phrasing.en)} — ${Math.round(item.weightedScore * 100)}%</li>`;
          }).join('')}</ul>`}`}
      <button class="primary" type="button" data-action="setup">${translate(locale(), 'action.newSession')}</button>
      <button type="button" data-action="open-readiness">${translate(locale(), 'screen.readiness')}</button>
      <button type="button" data-action="open-collection">${translate(locale(), 'screen.collection')}</button>
    </section>`;
  }

  function renderMockReview(attempts) {
    const attemptByCommand = new Map(attempts.map(attempt => [attempt.commandId, attempt]));
    return `<section aria-labelledby="mock-review-title">
      <h3 id="mock-review-title">${translate(locale(), 'mock.review.title')}</h3>
      <ol class="mock-review-list">${model.session.map(command => {
        const attempt = attemptByCommand.get(command.id);
        if (!attempt) return '';
        const phrasing = command.phrasings.find(candidate => candidate.id === attempt.phrasingId)
          ?? resolvePhrasing(command, command.audioVariant);
        return `<li class="mock-review-item ${attempt.outcome}">
          <h4 lang="es">${escapeHtml(phrasing.es)}</h4>
          ${locale() === 'en' ? `<p>${escapeHtml(phrasing.en)}</p>` : ''}
          <p><strong>${translate(locale(), 'reveal.expected')}:</strong> ${escapeHtml(translate(locale(), `actionResult.${command.acceptedResult}`))}</p>
          <p><strong>${translate(locale(), 'mock.review.outcome')}:</strong> ${translate(locale(), `result.${attempt.outcome}`)}</p>
          <p><strong>${translate(locale(), 'mock.review.response')}:</strong> ${attempt.responseMs === null
            ? '—'
            : translate(locale(), 'summary.milliseconds', { seconds: formatSeconds(attempt.responseMs) })}</p>
          <p><strong>${translate(locale(), 'summary.replays')}:</strong> ${attempt.replays ?? 0}</p>
          ${attempt.outcome === 'incorrect' ? `<fieldset class="diagnosis">
            <legend>${translate(locale(), 'miss.title')}</legend>
            <div class="diagnosis-grid">${MISS_REASONS.map(reason => `<button type="button" data-mock-miss-reason="${reason}" data-attempt-id="${escapeHtml(attempt.id)}" aria-pressed="${attempt.missReason === reason}">${translate(locale(), `miss.${reason}`)}</button>`).join('')}</div>
          </fieldset>` : ''}
        </li>`;
      }).join('')}</ol>
    </section>`;
  }

  function selectControl(setting, labelKey, values, labelsAreLiteral = false) {
    return `<label>${translate(locale(), labelKey)}
      <select data-setting="${setting}">
        ${values.map(([value, label]) => `<option value="${value}" ${String(state.settings[setting]) === String(value) ? 'selected' : ''}>${labelsAreLiteral ? label : translate(locale(), label)}</option>`).join('')}
      </select>
    </label>`;
  }

  function countCard(outcome, count) {
    return `<div class="count-card ${outcome}"><strong>${count}</strong><span>${translate(locale(), `result.${outcome}`)}</span></div>`;
  }

  function formatSeconds(responseMs) {
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(responseMs / 1000);
  }

  function personalBestResultNotice(personalBests, themeId, averageResponseMs, challengeStatus) {
    if (challengeStatus !== 'clean' || averageResponseMs === null) {
      return translate(locale(), 'challenge.personalBest.notClean');
    }
    const record = personalBests[personalBestKey(themeId)];
    return record?.averageResponseMs === averageResponseMs
      ? translate(locale(), 'challenge.personalBest.newRecord', { seconds: formatSeconds(averageResponseMs) })
      : translate(locale(), 'challenge.personalBest.comparison', {
          seconds: formatSeconds(averageResponseMs),
          best: formatSeconds(record.averageResponseMs)
        });
  }

  function bindCommonEvents() {
    app.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
      const editor = lessonEditorDraftFromForm(app.querySelector('.lesson-editor form'));
      if (editor) readinessFilters = { ...readinessFilters, editor };
      updateSettings({ locale: button.dataset.locale });
    }));
  }

  function bindSetupEvents() {
    app.querySelectorAll('[data-action="select-experience-mode"]').forEach(control => {
      control.addEventListener('change', () => updateSettings({ experienceMode: control.value }));
    });
    app.querySelectorAll('[data-action="select-examiner"]').forEach(control => {
      control.addEventListener('change', () => updateSettings({ examinerChoice: control.value }));
    });
    app.querySelectorAll('[data-action="select-theme"]').forEach(control => {
      control.addEventListener('change', () => updateSettings({
        themeId: control.value === 'adaptive' ? null : control.value
      }));
    });
    app.querySelectorAll('[data-action="select-challenge"]').forEach(control => {
      control.addEventListener('change', () => updateSettings({
        challengeId: control.value === 'none' ? null : control.value
      }));
    });
    app.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('change', () => {
      const setting = control.dataset.setting;
      const value = setting === 'speed'
        ? Number(control.value)
        : ['timed', 'feedbackSounds', 'roadMovement', 'continuousDrive', 'ambience'].includes(setting)
          ? control.value === 'true'
          : control.value;
      updateSettings({ [setting]: value });
    }));
    app.querySelector('[data-action="toggle-primary-hint"]')?.addEventListener('change', event => {
      updateSettings({ hintPolicy: event.target.checked ? 'available' : 'unavailable' });
    });
    app.querySelector('[data-action="start-drive"]')?.addEventListener('click', () => {
      updateSettings(PRIMARY_DRIVE_RECIPE);
      startSession();
    });
    app.querySelector('[data-action="start"]')?.addEventListener('click', () => startSession());
    app.querySelector('[data-action="open-readiness"]')?.addEventListener('click', openReadiness);
    app.querySelector('[data-action="open-collection"]')?.addEventListener('click', openCollection);
    app.querySelector('[data-action="resume-session"]')?.addEventListener('click', resumeSession);
    app.querySelector('[data-action="discard-session"]')?.addEventListener('click', discardSession);
    app.querySelector('[data-offline-action="download"]')?.addEventListener('click', () => void offlineClient.download());
    app.querySelector('[data-offline-action="cancel"]')?.addEventListener('click', () => void offlineClient.cancelDownload());
    app.querySelector('[data-offline-action="apply-update"]')?.addEventListener('click', () => void offlineClient.applyUpdate());
    app.querySelector('[data-action="export"]').addEventListener('click', downloadBackup);
    app.querySelector('[data-action="import"]').addEventListener('click', () => app.querySelector('[data-import-file]').click());
    app.querySelector('[data-action="reset"]').addEventListener('click', resetProgress);
    app.querySelector('[data-action="dismiss-persist-error"]')?.addEventListener('click', () => {
      persistError = false;
      render();
    });
    app.querySelector('[data-import-file]').addEventListener('change', event => {
      const [file] = event.target.files;
      if (file) void importBackup(file);
      event.target.value = '';
    });
  }

  function bindCollectionEvents() {
    app.querySelector('[data-action="close-collection"]')?.addEventListener('click', () => {
      model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
      render();
    });
  }

  function bindReadinessEvents() {
    app.querySelector('[data-action="close-readiness"]')?.addEventListener('click', () => {
      readinessFilters = { ...readinessFilters, editor: null };
      model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
      render();
    });
    for (const [action, key] of [
      ['set-readiness-phase', 'phase'],
      ['set-readiness-state', 'state'],
      ['set-readiness-flag', 'flag']
    ]) {
      app.querySelector(`[data-action="${action}"]`)?.addEventListener('change', event => {
        readinessFilters = { ...readinessFilters, [key]: event.target.value, editor: null, noticeKey: '' };
        render();
      });
    }
    app.querySelectorAll('[data-action="start-readiness-practice"]').forEach(button => {
      button.addEventListener('click', () => startSession(
        { kind: button.dataset.targetKind },
        readinessFilters.phase
      ));
    });
    app.querySelectorAll('[data-action="start-command-practice"]').forEach(button => {
      button.addEventListener('click', () => {
        const command = selectableCommands.find(candidate => candidate.id === button.dataset.commandId);
        if (command) startSession({ kind: 'command', commandId: command.id }, command.phase);
      });
    });
    app.querySelectorAll('[data-action="open-lesson-flag"]').forEach(button => {
      button.addEventListener('click', () => openLessonFlagEditor(button.dataset.commandId, button.dataset.flagId));
    });
    app.querySelector('[data-action="save-lesson-flag"]')?.addEventListener('click', saveLessonFlag);
    for (const [action, status] of [
      ['resolve-lesson-flag', 'resolved'],
      ['reopen-lesson-flag', 'open']
    ]) {
      app.querySelectorAll(`[data-action="${action}"]`).forEach(button => {
        button.addEventListener('click', () => changeLessonFlagStatus(button.dataset.flagId, status));
      });
    }
  }

  function bindLoadingEvents() {
    app.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'RETRY_AUDIO' });
      render();
      void playCurrentCommand();
    });
  }

  function bindPromptEvents() {
    app.querySelector('[data-action="end-session"]')?.addEventListener('click', endSession);
    app.querySelector('[data-action="replay"]')?.addEventListener('click', () => void replayAudio());
    app.querySelector('[data-action="show-spanish"]')?.addEventListener('click', () => {
      const event = { type: 'SHOW_SPANISH' };
      const before = model;
      model = reduceScreen(model, event);
      const cue = feedbackCueForTransition(before, model, event);
      render();
      playFeedbackCue(cue);
    });
    app.querySelector('[data-action="surface-retry"]')?.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'RETRY_SURFACE', startedAt: Date.now() });
      if (model.surfaceError) console.warn(`Surface unavailable for ${currentCommand().id}: ${model.surfaceError}`);
      render();
      if (model.activeSurfaceModel) startTimer();
    });
    app.querySelectorAll('[data-target]:not([data-control-event])').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'select-target', targetId: button.dataset.target });
    }));
    app.querySelectorAll('[data-control-event="activate"]').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'activate', targetId: button.dataset.target });
    }));
    app.querySelectorAll('[data-control-event="select-gear"]').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'select-gear', targetId: button.dataset.target, gear: button.dataset.gear });
    }));
    app.querySelector('[data-control-event="submit-secure"]')?.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'submit-secure' });
    });
    app.querySelectorAll('[data-control-event="set-wheel"]').forEach(control => control.addEventListener('input', () => {
      dispatchSurfaceEvent({ type: 'set-wheel', degrees: Number(control.value) });
    }));
    app.querySelector('.road-motion-scene[data-road-motion-running="true"]')
      ?.addEventListener('animationend', event => {
        if (event.animationName !== 'road-camera-push') return;
        const before = model;
        model = reduceScreen(model, {
          type: 'ROAD_APPROACH_ENDED',
          completedAt: Date.now()
        });
        if (model !== before) render();
      }, { once: true });
  }

  function dispatchSurfaceEvent(surfaceEvent) {
    if (!model.activeSurfaceModel || promptControlsDisabled(model)) return;
    completeTrial({ type: 'SURFACE_EVENT', surfaceEvent, completedAt: Date.now() });
  }

  function settleSessionEnd() {
    settlePersonalBest();
    settleCompletions();
  }

  function settlePersonalBest() {
    if (model.experience?.challengeId !== 'personal-best') return;
    const attempts = state.attempts.filter(attempt => sessionAttemptIds.includes(attempt.id));
    if (evaluateChallengeSession('personal-best', attempts, model.session.length) !== 'clean') return;
    const summary = summarizeSession(attempts, model.session);
    const key = personalBestKey(model.experience.themeId);
    const updated = recordPersonalBest(state.personalBests, key, summary.averageResponseMs, Date.now());
    if (updated === state.personalBests) return;
    state = { ...state, personalBests: updated };
    persistState();
  }

  function settleCompletions() {
    const achievedAt = Date.now();
    let completions = state.completions;
    const themeId = model.experience?.themeId ?? null;
    if (themeId !== null) {
      completions = recordCompletion(completions, 'theme', themeId, achievedAt);
    }
    const challengeId = model.experience?.challengeId ?? null;
    if (challengeId && ACCOMPLISHMENT_CHALLENGE_IDS.includes(challengeId)) {
      const attempts = state.attempts.filter(attempt => sessionAttemptIds.includes(attempt.id));
      if (evaluateChallengeSession(challengeId, attempts, model.session.length) === 'clean') {
        completions = recordCompletion(completions, 'challenge', challengeId, achievedAt);
      }
    }
    if (completions === state.completions) return;
    state = { ...state, completions };
    persistState();
  }

  function bindRevealEvents() {
    app.querySelector('[data-action="open-reveal-lesson-flag"]')?.addEventListener('click', () => {
      openLessonFlagEditor(currentCommand().id);
    });
    app.querySelector('[data-action="save-lesson-flag"]')?.addEventListener('click', saveLessonFlag);
    app.querySelectorAll('[data-miss-reason]').forEach(button => button.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'SET_MISS_REASON', reason: button.dataset.missReason });
      persistMissReason(model.missReason);
      render();
    }));
    app.querySelector('[data-action="continue"]').addEventListener('click', () => {
      readinessFilters = { ...readinessFilters, editor: null };
      currentAttemptId = null;
      model = reduceScreen(model, {
        type: 'CONTINUE',
        atTransition: currentContinuityStep(state.activeSession)?.kind === 'transition'
      });
      if (model.screen === 'results') settleSessionEnd();
      render();
      if (model.screen === 'loading-audio') void playCurrentCommand();
    });
  }

  function bindMockTransitionEvents() {
    app.querySelector('[data-action="end-session"]')?.addEventListener('click', endSession);
    const step = currentContinuityStep(state.activeSession);
    if (step?.kind === 'transition') {
      let consumed = false;
      const advance = () => {
        if (consumed || model.screen !== 'mock-transition') return;
        const current = currentContinuityStep(state.activeSession);
        if (current?.id !== step.id) return;
        consumed = true;
        advanceContinuityTransition();
      };
      app.querySelectorAll('[data-action="skip-continuity-transition"]')
        .forEach(button => button.addEventListener('click', advance));
      const family = continuityTransitionViewModel(step, {
        motionEnabled: true,
        progressText: continuityProgressText()
      }).family;
      const delay = Math.max(1_200, CONTINUITY_SCENE_FAMILIES[family].camera.durationMs + 250);
      window.setTimeout(advance, delay);
      return;
    }
    window.setTimeout(() => {
      if (model.screen !== 'mock-transition') return;
      model = reduceScreen(model, { type: 'MOCK_CONTINUE' });
      if (model.screen === 'results') settleSessionEnd();
      render();
      if (model.screen === 'loading-audio') void playCurrentCommand();
    }, 600);
  }

  function bindResultsEvents() {
    app.querySelectorAll('[data-mock-miss-reason]').forEach(button => {
      button.addEventListener('click', () => {
        const { attemptId } = button.dataset;
        const reason = button.dataset.mockMissReason;
        if (!MISS_REASONS.includes(reason)) return;
        state = {
          ...state,
          attempts: state.attempts.map(attempt => attempt.id === attemptId
            ? { ...attempt, missReason: reason }
            : attempt)
        };
        persistState();
        render();
      });
    });
    app.querySelector('[data-action="open-readiness"]')?.addEventListener('click', openReadiness);
    app.querySelector('[data-action="open-collection"]')?.addEventListener('click', openCollection);
    app.querySelector('[data-action="setup"]').addEventListener('click', () => {
      model = reduceScreen(model, { type: 'GO_TO_SETUP' });
      sessionAttemptIds = [];
      state = discardActiveSession(state);
      resumableSession = null;
      persistState();
      render();
    });
  }

  function openReadiness() {
    readinessFilters = { ...readinessFilters, phase: state.settings.phase, editor: null, noticeKey: '' };
    model = { ...model, screen: 'readiness', settings: state.settings };
    render();
  }

  function openCollection() {
    model = { ...model, screen: 'collection', settings: state.settings };
    render();
  }

  function openLessonFlagEditor(commandId, flagId = '') {
    if (!selectableCommands.some(command => command.id === commandId)) return;
    const flag = flagId ? state.lessonFlags.find(candidate => candidate.id === flagId) : null;
    if (flagId && !flag) return;
    readinessFilters = {
      ...readinessFilters,
      editor: {
        commandId,
        flagId: flag?.id ?? '',
        category: flag?.category ?? 'wording',
        note: flag?.note ?? ''
      }
    };
    render();
  }

  function saveLessonFlag() {
    const form = app.querySelector('.lesson-editor form');
    if (!form) return;
    const editor = lessonEditorDraftFromForm(form);
    const { commandId, flagId, category, note } = editor;
    try {
      if (!selectableCommands.some(command => command.id === commandId)) {
        throw new Error('Invalid command');
      }
      const lessonFlags = flagId
        ? updateLessonFlag(state.lessonFlags, flagId, { category, note })
        : createLessonFlag(state.lessonFlags, { commandId, category, note });
      state = { ...state, lessonFlags };
      persistState();
      readinessFilters = { ...readinessFilters, editor: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorKey = message.includes('280')
        ? 'readiness.flag.error.noteTooLong'
        : message.toLowerCase().includes('note')
          ? 'readiness.flag.error.noteEmpty'
          : message.toLowerCase().includes('category')
            ? 'readiness.flag.error.invalidCategory'
            : message.toLowerCase().includes('not found')
              ? 'readiness.flag.error.missingFlag'
              : 'readiness.flag.error.invalidCommand';
      readinessFilters = { ...readinessFilters, editor: { ...editor, errorKey } };
    }
    render();
  }

  function changeLessonFlagStatus(flagId, status) {
    try {
      state = { ...state, lessonFlags: updateLessonFlag(state.lessonFlags, flagId, { status }) };
      persistState();
      readinessFilters = { ...readinessFilters, editor: null };
      render();
    } catch {
      readinessFilters = {
        ...readinessFilters,
        editor: { commandId: '', flagId, category: 'wording', note: '', errorKey: 'readiness.flag.error.missingFlag' }
      };
      render();
    }
  }

  function updateSettings(changes) {
    state = { ...state, settings: { ...state.settings, ...changes } };
    persistState();
    model = { ...reduceScreen(model, { type: 'SET_LOCALE', locale: state.settings.locale }), settings: state.settings };
    importError = '';
    recoveryError = '';
    render();
  }

  function confusionDrillSelection(sessionSettings) {
    const phaseFiltered = sessionSettings.phase === 'mixed'
      ? selectableCommands
      : selectableCommands.filter(command => command.phase === sessionSettings.phase);
    const pairs = computeConfusionPairs(state.attempts, phaseFiltered);
    const ids = confusionDrillCommandIds(pairs, phaseFiltered, SESSION_LENGTHS[sessionSettings.length]);
    return ids.map(id => phaseFiltered.find(command => command.id === id)).filter(Boolean);
  }

  function startSession(target = null, selectionPhase = state.settings.phase) {
    sessionAttemptIds = [];
    const practiceTarget = target ?? { kind: state.settings.mode === 'free' ? 'free' : 'recommended' };
    const isConfusionPairs = state.settings.challengeId === 'confusion-pairs';
    const baseSessionSettings = effectiveSessionSettings(state.settings);
    // Confusion pairs picks its own commands from confusion history, not a
    // theme, so it always runs untethered from whatever theme is selected —
    // otherwise a resumed session could contain commands outside that theme.
    const sessionSettings = isConfusionPairs
      ? { ...baseSessionSettings, themeId: null }
      : baseSessionSettings;
    const sessionDateParts = localDateParts(new Date());
    const experience = resolveSessionExperience(sessionSettings, sessionDateParts);
    const selectedCommands = isConfusionPairs
      ? confusionDrillSelection(sessionSettings)
      : createSession(selectableCommands, {
        phase: selectionPhase,
        length: sessionSettings.length,
        mode: sessionSettings.mode,
        themeId: sessionSettings.themeId,
        target: practiceTarget,
        attempts: state.attempts,
        lessonFlags: state.lessonFlags
      });
    if (selectedCommands.length === 0) {
      if (model.screen === 'readiness') {
        readinessFilters = { ...readinessFilters, noticeKey: 'readiness.empty.target' };
        render();
      }
      return;
    }
    readinessFilters = { ...readinessFilters, noticeKey: '' };
    const examinerRotation = experience.challengeId === 'five-examiners'
      ? assignExaminerRotation(selectedCommands.length)
      : null;
    let session = selectedCommands.map((command, index) => ({
      ...command,
      audioVariant: selectPlaybackVariant(
        manifest,
        command,
        sessionSettings.speed,
        player.supportsFallback(),
        state.attempts,
        Math.random,
        {
          examinerChoice: examinerRotation ? examinerRotation[index] : (experience.resolvedExaminerId ?? 'mixed'),
          dateParts: sessionDateParts,
          manifestIndex
        }
      )
    }));
    let continuity;
    if (continuityEnabledForExperience(experience, sessionSettings)) {
      const prepared = prepareContinuitySession(session, selectableCommands);
      session = [...prepared.session];
      continuity = prepared.continuity;
    }
    const activeSession = createActiveSession({
      id: createAttemptId(),
      startedAt: Date.now(),
      items: session.map(command => ({
        commandId: command.id,
        phrasingId: command.audioVariant.phrasingId,
        voiceId: command.audioVariant.voiceId,
        speed: command.audioVariant.speed
      })),
      settings: resumableSettings(sessionSettings),
      target: practiceTarget,
      continuity,
      experience: experience
    });
    state = { ...state, activeSession };
    persistState();
    model = reduceScreen(
      { ...model, settings: sessionSettings },
      {
        type: 'START_SESSION',
        session,
        experience,
        atTransition: currentContinuityStep(activeSession)?.kind === 'transition',
        continuityActive: Boolean(activeSession.continuity)
      }
    );
    render();
    if (model.screen === 'loading-audio') void playCurrentCommand();
  }

  function resumeSession() {
    if (!resumableSession) return;
    const restoredSettings = { ...state.settings, ...resumableSession.settings };
    sessionAttemptIds = [...resumableSession.attemptIds];
    model = reduceScreen(
      { ...model, settings: restoredSettings },
      {
        type: 'RESUME_SESSION',
        session: resumableSession.sessionItems,
        index: resumableSession.index,
        experience: resumableSession.experience,
        atTransition: currentContinuityStep(state.activeSession)?.kind === 'transition',
        continuityActive: Boolean(state.activeSession?.continuity)
      }
    );
    render();
    if (model.screen === 'loading-audio') void playCurrentCommand();
  }

  function advanceContinuityTransition() {
    const advanced = advanceActiveSessionTransition(state.activeSession);
    const nextStep = currentContinuityStep(advanced);
    const routeComplete = !nextStep;
    state = { ...state, activeSession: routeComplete ? null : advanced };
    persistState();
    model = reduceScreen(model, {
      type: 'CONTINUITY_SYNC',
      index: advanced.nextIndex,
      atTransition: nextStep?.kind === 'transition'
    });
    if (model.screen === 'results') settleSessionEnd();
    render();
    if (model.screen === 'loading-audio') void playCurrentCommand();
  }

  function discardSession() {
    state = discardActiveSession(state);
    resumableSession = null;
    sessionRecoveryError = false;
    persistState();
    render();
  }

  function endSession() {
    if (!window.confirm(translate(locale(), 'session.endConfirm'))) return;
    stopTimer();
    player.cancel('end-session');
    feedbackPlayer.stop();
    ambiencePlayer.stop();
    ambienceClipId = null;
    state = discardActiveSession(state);
    resumableSession = null;
    sessionAttemptIds = [];
    currentAttemptId = null;
    persistState();
    model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
    render();
  }

  async function playCurrentCommand() {
    if (audioBusy || model.screen !== 'loading-audio') return;
    feedbackPlayer.stop();
    audioBusy = true;
    const operation = ++audioOperation;
    const command = currentCommand();
    let variant = model.variant ?? command.audioVariant;
    try {
      if (!variant) {
        variant = selectPlaybackVariant(manifest, command, model.settings.speed, player.supportsFallback(), state.attempts, Math.random, { manifestIndex });
      }
      const phrasing = resolvePhrasing(command, variant);
      const motionEnabled = movingRoadEnabled(command);
      const beforeScene = model;
      try {
        model = reduceScreen(model, {
          type: 'SCENE_STARTED',
          variant,
          startedAt: Date.now(),
          seed: nextSurfaceSeed(),
          motionEnabled
        });
      } catch {
        model = beforeScene;
      }
      if (model !== beforeScene) {
        render();
        await new Promise(resolve => setTimeout(resolve, commandOnsetDelayMs(motionEnabled)));
        if (operation !== audioOperation
            || model.screen !== 'prompt'
            || !model.initialAudioPending) return;
      }
      const result = await player.play(
        variant,
        { text: phrasing.es, speed: variant.speed },
        {
          onStarted: () => {
            if (operation !== audioOperation) return;
            const before = model;
            try {
              model = reduceScreen(model, {
                type: 'AUDIO_STARTED',
                variant,
                startedAt: Date.now(),
                seed: nextSurfaceSeed(),
                motionEnabled
              });
            } catch {
              model = before;
            }
            if (model !== before) render();
          }
        }
      );
      if (operation !== audioOperation) return;
      if (!result.scored) {
        model = reduceScreen(model, { type: 'AUDIO_FAILED', reason: result.reason });
      } else {
        model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant, completedAt: Date.now() });
        if (model.surfaceError) console.warn(`Surface unavailable for ${command.id}: ${model.surfaceError}`);
      }
    } catch {
      model = reduceScreen(model, { type: 'AUDIO_FAILED', reason: 'error' });
    } finally {
      if (operation === audioOperation) {
        audioBusy = false;
        render();
        if (model.screen === 'prompt') startTimer();
      }
    }
  }

  async function replayAudio() {
    if (audioBusy || model.screen !== 'prompt') return;
    stopTimer();
    feedbackPlayer.stop();
    audioBusy = true;
    const operationId = ++audioOperation;
    model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId });
    render();
    let result;
    try {
      result = await player.replay();
    } catch {
      result = { scored: false, reason: 'error' };
    }
    audioBusy = false;
    if (result.scored) {
      model = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId, completedAt: Date.now() });
    } else {
      model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId, reason: result.reason });
    }
    render();
    if (model.screen === 'prompt') startTimer();
  }

  function completeTrial(event) {
    if (model.screen !== 'prompt') return;
    const before = model;
    model = reduceScreen(model, event);
    if (model === before) return;
    const cue = feedbackCueForTransition(before, model, event);
    if (!['reveal', 'mock-transition'].includes(model.screen)) {
      render();
      playFeedbackCue(cue);
      return;
    }
    stopTimer();
    const command = before.session[before.index];
    const result = recordAttempt(state, {
      audio: { scored: true },
      commandId: command.id,
      actionId: command.actionId,
      phrasingId: before.variant.phrasingId,
      voiceId: before.variant.voiceId,
      audioProvider: before.variant.provider,
      speed: before.variant.speed,
      phase: command.phase,
      surfaceId: command.surfaceId,
      surfaceModel: before.activeSurfaceModel,
      selectedResult: model.selectedResult,
      selectedTargetId: model.selectedTargetId,
      correct: model.correct,
      textShown: model.textShown,
      responseMs: model.responseMs,
      replays: model.replays,
      timed: model.settings.timed,
      timeout: model.timeout
    });
    if (result.scored) {
      const progress = { nextIndex: before.index + 1, attemptId: result.attempt.id };
      const continuityEnabled = Boolean(state.activeSession?.continuity);
      let activeSession = continuityEnabled || before.experience?.revealPolicy === 'session-end'
        ? advanceActiveSession(state.activeSession, progress)
        : persistedActiveSessionAfterAttempt(state.activeSession, progress);
      const nextStep = continuityEnabled ? currentContinuityStep(activeSession) : null;
      const continuityIndex = activeSession?.nextIndex ?? progress.nextIndex;
      if (continuityEnabled && !nextStep) activeSession = null;
      state = { ...result.state, activeSession };
      currentAttemptId = result.attempt.id;
      sessionAttemptIds.push(result.attempt.id);
      persistState();
      if (continuityEnabled) {
        model = reduceScreen(model, {
          type: 'CONTINUITY_SYNC',
          index: continuityIndex,
          atTransition: nextStep?.kind === 'transition'
        });
        if (model.screen === 'results') settleSessionEnd();
      }
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
      model = reduceScreen(model, {
        type: 'POST_ANSWER_MOTION_STARTED',
        motion: createSavedPostAnswerMotion({
          screenModel: model,
          attempt: result.attempt,
          roadMovement: state.settings.roadMovement,
          reducedMotion,
          startedAt: Date.now()
        })
      });
    }
    render();
    if (before.experience?.revealPolicy === 'session-end') {
      if (model.screen === 'loading-audio') void playCurrentCommand();
      return;
    }
    playFeedbackCue(cue);
  }

  function playFeedbackCue(cue) {
    if (!cue) return;
    void feedbackPlayer.play(cue, {
      enabled: state.settings.feedbackSounds,
      busy: audioBusy
    });
  }

  function persistMissReason(reason) {
    if (!reason || !currentAttemptId) return;
    state = {
      ...state,
      attempts: state.attempts.map(attempt => attempt.id === currentAttemptId ? { ...attempt, missReason: reason } : attempt)
    };
    persistState();
  }

  function startTimer() {
    stopTimer();
    if (model.initialAudioPending) return;
    if (!model.settings.timed || model.screen !== 'prompt' || !model.activeSurfaceModel) return;
    timerDeadline = Date.now() + TRIAL_TIME_MS;
    timerTickId = window.setInterval(refreshTimerText, 200);
    timerId = window.setTimeout(() => {
      completeTrial({ type: 'TIMEOUT', completedAt: Date.now() });
    }, TRIAL_TIME_MS);
    refreshTimerText();
  }

  function stopTimer() {
    if (timerId !== null) window.clearTimeout(timerId);
    if (timerTickId !== null) window.clearInterval(timerTickId);
    timerId = null;
    timerTickId = null;
    timerDeadline = null;
  }

  function refreshTimerText() {
    const timer = app.querySelector('[data-timer]');
    if (timer) timer.textContent = timerText();
  }

  function timerText() {
    const remaining = timerDeadline === null ? TRIAL_TIME_MS : Math.max(0, timerDeadline - Date.now());
    return translate(locale(), 'prompt.timer', { seconds: Math.ceil(remaining / 1_000) });
  }

  function currentCommand() {
    return model.session[model.index];
  }

  function progressText() {
    return translate(locale(), 'prompt.progress', { current: model.index + 1, total: model.session.length });
  }

  function continuityProgressText() {
    const current = Math.min(model.session.length, model.index + 1);
    return translate(locale(), 'prompt.progress', { current, total: model.session.length });
  }

  function downloadBackup() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'examen-practico-de-conducir-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    try {
      const candidate = importState(await file.text());
      if (!window.confirm(translate(locale(), 'data.importConfirm'))) return;
      const candidateState = {
        ...candidate,
        settings: { ...candidate.settings, mode: practiceMode(candidate.settings.mode) }
      };
      const candidateSession = candidateState.activeSession
        ? resolveActiveSession(candidateState.activeSession, { commands: selectableCommands, audioManifest: manifest })
        : null;
      state = candidateState;
      resumableSession = candidateSession;
      persistState();
      model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
      importError = '';
      recoveryError = '';
    } catch {
      importError = translate(locale(), 'error.import');
    }
    render();
  }

  function resetProgress() {
    if (!window.confirm(translate(locale(), 'data.resetConfirm'))) return;
    stopTimer();
    player.cancel('reset');
    feedbackPlayer.stop();
    window.localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
    sessionAttemptIds = [];
    currentAttemptId = null;
    resumableSession = null;
    sessionRecoveryError = false;
    importError = '';
    recoveryError = '';
    render();
  }

  render();
  void offlineClient.register();
}

async function requireJsonResponse(response) {
  if (!response.ok) throw new Error(`Failed to load ${response.url}`);
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function practiceMode(value) {
  return ['recommended', 'free'].includes(value) ? value : 'recommended';
}

function resumableSettings(settings) {
  const { phase, speed, hintPolicy, timed, feedbackSounds, roadMovement, ambience, length } = settings;
  return {
    phase,
    speed,
    hintPolicy,
    timed,
    feedbackSounds,
    roadMovement,
    ambience,
    length,
    mode: practiceMode(settings.mode)
  };
}

function formatBytes(value) {
  return `${(Number(value) / 1_000_000).toFixed(1)} MB`;
}

function attributeSelector(attribute, value) {
  const escaped = String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `[${attribute}="${escaped}"]`;
}

function isEnabledFocusTarget(element) {
  return element.disabled !== true
    && element.hidden !== true
    && element.getAttribute?.('aria-disabled') !== 'true';
}
