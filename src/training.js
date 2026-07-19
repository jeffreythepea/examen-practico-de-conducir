export const OUTCOME_WEIGHTS = Object.freeze({ unaided: 1, assisted: 0.5, incorrect: 0 });
export const SESSION_LENGTHS = Object.freeze({ short: 5, medium: 10, all: 15 });
export const UNAIDED_INTERVAL_DAYS = Object.freeze([1, 3, 7, 14, 30]);

const DAY_MS = 86_400_000;

/**
 * @typedef {'driving' | 'precheck' | 'mixed'} SessionPhase
 * @typedef {'short' | 'medium' | 'all'} SessionLength
 * @typedef {'free' | 'weakest-first'} SessionMode
 * @typedef {'unaided' | 'assisted' | 'incorrect'} Outcome
 */

/**
 * @param {{ correct: boolean, textShown: boolean, timeout?: boolean }} input
 * @returns {Outcome}
 */
export function classifyOutcome({ correct, textShown, timeout }) {
  if (timeout) return 'incorrect';
  if (!correct) return 'incorrect';
  return textShown ? 'assisted' : 'unaided';
}

/**
 * @param {Array<{ phase: string }>} commands
 * @param {{ phase: SessionPhase, length: SessionLength, mode?: SessionMode, attempts?: Array<object>, now?: number, rng?: () => number }} settings
 */
export function createSession(commands, {
  phase,
  length,
  mode = 'free',
  attempts = [],
  now = Date.now(),
  rng = Math.random
}) {
  if (!['driving', 'precheck', 'mixed'].includes(phase)) throw new Error(`Unknown phase: ${phase}`);
  if (!['short', 'medium', 'all'].includes(length)) throw new Error(`Unknown session length: ${length}`);
  if (!['free', 'weakest-first'].includes(mode)) throw new Error(`Unknown session mode: ${mode}`);

  const pool = commands.filter(command => phase === 'mixed' || command.phase === phase);
  const ordered = mode === 'weakest-first'
    ? nextWeakestFirst(pool, attempts, now)
    : shuffle(pool, rng);
  const targetLength = SESSION_LENGTHS[length];
  return ordered.slice(0, targetLength);
}

/**
 * @param {Array<object>} items
 * @param {() => number} rng
 */
function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * @param {{ attempts?: Array<object>, actionProgress?: Record<string, object> }} state
 * @param {object} input
 * @param {{ now?: () => number, randomUUID?: (() => string) | null, cryptoRef?: Crypto }} dependencies
 */
export function recordAttempt(state, input, {
  now = Date.now,
  randomUUID,
  cryptoRef = globalThis.crypto
} = {}) {
  if (!input.audio?.scored) {
    return {
      state,
      attempt: null,
      scored: false,
      reason: input.audio?.reason ?? 'audio-unavailable'
    };
  }

  const outcome = classifyOutcome(input);
  const timestamp = now();
  const attempt = {
    id: createAttemptId({ randomUUID, cryptoRef }),
    timestamp,
    commandId: input.commandId,
    actionId: input.actionId,
    phrasingId: input.phrasingId,
    voiceId: input.voiceId,
    speed: input.speed,
    phase: input.phase,
    surfaceId: input.surfaceId,
    selectedResult: input.selectedResult,
    outcome,
    weight: OUTCOME_WEIGHTS[outcome],
    responseMs: Number.isFinite(input.responseMs) ? input.responseMs : null,
    replays: input.replays ?? 0,
    textShown: Boolean(input.textShown),
    timed: Boolean(input.timed),
    timeout: Boolean(input.timeout)
  };
  if (input.missReason) attempt.missReason = input.missReason;
  if (input.surfaceModel) {
    attempt.surfaceVersion = input.surfaceModel.version;
    attempt.surfaceSeed = input.surfaceModel.seed;
    attempt.expectedResult = input.surfaceModel.expectedResult;
    attempt.selectedTargetId = input.selectedTargetId ?? null;
  }

  const attempts = state.attempts ?? [];
  const priorSchedule = state.actionProgress?.[attempt.actionId]
    ?? scheduleForAttempts(attempts.filter(candidate => candidate.actionId === attempt.actionId));
  const schedule = scheduleAfterAttempt(priorSchedule, attempt);
  return {
    state: {
      ...state,
      attempts: [...attempts, attempt],
      actionProgress: {
        ...(state.actionProgress ?? {}),
        [attempt.actionId]: schedule
      }
    },
    attempt,
    scored: true
  };
}

/**
 * Creates an RFC 4122-shaped version-4 identifier without weakening entropy
 * when `Crypto.randomUUID()` is unavailable in a browser context.
 *
 * @param {{ randomUUID?: (() => string) | null, cryptoRef?: Crypto }} dependencies
 * @returns {string}
 */
