import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOMPLISHMENTS,
  ACCOMPLISHMENT_CHALLENGE_IDS,
  accomplishmentStatus,
  examinerEncounters,
  recordCompletion,
  themeCompletionStatus,
  validateCompletions
} from '../src/collection.js';
import { EXAMINERS } from '../src/examiners.js';
import { CHALLENGE_IDS } from '../src/challenges.js';
import { THEME_IDS } from '../src/session-themes.js';

test('exports exactly the five roadmap-named accomplishments, each tied to a real challenge', () => {
  assert.deepEqual(ACCOMPLISHMENT_CHALLENGE_IDS, [
    'audio-only', 'one-listen', 'five-examiners', 'control-check', 'perfect-roundabouts'
  ]);
  assert.deepEqual(ACCOMPLISHMENTS.map(({ id }) => id), ACCOMPLISHMENT_CHALLENGE_IDS);
  for (const id of ACCOMPLISHMENT_CHALLENGE_IDS) assert.ok(CHALLENGE_IDS.includes(id));
  // personal-best, brisk-examiner, and confusion-pairs deliberately have no accomplishment
  for (const id of ['personal-best', 'brisk-examiner', 'confusion-pairs']) {
    assert.ok(!ACCOMPLISHMENT_CHALLENGE_IDS.includes(id));
  }
});

test('validateCompletions accepts well-formed entries and rejects malformed ones', () => {
  assert.deepEqual(validateCompletions([]), []);
  const valid = [
    { kind: 'challenge', id: 'audio-only', achievedAt: 1000 },
    { kind: 'theme', id: THEME_IDS[0], achievedAt: 2000 }
  ];
  assert.deepEqual(validateCompletions(valid), valid);
  assert.equal(Object.isFrozen(validateCompletions(valid)), true);
  assert.equal(Object.isFrozen(validateCompletions(valid)[0]), true);

  assert.throws(() => validateCompletions('nope'), /invalid completions/i);
  assert.throws(() => validateCompletions([{ kind: 'mystery', id: 'audio-only', achievedAt: 1 }]), /invalid.*\.kind/i);
  assert.throws(() => validateCompletions([{ kind: 'challenge', id: 'personal-best', achievedAt: 1 }]), /invalid.*\.id/i);
  assert.throws(() => validateCompletions([{ kind: 'theme', id: 'not-a-theme', achievedAt: 1 }]), /invalid.*\.id/i);
  assert.throws(() => validateCompletions([{ kind: 'challenge', id: 'audio-only', achievedAt: 'soon' }]), /invalid.*\.achievedAt/i);
  assert.throws(() => validateCompletions([
    { kind: 'challenge', id: 'audio-only', achievedAt: 1 },
    { kind: 'challenge', id: 'audio-only', achievedAt: 2 }
  ]), /invalid duplicate/i);
});

test('recordCompletion is append-only: first write sticks, later writes for the same pair are no-ops', () => {
  const empty = Object.freeze([]);
  const first = recordCompletion(empty, 'challenge', 'audio-only', 1000);
  assert.deepEqual(first, [{ kind: 'challenge', id: 'audio-only', achievedAt: 1000 }]);
  assert.notEqual(first, empty);

  const second = recordCompletion(first, 'challenge', 'audio-only', 9999);
  assert.equal(second, first, 'a later completion of the same accomplishment must not overwrite the first');

  const withTheme = recordCompletion(first, 'theme', THEME_IDS[0], 2000);
  assert.deepEqual(withTheme, [
    { kind: 'challenge', id: 'audio-only', achievedAt: 1000 },
    { kind: 'theme', id: THEME_IDS[0], achievedAt: 2000 }
  ]);

  assert.throws(() => recordCompletion(empty, 'mystery', 'x', 1), /invalid completion kind/i);
});

test('accomplishmentStatus is a pure, reconstructible view over the completions log', () => {
  const completions = [
    { kind: 'challenge', id: 'audio-only', achievedAt: 1000 },
    { kind: 'theme', id: THEME_IDS[0], achievedAt: 2000 }
  ];
  const status = accomplishmentStatus(completions);
  assert.equal(status.length, ACCOMPLISHMENTS.length);
  const audioOnly = status.find(entry => entry.id === 'audio-only');
  assert.equal(audioOnly.earned, true);
  assert.equal(audioOnly.achievedAt, 1000);
  for (const entry of status) {
    if (entry.id === 'audio-only') continue;
    assert.equal(entry.earned, false);
    assert.equal(entry.achievedAt, null);
  }
  assert.equal(Object.isFrozen(status), true);

  // Same input always yields the same output — genuinely reconstructible.
  assert.deepEqual(accomplishmentStatus(completions), status);
});

test('themeCompletionStatus reports completed/not per requested theme id', () => {
  const completions = [{ kind: 'theme', id: THEME_IDS[1], achievedAt: 5000 }];
  const status = themeCompletionStatus(completions, THEME_IDS);
  assert.equal(status.length, THEME_IDS.length);
  assert.deepEqual(
    status.find(entry => entry.themeId === THEME_IDS[1]),
    { themeId: THEME_IDS[1], completed: true, achievedAt: 5000 }
  );
  assert.deepEqual(
    status.find(entry => entry.themeId === THEME_IDS[0]),
    { themeId: THEME_IDS[0], completed: false, achievedAt: null }
  );
});

test('examinerEncounters derives heard/not-heard purely from attempt voiceIds, no stored flag', () => {
  const attempts = [
    { voiceId: EXAMINERS[0].voiceId },
    { voiceId: EXAMINERS[0].voiceId },
    { voiceId: EXAMINERS[2].voiceId },
    { voiceId: 'browser-speech' }
  ];
  const encounters = examinerEncounters(attempts);
  assert.equal(encounters.length, EXAMINERS.length);
  assert.equal(encounters.find(entry => entry.id === EXAMINERS[0].id).encountered, true);
  assert.equal(encounters.find(entry => entry.id === EXAMINERS[2].id).encountered, true);
  assert.equal(encounters.find(entry => entry.id === EXAMINERS[1].id).encountered, false);
  assert.equal(Object.isFrozen(encounters), true);

  assert.deepEqual(
    examinerEncounters([]).map(entry => entry.encountered),
    EXAMINERS.map(() => false)
  );
});
