import { EXAMINER_CHOICE_IDS } from './examiners.js';
import { SESSION_PRESET_IDS, applySessionPreset } from './session-presets.js';
import { THEME_IDS } from './session-themes.js';

const HINT_POLICIES = new Set(['available', 'shown', 'unavailable']);
const REPLAY_POLICIES = new Set(['unlimited', 'none']);
const REVEAL_POLICIES = new Set(['immediate', 'session-end']);
const PASS_RULES = new Set(['clean', 'no-miss']);
const LENGTHS = new Set(['short', 'medium', 'all']);
const SPEEDS = new Set([0.75, 0.9, 1]);
const OVERRIDE_SETTING_FIELDS = new Set(['hintPolicy', 'themeId', 'length', 'examinerChoice', 'speed']);

const RAW_CHALLENGES = [
  {
    id: 'audio-only',
    titleKey: 'challenge.audioOnly.title',
    descriptionKey: 'challenge.audioOnly.description',
    basePresetId: 'practice',
    passRule: 'clean',
    overrides: {
      settings: { hintPolicy: 'unavailable' }
    }
  },
  {
    id: 'one-listen',
    titleKey: 'challenge.oneListen.title',
    descriptionKey: 'challenge.oneListen.description',
    basePresetId: 'practice',
    passRule: 'clean',
    overrides: {
      replayPolicy: 'none'
    }
  },
  {
    id: 'control-check',
    titleKey: 'challenge.controlCheck.title',
    descriptionKey: 'challenge.controlCheck.description',
    basePresetId: 'practice',
    passRule: 'no-miss',
    overrides: {
      settings: { themeId: 'precheck-inspection' }
    }
  },
  {
    id: 'personal-best',
    titleKey: 'challenge.personalBest.title',
    descriptionKey: 'challenge.personalBest.description',
    basePresetId: 'practice',
    passRule: 'clean'
  },
  {
    id: 'perfect-roundabouts',
    titleKey: 'challenge.perfectRoundabouts.title',
    descriptionKey: 'challenge.perfectRoundabouts.description',
    basePresetId: 'practice',
    passRule: 'clean',
    overrides: {
      settings: { themeId: 'roundabout-circuit', length: 'short' }
    }
  },
  {
    id: 'five-examiners',
    titleKey: 'challenge.fiveExaminers.title',
    descriptionKey: 'challenge.fiveExaminers.description',
    basePresetId: 'practice',
    passRule: 'clean',
    overrides: {
      settings: { length: 'short', examinerChoice: 'mixed' }
    }
  },
  {
    id: 'brisk-examiner',
    titleKey: 'challenge.briskExaminer.title',
    descriptionKey: 'challenge.briskExaminer.description',
    basePresetId: 'practice',
    passRule: 'clean',
    overrides: {
      settings: { speed: 1 }
    }
  },
  {
    id: 'confusion-pairs',
    titleKey: 'challenge.confusionPairs.title',
    descriptionKey: 'challenge.confusionPairs.description',
    basePresetId: 'practice',
    passRule: 'clean'
  }
];

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function nonempty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
}

function validateOverrides(overrides) {
  if (overrides === undefined) return;
  record(overrides, 'challenge overrides');
  if ('settings' in overrides) {
    record(overrides.settings, 'challenge settings override');
    for (const field of Object.keys(overrides.settings)) {
      if (!OVERRIDE_SETTING_FIELDS.has(field)) throw new Error(`Unsupported challenge settings override: ${field}`);
    }
    if ('hintPolicy' in overrides.settings && !HINT_POLICIES.has(overrides.settings.hintPolicy)) {
      throw new Error('Invalid challenge hint policy override');
    }
    if ('themeId' in overrides.settings && !THEME_IDS.includes(overrides.settings.themeId)) {
      throw new Error('Invalid challenge theme override');
    }
    if ('length' in overrides.settings && !LENGTHS.has(overrides.settings.length)) {
      throw new Error('Invalid challenge length override');
    }
    if ('examinerChoice' in overrides.settings && !EXAMINER_CHOICE_IDS.includes(overrides.settings.examinerChoice)) {
      throw new Error('Invalid challenge examiner choice override');
    }
    if ('speed' in overrides.settings && !SPEEDS.has(overrides.settings.speed)) {
      throw new Error('Invalid challenge speed override');
    }
  }
  if ('replayPolicy' in overrides && !REPLAY_POLICIES.has(overrides.replayPolicy)) {
    throw new Error('Invalid challenge replay policy override');
  }
  if ('revealPolicy' in overrides && !REVEAL_POLICIES.has(overrides.revealPolicy)) {
    throw new Error('Invalid challenge reveal policy override');
  }
}

function freezeChallenge(challenge) {
  return Object.freeze({
    id: challenge.id,
    titleKey: challenge.titleKey,
    descriptionKey: challenge.descriptionKey,
    basePresetId: challenge.basePresetId,
    passRule: challenge.passRule,
    overrides: Object.freeze({
      ...(challenge.overrides?.settings ? { settings: Object.freeze({ ...challenge.overrides.settings }) } : {}),
      ...(challenge.overrides?.replayPolicy ? { replayPolicy: challenge.overrides.replayPolicy } : {}),
      ...(challenge.overrides?.revealPolicy ? { revealPolicy: challenge.overrides.revealPolicy } : {})
    })
  });
}

