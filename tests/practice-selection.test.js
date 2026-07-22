import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectPracticeCommands } from '../src/practice-selection.js';

function utcDate(year, month, day) {
  return Date.UTC(year, month, day);
}

function command(id, actionId, phase = 'driving') {
  return { id, actionId, phase, phrasings: [{ id: `${id}-canonical`, es: '', en: '' }] };
}

function attempt(outcome, timestamp, overrides = {}) {
  return {
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
    ...overrides
  };
}

// Test commands for the main tests - each designed to produce a specific readiness state
// NOW = June 10, 2026
const NOW = utcDate(2026, 5, 10); // Month is 0-indexed in Date.UTC, so 5 = June

// Commands for testing recommended priority ordering
const PRIORITY_COMMANDS = [
  command('unseen', 'unseen-action'),           // not-tested: no attempts
  command('missed', 'missed-action'),           // needs-practice: latest incorrect
  command('due-in-progress', 'due-action'),     // in-progress + due: 2 unaided distinct dates, last on June 9 -> nextDueAt = June 10 = NOW
  command('learning', 'learning-action'),       // in-progress + due: 1 unaided on June 5 -> nextDueAt = June 6 < NOW
  command('ready-cmd', 'ready-action'),         // ready: 3 unaided distinct dates (Jun 1,2,3), latest 2 unaided
  command('precheck-1', 'precheck-1', 'precheck'), // not-tested, precheck phase
];

const PRIORITY_ATTEMPTS = [
  // missed: unaided then incorrect (latest)
  attempt('unaided', utcDate(2026, 5, 1), { commandId: 'missed', actionId: 'missed-action' }),
  attempt('incorrect', utcDate(2026, 5, 2), { commandId: 'missed', actionId: 'missed-action' }),
  // due-in-progress: 2 unaided on distinct dates (Jun 8, 9), last unaided Jun 9 -> nextDueAt = Jun 10 = NOW
  attempt('unaided', utcDate(2026, 5, 8), { commandId: 'due-in-progress', actionId: 'due-action' }),
  attempt('unaided', utcDate(2026, 5, 9), { commandId: 'due-in-progress', actionId: 'due-action' }),
  // learning: 1 unaided on Jun 5 -> nextDueAt = Jun 6 < NOW (due)
  attempt('unaided', utcDate(2026, 5, 5), { commandId: 'learning', actionId: 'learning-action' }),
  // ready-cmd: 3 unaided on distinct dates Jun 1,2,3, latest 2 unaided
  attempt('unaided', utcDate(2026, 5, 1), { commandId: 'ready-cmd', actionId: 'ready-action' }),
  attempt('unaided', utcDate(2026, 5, 2), { commandId: 'ready-cmd', actionId: 'ready-action' }),
  attempt('unaided', utcDate(2026, 5, 3), { commandId: 'ready-cmd', actionId: 'ready-action' }),
];

const FLAG_OPEN = {
  id: 'flag-1',
  commandId: 'c-der',
  category: 'wording',
  note: 'Instructor used shorter phrase.',
  createdAt: utcDate(2026, 5, 1),
  updatedAt: utcDate(2026, 5, 1),
  status: 'open',
};

const FLAG_RESOLVED = {
  id: 'flag-2',
  commandId: 'c-izq',
  category: 'audio',
  note: 'Audio volume low.',
  createdAt: utcDate(2026, 5, 1),
  updatedAt: utcDate(2026, 5, 2),
  status: 'resolved',
};

// Commands for lesson-flags tests
const FLAG_COMMANDS = [
  command('c-der', 'turn-right'),
  command('c-izq', 'turn-left'),
];

test('recommended orders unseen before needs-practice before due before in-progress before ready', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  // With rng=0, Fisher-Yates reverses pairs within each priority group
  // not-tested: [unseen, precheck-1] -> reversed to [precheck-1, unseen]
  // needs-practice: [missed] -> stays [missed]
  // due: [due-in-progress, learning] -> reversed to [learning, due-in-progress]
  // ready: [ready-cmd] -> stays [ready-cmd]
  const expected = ['precheck-1', 'unseen', 'missed', 'learning', 'due-in-progress', 'ready-cmd'];
  assert.deepEqual(selected.map(c => c.id), expected);
});

