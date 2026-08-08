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
import { createFeedbackCuePlayer } from './feedback-audio.js';
import {
  EXAMINERS,
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
import { readinessForCatalog } from './readiness.js';
import { renderLessonFlagEditor, renderReadinessView } from './readiness-view.js';
import { sessionPresetById } from './session-presets.js';
import { eligibleCommandsForTheme, SESSION_THEMES } from './session-themes.js';
import { renderSoloSetupView } from './solo-setup-view.js';
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
import { createAttemptId, createSession, recordAttempt, summarizeSession } from './training.js';
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
const POST_ANSWER_MOTION_DURATIONS = Object.freeze({
  junction: 1_300,
  roundabout: 1_650,
  parking: 1_450,
  stopping: 1_350
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

export function mockResultStatus(attempts, expectedCount) {
  if (!Array.isArray(attempts) || !Number.isSafeInteger(expectedCount) || expectedCount < 1) {
    return 'needs-practice';
  }
  return attempts.length === expectedCount && attempts.every(attempt => attempt.outcome === 'unaided')
    ? 'clean'
    : 'needs-practice';
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
      experience: event.experience ?? model.experience ?? null
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
      experience: event.experience ?? model.experience ?? null
    }, event.index);
  }
  if (event.type === 'AUDIO_STARTED'
      && event.motionEnabled === true
      && model.screen === 'loading-audio'
      && ROAD_MOTION_SURFACE_IDS.has(model.session[model.index]?.surfaceId)) {
    let generated;
    try {
      generated = generateSurfaceWithRetries(
        model.session[model.index],
        event.seed ?? nextSurfaceSeed(),
        surfaceGenerator
      );
    } catch {
      return model;
    }
    const sceneId = generated.model?.geometry?.sceneId;
    if (!generated.model || !roadMotionProfile(sceneId)) return model;
    return {
      ...model,
      screen: 'prompt',
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      activeSurfaceModel: generated.model,
      surfaceResponse: {},
      surfaceError: null,
      textShown: model.settings.hintPolicy === 'shown',
      replays: 0,
      promptStartedAt: null,
      initialAudioPending: true,
      roadMotion: createRoadMotion({
        enabled: true,
        startedAt: event.startedAt,
        sceneId
      }),
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
  if (event.type === 'AUDIO_COMPLETED'
      && model.screen === 'prompt'
      && model.initialAudioPending
      && model.roadMotion) {
    return {
      ...model,
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      promptStartedAt: event.completedAt,
      initialAudioPending: false,
      roadMotion: reduceRoadMotion(model.roadMotion, {
        type: 'AUDIO_COMPLETED',
        at: event.completedAt
      })
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
    examinerRegistry = EXAMINERS
  } = {}
) {
  const recorded = manifest.filter(variant =>
    variant.commandId === command.id
    && variant.speed === speed
  );
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
  const preset = sessionPresetById(settings?.experienceMode);
  const examinerChoice = settings?.examinerChoice;
  const resolvedExaminerId = examinerChoice === 'mixed'
    ? null
    : examinerChoice === 'today'
      ? selectTodaysExaminer(dateParts).id
      : examinerById(examinerChoice).id;
  return Object.freeze({
    modeId: preset.id,
    examinerChoice,
    resolvedExaminerId,
    themeId: settings?.themeId ?? null,
    replayPolicy: preset.replayPolicy,
    revealPolicy: preset.revealPolicy,
    simulated: preset.simulated
  });
}

export function sessionIdentityData(experience) {
  const preset = sessionPresetById(experience?.modeId);
  const theme = experience?.themeId === null
    ? null
    : SESSION_THEMES.find(candidate => candidate.id === experience?.themeId);
  if (experience?.themeId !== null && !theme) throw new Error(`Unknown theme: ${String(experience?.themeId)}`);

  if (experience?.examinerChoice === 'mixed') {
    return Object.freeze({
      modeTitleKey: preset.titleKey,
      themeTitleKey: theme?.titleKey ?? 'theme.adaptive.title',
      examinerTitleKey: 'examiner.mixed.title',
      examinerDescriptionKey: 'examiner.mixed.description',
      visualTokens: Object.freeze(EXAMINERS.map(examiner => examiner.visualToken))
    });
  }

  const examiner = examinerById(experience?.resolvedExaminerId);
  return Object.freeze({
    modeTitleKey: preset.titleKey,
    themeTitleKey: theme?.titleKey ?? 'theme.adaptive.title',
    examinerTitleKey: examiner.nameKey,
    examinerDescriptionKey: examiner.descriptionKey,
    visualTokens: Object.freeze([examiner.visualToken])
  });
}

export function effectiveSessionSettings(settings) {
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
  dateParts
) {
  const themed = settings.themeId === null
    ? commands
    : eligibleCommandsForTheme(commands, settings.themeId);
  const pool = commandsForPhase(themed, settings.phase);
  if (pool.length === 0) return Object.freeze({ canStart: false, reason: 'no-commands' });

  const experience = resolveSessionExperience(settings, dateParts);
  const examinerChoice = experience.resolvedExaminerId ?? 'mixed';
  const playable = pool.every(command => {
    const recorded = manifest.filter(variant =>
      variant.commandId === command.id
      && variant.speed === settings.speed
    );
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
  let player;
  let feedbackPlayer;
  let offlineClient;
  let offlineState;
  let state;
  let model;
  let resumableSession = null;
  let sessionRecoveryError = false;
  let importError = '';
  let recoveryError = '';
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
    selectableCommands = supportedCommands(commands, message => console.warn(message));
    const loaded = loadState(window.localStorage);
    recoveryError = loaded.recoveryError ?? '';
    const { recoveryError: _ignored, ...savedState } = loaded;
    state = {
      ...savedState,
      settings: { ...savedState.settings, mode: practiceMode(savedState.settings.mode) }
    };
    readinessFilters = { ...readinessFilters, phase: state.settings.phase };
    if (state.activeSession) {
      try {
        resumableSession = resolveActiveSession(state.activeSession, { commands: selectableCommands, audioManifest: manifest });
      } catch {
        state = discardActiveSession(state);
        saveState(window.localStorage, state);
        sessionRecoveryError = true;
      }
    }
    model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
    player = createAudioPlayer({ AudioCtor: window.Audio, document });
    feedbackPlayer = createFeedbackCuePlayer();
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

  function render() {
    const previousScreen = lastRenderedScreen;
    const focusSnapshot = previousScreen === model.screen
      ? captureFocusSnapshot(app, document)
      : null;
    setDocumentLocale(locale());
    document.title = translate(locale(), 'app.title');
    document.querySelector('#skip-link').textContent = translate(locale(), 'app.skip');
    const screen = model.screen === 'setup'
      ? renderSetup()
      : model.screen === 'readiness'
        ? renderReadiness()
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
    if (model.screen === 'setup') bindSetupEvents();
    if (model.screen === 'readiness') bindReadinessEvents();
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

  function renderSetup() {
    const dateParts = localDateParts(new Date());
    const effectiveSettings = effectiveSessionSettings(state.settings);
    const themed = state.settings.themeId === null
      ? selectableCommands
      : eligibleCommandsForTheme(selectableCommands, state.settings.themeId);
    const pool = commandsForPhase(themed, state.settings.phase);
    const eligibility = sessionStartEligibility(
      selectableCommands,
      manifest,
      effectiveSettings,
      player.supportsFallback(),
      dateParts
    );
    const startErrorKey = eligibility.reason === 'no-commands'
      ? 'setup.start.noCommands'
      : 'setup.start.examinerAudio';
    return `<section class="panel" aria-labelledby="setup-title">
      <h2 id="setup-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.setup')}</h2>
      ${recoveryError ? `<p class="notice" role="alert">${translate(locale(), 'error.recovery')}</p>` : ''}
      ${sessionRecoveryError ? `<p class="notice" role="alert">${translate(locale(), 'resume.recovery')}</p>` : ''}
      ${renderResumeCard()}
      ${renderSoloSetupView({
        locale: locale(),
        t: (key, variables) => translate(locale(), key, variables),
        selectedPresetId: state.settings.experienceMode,
        selectedExaminerChoiceId: state.settings.examinerChoice,
        selectedThemeId: state.settings.themeId,
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
          ${selectControl('length', 'setting.length', [
            ['short', 'length.short'], ['medium', 'length.medium'], ['all', 'length.all']
          ])}
          ${selectControl('mode', 'setting.mode', [['recommended', 'mode.recommended'], ['free', 'mode.free']])}
        </div>
      </details>
      <p class="pool-count">${translate(locale(), 'summary.count', { count: pool.length })}</p>
      <button type="button" data-action="open-readiness">${translate(locale(), 'screen.readiness')}</button>
      <button class="primary" type="button" data-action="start" ${eligibility.canStart ? '' : 'disabled'}>${translate(locale(), 'action.start')}</button>
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
      ${importError ? `<p class="notice error" role="alert">${importError}</p>` : ''}
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
      </section>`;
    }
    return `<section class="panel mock-transition" aria-labelledby="mock-transition-title">
      ${renderSessionIdentity()}
      <p class="progress">${progressText()}</p>
      <h2 id="mock-transition-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.mockTransition')}</h2>
      <p>${translate(locale(), 'mock.transition')}</p>
      <p class="notice">${translate(locale(), 'mock.simulated')}</p>
    </section>`;
  }

  function renderResults() {
    const attempts = state.attempts.filter(attempt => sessionAttemptIds.includes(attempt.id));
    const summary = summarizeSession(attempts, model.session);
    const isMock = model.experience?.revealPolicy === 'session-end';
    const mockStatus = isMock ? mockResultStatus(attempts, model.session.length) : null;
    return `<section class="panel results" aria-labelledby="results-title">
      <h2 id="results-title" role="status" aria-live="polite" aria-describedby="results-headline" data-screen-focus tabindex="-1">${translate(locale(), 'screen.results')}</h2>
      ${renderSessionIdentity()}
      <p id="results-headline" class="headline">${isMock
        ? translate(locale(), `mock.result.${mockStatus}`)
        : translate(locale(), 'summary.unaidedPercent', { percent: summary.unaidedPercentage })}</p>
      ${isMock ? `<p class="notice">${translate(locale(), 'mock.result.nonOfficial')}</p>` : ''}
      <div class="result-counts">
        ${countCard('unaided', summary.counts.unaided)}
        ${countCard('assisted', summary.counts.assisted)}
        ${countCard('incorrect', summary.counts.incorrect)}
      </div>
      <dl class="summary-details">
        <div><dt>${translate(locale(), 'summary.averageTime')}</dt><dd>${summary.averageResponseMs === null ? '—' : translate(locale(), 'summary.milliseconds', { milliseconds: Math.round(summary.averageResponseMs) })}</dd></div>
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
            : translate(locale(), 'summary.milliseconds', { milliseconds: Math.round(attempt.responseMs) })}</p>
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
    app.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('change', () => {
      const setting = control.dataset.setting;
      const value = setting === 'speed'
        ? Number(control.value)
        : ['timed', 'feedbackSounds', 'roadMovement'].includes(setting)
          ? control.value === 'true'
          : control.value;
      updateSettings({ [setting]: value });
    }));
    app.querySelector('[data-action="start"]')?.addEventListener('click', () => startSession());
    app.querySelector('[data-action="open-readiness"]')?.addEventListener('click', openReadiness);
    app.querySelector('[data-action="resume-session"]')?.addEventListener('click', resumeSession);
    app.querySelector('[data-action="discard-session"]')?.addEventListener('click', discardSession);
    app.querySelector('[data-offline-action="download"]')?.addEventListener('click', () => void offlineClient.download());
    app.querySelector('[data-offline-action="cancel"]')?.addEventListener('click', () => void offlineClient.cancelDownload());
    app.querySelector('[data-offline-action="apply-update"]')?.addEventListener('click', () => void offlineClient.applyUpdate());
    app.querySelector('[data-action="export"]').addEventListener('click', downloadBackup);
    app.querySelector('[data-action="import"]').addEventListener('click', () => app.querySelector('[data-import-file]').click());
    app.querySelector('[data-action="reset"]').addEventListener('click', resetProgress);
    app.querySelector('[data-import-file]').addEventListener('change', event => {
      const [file] = event.target.files;
      if (file) void importBackup(file);
      event.target.value = '';
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
      model = reduceScreen(model, { type: 'CONTINUE' });
      render();
      if (model.screen === 'loading-audio') void playCurrentCommand();
    });
  }

  function bindMockTransitionEvents() {
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
        saveState(window.localStorage, state);
        render();
      });
    });
    app.querySelector('[data-action="open-readiness"]')?.addEventListener('click', openReadiness);
    app.querySelector('[data-action="setup"]').addEventListener('click', () => {
      model = reduceScreen(model, { type: 'GO_TO_SETUP' });
      sessionAttemptIds = [];
      state = discardActiveSession(state);
      resumableSession = null;
      saveState(window.localStorage, state);
      render();
    });
  }

  function openReadiness() {
    readinessFilters = { ...readinessFilters, phase: state.settings.phase, editor: null, noticeKey: '' };
    model = { ...model, screen: 'readiness', settings: state.settings };
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
      saveState(window.localStorage, state);
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
      saveState(window.localStorage, state);
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
    saveState(window.localStorage, state);
    model = { ...reduceScreen(model, { type: 'SET_LOCALE', locale: state.settings.locale }), settings: state.settings };
    importError = '';
    recoveryError = '';
    render();
  }

  function startSession(target = null, selectionPhase = state.settings.phase) {
    sessionAttemptIds = [];
    const practiceTarget = target ?? { kind: state.settings.mode === 'free' ? 'free' : 'recommended' };
    const sessionSettings = effectiveSessionSettings(state.settings);
    const sessionDateParts = localDateParts(new Date());
    const experience = resolveSessionExperience(sessionSettings, sessionDateParts);
    const selectedCommands = createSession(selectableCommands, {
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
    let session = selectedCommands.map(command => ({
      ...command,
      audioVariant: selectPlaybackVariant(
        manifest,
        command,
        sessionSettings.speed,
        player.supportsFallback(),
        state.attempts,
        Math.random,
        {
          examinerChoice: experience.resolvedExaminerId ?? 'mixed',
          dateParts: sessionDateParts
        }
      )
    }));
    let continuity;
    if (continuityEnabledForExperience(experience)) {
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
    saveState(window.localStorage, state);
    model = reduceScreen(
      { ...model, settings: sessionSettings },
      {
        type: 'START_SESSION',
        session,
        experience,
        atTransition: currentContinuityStep(activeSession)?.kind === 'transition'
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
        atTransition: currentContinuityStep(state.activeSession)?.kind === 'transition'
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
    saveState(window.localStorage, state);
    model = reduceScreen(model, {
      type: 'CONTINUITY_SYNC',
      index: advanced.nextIndex,
      atTransition: nextStep?.kind === 'transition'
    });
    render();
    if (model.screen === 'loading-audio') void playCurrentCommand();
  }

  function discardSession() {
    state = discardActiveSession(state);
    resumableSession = null;
    sessionRecoveryError = false;
    saveState(window.localStorage, state);
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
        variant = selectPlaybackVariant(manifest, command, model.settings.speed, player.supportsFallback(), state.attempts);
      }
      const phrasing = resolvePhrasing(command, variant);
      const result = await player.play(
        variant,
        { text: phrasing.es, speed: variant.speed },
        {
          onStarted: () => {
            if (operation !== audioOperation || !movingRoadEnabled(command)) return;
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
      let activeSession = before.experience?.revealPolicy === 'session-end'
        ? advanceActiveSession(state.activeSession, progress)
        : persistedActiveSessionAfterAttempt(state.activeSession, progress);
      const nextStep = continuityEnabled ? currentContinuityStep(activeSession) : null;
      const continuityIndex = activeSession?.nextIndex ?? progress.nextIndex;
      if (continuityEnabled && !nextStep) activeSession = null;
      state = { ...result.state, activeSession };
      currentAttemptId = result.attempt.id;
      sessionAttemptIds.push(result.attempt.id);
      saveState(window.localStorage, state);
      if (continuityEnabled) {
        model = reduceScreen(model, {
          type: 'CONTINUITY_SYNC',
          index: continuityIndex,
          atTransition: nextStep?.kind === 'transition'
        });
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
    saveState(window.localStorage, state);
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
      saveState(window.localStorage, state);
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
  const { phase, speed, hintPolicy, timed, feedbackSounds, roadMovement, length } = settings;
  return {
    phase,
    speed,
    hintPolicy,
    timed,
    feedbackSounds,
    roadMovement,
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
