import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCoverageAwareVariant } from '../src/variant-coverage.js';

function attempt(overrides = {}) {
  return {
    id: 'attempt-1',
    timestamp: 1,
    commandId: 'c-der',
    actionId: 'turn-right',
    phrasingId: 'p1',
    voiceId: 'v1',
    speed: 1,
    phase: 'driving',
    surfaceId: 's1',
    selectedResult: 'right',
    outcome: 'unaided',
    weight: 1,
    responseMs: 1000,
    replays: 0,
    textShown: false,
    timed: true,
    timeout: false,
    ...overrides
  };
}

const CANDIDATES = [
  { commandId: 'c-der', phrasingId: 'p1', voiceId: 'v1', speed: 1, url: '...' },
  { commandId: 'c-der', phrasingId: 'p2', voiceId: 'v1', speed: 1, url: '...' },
  { commandId: 'c-der', phrasingId: 'p1', voiceId: 'v2', speed: 1, url: '...' },
  { commandId: 'c-der', phrasingId: 'p2', voiceId: 'v2', speed: 1, url: '...' },
  { commandId: 'c-der', phrasingId: 'p3', voiceId: 'v1', speed: 1, url: '...' },
];

test('prefers an unexposed phrasing and voice pair', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.75 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 1 }),
  ], () => 0);
  // With rng=0, picks first of tied group: p2+v1 (index 0 of 4 tied)
  assert.deepEqual([result.phrasingId, result.voiceId], ['p2', 'v1']);
});

test('exposure counts correctly across speeds', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.75 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 1 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.9 }),
  ], () => 0);
  assert.deepEqual([result.phrasingId, result.voiceId], ['p2', 'v1']);
});

test('command isolation: attempts for other command do not count', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [
    attempt({ commandId: 'c-izq', phrasingId: 'p1', voiceId: 'v1' }),
  ], () => 0);
  assert.equal(result.commandId, 'c-der');
});

test('rejects empty candidate list', () => {
  assert.throws(() => selectCoverageAwareVariant([], [], () => 0), /Empty candidate list/);
});

test('returns frozen copy', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [], () => 0);
  assert.throws(() => { result.phrasingId = 'hacked'; }, /read only|frozen|extensible/);
});

test('does not mutate input candidates', () => {
  const candidates = [...CANDIDATES];
  selectCoverageAwareVariant(candidates, [], () => 0);
  assert.equal(candidates.length, CANDIDATES.length);
});

test('does not mutate input attempts', () => {
  const attempts = [attempt({ phrasingId: 'p1', voiceId: 'v1' })];
  selectCoverageAwareVariant(CANDIDATES, attempts, () => 0);
  assert.equal(attempts.length, 1);
});

test('deterministic tie selection with injected rng', () => {
  const result1 = selectCoverageAwareVariant(CANDIDATES, [], () => 0);
  const result2 = selectCoverageAwareVariant(CANDIDATES, [], () => 0);
  assert.deepEqual(result1, result2);
});

test('clamps a boundary RNG value to the final tied candidate', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [], () => 1);
  assert.deepEqual(result, CANDIDATES.at(-1));
  assert.equal(Object.isFrozen(result), true);
});

test('different rng produces potentially different result from tied group', () => {
  const result1 = selectCoverageAwareVariant(CANDIDATES, [], () => 0);
  const result2 = selectCoverageAwareVariant(CANDIDATES, [], () => 0.9);
  assert(CANDIDATES.some(c => c.phrasingId === result1.phrasingId && c.voiceId === result1.voiceId));
  assert(CANDIDATES.some(c => c.phrasingId === result2.phrasingId && c.voiceId === result2.voiceId));
});

test('selects only voice pairs tied for minimum exposure', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.75 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 1 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.9 }),
    attempt({ phrasingId: 'p2', voiceId: 'v1', speed: 1 }),
  ], () => 0);
  assert(['p2', 'p1'].includes(result.phrasingId));
  assert(['v2'].includes(result.voiceId));
});

test('returns candidate with exact matching IDs', () => {
  const attempts = [
    attempt({ phrasingId: 'p1', voiceId: 'v1' }),
    attempt({ phrasingId: 'p2', voiceId: 'v1' }),
  ];
  const result = selectCoverageAwareVariant(CANDIDATES, attempts, () => 0);
  assert(['p1', 'p2'].includes(result.phrasingId));
  assert(['v2'].includes(result.voiceId));
});