test('lesson flag target includes only commands with open flags', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: [FLAG_OPEN, FLAG_RESOLVED],
    now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['c-der']);
});

test('needs-practice target filters to needs-practice commands', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'needs-practice' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['missed']);
});

test('not-tested target filters to not-tested commands', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'not-tested' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  // unseen and precheck-1 have no attempts
  assert.deepEqual(selected.map(c => c.id).sort(), ['unseen', 'precheck-1'].sort());
});

test('not-ready target includes needs-practice, in-progress, and not-tested', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'not-ready' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  // All except ready-cmd
  const expected = ['unseen', 'precheck-1', 'missed', 'due-in-progress', 'learning'];
  assert.deepEqual(selected.map(c => c.id).sort(), expected.sort());
});

test('command target returns that single command', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'command', commandId: 'c-der' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['c-der']);
});

test('command target throws if command not found', () => {
  assert.throws(() => selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'command', commandId: 'unknown' },
    attempts: [], now: NOW, rng: () => 0
  }), /Command not found/);
});

test('command target throws if command outside selected phase', () => {
  // precheck-cmd exists in original commands but not in driving phase filtered commands
  const mixedCmds = [command('driving-cmd', 'a'), command('precheck-cmd', 'b', 'precheck')];
  // Should work in mixed phase
  const mixed = selectPracticeCommands(mixedCmds, {
    phase: 'mixed', length: 'all', target: { kind: 'command', commandId: 'precheck-cmd' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(mixed[0].id, 'precheck-cmd');
  // Should throw in driving phase because precheck-cmd is not in driving phase
  assert.throws(() => selectPracticeCommands(mixedCmds, {
    phase: 'driving', length: 'all', target: { kind: 'command', commandId: 'precheck-cmd' },
    attempts: [], now: NOW, rng: () => 0
  }), /not in selected phase/);
});

test('free target returns all phase-eligible commands', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'driving', length: 'all', target: { kind: 'free' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 2);
});

test('phase filtering applied before target selection', () => {
  const cmds = [command('driving-1', 'a'), command('precheck-1', 'b', 'precheck')];
  const selected = selectPracticeCommands(cmds, {
    phase: 'precheck', length: 'all', target: { kind: 'recommended' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['precheck-1']);
});

test('length short limits to 5', () => {
  const cmds = [command('a', 'a'), command('b', 'b'), command('c', 'c'), command('d', 'd'), command('e', 'e'), command('f', 'f')];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'short', target: { kind: 'recommended' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 5);
});

test('length medium limits to 10', () => {
  const cmds = Array.from({ length: 15 }, (_, i) => command(`c${i}`, `a${i}`));
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'medium', target: { kind: 'recommended' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 10);
});

test('length all returns all eligible', () => {
  const cmds = [command('a', 'a'), command('b', 'b'), command('c', 'c')];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 3);
});

test('shuffle within equal priority using injected rng', () => {
  const cmds = [
    command('a', 'a'), command('b', 'b'), command('c', 'c'),
    command('d', 'd'), command('e', 'e'),
  ];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: [], now: NOW, rng: () => 0.5
  });
  assert.equal(selected.length, 5);
});

test('never duplicates commands', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  const ids = selected.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('deduplicates repeated command records by stable ID', () => {
  const repeated = [command('a', 'a'), command('a', 'a'), command('b', 'b')];
  const selected = selectPracticeCommands(repeated, {
    phase: 'mixed', length: 'all', target: { kind: 'free' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.deepEqual(new Set(selected.map(command => command.id)), new Set(['a', 'b']));
  assert.equal(selected.length, 2);
});

test('a boundary RNG value never inserts an undefined command', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 1
  });
  assert.equal(selected.length, PRIORITY_COMMANDS.length);
  assert.equal(selected.every(Boolean), true);
});

test('does not pad beyond selected target', () => {
  const cmds = [command('a', 'a'), command('b', 'b')];
  const attempts = [attempt('incorrect', NOW, { commandId: 'a', actionId: 'a' })];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'all', target: { kind: 'needs-practice' },
    attempts, now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 1);
});

test('recommended includes due non-ready commands before non-due in-progress', () => {
  const cmds = [
    command('due-in-progress', 'due-in-progress'),
    command('not-due-in-progress', 'not-due-in-progress'),
    command('ready-cmd', 'ready-cmd'),
  ];
  // NOW = June 10, 2026 (utcDate(2026, 5, 10))
  // To get a due command, we need nextDueAt <= NOW.
  // After 1 unaided: nextDueAt = timestamp + 1 day
  // So if we have 1 unaided on June 8, nextDueAt = June 9 < NOW (due)
  // not-due-in-progress: 1 unaided on Jun 10 (NOW) -> nextDueAt = Jun 11 > NOW (not due)
  // ready-cmd: 3 unaided distinct dates, latest 2 unaided
  const attempts = [
    // due-in-progress: 1 unaided on Jun 8 -> nextDueAt = Jun 9 <= NOW (due)
    attempt('unaided', utcDate(2026, 5, 8), { commandId: 'due-in-progress', actionId: 'due-in-progress' }),
    // not-due-in-progress: 1 unaided on NOW (Jun 10) -> nextDueAt = Jun 11 > NOW (not due)
    attempt('unaided', utcDate(2026, 5, 10), { commandId: 'not-due-in-progress', actionId: 'not-due-in-progress' }),
    // ready-cmd: 3 unaided distinct dates, latest 2 unaided
    attempt('unaided', utcDate(2026, 5, 1), { commandId: 'ready-cmd', actionId: 'ready-cmd' }),
    attempt('unaided', utcDate(2026, 5, 2), { commandId: 'ready-cmd', actionId: 'ready-cmd' }),
    attempt('unaided', utcDate(2026, 5, 3), { commandId: 'ready-cmd', actionId: 'ready-cmd' }),
  ];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts, now: NOW, rng: () => 0
  });
  const ids = selected.map(c => c.id);
  // due-in-progress (due) should come before not-due-in-progress (in-progress not due)
  // ready-cmd (ready) should come last
  const dueIdx = ids.indexOf('due-in-progress');
  const notDueIdx = ids.indexOf('not-due-in-progress');
  const readyIdx = ids.indexOf('ready-cmd');
  assert(dueIdx < notDueIdx, 'due-in-progress should come before not-due-in-progress');
  assert(notDueIdx < readyIdx, 'not-due-in-progress should come before ready');
});

