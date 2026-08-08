export const RETENTION_DAYS = 90;
export const RECENT_KEEP_COUNT = 10;

const DAY_MS = 86_400_000;
const OUTCOMES = new Set(['unaided', 'assisted', 'incorrect']);

function toUTCDateString(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Bounds the growth of state.attempts. Keeps every attempt from the last
 * RETENTION_DAYS days; for older attempts keeps, per command, the first
 * unaided attempt of each distinct UTC date plus the command's
 * RECENT_KEEP_COUNT most recent attempts, and drops the rest. Attempts
 * referenced by state.activeSession.attemptIds are always kept.
 *
 * Readiness depends on the kept set: distinct unaided UTC dates per command
 * survive exactly, and the most recent attempts per command survive in full
 * fidelity, so readinessForCommand state and masteryForAction ready flags
 * are unchanged by compaction.
 *
 * @param {{ attempts: Array<object>, activeSession?: { attemptIds: Array<string> } | null }} state
 * @param {number} now
 */
export function compactAttempts(state, now = Date.now()) {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('Invalid state');
  }
  if (!Array.isArray(state.attempts)) throw new Error('Invalid state.attempts');
  if (typeof now !== 'number' || !Number.isFinite(now)) throw new Error('Invalid now');

  const attempts = state.attempts;
  attempts.forEach((attempt, index) => validateCompactableAttempt(attempt, `attempts[${index}]`));

  const cutoff = now - RETENTION_DAYS * DAY_MS;
  const pinnedIds = new Set(state.activeSession?.attemptIds ?? []);

  const keptIndexes = new Set();
  const indexesByCommand = new Map();
  attempts.forEach((attempt, index) => {
    const commandIndexes = indexesByCommand.get(attempt.commandId);
    if (commandIndexes === undefined) {
      indexesByCommand.set(attempt.commandId, [index]);
    } else {
      commandIndexes.push(index);
    }
  });

  for (const commandIndexes of indexesByCommand.values()) {
    // Newest first with the same stable ordering readiness uses.
    const newestFirst = commandIndexes.toSorted(
      (left, right) => attempts[right].timestamp - attempts[left].timestamp
    );
    for (const index of newestFirst.slice(0, RECENT_KEEP_COUNT)) keptIndexes.add(index);

    const seenUnaidedDates = new Set();
    const oldestFirst = commandIndexes.toSorted(
      (left, right) => attempts[left].timestamp - attempts[right].timestamp
    );
    for (const index of oldestFirst) {
      const attempt = attempts[index];
      if (attempt.outcome !== 'unaided') continue;
      const date = toUTCDateString(attempt.timestamp);
      if (seenUnaidedDates.has(date)) continue;
      seenUnaidedDates.add(date);
      keptIndexes.add(index);
    }
  }

  const kept = attempts.filter((attempt, index) =>
    attempt.timestamp >= cutoff || pinnedIds.has(attempt.id) || keptIndexes.has(index)
  );
  if (kept.length === attempts.length) return state;
  return { ...state, attempts: kept };
}

function validateCompactableAttempt(attempt, path) {
  if (attempt === null || typeof attempt !== 'object' || Array.isArray(attempt)) {
    throw new Error(`Invalid ${path}`);
  }
  if (typeof attempt.id !== 'string' || attempt.id.length === 0) throw new Error(`Invalid ${path}.id`);
  if (typeof attempt.commandId !== 'string' || attempt.commandId.length === 0) {
    throw new Error(`Invalid ${path}.commandId`);
  }
  if (typeof attempt.timestamp !== 'number' || !Number.isFinite(attempt.timestamp)) {
    throw new Error(`Invalid ${path}.timestamp`);
  }
  if (!OUTCOMES.has(attempt.outcome)) throw new Error(`Invalid ${path}.outcome`);
}
