import { readinessForCatalog } from './readiness.js';
import { activeCommands } from './catalog.js';

// The medium default is sized so a mixed simulated drive carries enough
// ordinary driving commands for cruise transitions and an occasional null
// event, closer to a real exam's pacing.
export const SESSION_LENGTHS = Object.freeze({ short: 5, medium: 20, all: 25 });

// Prechecks are the formality that opens an exam, not the drive itself: at
// Jeffrey's first lesson (2026-08-17) the examiner asks exactly one. Hold them
// to a tenth of the session, floored, never more than three, but never below
// one so a short session can still open on a check.
export const PRECHECK_SESSION_SHARE = 0.1;
export const PRECHECK_SESSION_MAX = 3;

export function precheckCap(targetLength) {
  return Math.min(PRECHECK_SESSION_MAX, Math.max(1, Math.floor(targetLength * PRECHECK_SESSION_SHARE)));
}

// The cap is a preference for driving commands, not a length limit: when there
// are too few driving commands to take the freed places — a precheck-only
// phase, or a target whose whole selection is prechecks — the extra prechecks
// stay in and the session keeps its length. The longest session is sized just
// above the driving catalog (25 against 21 driving commands), so its last few
// places are prechecks until more driving commands land. Relative order is
// untouched, so the stratified merge above still holds.
function withPrecheckCap(ordered, targetLength) {
  const drivingAvailable = ordered.filter(command => command.phase !== 'precheck').length;
  const cap = Math.max(precheckCap(targetLength), targetLength - drivingAvailable);
  let used = 0;
  return ordered.filter(command => {
    if (command.phase !== 'precheck') return true;
    if (used >= cap) return false;
    used += 1;
    return true;
  });
}