export function createAttemptId({ randomUUID, cryptoRef = globalThis.crypto } = {}) {
  if (typeof randomUUID === 'function') return randomUUID();
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();
  if (typeof cryptoRef?.getRandomValues !== 'function') {
    throw new Error('Cryptographic attempt ID generation is unavailable');
  }

  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

/**
 * @param {{ consecutiveUnaided?: number } | undefined} previous
 * @param {{ outcome: Outcome, timestamp: number }} attempt
 */
export function scheduleAfterAttempt(previous, attempt) {
  if (attempt.outcome === 'incorrect') {
    return { consecutiveUnaided: 0, nextDueAt: attempt.timestamp };
  }
  if (attempt.outcome === 'assisted') {
    return { consecutiveUnaided: 0, nextDueAt: attempt.timestamp + DAY_MS };
  }
  const consecutiveUnaided = (previous?.consecutiveUnaided ?? 0) + 1;
  const intervalIndex = Math.min(consecutiveUnaided - 1, UNAIDED_INTERVAL_DAYS.length - 1);
  return {
    consecutiveUnaided,
    nextDueAt: attempt.timestamp + UNAIDED_INTERVAL_DAYS[intervalIndex] * DAY_MS
  };
}

/**
 * @param {Array<{ actionId: string, outcome: Outcome, weight?: number, timestamp: number, responseMs?: number | null }>} attempts
 * @param {string} actionId
 */
export function masteryForAction(attempts, actionId) {
  const actionAttempts = attempts
    .filter(attempt => attempt.actionId === actionId)
    .toSorted((left, right) => left.timestamp - right.timestamp);
  const counts = { unaided: 0, assisted: 0, incorrect: 0 };
  for (const attempt of actionAttempts) counts[attempt.outcome] += 1;

  const scoredAttempts = actionAttempts.length;
  const responseTimes = actionAttempts
    .map(attempt => attempt.responseMs)
    .filter(Number.isFinite);
  const weightedScore = scoredAttempts === 0
    ? 0
    : actionAttempts.reduce((total, attempt) => total + OUTCOME_WEIGHTS[attempt.outcome], 0) / scoredAttempts;
  const schedule = scheduleForAttempts(actionAttempts);
  const recent = actionAttempts.slice(-2);
  const unaidedDates = new Set(actionAttempts
    .filter(attempt => attempt.outcome === 'unaided')
    .map(attempt => new Date(attempt.timestamp).toISOString().slice(0, 10)));

  return {
    ...counts,
    weightedScore,
    averageResponseMs: responseTimes.length === 0
      ? null
      : responseTimes.reduce((total, responseMs) => total + responseMs, 0) / responseTimes.length,
    lastPracticedAt: actionAttempts.at(-1)?.timestamp ?? null,
    nextDueAt: schedule.nextDueAt,
    ready: unaidedDates.size >= 3 && recent.length >= 2 && recent.every(attempt => attempt.outcome === 'unaided')
  };
}

/**
 * @param {Array<{ actionId: string, outcome: Outcome, timestamp: number }>} attempts
 */
function scheduleForAttempts(attempts) {
  return attempts
    .toSorted((left, right) => left.timestamp - right.timestamp)
    .reduce((schedule, attempt) => scheduleAfterAttempt(schedule, attempt), { consecutiveUnaided: 0, nextDueAt: null });
}

/**
 * @param {Array<{ id: string, actionId: string }>} commands
 * @param {Array<object>} attempts
 * @param {number} now
 */
export function nextWeakestFirst(commands, attempts, now = Date.now()) {
  return commands
    .map(command => ({ command, mastery: masteryForAction(attempts, command.actionId) }))
    .sort((left, right) => {
      const rankDifference = practiceRank(left.mastery, now) - practiceRank(right.mastery, now);
      if (rankDifference !== 0) return rankDifference;
      const scoreDifference = left.mastery.weightedScore - right.mastery.weightedScore;
      if (scoreDifference !== 0) return scoreDifference;
      const leftLast = left.mastery.lastPracticedAt ?? Number.NEGATIVE_INFINITY;
      const rightLast = right.mastery.lastPracticedAt ?? Number.NEGATIVE_INFINITY;
      if (leftLast !== rightLast) return leftLast - rightLast;
      return left.command.id.localeCompare(right.command.id);
    })
    .map(({ command }) => command);
}

/**
 * Build the raw daily-practice report without hiding outcomes behind a score.
 */
export function summarizeSession(attempts, commands) {
  const counts = { unaided: 0, assisted: 0, incorrect: 0 };
  const responseTimes = [];
  let replayCount = 0;
  let hintCount = 0;
  for (const attempt of attempts) {
    counts[attempt.outcome] += 1;
    if (Number.isFinite(attempt.responseMs)) responseTimes.push(attempt.responseMs);
    replayCount += attempt.replays ?? 0;
    if (attempt.textShown) hintCount += 1;
  }
  const total = attempts.length;
  const weakActions = commands
    .map(command => ({ actionId: command.actionId, commandId: command.id, ...masteryForAction(attempts, command.actionId) }))
    .filter(item => item.unaided + item.assisted + item.incorrect > 0)
    .sort((left, right) => left.weightedScore - right.weightedScore || left.actionId.localeCompare(right.actionId));
  return {
    counts,
    unaidedPercentage: total === 0 ? 0 : Math.round(100 * counts.unaided / total),
    averageResponseMs: responseTimes.length === 0
      ? null
      : responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length,
    replayCount,
    hintCount,
    weakActions
  };
}

function practiceRank(mastery, now) {
  if (mastery.lastPracticedAt === null) return 0;
  return mastery.nextDueAt <= now ? 1 : 2;
}
