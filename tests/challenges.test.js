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
  personalBestKey,
  recordPersonalBest,
  validateChallenges
} from '../src/challenges.js';
import { defaultState } from '../src/storage.js';

const TITLE_KEYS = Object.freeze({
  'audio-only': 'audioOnly',
  'one-listen': 'oneListen',
  'control-check': 'controlCheck',
  'personal-best': 'personalBest',
  'perfect-roundabouts': 'perfectRoundabouts',
  'five-examiners': 'fiveExaminers',
  'brisk-examiner': 'briskExaminer'
});

test('exports all seven challenges in stable order', () => {
  assert.deepEqual(CHALLENGE_IDS, [
    'audio-only', 'one-listen', 'control-check', 'personal-best',
    'perfect-roundabouts', 'five-examiners', 'brisk-examiner'
  ]);
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
  assert.equal(challengeById('personal-best').passRule, 'clean');
  assert.equal(challengeById('perfect-roundabouts').passRule, 'clean');
  assert.equal(challengeById('five-examiners').passRule, 'clean');
  assert.equal(challengeById('brisk-examiner').passRule, 'clean');
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

test('personal-best applies Practice unmodified: theme, hints, and replay stay whatever the learner already chose', () => {
  const base = { ...defaultState().settings, themeId: 'roundabout-circuit' };
  const result = applyChallenge(base, 'personal-best');

  assert.equal(result.challengeId, 'personal-best');
  assert.equal(result.presetId, 'practice');
  assert.equal(result.settings.themeId, 'roundabout-circuit');
  assert.equal(result.settings.hintPolicy, 'available');
  assert.equal(result.replayPolicy, 'unlimited');
  assert.equal(result.revealPolicy, 'immediate');
});

test('perfect-roundabouts forces the roundabout-circuit theme and a short (5-command) session', () => {
  const base = { ...defaultState().settings, themeId: 'city-circuit', length: 'medium' };
  const result = applyChallenge(base, 'perfect-roundabouts');

  assert.equal(result.challengeId, 'perfect-roundabouts');
  assert.equal(result.settings.themeId, 'roundabout-circuit');
  assert.equal(result.settings.length, 'short');
  assert.equal(result.settings.hintPolicy, 'available');
  assert.equal(result.replayPolicy, 'unlimited');
});

test('five-examiners forces a short session and Mixed examiners, leaving theme and hints untouched', () => {
  const base = { ...defaultState().settings, examinerChoice: 'roger', length: 'all', themeId: 'city-circuit' };
  const result = applyChallenge(base, 'five-examiners');

  assert.equal(result.challengeId, 'five-examiners');
  assert.equal(result.settings.length, 'short');
  assert.equal(result.settings.examinerChoice, 'mixed');
  assert.equal(result.settings.themeId, 'city-circuit');
  assert.equal(result.settings.hintPolicy, 'available');
});

test('brisk-examiner forces speed 1 on top of Practice, leaving theme, hints, and replay untouched', () => {
  const base = { ...defaultState().settings, speed: 0.75, themeId: 'city-circuit' };
  const result = applyChallenge(base, 'brisk-examiner');

  assert.equal(result.challengeId, 'brisk-examiner');
  assert.equal(result.settings.speed, 1);
  assert.equal(result.settings.themeId, 'city-circuit');
  assert.equal(result.settings.hintPolicy, 'available');
  assert.equal(result.replayPolicy, 'unlimited');
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
    { ...CHALLENGES[0], overrides: { settings: { mode: 'free' } } }
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
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[4], overrides: { settings: { themeId: 'roundabout-circuit', length: 'medium-ish' } } }
  ]), /invalid challenge length override/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[5], overrides: { settings: { length: 'short', examinerChoice: 'nobody' } } }
  ]), /invalid challenge examiner choice override/i);
  assert.throws(() => validateChallenges([
    { ...CHALLENGES[6], overrides: { settings: { speed: 2 } } }
  ]), /invalid challenge speed override/i);
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

test('personalBestKey settles the null (Adaptive) theme to a stable key', () => {
  assert.equal(personalBestKey(null), 'adaptive');
  assert.equal(personalBestKey('roundabout-circuit'), 'roundabout-circuit');
});

test('recordPersonalBest only replaces an existing record with a strictly faster average', () => {
  const empty = Object.freeze({});
  const firstRun = recordPersonalBest(empty, 'adaptive', 4000, 1000);
  assert.deepEqual(firstRun, { adaptive: { averageResponseMs: 4000, achievedAt: 1000 } });
  assert.notEqual(firstRun, empty);

  const slower = recordPersonalBest(firstRun, 'adaptive', 5000, 2000);
  assert.equal(slower, firstRun);

  const tied = recordPersonalBest(firstRun, 'adaptive', 4000, 2000);
  assert.equal(tied, firstRun);

  const faster = recordPersonalBest(firstRun, 'adaptive', 3000, 3000);
  assert.deepEqual(faster, { adaptive: { averageResponseMs: 3000, achievedAt: 3000 } });
  assert.notEqual(faster, firstRun);

  const otherKey = recordPersonalBest(firstRun, 'roundabout-circuit', 6000, 4000);
  assert.deepEqual(otherKey, {
    adaptive: { averageResponseMs: 4000, achievedAt: 1000 },
    'roundabout-circuit': { averageResponseMs: 6000, achievedAt: 4000 }
  });

  assert.equal(recordPersonalBest(empty, 'adaptive', 0, 1), empty);
  assert.equal(recordPersonalBest(empty, 'adaptive', NaN, 1), empty);
});
