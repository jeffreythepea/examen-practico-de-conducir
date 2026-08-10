import { challengeById, CHALLENGE_IDS } from './challenges.js';
import { EXAMINERS, EXAMINER_CHOICE_IDS, examinerById } from './examiners.js';
import { SESSION_PRESET_IDS, sessionPresetById } from './session-presets.js';
import { SESSION_THEMES, THEME_IDS } from './session-themes.js';

const PHASES = new Set(['driving', 'precheck', 'mixed']);
const SPEEDS = new Set([0.75, 0.9, 1]);
const HINT_POLICIES = new Set(['available', 'shown', 'unavailable']);
const LENGTHS = new Set(['short', 'medium', 'all']);
const MODES = new Set(['free', 'recommended']);
const EXPERIENCE_MODES = new Set(SESSION_PRESET_IDS);
const EXAMINER_CHOICES = new Set(EXAMINER_CHOICE_IDS);
const EXAMINER_IDS = new Set(EXAMINERS.map(({ id }) => id));
const THEMES = new Set([null, ...THEME_IDS]);
const CHALLENGES_OR_NULL = new Set([null, ...CHALLENGE_IDS]);
const TARGET_KINDS = new Set([
  'recommended', 'needs-practice', 'not-tested', 'lesson-flags', 'not-ready', 'command', 'free'
]);

const COMPATIBILITY_EXPERIENCE = Object.freeze({
  modeId: 'practice',
  examinerChoice: 'mixed',
  resolvedExaminerId: null,
  themeId: null,
  challengeId: null,
  replayPolicy: 'unlimited',
  revealPolicy: 'immediate',
  simulated: false
});

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    throw new Error('Active session must be cloneable');
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${path}`);
  return value;
}

function nonempty(value, path) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${path}`);
}

function validateSettings(settings) {
  record(settings, 'activeSession.settings');
  if (settings.roadMovement === undefined) settings.roadMovement = true;
  if (!PHASES.has(settings.phase)) throw new Error('Invalid activeSession.settings.phase');
  if (!SPEEDS.has(settings.speed)) throw new Error('Invalid activeSession.settings.speed');
  if (!HINT_POLICIES.has(settings.hintPolicy)) throw new Error('Invalid activeSession.settings.hintPolicy');
  if (typeof settings.timed !== 'boolean') throw new Error('Invalid activeSession.settings.timed');
  if (typeof settings.feedbackSounds !== 'boolean') throw new Error('Invalid activeSession.settings.feedbackSounds');
  if (typeof settings.roadMovement !== 'boolean') throw new Error('Invalid activeSession.settings.roadMovement');
  if (!LENGTHS.has(settings.length)) throw new Error('Invalid activeSession.settings.length');
  if (!MODES.has(settings.mode)) throw new Error('Invalid activeSession.settings.mode');
}

function validateTarget(target) {
  record(target, 'activeSession.target');
  if (!TARGET_KINDS.has(target.kind)) throw new Error('Invalid activeSession.target.kind');
  const allowedKeys = target.kind === 'command' ? ['commandId', 'kind'] : ['kind'];
  if (Object.keys(target).some(key => !allowedKeys.includes(key))) {
    throw new Error('Invalid activeSession.target');
  }
  if (target.kind === 'command') nonempty(target.commandId, 'activeSession.target.commandId');
}

function validateContinuity(continuity, items, nextIndex) {
  record(continuity, 'activeSession.continuity');
  const allowedKeys = ['nextRouteStepIndex', 'route'];
  if (Object.keys(continuity).some(key => !allowedKeys.includes(key))) {
    throw new Error('Invalid activeSession.continuity');
  }
  if (!Array.isArray(continuity.route) || continuity.route.length === 0) {
    throw new Error('Invalid activeSession.continuity.route');
  }
  if (!Number.isSafeInteger(continuity.nextRouteStepIndex)
      || continuity.nextRouteStepIndex < 0
      || continuity.nextRouteStepIndex > continuity.route.length) {
    throw new Error('Invalid activeSession.continuity.nextRouteStepIndex');
  }

  const commandIndexes = new Set();
  const transitionIds = new Set();
  continuity.route.forEach((step, routeIndex) => {
    const path = `activeSession.continuity.route[${routeIndex}]`;
    record(step, path);
    nonempty(step.kind, `${path}.kind`);
    nonempty(step.chapter, `${path}.chapter`);
    if (step.kind === 'command') {
      const allowed = ['chapter', 'commandId', 'itemIndex', 'kind'];
      if (Object.keys(step).some(key => !allowed.includes(key))) throw new Error(`Invalid ${path}`);
      if (!Number.isSafeInteger(step.itemIndex) || step.itemIndex < 0 || step.itemIndex >= items.length) {
        throw new Error(`Invalid ${path}.itemIndex`);
      }
      nonempty(step.commandId, `${path}.commandId`);
      if (items[step.itemIndex].commandId !== step.commandId) throw new Error(`Invalid ${path}.commandId`);
      if (commandIndexes.has(step.itemIndex)) throw new Error(`Invalid duplicate ${path}.itemIndex`);
      commandIndexes.add(step.itemIndex);
      return;
    }
    if (step.kind === 'transition') {
      const allowed = ['chapter', 'id', 'kind', 'sceneId'];
      if (Object.keys(step).some(key => !allowed.includes(key))) throw new Error(`Invalid ${path}`);
      nonempty(step.id, `${path}.id`);
      nonempty(step.sceneId, `${path}.sceneId`);
      if (transitionIds.has(step.id)) throw new Error(`Invalid duplicate ${path}.id`);
      transitionIds.add(step.id);
      return;
    }
    throw new Error(`Invalid ${path}.kind`);
  });
  if (commandIndexes.size !== items.length) throw new Error('Invalid activeSession.continuity command coverage');
  const completedCommands = continuity.route
    .slice(0, continuity.nextRouteStepIndex)
    .filter(step => step.kind === 'command').length;
  if (completedCommands !== nextIndex) throw new Error('Invalid activeSession.continuity progress');
  const currentStep = continuity.route[continuity.nextRouteStepIndex];
  if (currentStep?.kind === 'command' && currentStep.itemIndex !== nextIndex) {
    throw new Error('Invalid activeSession.continuity command order');
  }
}

