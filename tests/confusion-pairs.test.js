import assert from 'node:assert/strict';
import test from 'node:test';

import { computeConfusionPairs, confusionDrillCommandIds } from '../src/confusion-pairs.js';

const commands = [
  { id: 'c-der', actionId: 'turn-right' },
  { id: 'c-izq', actionId: 'turn-left' },
  { id: 'c-adelante', actionId: 'continue-forward' },
  { id: 'c-parar', actionId: 'voluntary-stop' }
];

function attempt(overrides = {}) {
  return {
    outcome: 'incorrect',
    expectedResult: 'turn-right',
    selectedResult: 'turn-left',
    ...overrides
  };
}

test('computeConfusionPairs only counts incorrect attempts confused with a different real command', () => {
  const attempts = [
    attempt(),
    attempt(),
    attempt({ outcome: 'unaided' }),
    attempt({ expectedResult: 'turn-right', selectedResult: 'turn-right' }),
    attempt({ expectedResult: 'turn-right', selectedResult: null }),
    attempt({ expectedResult: 'turn-right', selectedResult: 'nonexistent-action' }),
    attempt({ expectedResult: 'continue-forward', selectedResult: 'voluntary-stop' })
  ];
  const pairs = computeConfusionPairs(attempts, commands);

  assert.deepEqual(pairs, [
    { actionIdA: 'turn-right', actionIdB: 'turn-left', count: 2 },
    { actionIdA: 'continue-forward', actionIdB: 'voluntary-stop', count: 1 }
  ]);
});

test('computeConfusionPairs treats a pair as symmetric regardless of confusion direction', () => {
  const attempts = [
    attempt({ expectedResult: 'turn-right', selectedResult: 'turn-left' }),
    attempt({ expectedResult: 'turn-left', selectedResult: 'turn-right' })
  ];
  const pairs = computeConfusionPairs(attempts, commands);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].count, 2);
});

test('computeConfusionPairs is frozen and returns no pairs for clean history', () => {
  const pairs = computeConfusionPairs([attempt({ outcome: 'unaided' })], commands);
  assert.deepEqual(pairs, []);
  assert.equal(Object.isFrozen(pairs), true);

  const withPairs = computeConfusionPairs([attempt()], commands);
  assert.equal(Object.isFrozen(withPairs), true);
  assert.equal(Object.isFrozen(withPairs[0]), true);
});

test('computeConfusionPairs rejects malformed input', () => {
  assert.throws(() => computeConfusionPairs(null, commands), /invalid attempts/i);
  assert.throws(() => computeConfusionPairs([], null), /invalid commands/i);
});

test('confusionDrillCommandIds walks pairs in rank order, deduplicating commands, up to the limit', () => {
  const pairs = [
    { actionIdA: 'turn-right', actionIdB: 'turn-left', count: 5 },
    { actionIdA: 'turn-right', actionIdB: 'continue-forward', count: 3 },
    { actionIdA: 'continue-forward', actionIdB: 'voluntary-stop', count: 1 }
  ];
  assert.deepEqual(
    confusionDrillCommandIds(pairs, commands, 10),
    ['c-der', 'c-izq', 'c-adelante', 'c-parar']
  );
  assert.deepEqual(
    confusionDrillCommandIds(pairs, commands, 3),
    ['c-der', 'c-izq', 'c-adelante']
  );
  assert.equal(Object.isFrozen(confusionDrillCommandIds(pairs, commands, 3)), true);
});

test('confusionDrillCommandIds returns an empty array when there are no pairs yet', () => {
  assert.deepEqual(confusionDrillCommandIds([], commands, 10), []);
});

test('confusionDrillCommandIds rejects malformed input', () => {
  assert.throws(() => confusionDrillCommandIds(null, commands, 5), /invalid confusion pairs/i);
  assert.throws(() => confusionDrillCommandIds([], null, 5), /invalid commands/i);
  assert.throws(() => confusionDrillCommandIds([], commands, 0), /invalid confusion drill limit/i);
  assert.throws(() => confusionDrillCommandIds([], commands, 1.5), /invalid confusion drill limit/i);
});
