export const JUNCTION_APPROACH_MS = 6_000;
export const JUNCTION_END_SCALE = 1.34;
export const JUNCTION_MOTION_PHASES = Object.freeze({
  STATIC: 'static',
  APPROACHING_LOCKED: 'approaching-locked',
  APPROACHING_INTERACTIVE: 'approaching-interactive',
  WAITING: 'waiting'
});

const EVENT_TYPES = new Set(['AUDIO_COMPLETED', 'APPROACH_ENDED', 'ANSWERED', 'FAILED']);

export function createJunctionMotion({ enabled, startedAt } = {}) {
  if (!enabled) return staticMotion();
  requireFinite(startedAt, 'startedAt');
  return motion(JUNCTION_MOTION_PHASES.APPROACHING_LOCKED, startedAt, null);
}

export function reduceJunctionMotion(state, event) {
  validateState(state);
  if (!EVENT_TYPES.has(event?.type)) throw new Error('Invalid junction motion event type');
  requireFinite(event.at, 'event at');
  if (state.phase === JUNCTION_MOTION_PHASES.STATIC) return state;
  if (event.type === 'FAILED') return staticMotion();

  if (state.phase === JUNCTION_MOTION_PHASES.APPROACHING_LOCKED) {
    if (event.type !== 'AUDIO_COMPLETED') return state;
    const progress = timelineProgress(state, event.at);
    return progress >= 1
      ? waitingMotion(1)
      : motion(JUNCTION_MOTION_PHASES.APPROACHING_INTERACTIVE, state.startedAt, null);
  }

  if (state.phase === JUNCTION_MOTION_PHASES.APPROACHING_INTERACTIVE) {
    if (event.type === 'APPROACH_ENDED') return waitingMotion(1);
    if (event.type === 'ANSWERED') return waitingMotion(timelineProgress(state, event.at));
    return state;
  }

  return state;
}

export function junctionMotionView(state, now) {
  validateState(state);
  requireFinite(now, 'now');
  const progress = state.startedAt === null
    ? state.frozenProgress
    : timelineProgress(state, now);
  const elapsedMs = progress * JUNCTION_APPROACH_MS;
  const approaching = state.phase === JUNCTION_MOTION_PHASES.APPROACHING_LOCKED
    || state.phase === JUNCTION_MOTION_PHASES.APPROACHING_INTERACTIVE;
  return Object.freeze({
    phase: state.phase,
    progress,
    scale: scaleAt(progress),
    locked: state.phase === JUNCTION_MOTION_PHASES.APPROACHING_LOCKED,
    moving: approaching && progress < 1,
    elapsedMs,
    remainingMs: JUNCTION_APPROACH_MS - elapsedMs
  });
}

function timelineProgress(state, now) {
  return clamp((now - state.startedAt) / JUNCTION_APPROACH_MS);
}

function scaleAt(progress) {
  const eased = easeInOut(progress);
  return round4(1 + eased * (JUNCTION_END_SCALE - 1));
}

function easeInOut(progress) {
  if (progress <= 0 || progress >= 1) return progress;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const candidate = (low + high) / 2;
    if (cubicBezier(candidate, 0.42, 0.58) < progress) low = candidate;
    else high = candidate;
  }
  return cubicBezier((low + high) / 2, 0, 1);
}

function cubicBezier(t, first, second) {
  const inverse = 1 - t;
  return 3 * inverse * inverse * t * first
    + 3 * inverse * t * t * second
    + t * t * t;
}

function staticMotion() {
  return motion(JUNCTION_MOTION_PHASES.STATIC, null, 0);
}

function waitingMotion(progress) {
  return motion(JUNCTION_MOTION_PHASES.WAITING, null, clamp(progress));
}

function motion(phase, startedAt, frozenProgress) {
  return Object.freeze({ phase, startedAt, frozenProgress });
}

function validateState(state) {
  if (!state || !Object.values(JUNCTION_MOTION_PHASES).includes(state.phase)) {
    throw new Error('Invalid junction motion state');
  }
  if (state.startedAt === null) {
    if (!Number.isFinite(state.frozenProgress)
        || state.frozenProgress < 0
        || state.frozenProgress > 1) {
      throw new Error('Invalid junction motion frozenProgress');
    }
    return;
  }
  requireFinite(state.startedAt, 'junction motion startedAt');
  if (state.frozenProgress !== null) throw new Error('Invalid junction motion frozenProgress');
}

function requireFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid junction motion ${label}`);
  }
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function round4(value) {
  return Math.round(value * 10_000) / 10_000;
}