function validateExperience(experience, settings) {
  record(experience, 'activeSession.experience');
  if (experience.challengeId === undefined) experience.challengeId = null;
  if (!EXPERIENCE_MODES.has(experience.modeId)) throw new Error('Invalid activeSession.experience.modeId');
  if (!EXAMINER_CHOICES.has(experience.examinerChoice)) throw new Error('Invalid activeSession.experience.examinerChoice');
  if (!THEMES.has(experience.themeId)) throw new Error('Invalid activeSession.experience.themeId');
  if (!CHALLENGES_OR_NULL.has(experience.challengeId)) throw new Error('Invalid activeSession.experience.challengeId');

  const preset = sessionPresetById(experience.modeId);
  const challenge = experience.challengeId === null ? null : challengeById(experience.challengeId);
  if (challenge && challenge.basePresetId !== experience.modeId) {
    throw new Error('Invalid activeSession.experience.challengeId for modeId');
  }
  const expectedReplayPolicy = challenge?.overrides.replayPolicy ?? preset.replayPolicy;
  const expectedRevealPolicy = challenge?.overrides.revealPolicy ?? preset.revealPolicy;
  if (experience.replayPolicy !== expectedReplayPolicy) throw new Error('Invalid activeSession.experience.replayPolicy');
  if (experience.revealPolicy !== expectedRevealPolicy) throw new Error('Invalid activeSession.experience.revealPolicy');
  if (experience.simulated !== preset.simulated) throw new Error('Invalid activeSession.experience.simulated');
  if (experience.modeId !== 'practice') {
    for (const field of ['speed', 'hintPolicy', 'timed']) {
      if (settings[field] !== preset.settings[field]) throw new Error(`Invalid activeSession.settings.${field} for experience`);
    }
  } else if (challenge) {
    for (const field of Object.keys(challenge.overrides.settings ?? {})) {
      if (field === 'themeId') {
        if (experience.themeId !== challenge.overrides.settings.themeId) {
          throw new Error('Invalid activeSession.experience.themeId for challenge');
        }
        continue;
      }
      if (settings[field] !== challenge.overrides.settings[field]) throw new Error(`Invalid activeSession.settings.${field} for experience`);
    }
  }

  if (experience.examinerChoice === 'mixed') {
    if (experience.resolvedExaminerId !== null) throw new Error('Invalid activeSession.experience.resolvedExaminerId');
    return;
  }
  if (!EXAMINER_IDS.has(experience.resolvedExaminerId)) {
    throw new Error('Invalid activeSession.experience.resolvedExaminerId');
  }
  if (experience.examinerChoice !== 'today' && experience.resolvedExaminerId !== experience.examinerChoice) {
    throw new Error('Invalid activeSession.experience.resolvedExaminerId');
  }
}

function normalizeVersionOne(session) {
  if (session.version !== 1) return session;
  return {
    ...session,
    version: 2,
    experience: clone(COMPATIBILITY_EXPERIENCE)
  };
}

function normalizeVersionTwo(session) {
  if (session.version !== 2) return session;
  return { ...session, version: 3 };
}

