import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECENT_KEEP_COUNT,
  RETENTION_DAYS,
  compactAttempts
} from '../src/attempt-compaction.js';
import { readinessForCommand } from '../src/readiness.js';
import { defaultState, exportState, importState } from '../src/storage.js';
import { masteryForAction } from '../src/training.js';

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 7, 8, 12);
const OUTCOME_WEIGHTS = { unaided: 1, assisted: 0.5, incorrect: 0 };

function command(id, actionId, phase = 'driving') {
  return { id, actionId, phase };
}

const commands = [
  command('d-1', 'action-1'),
  command('d-2', 'action-1'),
  command('d-3', 'action-3'),
  command('p-1', 'precheck-1', 'precheck'),
  command('p-2', 'precheck-2', 'precheck')
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function completedAttempt({
  id,
  commandId,
  actionId,
  timestamp,
  outcome = 'unaided',
  responseMs = 800,
  replays = 0
}) {
  return {
    id,
    timestamp,
    commandId,
    actionId,
    phrasingId: `${commandId}-canonical`,
    voiceId: 'voice-es',
    speed: 0.9,
    phase: 'driving',
    surfaceId: 'junction-v1',
    selectedResult: outcome === 'incorrect' ? 'wrong-result' : 'expected-result',
    outcome,
    weight: OUTCOME_WEIGHTS[outcome],
    responseMs,
    replays,
    textShown: outcome === 'assisted',
    timed: false,
    timeout: false
  };
}

function randomAttempts(rng, count) {
  const outcomes = ['unaided', 'assisted', 'incorrect'];
  const timestamps = Array.from({ length: count }, () =>
    NOW - Math.floor(rng() * 200) * DAY_MS - Math.floor(rng() * DAY_MS)
  ).sort((left, right) => left - right);
  return timestamps.map((timestamp, index) => {
    const source = commands[Math.floor(rng() * commands.length)];
    return completedAttempt({
      id: `attempt-${index}`,
      commandId: source.id,
      actionId: source.actionId,
      timestamp,
      outcome: outcomes[Math.floor(rng() * outcomes.length)],
      responseMs: Math.floor(rng() * 3_000),
      replays: Math.floor(rng() * 3)
    });
  });
}

function stateWith(attempts, overrides = {}) {
  return { ...defaultState(), attempts, ...overrides };
}

function oldDay(daysBack, hour = 9) {
  return NOW - daysBack * DAY_MS + hour * 3_600_000 - 12 * 3_600_000;
}

test('readiness state and mastery ready flags survive compaction for randomized histories', () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const rng = mulberry32(seed);
    const attempts = randomAttempts(rng, 40 + Math.floor(rng() * 120));
    const before = stateWith(attempts);
    const after = compactAttempts(before, NOW);

    assert.ok(after.attempts.length <= before.attempts.length, `seed ${seed} grew attempts`);
    for (const entry of commands) {
      const beforeRecord = readinessForCommand(entry, before.attempts, [], NOW);
      const afterRecord = readinessForCommand(entry, after.attempts, [], NOW);
      assert.equal(afterRecord.state, beforeRecord.state, `seed ${seed} changed ${entry.id} readiness`);
      assert.deepEqual(
        afterRecord.recentOutcomes,
        beforeRecord.recentOutcomes,
        `seed ${seed} changed ${entry.id} recent outcomes`
      );
      assert.equal(
        masteryForAction(after.attempts, entry.actionId).ready,
        masteryForAction(before.attempts, entry.actionId).ready,
        `seed ${seed} changed ${entry.actionId} mastery`
      );
    }
  }
});

test('drops repeat unaided attempts on old dates while keeping each distinct unaided date', () => {
  const attempts = [
    completedAttempt({ id: 'old-first', commandId: 'd-1', actionId: 'action-1', timestamp: oldDay(120, 9) }),
    completedAttempt({ id: 'old-repeat', commandId: 'd-1', actionId: 'action-1', timestamp: oldDay(120, 15) }),
    completedAttempt({ id: 'old-other-date', commandId: 'd-1', actionId: 'action-1', timestamp: oldDay(110) }),
    ...Array.from({ length: RECENT_KEEP_COUNT }, (unused, index) =>
      completedAttempt({
        id: `recent-${index}`,
        commandId: 'd-1',
        actionId: 'action-1',
        timestamp: NOW - (RECENT_KEEP_COUNT - index) * DAY_MS
      }))
  ];
  const before = stateWith(attempts);
  const after = compactAttempts(before, NOW);

  const keptIds = after.attempts.map(attempt => attempt.id);
  assert.ok(keptIds.includes('old-first'), 'first unaided attempt of an old date must survive');
  assert.ok(keptIds.includes('old-other-date'), 'each distinct old unaided date must survive');
  assert.ok(!keptIds.includes('old-repeat'), 'repeat unaided attempts on an old date must drop');

  const unaidedDates = attemptList => new Set(attemptList
    .filter(attempt => attempt.outcome === 'unaided' && attempt.commandId === 'd-1')
    .map(attempt => new Date(attempt.timestamp).toISOString().slice(0, 10)));
  assert.deepEqual(unaidedDates(after.attempts), unaidedDates(before.attempts));

  const beforeRecord = readinessForCommand(commands[0], before.attempts, [], NOW);
  const afterRecord = readinessForCommand(commands[0], after.attempts, [], NOW);
  assert.equal(beforeRecord.state, 'ready');
  assert.equal(afterRecord.state, 'ready');
});