test('unknown phase throws', () => {
  assert.throws(() => selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'unknown', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  }), /Unknown phase/);
});

test('unknown length throws', () => {
  assert.throws(() => selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'unknown', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  }), /Unknown session length/);
});

test('unknown target kind throws', () => {
  assert.throws(() => selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'unknown' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  }), /Unknown target kind/);
});

test('input commands array not mutated', () => {
  const cmds = [...PRIORITY_COMMANDS];
  selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  assert.equal(cmds.length, PRIORITY_COMMANDS.length);
});

test('input attempts array not mutated', () => {
  const attempts = [...PRIORITY_ATTEMPTS];
  selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts, now: NOW, rng: () => 0
  });
  assert.equal(attempts.length, PRIORITY_ATTEMPTS.length);
});

test('input flags array not mutated', () => {
  const flags = [FLAG_OPEN, FLAG_RESOLVED];
  selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: flags, now: NOW, rng: () => 0
  });
  assert.equal(flags.length, 2);
});

test('lesson-flags target excludes resolved flags', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: [FLAG_OPEN, FLAG_RESOLVED], now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['c-der']);
});

test('lesson-flags target handles duplicate flags for same command', () => {
  const flag2 = { ...FLAG_OPEN, id: 'flag-3' };
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: [FLAG_OPEN, flag2], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 1);
});

test('recommended priority: not-tested > needs-practice > due > in-progress > ready', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  const ids = selected.map(c => c.id);
  // With rng=0, Fisher-Yates reverses pairs:
  // not-tested: [precheck-1, unseen] (first 2)
  // needs-practice: [missed] (index 2)
  // due: [learning, due-in-progress] (indices 3, 4)
  // ready: [ready-cmd] (last)
  assert.equal(ids.indexOf('unseen'), 1);
  assert.equal(ids.indexOf('precheck-1'), 0);
  assert.equal(ids.indexOf('missed'), 2);
  // due commands before ready
  assert(ids.indexOf('due-in-progress') < ids.indexOf('ready-cmd'));
  assert(ids.indexOf('learning') < ids.indexOf('ready-cmd'));
  // ready last
  assert.equal(ids.indexOf('ready-cmd'), ids.length - 1);
});