function fisherYatesShuffle(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueCommands(commands) {
  const ids = new Set();
  return commands.filter(command => {
    if (ids.has(command.id)) return false;
    ids.add(command.id);
    return true;
  });
}

// Interleaves an already-shuffled group's driving/precheck commands (a stratified
// merge) so a mixed session can't front-load one phase by chance. Each phase's
// shuffled relative order is preserved; the leading phase is chosen with the
// injected rng so neither phase is systematically favored; leftovers from
// whichever phase runs out first are appended in their shuffled order.
function stratifyByPhase(group, rng) {
  const driving = group.filter(command => command.phase === 'driving');
  const precheck = group.filter(command => command.phase === 'precheck');
  const other = group.filter(command => command.phase !== 'driving' && command.phase !== 'precheck');
  const buckets = rng() < 0.5 ? [driving, precheck] : [precheck, driving];
  const indices = [0, 0];
  const merged = [];
  while (indices[0] < buckets[0].length || indices[1] < buckets[1].length) {
    for (let bucket = 0; bucket < 2; bucket += 1) {
      if (indices[bucket] < buckets[bucket].length) merged.push(buckets[bucket][indices[bucket]++]);
    }
  }
  return [...merged, ...other];
}

function groupByReadiness(commands, readinessRecords, now) {
  const groups = {
    'not-tested': [],
    'needs-practice': [],
    'due': [],
    'in-progress': [],
    'ready': []
  };

  const recordsByCommand = new Map(readinessRecords.map(record => [record.commandId, record]));
  for (const command of commands) {
    const record = recordsByCommand.get(command.id);
    const state = record?.state ?? 'not-tested';

    if (state === 'not-tested') {
      groups['not-tested'].push(command);
    } else if (state === 'needs-practice') {
      groups['needs-practice'].push(command);
    } else if (state === 'ready') {
      groups['ready'].push(command);
    } else if (state === 'in-progress') {
      // Check if due (nextDueAt <= now)
      const nextDueAt = record?.nextDueAt ?? null;
      if (nextDueAt !== null && nextDueAt <= now) {
        groups['due'].push(command);
      } else {
        groups['in-progress'].push(command);
      }
    }
  }

  return groups;
}

function selectByTarget(commands, readinessRecords, lessonFlags, target, now, originalCommands) {
  const flags = lessonFlags.filter(f => f.status === 'open');

  switch (target.kind) {
    case 'recommended': {
      // All commands, ordered by priority groups
      const groups = groupByReadiness(commands, readinessRecords, now);
      return [
        ...groups['not-tested'],
        ...groups['needs-practice'],
        ...groups['due'],
        ...groups['in-progress'],
        ...groups['ready']
      ];
    }
    case 'needs-practice': {
      const groups = groupByReadiness(commands, readinessRecords, now);
      return groups['needs-practice'];
    }
    case 'not-tested': {
      const groups = groupByReadiness(commands, readinessRecords, now);
      return groups['not-tested'];
    }
    case 'lesson-flags': {
      const flaggedCommandIds = new Set(flags.map(f => f.commandId));
      return commands.filter(c => flaggedCommandIds.has(c.id));
    }
    case 'not-ready': {
      return commands.filter(c => {
        const record = readinessRecords.find(r => r.commandId === c.id);
        const state = record?.state ?? 'not-tested';
        return state !== 'ready';
      });
    }
    case 'command': {
      // Look up in original commands (not phase-filtered)
      const command = originalCommands.find(c => c.id === target.commandId);
      if (!command) {
        throw new Error(`Command not found: ${target.commandId}`);
      }
      return [command];
    }
    case 'free': {
      return commands;
    }
    default:
      throw new Error(`Unknown target kind: ${target.kind}`);
  }
}

export function selectPracticeCommands(commands, {
  phase,
  length,
  target = { kind: 'recommended' },
  attempts = [],
  lessonFlags = [],
  now = Date.now(),
  rng = Math.random
}) {
  // Phase filtering first, while enforcing stable command identity.
  let eligibleCommands = uniqueCommands(activeCommands(commands));
  if (phase !== 'mixed') {
    eligibleCommands = eligibleCommands.filter(c => c.phase === phase);
  }

  // Validate phase
  if (!['driving', 'precheck', 'mixed'].includes(phase)) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  // Validate length
  if (!SESSION_LENGTHS.hasOwnProperty(length)) {
    throw new Error(`Unknown session length: ${length}`);
  }

  // Validate target
  const validTargets = ['recommended', 'needs-practice', 'not-tested', 'lesson-flags', 'not-ready', 'command', 'free'];
  if (!validTargets.includes(target.kind)) {
    throw new Error(`Unknown target kind: ${target.kind}`);
  }
  if (target.kind === 'command' && !target.commandId) {
    throw new Error('command target requires commandId');
  }

  // Get readiness for all eligible commands
  const readinessRecords = readinessForCatalog(eligibleCommands, attempts, lessonFlags, now);

  // Select by target - pass original commands for command target lookup
  let selected = selectByTarget(
    eligibleCommands,
    readinessRecords,
    lessonFlags,
    target,
    now,
    activeCommands(commands)
  );

  // For command target, validate it's in the eligible phase
  if (target.kind === 'command') {
    const command = selected[0];
    if (!command || (phase !== 'mixed' && command.phase !== phase)) {
      throw new Error(`Command ${target.commandId} not in selected phase`);
    }
  }

  // Shuffle within equal priority using injected RNG
  // For recommended target, we already have priority groups - shuffle within each
  if (target.kind === 'recommended') {
    // Need to re-group and shuffle within each group
    const groups = groupByReadiness(eligibleCommands, readinessRecords, now);
    const shuffleGroup = phase === 'mixed'
      ? group => stratifyByPhase(fisherYatesShuffle(group, rng), rng)
      : group => fisherYatesShuffle(group, rng);
    const shuffled = [
      ...shuffleGroup(groups['not-tested']),
      ...shuffleGroup(groups['needs-practice']),
      ...shuffleGroup(groups['due']),
      ...shuffleGroup(groups['in-progress']),
      ...shuffleGroup(groups['ready'])
    ];
    selected = shuffled;
  } else {
    // For other targets, shuffle the whole selection
    selected = fisherYatesShuffle(selected, rng);
  }

  // Slice to session length
  const targetLength = SESSION_LENGTHS[length];
  selected = withPrecheckCap(selected, targetLength).slice(0, targetLength);

  return Object.freeze(selected);
}
