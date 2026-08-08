export const POST_ANSWER_MOTION_PHASES = Object.freeze({
  STATIC: 'static',
  RUNNING: 'running',
  COMPLETE: 'complete'
});

export const POST_ANSWER_MOTION_FAMILIES = Object.freeze([
  'junction',
  'roundabout',
  'parking',
  'stopping'
]);

const EVENT_TYPES = new Set(['ANIMATION_ENDED', 'FAILED']);
const FAMILY_TYPES = new Set(POST_ANSWER_MOTION_FAMILIES);
const MAX_DURATION_MS = 10_000;

export function createPostAnswerMotion({
  eligible = false,
  family,
  route,
  startedAt,
  durationMs
} = {}) {
  if (eligible !== true) return staticMotion();
  if (!FAMILY_TYPES.has(family)) {
    throw new Error('Invalid post-answer motion family');
  }
  const frozenRoute = cloneAndValidateRoute(route);
  requireFinite(startedAt, 'startedAt');
  if (typeof durationMs !== 'number'
      || !Number.isFinite(durationMs)
      || durationMs <= 0
      || durationMs > MAX_DURATION_MS) {
    throw new Error('Invalid post-answer motion durationMs');
  }
  return motion(
    POST_ANSWER_MOTION_PHASES.RUNNING,
    family,
    startedAt,
    durationMs,
    frozenRoute
  );
}

export function reducePostAnswerMotion(state, event) {
  validateState(state);
  if (!EVENT_TYPES.has(event?.type)) {
    throw new Error('Invalid post-answer motion event type');
  }
  if (state.phase !== POST_ANSWER_MOTION_PHASES.RUNNING) return state;
  if (event.type === 'FAILED') return staticMotion();
  return motion(
    POST_ANSWER_MOTION_PHASES.COMPLETE,
    state.family,
    null,
    state.durationMs,
    state.route
  );
}

export function postAnswerMotionView(state, now) {
  validateState(state);
  requireFinite(now, 'now');

  if (state.phase === POST_ANSWER_MOTION_PHASES.STATIC) {
    return view(state, 0, false, 0, 0);
  }
  if (state.phase === POST_ANSWER_MOTION_PHASES.COMPLETE) {
    return view(state, 1, false, state.durationMs, 0);
  }

  const progress = clamp((now - state.startedAt) / state.durationMs);
  const elapsedMs = progress * state.durationMs;
  return view(
    state,
    progress,
    progress < 1,
    elapsedMs,
    state.durationMs - elapsedMs
  );
}

function staticMotion() {
  return motion(POST_ANSWER_MOTION_PHASES.STATIC, null, null, 0, Object.freeze([]));
}

function motion(phase, family, startedAt, durationMs, route) {
  return Object.freeze({ phase, family, startedAt, durationMs, route });
}

function view(state, progress, moving, elapsedMs, remainingMs) {
  return Object.freeze({
    phase: state.phase,
    family: state.family,
    progress,
    moving,
    durationMs: state.durationMs,
    elapsedMs,
    remainingMs,
    route: state.route
  });
}

function cloneAndValidateRoute(route) {
  if (!Array.isArray(route) || route.length < 2) {
    throw new Error('Invalid post-answer motion route');
  }
  const cloned = route.map((point) => {
    if (!point || typeof point !== 'object'
        || !inStage(point.x)
        || !inStage(point.y)) {
      throw new Error('Invalid post-answer motion route');
    }
    return Object.freeze({ x: point.x, y: point.y });
  });
  return Object.freeze(cloned);
}

function validateState(state) {
  if (!state || typeof state !== 'object'
      || !Object.values(POST_ANSWER_MOTION_PHASES).includes(state.phase)) {
    throw new Error('Invalid post-answer motion state');
  }
  if (state.phase === POST_ANSWER_MOTION_PHASES.STATIC) {
    if (state.family !== null
        || state.startedAt !== null
        || state.durationMs !== 0
        || !Array.isArray(state.route)
        || state.route.length !== 0) {
      throw new Error('Invalid post-answer motion state');
    }
    return;
  }
  if (!FAMILY_TYPES.has(state.family)
      || !Array.isArray(state.route)
      || state.route.length < 2
      || typeof state.durationMs !== 'number'
      || !Number.isFinite(state.durationMs)
      || state.durationMs <= 0
      || state.durationMs > MAX_DURATION_MS) {
    throw new Error('Invalid post-answer motion state');
  }
  for (const point of state.route) {
    if (!point || typeof point !== 'object' || !inStage(point.x) || !inStage(point.y)) {
      throw new Error('Invalid post-answer motion state');
    }
  }
  if (state.phase === POST_ANSWER_MOTION_PHASES.RUNNING) {
    if (typeof state.startedAt !== 'number' || !Number.isFinite(state.startedAt)) {
      throw new Error('Invalid post-answer motion state');
    }
    return;
  }
  if (state.startedAt !== null) throw new Error('Invalid post-answer motion state');
}

function requireFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid post-answer motion ${label}`);
  }
}

function inStage(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 100;
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}
