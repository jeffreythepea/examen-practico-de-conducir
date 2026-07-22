import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  READINESS_STATES,
  readinessForCommand,
  readinessForCatalog,
} from '../src/readiness.js';

const DAY_MS = 86_400_000;

function utcDate(year, month, day) {
  return Date.UTC(year, month, day);
}

function attempt(outcome, timestamp, overrides = {}) {
  const base = {
    id: `attempt-${outcome}-${timestamp}`,
    timestamp,
    commandId: 'c-der',
    actionId: 'turn-right',
    phrasingId: 'p1',
    voiceId: 'v1',
    speed: 1,
    phase: 'driving',
    surfaceId: 's1',
    selectedResult: 'right',
    outcome,
    weight: outcome === 'unaided' ? 1 : outcome === 'assisted' ? 0.5 : 0,
    responseMs: 1000,
    replays: 0,
    textShown: outcome === 'assisted',
    timed: true,
    timeout: outcome === 'incorrect',
  };
  return { ...base, ...overrides };
}

const COMMAND = {
  id: 'c-der',
  actionId: 'turn-right',
  phase: 'driving',
  phrasings: [{ id: 'p1', text: 'Gire a la derecha' }],
};

const FLAG_OPEN = {
  id: 'flag-1',
  commandId: 'c-der',
  category: 'wording',
  note: 'Instructor used shorter phrase.',
  createdAt: utcDate(2026, 6, 1),
  updatedAt: utcDate(2026, 6, 1),
  status: 'open',
};

const FLAG_RESOLVED = {
  id: 'flag-2',
  commandId: 'c-der',
  category: 'audio',
  note: 'Audio volume low.',
  createdAt: utcDate(2026, 6, 1),
  updatedAt: utcDate(2026, 6, 2),
  status: 'resolved',
};

const FLAG_OTHER_COMMAND = {
  id: 'flag-3',
  commandId: 'c-izq',
  category: 'visual',
  note: 'Arrow unclear.',
  createdAt: utcDate(2026, 6, 1),
  updatedAt: utcDate(2026, 6, 1),
  status: 'open',
};

test('READINESS_STATES exports the four states in correct order', () => {
  assert.deepEqual(READINESS_STATES, Object.freeze([
    'ready', 'in-progress', 'needs-practice', 'not-tested'
  ]));
});

test('no scored attempt returns not-tested', () => {
  const result = readinessForCommand(COMMAND, [], [], Date.now());
  assert.equal(result.state, 'not-tested');
  assert.deepEqual(result.recentOutcomes, []);
  assert.equal(result.lastPracticedAt, null);
  assert.equal(result.averageResponseMs, null);
  assert.equal(result.replayCount, 0);
  assert.equal(result.hintCount, 0);
  assert.equal(result.openLessonFlagCount, 0);
  assert.equal(result.nextDueAt, null);
});

test('latest incorrect returns needs-practice', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('incorrect', utcDate(2026, 6, 2)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 3));
  assert.equal(result.state, 'needs-practice');
});

test('latest assisted returns needs-practice', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('assisted', utcDate(2026, 6, 2)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 3));
  assert.equal(result.state, 'needs-practice');
});

test('ready requires three distinct UTC dates and latest two unaided', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 2)),
    attempt('unaided', utcDate(2026, 6, 3)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.state, 'ready');
});

test('latest assisted after three unaided dates returns needs-practice', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 2)),
    attempt('unaided', utcDate(2026, 6, 3)),
    attempt('assisted', utcDate(2026, 6, 4)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 5));
  assert.equal(result.state, 'needs-practice');
});

test('latest incorrect after three unaided dates returns needs-practice', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 2)),
    attempt('unaided', utcDate(2026, 6, 3)),
    attempt('incorrect', utcDate(2026, 6, 4)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 5));
  assert.equal(result.state, 'needs-practice');
});

