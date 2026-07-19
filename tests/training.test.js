import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OUTCOME_WEIGHTS,
  SESSION_LENGTHS,
  UNAIDED_INTERVAL_DAYS,
  classifyOutcome,
  createSession,
  masteryForAction,
  nextWeakestFirst,
  recordAttempt,
  scheduleAfterAttempt,
  summarizeSession
} from '../src/training.js';

const DAY_MS = 86_400_000;
const NOW = Date.UTC(2026, 6, 17, 12);

function command(id, actionId, phase = 'driving') {
  return { id, actionId, phase };
}

const commands = [
  command('d-1', 'action-1'),
  command('d-2', 'action-2'),
  command('d-3', 'action-3'),
  command('d-4', 'action-4'),
  command('d-5', 'action-5'),
  command('d-6', 'action-6'),
  command('d-7', 'action-7'),
  command('p-1', 'precheck-1', 'precheck'),
  command('p-2', 'precheck-2', 'precheck'),
  command('p-3', 'precheck-3', 'precheck'),
  command('p-4', 'precheck-4', 'precheck'),
  command('p-5', 'precheck-5', 'precheck'),
  command('p-6', 'precheck-6', 'precheck')
];

function rngFrom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

function completedAttempt({
  id = 'attempt',
  actionId = 'action-1',
  outcome = 'unaided',
  timestamp = NOW,
  responseMs = 900
} = {}) {
  return {
    id,
    actionId,
    outcome,
    weight: OUTCOME_WEIGHTS[outcome],
    timestamp,
    responseMs
  };
}

function record(state, input = {}, dependencies = {}) {
  return recordAttempt(state, {
    audio: { scored: true },
    commandId: 'd-1',
    actionId: 'action-1',
    phrasingId: 'd-1-canonical',
    voiceId: 'voice-es',
    speed: 0.9,
    phase: 'driving',
    surfaceId: 'junction-v1',
    selectedResult: 'action-1',
    correct: true,
    textShown: false,
    responseMs: 900,
    replays: 0,
    timed: false,
    timeout: false,
    ...input
  }, {
    now: () => NOW,
    randomUUID: () => 'attempt-1',
    ...dependencies
  });
}

test('classifies outcomes independently of replay count and exports their fixed weights', () => {
  assert.equal(classifyOutcome({ correct: true, textShown: false }), 'unaided');
  assert.equal(classifyOutcome({ correct: true, textShown: true }), 'assisted');
  assert.equal(classifyOutcome({ correct: false, textShown: false }), 'incorrect');
  assert.equal(classifyOutcome({ correct: true, textShown: false, replays: 4 }), 'unaided');
  assert.equal(classifyOutcome({ correct: true, textShown: false, timeout: true }), 'incorrect');
  assert.deepEqual(OUTCOME_WEIGHTS, { unaided: 1, assisted: 0.5, incorrect: 0 });
});

test('creates phase-filtered sessions at each supported length with injected deterministic randomness', () => {
  assert.deepEqual(SESSION_LENGTHS, { short: 5, medium: 10, all: 15 });

  const settings = { phase: 'mixed', length: 'short' };
  const first = createSession(commands, { ...settings, rng: rngFrom([0.8, 0.1, 0.6]) });
  const second = createSession(commands, { ...settings, rng: rngFrom([0.8, 0.1, 0.6]) });
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);

  const driving = createSession(commands, { phase: 'driving', length: 'all', rng: () => 0.5 });
  assert.equal(driving.length, 7);
  assert.ok(driving.every(item => item.phase === 'driving'));

  const prechecks = createSession(commands, { phase: 'precheck', length: 'medium', rng: () => 0.5 });
  assert.equal(prechecks.length, 6);
  assert.ok(prechecks.every(item => item.phase === 'precheck'));

  assert.equal(createSession(commands, { phase: 'mixed', length: 'medium', rng: () => 0.5 }).length, 10);
  assert.equal(createSession(commands, { phase: 'mixed', length: 'all', rng: () => 0.5 }).length, commands.length);

  const largePool = Array.from({ length: 20 }, (_, index) => command(`large-${index}`, `large-${index}`));
  assert.equal(createSession(largePool, { phase: 'driving', length: 'short', rng: () => 0.5 }).length, 5);
  assert.equal(createSession(largePool, { phase: 'driving', length: 'medium', rng: () => 0.5 }).length, 10);
  assert.equal(createSession(largePool, { phase: 'driving', length: 'all', rng: () => 0.5 }).length, 15);
  assert.throws(
    () => createSession(commands, { phase: 'mixed', length: 'short', mode: 'sequential', rng: () => 0.5 }),
    /Unknown session mode: sequential/
  );
});