test('lesson-flags target returns empty array when no open flags', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: [FLAG_RESOLVED], now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), []);
});

test('command target with free practice length returns just that command', () => {
  const selected = selectPracticeCommands(FLAG_COMMANDS, {
    phase: 'mixed', length: 'short', target: { kind: 'command', commandId: 'c-der' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(c => c.id), ['c-der']);
});

test('command target throws if command outside selected phase', () => {
  // precheck-cmd exists in original commands but not in driving phase filtered commands
  const mixedCmds = [command('driving-cmd', 'a'), command('precheck-cmd', 'b', 'precheck')];
  // Should work in mixed phase
  const mixed = selectPracticeCommands(mixedCmds, {
    phase: 'mixed', length: 'all', target: { kind: 'command', commandId: 'precheck-cmd' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(mixed[0].id, 'precheck-cmd');
  // Should throw in driving phase because precheck-cmd is not in driving phase
  assert.throws(() => selectPracticeCommands(mixedCmds, {
    phase: 'driving', length: 'all', target: { kind: 'command', commandId: 'precheck-cmd' },
    attempts: [], now: NOW, rng: () => 0
  }), /not in selected phase/);
});

test('free target respects length limit', () => {
  const cmds = [command('a', 'a'), command('b', 'b'), command('c', 'c')];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'short', target: { kind: 'free' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 3); // short=5 but only 3 commands
});

test('lesson-flags target respects length limit', () => {
  const cmds = [command('a', 'a'), command('b', 'b'), command('c', 'c')];
  const flags = [
    { id: 'f1', commandId: 'a', category: 'wording', note: 'x', createdAt: NOW, updatedAt: NOW, status: 'open' },
    { id: 'f2', commandId: 'b', category: 'audio', note: 'y', createdAt: NOW, updatedAt: NOW, status: 'open' },
  ];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'short', target: { kind: 'lesson-flags' },
    lessonFlags: flags, now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 2); // only 2 flagged commands
});

test('not-tested target respects length limit', () => {
  const cmds = Array.from({ length: 10 }, (_, i) => command(`c${i}`, `a${i}`));
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'short', target: { kind: 'not-tested' },
    attempts: [], now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 5);
});

test('needs-practice target respects length limit', () => {
  const cmds = [
    command('a', 'a'), command('b', 'b'), command('c', 'c'), command('d', 'd'), command('e', 'e'), command('f', 'f'),
  ];
  const attempts = [
    attempt('incorrect', NOW, { commandId: 'a', actionId: 'a' }),
    attempt('incorrect', NOW, { commandId: 'b', actionId: 'b' }),
    attempt('incorrect', NOW, { commandId: 'c', actionId: 'c' }),
    attempt('incorrect', NOW, { commandId: 'd', actionId: 'd' }),
    attempt('incorrect', NOW, { commandId: 'e', actionId: 'e' }),
    attempt('incorrect', NOW, { commandId: 'f', actionId: 'f' }),
  ];
  const selected = selectPracticeCommands(cmds, {
    phase: 'mixed', length: 'short', target: { kind: 'needs-practice' },
    attempts, now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 5); // short=5
});

test('recommended target with short length returns top 5 by priority', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'short', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  assert.equal(selected.length, 5);
  // Top 5 should be: unseen, precheck-1, missed, due-in-progress, learning
  const ids = selected.map(c => c.id);
  assert(ids.includes('unseen'));
  assert(ids.includes('precheck-1'));
  assert(ids.includes('missed'));
  assert(ids.includes('due-in-progress'));
  assert(ids.includes('learning'));
  assert(!ids.includes('ready-cmd'));
});

test('returned array is frozen', () => {
  const selected = selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'recommended' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  });
  assert.throws(() => { selected.push({}); }, /extensible|frozen/);
});

test('command target throws if commandId missing', () => {
  assert.throws(() => selectPracticeCommands(PRIORITY_COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'command' },
    attempts: PRIORITY_ATTEMPTS, now: NOW, rng: () => 0
  }), /commandId/);
});