export function validateChallenges(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid challenges');
  const ids = new Set();
  const challenges = value.map((challenge, index) => {
    record(challenge, `challenge ${index}`);
    for (const field of ['id', 'titleKey', 'descriptionKey', 'basePresetId']) nonempty(challenge[field], `challenge ${field}`);
    if (ids.has(challenge.id)) throw new Error(`Duplicate challenge id: ${challenge.id}`);
    ids.add(challenge.id);
    if (!SESSION_PRESET_IDS.includes(challenge.basePresetId)) {
      throw new Error(`Unknown challenge base preset: ${challenge.basePresetId}`);
    }
    if (!PASS_RULES.has(challenge.passRule)) throw new Error(`Invalid challenge pass rule: ${challenge.passRule}`);
    validateOverrides(challenge.overrides);
    return freezeChallenge(challenge);
  });
  return Object.freeze(challenges);
}

export const CHALLENGES = validateChallenges(RAW_CHALLENGES);
export const CHALLENGE_IDS = Object.freeze(CHALLENGES.map(({ id }) => id));

export function challengeById(id, challenges = CHALLENGES) {
  const registry = challenges === CHALLENGES ? challenges : validateChallenges(challenges);
  const challenge = registry.find(candidate => candidate.id === id);
  if (!challenge) throw new Error(`Unknown challenge: ${String(id)}`);
  return challenge;
}

export function applyChallenge(baseSettings, challengeId, challenges = CHALLENGES) {
  const challenge = challengeById(challengeId, challenges);
  const applied = applySessionPreset(baseSettings, challenge.basePresetId);
  return Object.freeze({
    presetId: applied.presetId,
    challengeId: challenge.id,
    settings: Object.freeze({ ...applied.settings, ...(challenge.overrides.settings ?? {}) }),
    replayPolicy: challenge.overrides.replayPolicy ?? applied.replayPolicy,
    revealPolicy: challenge.overrides.revealPolicy ?? applied.revealPolicy,
    simulated: applied.simulated
  });
}

/**
 * A challenge run is "clean" only if every expected command in the session
 * was attempted and answered unaided — the same bar Mock's result screen
 * uses. Abandoning a challenge early (fewer attempts than expected) simply
 * yields no verdict rather than a fail; callers should only invoke this once
 * a session actually reaches its end screen.
 */
export function evaluateCleanSession(attempts, expectedCount) {
  if (!Array.isArray(attempts) || !Number.isSafeInteger(expectedCount) || expectedCount < 1) {
    return 'needs-practice';
  }
  return attempts.length === expectedCount && attempts.every(attempt => attempt.outcome === 'unaided')
    ? 'clean'
    : 'needs-practice';
}

/**
 * A looser bar than evaluateCleanSession: every expected command must be
 * attempted, but hint-assisted correct answers still pass — only an actual
 * miss (outcome 'incorrect') fails the run. This is Control check's rule:
 * "complete a precheck inspection without a miss," not "without a hint."
 */
export function evaluateNoMissSession(attempts, expectedCount) {
  if (!Array.isArray(attempts) || !Number.isSafeInteger(expectedCount) || expectedCount < 1) {
    return 'needs-practice';
  }
  return attempts.length === expectedCount && attempts.every(attempt => attempt.outcome !== 'incorrect')
    ? 'clean'
    : 'needs-practice';
}

const PASS_RULE_EVALUATORS = Object.freeze({
  clean: evaluateCleanSession,
  'no-miss': evaluateNoMissSession
});

export function evaluateChallengeSession(challengeId, attempts, expectedCount, challenges = CHALLENGES) {
  const challenge = challengeById(challengeId, challenges);
  return PASS_RULE_EVALUATORS[challenge.passRule](attempts, expectedCount);
}

/**
 * Personal-best records are compared per drive/theme, since a First-drive
 * clean run and a Roundabout-circuit clean run aren't comparable speeds.
 * null (Adaptive) settles to a stable 'adaptive' key.
 */
export function personalBestKey(themeId) {
  return themeId ?? 'adaptive';
}

/**
 * Registers a new personal-best record only if it strictly beats any
 * existing record for the same key (a faster, i.e. lower, average). Returns
 * the same personalBests reference unchanged when it doesn't qualify, so
 * callers can tell by reference whether anything actually changed.
 */
export function recordPersonalBest(personalBests, key, averageResponseMs, achievedAt) {
  if (!Number.isFinite(averageResponseMs) || averageResponseMs <= 0) return personalBests;
  const existing = personalBests?.[key];
  if (existing && existing.averageResponseMs <= averageResponseMs) return personalBests;
  return Object.freeze({ ...personalBests, [key]: Object.freeze({ averageResponseMs, achievedAt }) });
}