test('three unaided but not three distinct UTC dates returns in-progress', () => {
  const sameDay = utcDate(2026, 6, 1);
  const attempts = [
    attempt('unaided', sameDay),
    attempt('unaided', sameDay + 3600000),
    attempt('unaided', sameDay + 7200000),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], sameDay + DAY_MS);
  assert.equal(result.state, 'in-progress');
});

test('two unaided distinct dates and one assisted returns in-progress', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('assisted', utcDate(2026, 6, 2)),
    attempt('unaided', utcDate(2026, 6, 3)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.state, 'in-progress');
});

test('single unaided returns in-progress', () => {
  const attempts = [attempt('unaided', utcDate(2026, 6, 1))];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 2));
  assert.equal(result.state, 'in-progress');
});

test('recentOutcomes newest-first maximum five', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 2)),
    attempt('unaided', utcDate(2026, 6, 3)),
    attempt('unaided', utcDate(2026, 6, 4)),
    attempt('unaided', utcDate(2026, 6, 5)),
    attempt('unaided', utcDate(2026, 6, 6)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 7));
  assert.equal(result.recentOutcomes.length, 5);
  assert.equal(result.recentOutcomes[0], 'unaided');
  assert.equal(result.recentOutcomes[4], 'unaided');
});

test('recentOutcomes sorts newest first regardless of input order', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 3)),
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 2)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.deepEqual(result.recentOutcomes, ['unaided', 'unaided', 'unaided']);
});

test('lastPracticedAt is latest attempt timestamp', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    attempt('unaided', utcDate(2026, 6, 3)),
    attempt('unaided', utcDate(2026, 6, 2)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.lastPracticedAt, utcDate(2026, 6, 3));
});

test('averageResponseMs averages only finite responseMs', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1), { responseMs: 1000 }),
    attempt('unaided', utcDate(2026, 6, 2), { responseMs: 2000 }),
    attempt('unaided', utcDate(2026, 6, 3), { responseMs: null }),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.averageResponseMs, 1500);
});

test('replayCount sums replays from matching attempts', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1), { replays: 2 }),
    attempt('unaided', utcDate(2026, 6, 2), { replays: 1 }),
    attempt('unaided', utcDate(2026, 6, 3), { replays: 0 }),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.replayCount, 3);
});

test('hintCount counts textShown as hint use', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1), { textShown: false }),
    attempt('assisted', utcDate(2026, 6, 2), { textShown: true }),
    attempt('unaided', utcDate(2026, 6, 3), { textShown: true }),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.hintCount, 2);
});

test('openLessonFlagCount counts only open flags matching commandId', () => {
  const flags = [FLAG_OPEN, FLAG_RESOLVED, FLAG_OTHER_COMMAND];
  const attempts = [attempt('unaided', utcDate(2026, 6, 1))];
  const result = readinessForCommand(COMMAND, attempts, flags, utcDate(2026, 6, 2));
  assert.equal(result.openLessonFlagCount, 1);
});

test('nextDueAt comes from masteryForAction via actionId', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 2));
  // scheduleAfterAttempt for unaided adds 1 day
  assert.equal(result.nextDueAt, utcDate(2026, 6, 2));
});
test('readinessForCommand does not mutate input attempts', () => {
  const attempts = [attempt('unaided', utcDate(2026, 6, 1))];
  const originalLength = attempts.length;
  readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 2));
  assert.equal(attempts.length, originalLength);
});

test('readinessForCommand does not mutate input flags', () => {
  const flags = [FLAG_OPEN];
  const originalLength = flags.length;
  readinessForCommand(COMMAND, [], flags, utcDate(2026, 6, 2));
  assert.equal(flags.length, originalLength);
});

