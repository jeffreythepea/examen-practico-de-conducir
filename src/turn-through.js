import { POST_ANSWER_MOTION_FAMILIES } from './post-answer-motion.js';
import { drivingScene } from './driving-scenes.js';

const CORRECT_OUTCOMES = new Set(['unaided', 'assisted']);
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
 *   nextStepKind: string|null
 * }} input
 * @returns {Readonly<{ sceneId: string, asset: string, dx: number, dy: number, scale: number, rotate: number, yawDeg: number, settleDx: number, durationMs: number }>|null}
 */
export function turnThroughIntro({
  surfaceModel,
  selectedTargetId,
  outcome,
  motionEnabled,
  nextStepKind
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
  return Object.freeze({
    sceneId,
    asset: scene.asset,
    dx,
    dy,
    scale: INTRO_SCALE,
    rotate: dx === 0 ? 0 : dx > 0 ? -INTRO_LEAN_DEGREES : INTRO_LEAN_DEGREES,
    yawDeg: dx === 0 ? 0 : round(dx > 0 ? -yawMagnitude : yawMagnitude),
    settleDx: round(-dx * SETTLE_GAIN),
    durationMs: INTRO_DURATION_MS
  });
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
