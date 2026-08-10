import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXAMINERS,
  EXAMINER_CHOICE_IDS,
  assignExaminerRotation,
  examinerById,
  examinerForVoiceId,
  filterVariantsForExaminer,
  missingExaminerVoiceIds,
  selectTodaysExaminer,
  validateExaminerRegistry
} from '../src/examiners.js';

const EXPECTED = Object.freeze([
  ['roger', 'CwhRBWXzGAHq8TQ4Fs17', 'Roger'],
  ['sarah', 'EXAVITQu4vr4xnSDxMaL', 'Sara'],
  ['george', 'JBFqnCBsd6RMkjVDRZzb', 'Jorge'],
  ['matilda', 'XrExE9yKIg1WjnnlVkGX', 'Matilde'],
  ['eric', 'cjVigY5qzO86Huf0OWal', 'Eric']
]);

test('registry maps exactly five stable examiner IDs to production voice IDs', () => {
  assert.deepEqual(
    EXAMINERS.map(({ id, voiceId, displayName }) => [id, voiceId, displayName]),
    EXPECTED
  );
  assert.deepEqual(EXAMINER_CHOICE_IDS, [
    'today', 'mixed', 'roger', 'sarah', 'george', 'matilda', 'eric'
  ]);
});

test('examiner records expose localization and CSS-safe visual identity', () => {
  for (const examiner of EXAMINERS) {
    assert.equal(examiner.nameKey, `examiner.${examiner.id}.name`);
    assert.equal(examiner.descriptionKey, `examiner.${examiner.id}.description`);
    assert.match(examiner.visualToken, /^[a-z][a-z0-9-]*$/);
  }
});

test('registry and every examiner record are frozen', () => {
  assert.equal(Object.isFrozen(EXAMINERS), true);
  assert.equal(EXAMINERS.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(EXAMINER_CHOICE_IDS), true);
});

test('registry validation rejects duplicate IDs, duplicate voices, and malformed records', () => {
  assert.throws(() => validateExaminerRegistry([
    EXAMINERS[0],
    { ...EXAMINERS[1], id: EXAMINERS[0].id }
  ]), /duplicate examiner id/i);
  assert.throws(() => validateExaminerRegistry([
    EXAMINERS[0],
    { ...EXAMINERS[1], voiceId: EXAMINERS[0].voiceId }
  ]), /duplicate voice id/i);
  assert.throws(() => validateExaminerRegistry([
    { ...EXAMINERS[0], visualToken: 'Not safe' }
  ]), /visual token/i);
  assert.throws(() => validateExaminerRegistry([]), /examiner registry/i);
});

test('exact lookups reject unknown examiner and voice IDs', () => {
  assert.equal(examinerById('matilda'), EXAMINERS[3]);
  assert.equal(examinerForVoiceId('JBFqnCBsd6RMkjVDRZzb'), EXAMINERS[2]);
  assert.throws(() => examinerById('unknown'), /unknown examiner/i);
  assert.throws(() => examinerForVoiceId('unknown'), /unknown voice/i);
});

test('today selection is stable for a local calendar date and rotates by day', () => {
  const date = { year: 2026, month: 8, day: 6 };
  assert.equal(selectTodaysExaminer(date), selectTodaysExaminer({ ...date }));

  const fiveDays = Array.from({ length: 5 }, (_, offset) =>
    selectTodaysExaminer({ year: 2026, month: 8, day: 6 + offset }).id
  );
  assert.equal(new Set(fiveDays).size, 5);
});

test('today selection validates real calendar dates and registry availability', () => {
  assert.throws(() => selectTodaysExaminer({ year: 2026, month: 2, day: 30 }), /calendar date/i);
  assert.throws(() => selectTodaysExaminer({ year: 2026, month: 13, day: 1 }), /calendar date/i);
  assert.throws(() => selectTodaysExaminer({ year: 2026, month: 8, day: 6 }, []), /examiner registry/i);
});

test('mixed filtering preserves all candidates while fixed filtering preserves every matching speed and phrasing', () => {
  const variants = [
    { id: 'roger-a-075', voiceId: EXAMINERS[0].voiceId, phrasingId: 'a', speed: 0.75 },
    { id: 'roger-b-1', voiceId: EXAMINERS[0].voiceId, phrasingId: 'b', speed: 1 },
    { id: 'sarah-a-09', voiceId: EXAMINERS[1].voiceId, phrasingId: 'a', speed: 0.9 }
  ];

  const mixed = filterVariantsForExaminer(variants, 'mixed');
  const roger = filterVariantsForExaminer(variants, 'roger');

  assert.deepEqual(mixed.map(({ id }) => id), variants.map(({ id }) => id));
  assert.deepEqual(roger.map(({ id }) => id), ['roger-a-075', 'roger-b-1']);
  assert.equal(Object.isFrozen(mixed), true);
  assert.equal(Object.isFrozen(roger), true);
  assert.equal(mixed.every(Object.isFrozen), true);
});

test('today filtering resolves through the injected local date and fixed choices reject unknown IDs', () => {
  const date = { year: 2026, month: 8, day: 6 };
  const today = selectTodaysExaminer(date);
  const variants = EXAMINERS.map(examiner => ({ id: examiner.id, voiceId: examiner.voiceId }));

  assert.deepEqual(
    filterVariantsForExaminer(variants, 'today', { dateParts: date }).map(({ voiceId }) => voiceId),
    [today.voiceId]
  );
  assert.throws(() => filterVariantsForExaminer(variants, 'other'), /unknown examiner choice/i);
  assert.throws(() => filterVariantsForExaminer({}, 'mixed'), /audio variants/i);
});

test('candidate filtering never mutates caller-owned arrays or records', () => {
  const variants = [{ id: 'a', voiceId: EXAMINERS[0].voiceId }];
  const before = structuredClone(variants);
  const selected = filterVariantsForExaminer(variants, 'roger');

  assert.deepEqual(variants, before);
  assert.notEqual(selected, variants);
  assert.notEqual(selected[0], variants[0]);
});

test('coverage reports exactly the missing production examiner voice IDs', () => {
  const variants = EXAMINERS.slice(0, 3).map(examiner => ({ voiceId: examiner.voiceId }));
  assert.deepEqual(missingExaminerVoiceIds(variants), EXAMINERS.slice(3).map(({ voiceId }) => voiceId));
  assert.deepEqual(missingExaminerVoiceIds(EXAMINERS.map(({ voiceId }) => ({ voiceId }))), []);
});

test('assignExaminerRotation gives a full shuffled permutation before repeating', () => {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return 0.999999 - calls * 0.0001;
  };
  const five = assignExaminerRotation(5, rng);
  assert.equal(five.length, 5);
  assert.deepEqual([...five].sort(), EXAMINERS.map(({ id }) => id).sort());
  assert.equal(Object.isFrozen(five), true);

  const seven = assignExaminerRotation(7, rng);
  assert.equal(seven.length, 7);
  assert.deepEqual([...seven.slice(0, 5)].sort(), EXAMINERS.map(({ id }) => id).sort());
  assert.ok(EXAMINERS.some(({ id }) => id === seven[5]));
  assert.ok(EXAMINERS.some(({ id }) => id === seven[6]));

  assert.deepEqual(assignExaminerRotation(0, rng), []);
});

test('assignExaminerRotation rejects an invalid count', () => {
  assert.throws(() => assignExaminerRotation(-1), /invalid examiner rotation count/i);
  assert.throws(() => assignExaminerRotation(1.5), /invalid examiner rotation count/i);
});
