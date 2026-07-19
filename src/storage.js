export const STORAGE_KEY = 'examen-practico-de-conducir';
export const SCHEMA_VERSION = 1;

const LOCALES = new Set(['en', 'es']);
const PHASES = new Set(['driving', 'precheck', 'mixed']);
const SPEEDS = new Set([0.75, 0.9, 1]);
const HINT_POLICIES = new Set(['available', 'shown', 'unavailable']);
const LENGTHS = new Set(['short', 'medium', 'all']);
const OUTCOMES = new Set(['unaided', 'assisted', 'incorrect']);
const OUTCOME_WEIGHTS = Object.freeze({ unaided: 1, assisted: 0.5, incorrect: 0 });

export function defaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      locale: 'en',
      phase: 'mixed',
      speed: 0.9,
      hintPolicy: 'available',
      timed: false,
      feedbackSounds: true,
      length: 'medium'
    },
    attempts: [],
    actionProgress: {}
  };
}

/**
 * @param {Storage} storage
 */
export function loadState(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  if (saved === null) return defaultState();

  try {
    return validateState(JSON.parse(saved));
  } catch (error) {
    return {
      ...defaultState(),
      recoveryError: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * @param {Storage} storage
 * @param {object} state
 */
export function saveState(storage, state) {
  const candidate = validateState(state);
  const serialized = JSON.stringify(candidate);
  storage.setItem(STORAGE_KEY, serialized);
}

/**
 * @param {object} state
 */
export function exportState(state) {
  return JSON.stringify(validateState(state), null, 2);
}

/**
 * @param {string} text
 */
export function importState(text) {
  if (typeof text !== 'string') throw new Error('Import must be JSON text');
  return discardImportedActiveSurface(validateState(JSON.parse(text)));
}

function discardImportedActiveSurface(state) {
  delete state.activeSurfaceModel;
  if (isRecord(state.activeSession)) delete state.activeSession.activeSurfaceModel;
  return state;
}

function validateState(value) {
  const state = clone(value);
  if (!isRecord(state)) throw new Error('Invalid state');
  if (state.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schema: ${String(state.schemaVersion)}`);
  }
  if (!isRecord(state.settings)) throw new Error('Invalid settings');
  validateSettings(state.settings);
  validateAttempts(state.attempts);
  if (!isRecord(state.actionProgress)) throw new Error('Invalid actionProgress');
  validateActionProgress(state.actionProgress);
  return state;
}

function validateSettings(settings) {
  if (settings.feedbackSounds === undefined) settings.feedbackSounds = true;
  if (!LOCALES.has(settings.locale)) throw new Error('Invalid settings.locale');
  if (!PHASES.has(settings.phase)) throw new Error('Invalid settings.phase');
  if (!SPEEDS.has(settings.speed)) throw new Error('Invalid settings.speed');
  if (!HINT_POLICIES.has(settings.hintPolicy)) throw new Error('Invalid settings.hintPolicy');
  if (typeof settings.timed !== 'boolean') throw new Error('Invalid settings.timed');
  if (typeof settings.feedbackSounds !== 'boolean') throw new Error('Invalid settings.feedbackSounds');
  if (!LENGTHS.has(settings.length)) throw new Error('Invalid settings.length');
}

function validateAttempts(attempts) {
  if (!Array.isArray(attempts)) throw new Error('Invalid attempts');
  attempts.forEach((attempt, index) => validateAttempt(attempt, `attempts[${index}]`));
}

function validateAttempt(attempt, path) {
  if (!isRecord(attempt)) throw new Error(`Invalid ${path}`);
  for (const field of ['id', 'commandId', 'actionId', 'phrasingId', 'voiceId', 'surfaceId']) {
    requireNonEmptyString(attempt[field], `${path}.${field}`);
  }
  if (!isFiniteNumber(attempt.timestamp)) throw new Error(`Invalid ${path}.timestamp`);
  if (!SPEEDS.has(attempt.speed)) throw new Error(`Invalid ${path}.speed`);
  if (!PHASES.has(attempt.phase)) throw new Error(`Invalid ${path}.phase`);
  if (attempt.selectedResult !== null) requireNonEmptyString(attempt.selectedResult, `${path}.selectedResult`);
  if (!OUTCOMES.has(attempt.outcome)) throw new Error(`Invalid ${path}.outcome`);
  if (attempt.weight !== OUTCOME_WEIGHTS[attempt.outcome]) throw new Error(`Invalid ${path}.weight`);
  if (attempt.responseMs !== null && (!isFiniteNumber(attempt.responseMs) || attempt.responseMs < 0)) {
    throw new Error(`Invalid ${path}.responseMs`);
  }
  if (!Number.isSafeInteger(attempt.replays) || attempt.replays < 0) throw new Error(`Invalid ${path}.replays`);
  if (typeof attempt.textShown !== 'boolean') throw new Error(`Invalid ${path}.textShown`);
  if (typeof attempt.timed !== 'boolean') throw new Error(`Invalid ${path}.timed`);
  if (typeof attempt.timeout !== 'boolean') throw new Error(`Invalid ${path}.timeout`);
  if (attempt.audioProvider !== undefined) {
    requireNonEmptyString(attempt.audioProvider, `${path}.audioProvider`);
  }
  if (attempt.missReason !== undefined) requireNonEmptyString(attempt.missReason, `${path}.missReason`);
  if (attempt.surfaceVersion !== undefined && (!Number.isSafeInteger(attempt.surfaceVersion) || attempt.surfaceVersion < 1)) {
    throw new Error(`Invalid ${path}.surfaceVersion`);
  }
  if (attempt.surfaceSeed !== undefined && (!Number.isInteger(attempt.surfaceSeed) || attempt.surfaceSeed < 0 || attempt.surfaceSeed > 0xffffffff)) {
    throw new Error(`Invalid ${path}.surfaceSeed`);
  }
  if (attempt.expectedResult !== undefined) requireNonEmptyString(attempt.expectedResult, `${path}.expectedResult`);
  if (attempt.selectedTargetId !== undefined && attempt.selectedTargetId !== null) {
    requireNonEmptyString(attempt.selectedTargetId, `${path}.selectedTargetId`);
  }
  if (attempt.outcome === 'unaided' && attempt.textShown) throw new Error(`Invalid ${path}.textShown`);
  if (attempt.outcome === 'assisted' && !attempt.textShown) throw new Error(`Invalid ${path}.textShown`);
  if (attempt.timeout && attempt.outcome !== 'incorrect') throw new Error(`Invalid ${path}.outcome`);
}

function validateActionProgress(actionProgress) {
  for (const [actionId, schedule] of Object.entries(actionProgress)) {
    const path = `actionProgress.${actionId}`;
    if (!actionId) throw new Error('Invalid actionProgress key');
    if (!isRecord(schedule)) throw new Error(`Invalid ${path}`);
    if (!Number.isSafeInteger(schedule.consecutiveUnaided) || schedule.consecutiveUnaided < 0) {
      throw new Error(`Invalid ${path}.consecutiveUnaided`);
    }
    if (!isFiniteNumber(schedule.nextDueAt)) throw new Error(`Invalid ${path}.nextDueAt`);
  }
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${path}`);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    throw new Error('State must be cloneable');
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