test('keeps the most recent attempts per command in full fidelity regardless of age', () => {
  const attempts = Array.from({ length: 15 }, (unused, index) =>
    completedAttempt({
      id: `assisted-${index}`,
      commandId: 'd-2',
      actionId: 'action-1',
      timestamp: oldDay(180 - index),
      outcome: 'assisted'
    }));
  const after = compactAttempts(stateWith(attempts), NOW);

  assert.deepEqual(
    after.attempts.map(attempt => attempt.id),
    attempts.slice(-RECENT_KEEP_COUNT).map(attempt => attempt.id)
  );
});

test('never drops attempts referenced by the active session', () => {
  const attempts = [
    completedAttempt({ id: 'pinned-old', commandId: 'd-1', actionId: 'action-1', timestamp: oldDay(150, 9), outcome: 'incorrect' }),
    completedAttempt({ id: 'droppable-old', commandId: 'd-1', actionId: 'action-1', timestamp: oldDay(150, 10), outcome: 'incorrect' }),
    ...Array.from({ length: RECENT_KEEP_COUNT + 2 }, (unused, index) =>
      completedAttempt({
        id: `recent-${index}`,
        commandId: 'd-1',
        actionId: 'action-1',
        timestamp: NOW - (RECENT_KEEP_COUNT + 2 - index) * 3_600_000
      }))
  ];
  const before = stateWith(attempts, { activeSession: { attemptIds: ['pinned-old'] } });
  const after = compactAttempts(before, NOW);

  const keptIds = after.attempts.map(attempt => attempt.id);
  assert.ok(keptIds.includes('pinned-old'));
  assert.ok(!keptIds.includes('droppable-old'));
});

test('keeps every attempt inside the retention window and returns the same state when nothing drops', () => {
  const attempts = Array.from({ length: 30 }, (unused, index) =>
    completedAttempt({
      id: `recent-${index}`,
      commandId: commands[index % commands.length].id,
      actionId: commands[index % commands.length].actionId,
      timestamp: NOW - Math.floor(index * ((RETENTION_DAYS - 1) * DAY_MS) / 30),
      outcome: index % 3 === 0 ? 'incorrect' : 'unaided'
    }));
  const before = stateWith(attempts);
  const after = compactAttempts(before, NOW);

  assert.equal(after, before);
});

test('compaction is idempotent', () => {
  const rng = mulberry32(99);
  const before = stateWith(randomAttempts(rng, 160));
  const once = compactAttempts(before, NOW);
  const twice = compactAttempts(once, NOW);

  assert.ok(once.attempts.length < before.attempts.length, 'fixture must actually compact');
  assert.deepEqual(twice, once);
});

test('compacted state remains valid for storage export and import round-trips', () => {
  const rng = mulberry32(7);
  const before = stateWith(randomAttempts(rng, 120));
  const after = compactAttempts(before, NOW);

  const exported = exportState(after);
  assert.deepEqual(importState(exported), after);
});

test('rejects malformed state, attempts, and clock input', () => {
  assert.throws(() => compactAttempts(null, NOW), /Invalid state/);
  assert.throws(() => compactAttempts([], NOW), /Invalid state/);
  assert.throws(() => compactAttempts({ attempts: {} }, NOW), /Invalid state\.attempts/);
  assert.throws(() => compactAttempts({ attempts: [] }, Number.NaN), /Invalid now/);
  assert.throws(() => compactAttempts({ attempts: [null] }, NOW), /Invalid attempts\[0\]/);
  assert.throws(
    () => compactAttempts({ attempts: [{ id: '', commandId: 'd-1', timestamp: NOW, outcome: 'unaided' }] }, NOW),
    /Invalid attempts\[0\]\.id/
  );
  assert.throws(
    () => compactAttempts({ attempts: [{ id: 'a', commandId: '', timestamp: NOW, outcome: 'unaided' }] }, NOW),
    /Invalid attempts\[0\]\.commandId/
  );
  assert.throws(
    () => compactAttempts({ attempts: [{ id: 'a', commandId: 'd-1', timestamp: Number.POSITIVE_INFINITY, outcome: 'unaided' }] }, NOW),
    /Invalid attempts\[0\]\.timestamp/
  );
  assert.throws(
    () => compactAttempts({ attempts: [{ id: 'a', commandId: 'd-1', timestamp: NOW, outcome: 'perfect' }] }, NOW),
    /Invalid attempts\[0\]\.outcome/
  );
});