test('readinessForCatalog returns frozen array of records', () => {
  const commands = [
    { id: 'c-der', actionId: 'turn-right', phase: 'driving' },
    { id: 'c-izq', actionId: 'turn-left', phase: 'driving' },
  ];
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1)),
    { ...attempt('unaided', utcDate(2026, 6, 2)), commandId: 'c-izq', actionId: 'turn-left' },
  ];
  const result = readinessForCatalog(commands, attempts, [], utcDate(2026, 6, 3));
  assert.equal(result.length, 2);
  assert.equal(result[0].commandId, 'c-der');
  assert.equal(result[1].commandId, 'c-izq');
  // The array itself is frozen (not extensible)
  assert.throws(() => { result.push({}); }, /extensible|frozen/);
  // The elements are already frozen by readinessForCommand
  assert.throws(() => { result[0].state = 'hacked'; }, /read only|frozen/);
});

test('readinessForCatalog does not mutate inputs', () => {
  const commands = [{ id: 'c-der', actionId: 'turn-right', phase: 'driving' }];
  const attempts = [attempt('unaided', utcDate(2026, 6, 1))];
  const flags = [FLAG_OPEN];
  readinessForCatalog(commands, attempts, flags, utcDate(2026, 6, 2));
  assert.equal(commands.length, 1);
  assert.equal(attempts.length, 1);
  assert.equal(flags.length, 1);
});

test('readinessForCommand uses injected now for nextDueAt scheduling', () => {
  const attempts = [attempt('incorrect', utcDate(2026, 6, 1))];
  const now = utcDate(2026, 6, 5);
  const result = readinessForCommand(COMMAND, attempts, [], now);
  // incorrect resets to attempt timestamp
  assert.equal(result.nextDueAt, utcDate(2026, 6, 1));
});

test('cross-command isolation: attempts for other commands do not affect readiness', () => {
  const attempts = [
    attempt('incorrect', utcDate(2026, 6, 1)),
    { ...attempt('unaided', utcDate(2026, 6, 2)), commandId: 'c-izq', actionId: 'turn-left' },
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 3));
  assert.equal(result.state, 'needs-practice');
});

test('recentOutcomes only includes matching commandId attempts', () => {
  const attempts = [
    attempt('incorrect', utcDate(2026, 6, 1)),
    { ...attempt('unaided', utcDate(2026, 6, 2)), commandId: 'c-izq', actionId: 'turn-left' },
    attempt('unaided', utcDate(2026, 6, 3)),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 4));
  assert.equal(result.recentOutcomes.length, 2);
  assert.deepEqual(result.recentOutcomes, ['unaided', 'incorrect']);
});

test('averageResponseMs is null when no finite responseMs', () => {
  const attempts = [
    attempt('unaided', utcDate(2026, 6, 1), { responseMs: null }),
    attempt('unaided', utcDate(2026, 6, 2), { responseMs: undefined }),
  ];
  const result = readinessForCommand(COMMAND, attempts, [], utcDate(2026, 6, 3));
  assert.equal(result.averageResponseMs, null);
});

test('readinessForCommand uses actionId from command for nextDueAt', () => {
  const customCommand = {
    id: 'c-custom',
    actionId: 'custom-action',
    phase: 'precheck',
    phrasings: [{ id: 'p1', text: 'Check' }],
  };
  const attempts = [
    { ...attempt('unaided', utcDate(2026, 6, 1)), actionId: 'custom-action' },
  ];
  const result = readinessForCommand(customCommand, attempts, [], utcDate(2026, 6, 2));
  assert.equal(result.nextDueAt, utcDate(2026, 6, 2)); // unaided -> +1 day
});

test('phase is carried from command', () => {
  const precheckCommand = { ...COMMAND, phase: 'precheck' };
  const attempts = [attempt('unaided', utcDate(2026, 6, 1))];
  const result = readinessForCommand(precheckCommand, attempts, [], utcDate(2026, 6, 2));
  assert.equal(result.phase, 'precheck');
});

test('actionId is carried from command', () => {
  const result = readinessForCommand(COMMAND, [], [], Date.now());
  assert.equal(result.actionId, 'turn-right');
});