test('records a complete immutable scored attempt with injected time and identifier', () => {
  const state = { attempts: [], actionProgress: {} };
  const result = record(state, { textShown: true, replays: 2, responseMs: 1_250 });

  assert.deepEqual(state, { attempts: [], actionProgress: {} });
  assert.deepEqual(result.attempt, {
    id: 'attempt-1',
    timestamp: NOW,
    commandId: 'd-1',
    actionId: 'action-1',
    phrasingId: 'd-1-canonical',
    voiceId: 'voice-es',
    speed: 0.9,
    phase: 'driving',
    surfaceId: 'junction-v1',
    selectedResult: 'action-1',
    outcome: 'assisted',
    weight: 0.5,
    responseMs: 1_250,
    replays: 2,
    textShown: true,
    timed: false,
    timeout: false
  });
  assert.equal(result.state.attempts.length, 1);
  assert.deepEqual(result.state.actionProgress['action-1'], {
    consecutiveUnaided: 0,
    nextDueAt: NOW + DAY_MS
  });

  const timeout = record(state, { correct: true, timeout: true, selectedResult: null });
  assert.equal(timeout.attempt.outcome, 'incorrect');
  assert.equal(timeout.attempt.weight, 0);
});

test('records browser-speech provider provenance without changing scoring', () => {
  const result = record(
    { attempts: [], actionProgress: {} },
    { audioProvider: 'browser-speech', voiceId: 'browser-speech' }
  );

  assert.equal(result.scored, true);
  assert.equal(result.attempt.audioProvider, 'browser-speech');
  assert.equal(result.attempt.voiceId, 'browser-speech');
});

test('records optional surface-model provenance alongside a scored attempt', () => {
  const surfaceModel = {
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3'
  };

  const result = record({ attempts: [], actionProgress: {} }, {
    surfaceModel,
    selectedTargetId: 'exit-3'
  });

  assert.deepEqual(
    {
      surfaceVersion: result.attempt.surfaceVersion,
      surfaceSeed: result.attempt.surfaceSeed,
      expectedResult: result.attempt.expectedResult,
      selectedTargetId: result.attempt.selectedTargetId
    },
    {
      surfaceVersion: 2,
      surfaceSeed: 42,
      expectedResult: 'roundabout-exit-3',
      selectedTargetId: 'exit-3'
    }
  );
  assert.equal(record({ attempts: [], actionProgress: {} }).attempt.surfaceVersion, undefined);
});

test('does not create attempts or update mastery when audio is missing or interrupted', () => {
  const initial = { attempts: [], actionProgress: {} };
  for (const audio of [undefined, { scored: false, reason: 'missing' }, { scored: false, reason: 'interrupted' }]) {
    const result = record(initial, { audio });
    assert.equal(result.attempt, null);
    assert.deepEqual(result.state, initial);
    assert.equal(result.scored, false);
  }
  assert.deepEqual(masteryForAction(initial.attempts, 'action-1'), {
    unaided: 0,
    assisted: 0,
    incorrect: 0,
    weightedScore: 0,
    averageResponseMs: null,
    lastPracticedAt: null,
    nextDueAt: null,
    ready: false
  });
});

test('schedules incorrect, assisted, and consecutive unaided attempts at the specified intervals', () => {
  assert.deepEqual(UNAIDED_INTERVAL_DAYS, [1, 3, 7, 14, 30]);

  const incorrect = scheduleAfterAttempt({ consecutiveUnaided: 4, nextDueAt: NOW + DAY_MS }, completedAttempt({ outcome: 'incorrect' }));
  assert.deepEqual(incorrect, { consecutiveUnaided: 0, nextDueAt: NOW });

  const assisted = scheduleAfterAttempt({ consecutiveUnaided: 4, nextDueAt: NOW }, completedAttempt({ outcome: 'assisted' }));
  assert.deepEqual(assisted, { consecutiveUnaided: 0, nextDueAt: NOW + DAY_MS });

  let schedule = { consecutiveUnaided: 0, nextDueAt: null };
  for (const [index, days] of [1, 3, 7, 14, 30, 30].entries()) {
    const timestamp = NOW + index * DAY_MS;
    schedule = scheduleAfterAttempt(schedule, completedAttempt({ outcome: 'unaided', timestamp }));
    assert.deepEqual(schedule, {
      consecutiveUnaided: index + 1,
      nextDueAt: timestamp + days * DAY_MS
    });
  }
});

test('requires three unaided successes on distinct UTC dates and two recent unaided results for readiness', () => {
  const sameDay = [
    completedAttempt({ id: 'a1', timestamp: NOW - 3 * DAY_MS }),
    completedAttempt({ id: 'a2', timestamp: NOW - 3 * DAY_MS + 1 }),
    completedAttempt({ id: 'a3', timestamp: NOW - 2 * DAY_MS })
  ];
  assert.equal(masteryForAction(sameDay, 'action-1').ready, false);

  const interruptedStreak = [
    completedAttempt({ id: 'b1', timestamp: NOW - 4 * DAY_MS }),
    completedAttempt({ id: 'b2', timestamp: NOW - 3 * DAY_MS }),
    completedAttempt({ id: 'b3', timestamp: NOW - 2 * DAY_MS }),
    completedAttempt({ id: 'b4', outcome: 'incorrect', timestamp: NOW - DAY_MS })
  ];
  assert.equal(masteryForAction(interruptedStreak, 'action-1').ready, false);

  const ready = [
    completedAttempt({ id: 'c1', timestamp: NOW - 3 * DAY_MS }),
    completedAttempt({ id: 'c2', timestamp: NOW - 2 * DAY_MS }),
    completedAttempt({ id: 'c3', timestamp: NOW - DAY_MS })
  ];
  const progress = masteryForAction(ready, 'action-1');
  assert.equal(progress.ready, true);
  assert.equal(masteryForAction([ready[0]], 'action-1').ready, false);
});

