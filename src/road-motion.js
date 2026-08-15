export const ROAD_APPROACH_MS = 6_000;
export const ROAD_MOTION_PHASES = Object.freeze({
  STATIC: 'static',
  APPROACHING_LOCKED: 'approaching-locked',
  APPROACHING_INTERACTIVE: 'approaching-interactive',
  WAITING: 'waiting'
});

export const ROAD_MOTION_PROFILES = deepFreeze({
  'four-way-intersection-photo-v1': { endScale: 1.06, originX: 50, originY: 82 },
  'roundabout-four-photo-v2': { endScale: 1.03, originX: 50, originY: 80 },
  'roundabout-five-photo-v1': { endScale: 1.03, originX: 50, originY: 80 },
  'roundabout-four-photo-v3': { endScale: 1.03, originX: 50, originY: 80 },
  'u-turn-photo-v1': { endScale: 1.05, originX: 50, originY: 84 },
  'overtaking-photo-v1': { endScale: 1.18, originX: 54, originY: 86 },
  'join-traffic-photo-v1': { endScale: 1.06, originX: 66, originY: 84 },
  'parallel-parking-gap-photo-v1': { endScale: 1.06, originX: 65, originY: 84 },
  'urban-roadside-photo-v1': { endScale: 1.06, originX: 66, originY: 84 },
  // 1.03 like the roundabouts: the crosswalk target sits near the top edge
  // and a 1.06 push would carry its circle off-frame at the endpoint.
  'urban-roadside-photo-v2': { endScale: 1.03, originX: 47, originY: 88 }
});

const EVENT_TYPES = new Set(['AUDIO_COMPLETED', 'APPROACH_ENDED', 'ANSWERED', 'FAILED']);
const STATIC_ORIGIN = Object.freeze({ x: 50, y: 50 });

export function roadMotionProfile(sceneId) {
  return ROAD_MOTION_PROFILES[sceneId] ?? null;
}

export function createRoadMotion({ enabled, startedAt, sceneId } = {}) {
  if (!enabled || !roadMotionProfile(sceneId)) return staticMotion();
  requireFinite(startedAt, 'startedAt');
  return motion(ROAD_MOTION_PHASES.APPROACHING_LOCKED, startedAt, null, sceneId);
}

export function reduceRoadMotion(state, event) {
  validateState(state);
  if (!EVENT_TYPES.has(event?.type)) throw new Error('Invalid road motion event type');
  requireFinite(event.at, 'event at');
  if (state.phase === ROAD_MOTION_PHASES.STATIC) return state;
  if (event.type === 'FAILED') return staticMotion();

  if (state.phase === ROAD_MOTION_PHASES.APPROACHING_LOCKED) {
    if (event.type !== 'AUDIO_COMPLETED') return state;
    const progress = timelineProgress(state, event.at);
    return progress >= 1
      ? waitingMotion(state.sceneId, 1)
      : motion(
          ROAD_MOTION_PHASES.APPROACHING_INTERACTIVE,
          state.startedAt,
          null,
          state.sceneId
        );
  }

  if (state.phase === ROAD_MOTION_PHASES.APPROACHING_INTERACTIVE) {
    if (event.type === 'APPROACH_ENDED') return waitingMotion(state.sceneId, 1);
    if (event.type === 'ANSWERED') {
      return waitingMotion(state.sceneId, timelineProgress(state, event.at));
    }
    return state;
  }

  return state;
}

export function roadMotionView(state, now) {
  validateState(state);
  requireFinite(now, 'now');
  const profile = roadMotionProfile(state.sceneId);
  const progress = state.startedAt === null
    ? state.frozenProgress
    : timelineProgress(state, now);
  const elapsedMs = progress * ROAD_APPROACH_MS;
  const approaching = state.phase === ROAD_MOTION_PHASES.APPROACHING_LOCKED
    || state.phase === ROAD_MOTION_PHASES.APPROACHING_INTERACTIVE;
  const endScale = profile?.endScale ?? 1;
  return Object.freeze({
    phase: state.phase,
    progress,
    scale: scaleAt(progress, endScale),
    endScale,
    origin: profile
      ? Object.freeze({ x: profile.originX, y: profile.originY })
      : STATIC_ORIGIN,
    locked: state.phase === ROAD_MOTION_PHASES.APPROACHING_LOCKED,
    moving: approaching && progress < 1,
    elapsedMs,
    remainingMs: ROAD_APPROACH_MS - elapsedMs
  });
}

function timelineProgress(state, now) {
  return clamp((now - state.startedAt) / ROAD_APPROACH_MS);
}

function scaleAt(progress, endScale) {
  const eased = easeInOut(progress);
  return round4(1 + eased * (endScale - 1));
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
  return motion(ROAD_MOTION_PHASES.STATIC, null, 0, null);
}

function waitingMotion(sceneId, progress) {
  return motion(ROAD_MOTION_PHASES.WAITING, null, clamp(progress), sceneId);
}

function motion(phase, startedAt, frozenProgress, sceneId) {
  return Object.freeze({ phase, startedAt, frozenProgress, sceneId });
}

function validateState(state) {
  if (!state || !Object.values(ROAD_MOTION_PHASES).includes(state.phase)) {
    throw new Error('Invalid road motion state');
  }
  if (state.phase === ROAD_MOTION_PHASES.STATIC) {
    if (state.startedAt !== null || state.frozenProgress !== 0 || state.sceneId !== null) {
      throw new Error('Invalid road motion static state');
    }
    return;
  }
  if (!roadMotionProfile(state.sceneId)) throw new Error('Invalid road motion sceneId');
  if (state.startedAt === null) {
    if (!Number.isFinite(state.frozenProgress)
        || state.frozenProgress < 0
        || state.frozenProgress > 1) {
      throw new Error('Invalid road motion frozenProgress');
    }
    return;
  }
  requireFinite(state.startedAt, 'startedAt');
  if (state.frozenProgress !== null) throw new Error('Invalid road motion frozenProgress');
}

function requireFinite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid road motion ${label}`);
  }
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function round4(value) {
  return Math.round(value * 10_000) / 10_000;
}

function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested);
  }
  return Object.freeze(value);
}
