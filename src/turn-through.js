import { POST_ANSWER_MOTION_FAMILIES } from './post-answer-motion.js';
import { drivingScene } from './driving-scenes.js';

const CORRECT_OUTCOMES = new Set(['unaided', 'assisted']);

// Real driving clips of the turn, per junction scene and chosen direction.
// Only the four-way slice is registered; every other scene falls back to the
// CSS turn-through-pan (the no-clip path, kept deliberately). Durations are
// the trimmed clip lengths; auto-advance derives from them, never hardcoded.
function turnClip(videoId, durationMs) {
  return Object.freeze({
    videoId,
    asset: `./assets/driving/${videoId}.mp4`,
    poster: `./assets/driving/${videoId}-poster.webp`,
    provenance: 'ai-generated-illustrative',
    durationMs
  });
}

export const TURN_CLIPS = Object.freeze({
  'four-way-intersection-photo-v1': Object.freeze({
    'turn-left': turnClip('four-way-turn-left-v1', 3917),
    'turn-right': turnClip('four-way-turn-right-v1', 3917),
    'continue-forward': turnClip('four-way-straight-v1', 4000)
  })
});
// Percent of frame translated per percent of target offset from stage centre.
const DIRECTION_GAIN = 0.35;
const INTRO_SCALE = 1.22;
const INTRO_LEAN_DEGREES = 2;
// Two beats: approach push toward the junction, then the perspective turn.
const INTRO_DURATION_MS = 1400;
const YAW_GAIN = 1.1;
const YAW_MIN_DEGREES = 8;
const YAW_MAX_DEGREES = 16;
// Fraction of dx the cruise photo starts counter-offset by before settling.
const SETTLE_GAIN = 0.25;
// Scale checkpoints for the two-beat keyframes. The approach beat must never
// zoom out, so the mid checkpoint rides above whatever pose the answered
// scene froze at (road-motion profiles reach 1.18 on overtaking).
const MID_SCALE_FLOOR = 1.12;
const MID_SCALE_LIFT = 0.06;
const END_SCALE = 1.3;
const TURN_BEAT_FRACTION = 0.45;
const MAX_START_SCALE = 1.5;

/**
 * First-person "drive into the chosen road" intro for a cruise transition.
 * Returns null whenever the intro must not play: wrong answers, non-transition
 * next steps, motion disabled, ineligible families, unknown targets, or
 * scenes without a photo asset.
 *
 * @param {{
 *   surfaceModel: Readonly<object>|null,
 *   selectedTargetId: string|null,
 *   outcome: string|null,
 *   motionEnabled: boolean,
 *   nextStepKind: string|null,
 *   startPose?: { scale: number, originX: number, originY: number }|null
 * }} input
 * @returns {Readonly<{ sceneId: string, asset: string, dx: number, dy: number, scale: number, rotate: number, yawDeg: number, settleDx: number, startScale: number, midScale: number, turnScale: number, originX: number, originY: number, durationMs: number }>|null}
 */
export function turnThroughIntro({
  surfaceModel,
  selectedTargetId,
  outcome,
  motionEnabled,
  nextStepKind,
  startPose = null,
  clipsEnabled = false
} = {}) {
  if (!CORRECT_OUTCOMES.has(outcome)) return null;
  if (nextStepKind !== 'transition') return null;
  if (motionEnabled !== true) return null;
  if (!surfaceModel || typeof surfaceModel !== 'object') return null;
  if (!POST_ANSWER_MOTION_FAMILIES.includes(surfaceModel.family)) return null;
  const target = Array.isArray(surfaceModel.targets)
    ? surfaceModel.targets.find(candidate => candidate?.id === selectedTargetId)
    : null;
  if (!target || !inStage(target.x) || !inStage(target.y)) return null;
  const sceneId = surfaceModel.geometry?.sceneId;
  if (typeof sceneId !== 'string' || !sceneId) return null;
  let scene;
  try {
    scene = drivingScene(sceneId);
  } catch {
    return null;
  }

  const dx = round((target.x - 50) * DIRECTION_GAIN);
  const dy = round((target.y - 50) * DIRECTION_GAIN);
  const yawMagnitude = Math.min(
    YAW_MAX_DEGREES,
    Math.max(YAW_MIN_DEGREES, Math.abs(dx) * YAW_GAIN)
  );
  // The intro opens at the pose the answered scene froze in, so Continue
  // reads as one camera move instead of a zoom-out pop. Invalid or missing
  // poses fall back to the identity pose (today's behaviour).
  const pose = normalizePose(startPose);
  const midScale = round(Math.max(MID_SCALE_FLOOR, pose.scale + MID_SCALE_LIFT));
  // A registered clip replaces the CSS pan as the turn itself: the intro
  // runs for the clip's own duration, and the cruise settle collapses to a
  // no-op because a real turn clip already ends on a straight road.
  const clip = clipsEnabled === true
    ? TURN_CLIPS[sceneId]?.[target.resultId] ?? null
    : null;
  return Object.freeze({
    sceneId,
    asset: scene.asset,
    dx,
    dy,
    scale: INTRO_SCALE,
    rotate: dx === 0 ? 0 : dx > 0 ? -INTRO_LEAN_DEGREES : INTRO_LEAN_DEGREES,
    yawDeg: dx === 0 ? 0 : round(dx > 0 ? -yawMagnitude : yawMagnitude),
    settleDx: clip ? 0 : round(-dx * SETTLE_GAIN),
    startScale: pose.scale,
    midScale,
    turnScale: round(midScale + (END_SCALE - midScale) * TURN_BEAT_FRACTION),
    originX: pose.originX,
    originY: pose.originY,
    durationMs: clip ? clip.durationMs : INTRO_DURATION_MS,
    clip
  });
}

function normalizePose(startPose) {
  const valid = startPose
    && typeof startPose === 'object'
    && typeof startPose.scale === 'number'
    && Number.isFinite(startPose.scale)
    && startPose.scale >= 1
    && startPose.scale <= MAX_START_SCALE
    && inStage(startPose.originX)
    && inStage(startPose.originY);
  return valid
    ? { scale: round(startPose.scale), originX: round(startPose.originX), originY: round(startPose.originY) }
    : { scale: 1, originX: 50, originY: 50 };
}

function inStage(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= 100;
}

function round(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}
