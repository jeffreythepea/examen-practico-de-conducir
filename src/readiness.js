import { masteryForAction } from './training.js';

export const READINESS_STATES = Object.freeze([
  'ready', 'in-progress', 'needs-practice', 'not-tested'
]);

function toUTCDateString(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function readinessForCommand(command, attempts, lessonFlags = [], now = Date.now()) {
  const commandAttempts = attempts
    .filter(attempt => attempt.commandId === command.id)
    .toSorted((left, right) => right.timestamp - left.timestamp); // newest first

  let state;
  if (commandAttempts.length === 0) {
    state = 'not-tested';
  } else {
    const latest = commandAttempts[0];
    if (latest.outcome === 'incorrect' || latest.outcome === 'assisted') {
      state = 'needs-practice';
    } else {
      // Latest is unaided
      const unaidedDates = new Set(
        commandAttempts
          .filter(a => a.outcome === 'unaided')
          .map(a => toUTCDateString(a.timestamp))
      );
      const recentTwo = commandAttempts.slice(0, 2);
      if (unaidedDates.size >= 3 && recentTwo.length === 2 && recentTwo.every(a => a.outcome === 'unaided')) {
        state = 'ready';
      } else {
        state = 'in-progress';
      }
    }
  }

  const recentOutcomes = commandAttempts
    .slice(0, 5)
    .map(a => a.outcome);

  const lastPracticedAt = commandAttempts.length > 0 ? commandAttempts[0].timestamp : null;

  const responseTimes = commandAttempts
    .map(a => a.responseMs)
    .filter(Number.isFinite);
  const averageResponseMs = responseTimes.length === 0
    ? null
    : responseTimes.reduce((sum, v) => sum + v, 0) / responseTimes.length;

  const replayCount = commandAttempts
    .reduce((sum, a) => sum + (a.replays ?? 0), 0);

  const hintCount = commandAttempts
    .filter(a => a.textShown)
    .length;

  const openLessonFlagCount = lessonFlags
    .filter(flag => flag.commandId === command.id && flag.status === 'open')
    .length;

  // Use masteryForAction for nextDueAt based on actionId
  const mastery = masteryForAction(attempts, command.actionId);
  const nextDueAt = mastery.nextDueAt ?? null;

  const record = Object.freeze({
    commandId: command.id,
    actionId: command.actionId,
    phase: command.phase,
    state,
    recentOutcomes: Object.freeze(recentOutcomes),
    lastPracticedAt,
    averageResponseMs,
    replayCount,
    hintCount,
    openLessonFlagCount,
    nextDueAt
  });

  return record;
}

export function readinessForCatalog(commands, attempts, lessonFlags = [], now = Date.now()) {
  const records = commands.map(command =>
    readinessForCommand(command, attempts, lessonFlags, now)
  );
  return Object.freeze(records);
}
