import { examinerForVoiceId, EXAMINERS } from './examiners.js';
import { THEME_IDS } from './session-themes.js';

/**
 * The five roadmap-named accomplishments, each earned by one clean run of the
 * matching Solo E4 challenge. Deliberately not all 8 challenges: personal-best,
 * brisk-examiner, and confusion-pairs have no accomplishment in the roadmap's
 * named set, and inventing new ones would be scope creep.
 */
export const ACCOMPLISHMENTS = Object.freeze([
  { id: 'audio-only', titleKey: 'accomplishment.audioOnly.title', descriptionKey: 'accomplishment.audioOnly.description' },
  { id: 'one-listen', titleKey: 'accomplishment.noReplay.title', descriptionKey: 'accomplishment.noReplay.description' },
  { id: 'five-examiners', titleKey: 'accomplishment.fiveExaminer.title', descriptionKey: 'accomplishment.fiveExaminer.description' },
  { id: 'control-check', titleKey: 'accomplishment.precheckReady.title', descriptionKey: 'accomplishment.precheckReady.description' },
  { id: 'perfect-roundabouts', titleKey: 'accomplishment.roundaboutReady.title', descriptionKey: 'accomplishment.roundaboutReady.description' }
]);
export const ACCOMPLISHMENT_CHALLENGE_IDS = Object.freeze(ACCOMPLISHMENTS.map(({ id }) => id));

const COMPLETION_KINDS = new Set(['challenge', 'theme']);

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

export function validateCompletions(value) {
  if (!Array.isArray(value)) throw new Error('Invalid completions');
  const seen = new Set();
  return Object.freeze(value.map((entry, index) => {
    const path = `completions[${index}]`;
    record(entry, path);
    if (!COMPLETION_KINDS.has(entry.kind)) throw new Error(`Invalid ${path}.kind`);
    if (entry.kind === 'challenge' && !ACCOMPLISHMENT_CHALLENGE_IDS.includes(entry.id)) {
      throw new Error(`Invalid ${path}.id`);
    }
    if (entry.kind === 'theme' && !THEME_IDS.includes(entry.id)) throw new Error(`Invalid ${path}.id`);
    if (!Number.isFinite(entry.achievedAt)) throw new Error(`Invalid ${path}.achievedAt`);
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key)) throw new Error(`Invalid duplicate ${path}: ${key}`);
    seen.add(key);
    return Object.freeze({ kind: entry.kind, id: entry.id, achievedAt: entry.achievedAt });
  }));
}

/**
 * Append-only: a (kind, id) pair is recorded once and never rewritten, so an
 * accomplishment's `achievedAt` is permanent evidence of the first time it was
 * earned, not a running "current state" that could regress or decay. Returns
 * the same array reference when the pair is already present, so callers can
 * tell by reference whether a write is actually needed.
 */
export function recordCompletion(completions, kind, id, achievedAt) {
  if (!COMPLETION_KINDS.has(kind)) throw new Error('Invalid completion kind');
  if (completions.some(entry => entry.kind === kind && entry.id === id)) return completions;
  return Object.freeze([...completions, Object.freeze({ kind, id, achievedAt })]);
}

function completionFor(completions, kind, id) {
  return completions.find(entry => entry.kind === kind && entry.id === id) ?? null;
}

/**
 * Reconstructible from `completions` alone — no separate "earned" flag exists
 * anywhere else. Replaying the same completions array always yields the same
 * result.
 */
export function accomplishmentStatus(completions) {
  return Object.freeze(ACCOMPLISHMENTS.map(accomplishment => {
    const completion = completionFor(completions, 'challenge', accomplishment.id);
    return Object.freeze({
      id: accomplishment.id,
      titleKey: accomplishment.titleKey,
      descriptionKey: accomplishment.descriptionKey,
      earned: completion !== null,
      achievedAt: completion?.achievedAt ?? null
    });
  }));
}

export function themeCompletionStatus(completions, themeIds) {
  return Object.freeze(themeIds.map(themeId => {
    const completion = completionFor(completions, 'theme', themeId);
    return Object.freeze({
      themeId,
      completed: completion !== null,
      achievedAt: completion?.achievedAt ?? null
    });
  }));
}

/**
 * Pure derivation over existing attempt history — no completions-log entry
 * needed, since every attempt already stores which voice was heard.
 */
export function examinerEncounters(attempts, registry = EXAMINERS) {
  const heard = new Set();
  for (const attempt of attempts) {
    try {
      heard.add(examinerForVoiceId(attempt.voiceId, registry).id);
    } catch {
      // browser-speech or unrecognized voiceId: not an examiner encounter
    }
  }
  return Object.freeze(registry.map(examiner => Object.freeze({
    id: examiner.id,
    nameKey: examiner.nameKey,
    encountered: heard.has(examiner.id)
  })));
}
