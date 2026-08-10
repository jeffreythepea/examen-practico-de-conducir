import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHALLENGES,
  CHALLENGE_IDS,
  applyChallenge,
  challengeById,
  evaluateChallengeSession,
  evaluateCleanSession,
  evaluateNoMissSession,
  validateChallenges
} from '../src/challenges.js';
import { defaultState } from '../src/storage.js';

const TITLE_KEYS = Object.freeze({
  'audio-only': 'audioOnly',
  'one-listen': 'oneListen',
  'control-check': 'controlCheck'
});

test('exports Audio only, One listen, and Control check challenges in stable order', () => {
  assert.deepEqual(CHALLENGE_IDS, ['audio-only', 'one-listen', 'control-check']);
  assert.deepEqual(CHALLENGES.map(({ id }) => id), CHALLENGE_IDS);
});

test('each challenge carries a title/description key, a known base preset, and a pass rule', () => {
  for (const challenge of CHALLENGES) {
    assert.equal(challenge.titleKey, `challenge.${TITLE_KEYS[challenge.id]}.title`);
    assert.equal(challenge.descriptionKey, `challenge.${TITLE_KEYS[challenge.id]}.description`);
    assert.equal(challenge.basePresetId, 'practice');
    assert.ok(['clean', 'no-miss'].includes(challenge.passRule));
  }
  assert.equal(challengeById('audio-only').passRule, 'clean');
  assert.equal(challengeById('one-listen').passRule, 'clean');
  assert.equal(challengeById('control-check').passRule, 'no-miss');
});

test('challenge registry and every nested record are deeply frozen', () => {
  assert.equal(Object.isFrozen(CHALLENGES), true);
  assert.equal(Object.isFrozen(CHALLENGE_IDS), true);
  for (const challenge of CHALLENGES) {
    assert.equal(Object.isFrozen(challenge), true);
    assert.equal(Object.isFrozen(challenge.overrides), true);
  }
});

test('audio-only forces hintPolicy unavailable on top of Practice, leaving replay untouched', () => {
  const base = defaultState().settings;
  const result = applyChallenge(base, 'audio-only');

  assert.equal(result.challengeId, 'audio-only');
  assert.equal(result.presetId, 'practice');
  assert.equal(result.settings.hintPolicy, 'unavailable');
  assert.equal(result.settings.speed, 0.9);
  assert.equal(result.replayPolicy, 'unlimited');
  assert.equal(result.revealPolicy, 'immediate');
  assert.equal(result.simulated, false);
});

test('one-listen forces replayPolicy none on top of Practice, leaving hints untouched', () => {
  const base = defaultState().settings;
  const result = applyChallenge(base, 'one-listen');

  assert.equal(result.challengeId, 'one-listen');
  assert.equal(result.presetId, 'practice');
  assert.equal(result.settings.hintPolicy, 'available');
  assert.equal(result.replayPolicy, 'none');
  assert.equal(result.revealPolicy, 'immediate');
});

test('control-check forces the precheck-inspection theme on top of Practice, leaving hints and replay untouched', () => {
  const base = defaultState().settings;
  const result = applyChallenge(base, 'control-check');

  assert.equal(result.challengeId, 'control-check');
  assert.equal(result.presetId, 'practice');
  assert.equal(result.settings.themeId, 'precheck-inspection');
  assert.equal(result.settings.hintPolicy, 'available');
  assert.equal(result.replayPolicy, 'unlimited');
  assert.equal(result.revealPolicy, 'immediate');
});

test('applying a challenge never mutates caller-owned settings', () => {
  const base = defaultState().settings;
  const before = structuredClone(base);
  const result = applyChallenge(base, 'audio-only');

  assert.deepEqual(base, before);
  assert.notEqual(result.settings, base);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.settings), true);
});

test('lookups and application reject unknown challenges', () => {
  assert.throws(() => challengeById('unknown'), /unknown challenge/i);
  assert.throws(() => applyChallenge(defaultState().settings, 'unknown'), /unknown challenge/i);
});

test('validation rejects duplicates, unknown base presets, and unsupported overrides', () => {
  assert.throws(() => validateChallenges([
    CHALLENGES[0],
    { ...CHALLENGES[1], id: CHALLENGES[0].id }
  ]), /duplicate challenge id/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[0], basePresetId: 'unknown' }
  ]), /unknown challenge base preset/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[0], passRule: 'flawless' }
  ]), /invalid challenge pass rule/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[0], overrides: { settings: { speed: 1 } } }
  ]), /unsupported challenge settings override/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[0], overrides: { settings: { hintPolicy: 'loud' } } }
  ]), /invalid challenge hint policy/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[2], overrides: { settings: { themeId: 'mystery' } } }
  ]), /invalid challenge theme override/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[1], overrides: { replayPolicy: 'sometimes' } }
  ]), /invalid challenge replay policy/i);
  assert.throws(() => validateChallenges([]), /invalid challenges/i);
});

test('evaluateCleanSession requires every expected attempt to be unaided', () => {
  assert.equal(evaluateCleanSession([
    { outcome: 'unaided' },
    { outcome: 'unaided' }
  ], 2), 'clean');
  assert.equal(evaluateCleanSession([{ outcome: 'unaided' }], 2), 'needs-practice');
  assert.equal(evaluateCleanSession([
    { outcome: 'unaided' },
    { outcome: 'assisted' }
  ], 2), 'needs-practice');
  assert.equal(evaluateCleanSession([
    { outcome: 'unaided' },
    { outcome: 'incorrect' }
  ], 2), 'needs-practice');
  assert.equal(evaluateCleanSession(null, 2), 'needs-practice');
  assert.equal(evaluateCleanSession([], 0), 'needs-practice');
});

test('evaluateNoMissSession allows hint-assisted answers but not an actual miss', () => {
  assert.equal(evaluateNoMissSession([
    { outcome: 'unaided' },
    { outcome: 'assisted' }
  ], 2), 'clean');
  assert.equal(evaluateNoMissSession([{ outcome: 'unaided' }], 2), 'needs-practice');
  assert.equal(evaluateNoMissSession([
    { outcome: 'unaided' },
    { outcome: 'incorrect' }
  ], 2), 'needs-practice');
  assert.equal(evaluateNoMissSession(null, 2), 'needs-practice');
});

test('evaluateChallengeSession dispatches to the challenge-specific pass rule', () => {
  assert.equal(evaluateChallengeSession('audio-only', [
    { outcome: 'unaided' },
    { outcome: 'assisted' }
  ], 2), 'needs-practice');
  assert.equal(evaluateChallengeSession('control-check', [
    { outcome: 'unaided' },
    { outcome: 'assisted' }
  ], 2), 'clean');
  assert.throws(() => evaluateChallengeSession('unknown', [], 0), /unknown challenge/i);
});
