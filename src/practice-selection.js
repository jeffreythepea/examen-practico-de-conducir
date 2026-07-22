import { readinessForCatalog } from './readiness.js';

export const SESSION_LENGTHS = Object.freeze({ short: 5, medium: 10, all: 15 });

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

function groupByReadiness(commands, readinessRecords, now) {
  const groups = {
    'not-tested': [],
    'needs-practice': [],
    'due': [],
    'in-progress': [],
    'ready': []
  };

  for (const command of commands) {
    const record = readinessRecords.find(r => r.commandId === command.id);
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
  let eligibleCommands = uniqueCommands(commands);
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
  let selected = selectByTarget(eligibleCommands, readinessRecords, lessonFlags, target, now, commands);

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
    const shuffled = [
      ...fisherYatesShuffle(groups['not-tested'], rng),
      ...fisherYatesShuffle(groups['needs-practice'], rng),
      ...fisherYatesShuffle(groups['due'], rng),
      ...fisherYatesShuffle(groups['in-progress'], rng),
      ...fisherYatesShuffle(groups['ready'], rng)
    ];
    selected = shuffled;
  } else {
    // For other targets, shuffle the whole selection
    selected = fisherYatesShuffle(selected, rng);
  }

  // Slice to session length
  const targetLength = SESSION_LENGTHS[length];
  selected = selected.slice(0, targetLength);

  return Object.freeze(selected);
}
