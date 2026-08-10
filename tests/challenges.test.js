import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHALLENGES,
  CHALLENGE_IDS,
  applyChallenge,
  challengeById,
  evaluateCleanSession,
  validateChallenges
} from '../src/challenges.js';
import { defaultState } from '../src/storage.js';

test('exports Audio only and One listen challenges in stable order', () => {
  assert.deepEqual(CHALLENGE_IDS, ['audio-only', 'one-listen']);
  assert.deepEqual(CHALLENGES.map(({ id }) => id), CHALLENGE_IDS);
});

test('each challenge carries a title/description key and a known base preset', () => {
  for (const challenge of CHALLENGES) {
    assert.equal(challenge.titleKey, `challenge.${challenge.id === 'audio-only' ? 'audioOnly' : 'oneListen'}.title`);
    assert.equal(challenge.descriptionKey, `challenge.${challenge.id === 'audio-only' ? 'audioOnly' : 'oneListen'}.description`);
    assert.equal(challenge.basePresetId, 'practice');
  }
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
    { ...CHALLENGES[0], overrides: { settings: { speed: 1 } } }
  ]), /unsupported challenge settings override/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[0], overrides: { settings: { hintPolicy: 'loud' } } }
  ]), /invalid challenge hint policy/i);
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