test('reports raw outcome counts and averages response time only across completed scored attempts', () => {
  const attempts = [
    completedAttempt({ id: 'u', outcome: 'unaided', responseMs: 800, timestamp: NOW - 3 * DAY_MS }),
    completedAttempt({ id: 'a', outcome: 'assisted', responseMs: 1_200, timestamp: NOW - 2 * DAY_MS }),
    completedAttempt({ id: 'i', outcome: 'incorrect', responseMs: null, timestamp: NOW - DAY_MS }),
    completedAttempt({ id: 'other', actionId: 'action-2', responseMs: 5 })
  ];
  assert.deepEqual(masteryForAction(attempts, 'action-1'), {
    unaided: 1,
    assisted: 1,
    incorrect: 1,
    weightedScore: 0.5,
    averageResponseMs: 1_000,
    lastPracticedAt: NOW - DAY_MS,
    nextDueAt: NOW - DAY_MS,
    ready: false
  });
});

test('recomputes mastery weights from outcomes instead of persisted attempt data', () => {
  const malformedWeights = [
    { ...completedAttempt({ id: 'u', outcome: 'unaided' }), weight: 0 },
    { ...completedAttempt({ id: 'a', outcome: 'assisted' }), weight: 1 },
    { ...completedAttempt({ id: 'i', outcome: 'incorrect' }), weight: 1 }
  ];
  assert.equal(masteryForAction(malformedWeights, 'action-1').weightedScore, 0.5);
});

test('weakest-first selection puts unseen and due actions ahead of weaker actions that are not yet due', () => {
  const selectionCommands = [
    command('unseen', 'unseen'),
    command('due', 'due'),
    command('not-due', 'not-due')
  ];
  const attempts = [
    completedAttempt({ id: 'due-1', actionId: 'due', timestamp: NOW - 20 * DAY_MS }),
    completedAttempt({ id: 'due-2', actionId: 'due', timestamp: NOW - 15 * DAY_MS }),
    completedAttempt({ id: 'due-3', actionId: 'due', timestamp: NOW - 10 * DAY_MS }),
    completedAttempt({ id: 'not-due-1', actionId: 'not-due', outcome: 'incorrect', timestamp: NOW - 2 * DAY_MS }),
    completedAttempt({ id: 'not-due-2', actionId: 'not-due', timestamp: NOW })
  ];
  assert.deepEqual(
    nextWeakestFirst(selectionCommands, attempts, NOW).map(item => item.id),
    ['unseen', 'due', 'not-due']
  );
});

test('free-practice session ignores due dates while retaining the same attempt scoring engine', () => {
  const selectionCommands = [command('due', 'due'), command('not-due', 'not-due')];
  const attempts = [
    completedAttempt({ id: 'due-1', actionId: 'due', outcome: 'incorrect', timestamp: NOW - DAY_MS }),
    completedAttempt({ id: 'not-due-1', actionId: 'not-due', outcome: 'unaided', timestamp: NOW })
  ];
  const duePractice = createSession(selectionCommands, {
    phase: 'driving', length: 'short', mode: 'weakest-first', attempts, now: NOW, rng: () => 0.5
  });
  const freePractice = createSession(selectionCommands, {
    phase: 'driving', length: 'all', mode: 'free', attempts, now: NOW, rng: () => 0.5
  });

  assert.deepEqual(duePractice.map(item => item.id), ['due', 'not-due']);
  assert.deepEqual(freePractice.map(item => item.id).sort(), ['due', 'not-due']);
  assert.equal(record({ attempts: [] }).attempt.weight, OUTCOME_WEIGHTS.unaided);
});

test('summarizes raw outcomes, unaided percentage, timing, dependence, and weakest actions', () => {
  const attempts = [
    { ...completedAttempt({ id: 'u', actionId: 'action-1', outcome: 'unaided', responseMs: 800 }), replays: 2, textShown: false },
    { ...completedAttempt({ id: 'a', actionId: 'action-1', outcome: 'assisted', responseMs: 1_200 }), replays: 0, textShown: true },
    { ...completedAttempt({ id: 'i', actionId: 'action-2', outcome: 'incorrect', responseMs: null }), replays: 1, textShown: false }
  ];
  const summary = summarizeSession(attempts, [command('d-1', 'action-1'), command('d-2', 'action-2')]);

  assert.deepEqual(summary.counts, { unaided: 1, assisted: 1, incorrect: 1 });
  assert.equal(summary.unaidedPercentage, 33);
  assert.equal(summary.averageResponseMs, 1_000);
  assert.equal(summary.replayCount, 3);
  assert.equal(summary.hintCount, 1);
  assert.deepEqual(summary.weakActions.map(item => item.actionId), ['action-2', 'action-1']);
});