export function validateStoredActiveSession(value) {
  const candidate = clone(value);
  record(candidate, 'activeSession');
  const session = normalizeVersionTwo(normalizeVersionOne(candidate));
  if (session.version !== 3) throw new Error('Invalid activeSession.version');
  nonempty(session.id, 'activeSession.id');
  if (typeof session.startedAt !== 'number' || !Number.isFinite(session.startedAt)) {
    throw new Error('Invalid activeSession.startedAt');
  }
  validateSettings(session.settings);
  validateExperience(session.experience, session.settings);
  if (!Array.isArray(session.items) || session.items.length === 0) throw new Error('Invalid activeSession.items');
  const commandIds = new Set();
  session.items.forEach((item, index) => {
    const path = `activeSession.items[${index}]`;
    record(item, path);
    for (const field of ['commandId', 'phrasingId', 'voiceId']) nonempty(item[field], `${path}.${field}`);
    if (!SPEEDS.has(item.speed)) throw new Error(`Invalid ${path}.speed`);
    if (commandIds.has(item.commandId)) throw new Error(`Invalid duplicate command: ${item.commandId}`);
    if (session.experience.resolvedExaminerId !== null) {
      const expectedVoiceId = examinerById(session.experience.resolvedExaminerId).voiceId;
      if (item.voiceId !== expectedVoiceId) throw new Error(`Invalid ${path}.voiceId for examiner`);
    }
    commandIds.add(item.commandId);
  });
  if (!Number.isSafeInteger(session.nextIndex) || session.nextIndex < 0 || session.nextIndex > session.items.length) {
    throw new Error('Invalid activeSession.nextIndex');
  }
  if (!Array.isArray(session.attemptIds)) throw new Error('Invalid activeSession.attemptIds');
  const attemptIds = new Set();
  session.attemptIds.forEach((attemptId, index) => {
    nonempty(attemptId, `activeSession.attemptIds[${index}]`);
    if (attemptIds.has(attemptId)) throw new Error(`Invalid activeSession.attemptIds[${index}]`);
    attemptIds.add(attemptId);
  });
  if (session.attemptIds.length !== session.nextIndex) throw new Error('Invalid activeSession.attemptIds length');
  if (session.target === undefined) delete session.target;
  else validateTarget(session.target);
  if (session.continuity === undefined) delete session.continuity;
  else validateContinuity(session.continuity, session.items, session.nextIndex);
  return deepFreeze(session);
}

export function createActiveSession({
  id,
  startedAt,
  items,
  nextIndex = 0,
  attemptIds = [],
  settings,
  target,
  continuity,
  experience = COMPATIBILITY_EXPERIENCE
}) {
  const session = { version: 3, id, startedAt, items, nextIndex, attemptIds, settings, experience };
  if (target !== undefined) session.target = target;
  if (continuity !== undefined) session.continuity = continuity;
  return validateStoredActiveSession(session);
}

export function advanceActiveSession(session, { nextIndex, attemptId }) {
  const current = validateStoredActiveSession(session);
  nonempty(attemptId, 'attemptId');
  if (current.attemptIds.includes(attemptId)) throw new Error('Invalid duplicate attemptId');
  if (nextIndex !== current.nextIndex + 1) throw new Error('Invalid nextIndex');
  const continuity = current.continuity === undefined
    ? undefined
    : {
        ...current.continuity,
        nextRouteStepIndex: current.continuity.nextRouteStepIndex + 1
      };
  return validateStoredActiveSession({
    ...current,
    nextIndex,
    attemptIds: [...current.attemptIds, attemptId],
    ...(continuity === undefined ? {} : { continuity })
  });
}

export function advanceActiveSessionTransition(session) {
  const current = validateStoredActiveSession(session);
  if (!current.continuity) throw new Error('Active session continuity is disabled');
  const step = current.continuity.route[current.continuity.nextRouteStepIndex];
  if (step?.kind !== 'transition') throw new Error('Active session is not at a transition');
  return validateStoredActiveSession({
    ...current,
    continuity: {
      ...current.continuity,
      nextRouteStepIndex: current.continuity.nextRouteStepIndex + 1
    }
  });
}

export function resolveActiveSession(session, { commands, audioManifest }) {
  const stored = validateStoredActiveSession(session);
  if (!Array.isArray(commands) || !Array.isArray(audioManifest)) throw new Error('Invalid active-session resolver data');
  const commandById = new Map(commands.map(command => [command.id, command]));
  const sessionItems = stored.items.map(item => {
    const command = commandById.get(item.commandId);
    if (!command) throw new Error(`Unsupported command: ${item.commandId}`);
    if (stored.experience.themeId !== null) {
      const theme = SESSION_THEMES.find(candidate => candidate.id === stored.experience.themeId);
      if (!theme.criteria(command)) throw new Error(`Command outside theme: ${item.commandId}`);
    }
    if (!command.phrasings?.some(phrasing => phrasing.id === item.phrasingId)) {
      throw new Error(`Unsupported phrasing: ${item.phrasingId}`);
    }
    const variant = audioManifest.find(candidate =>
      candidate.commandId === item.commandId
      && candidate.phrasingId === item.phrasingId
      && candidate.voiceId === item.voiceId
      && candidate.speed === item.speed
    );
    if (!variant) throw new Error(`Unsupported audio variant: ${item.commandId}`);
    return { ...clone(command), audioVariant: clone(variant) };
  });
  const resolved = {
    sessionItems,
    index: stored.nextIndex,
    attemptIds: [...stored.attemptIds],
    settings: clone(stored.settings),
    experience: clone(stored.experience)
  };
  if (stored.target !== undefined) resolved.target = clone(stored.target);
  if (stored.continuity !== undefined) resolved.continuity = clone(stored.continuity);
  return deepFreeze(resolved);
}

export function discardActiveSession(state) {
  return { ...state, activeSession: null };
}
