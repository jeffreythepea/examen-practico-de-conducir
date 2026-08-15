// Whether a reveal is demonstrated by its clip, and for how long it therefore
// holds before advancing itself. Pure policy, no browser and no session: the
// controller assembles the inputs and asks once per reveal render.
import { hasTurnClip } from './turn-through.js';

// Preserve the reviewed result-reading beats that preceded each transition;
// these values no longer drive or describe an animated answer glyph.
// This map is the single roster of clip-backed reveal families. A family
// listed as clip-backed without a dwell here yielded `undefined + 1200 = NaN`,
// and setTimeout(fn, NaN) fires at once — the reveal flashed away, a symptom
// only visible on the device.
export const REVEAL_DWELL_MS_BY_FAMILY = Object.freeze({
  junction: 1_300,
  roundabout: 1_650,
  parking: 1_450,
  stopping: 1_350,
  'join-traffic': 1_100,
  overtake: 1_550,
  'u-turn': 1_800
});
const TURN_CLIP_REVEAL_FAMILIES = new Set(Object.keys(REVEAL_DWELL_MS_BY_FAMILY));

// The learner is reading the result label before the transition begins.
const REVEAL_READING_BEAT_MS = 1_200;

// Jeffrey's device passes 2026-08-15: first a third off, then lower again to
// around a second. The correct-answer chime is the cue that the answer landed,
// so the clip arriving sooner reads as continuous driving rather than as an
// interruption waiting to be dismissed. One knob scales every family
// together, so the relative pacing he calibrated per family — and the
// reviewed beats above — survive the change instead of being retyped.
const REVEAL_PACE_SCALE = 1 / 2;

// Rounded to a hundredth of a second: these are perceived beats, and a
// timer of 1666.6667 ms only pretends to a precision the eye does not have.
export function revealHoldMs(family) {
  const dwell = REVEAL_DWELL_MS_BY_FAMILY[family];
  if (!Number.isFinite(dwell)) return null;
  return Math.round((dwell + REVEAL_READING_BEAT_MS) * REVEAL_PACE_SCALE / 10) * 10;
}

/**
 * A clip-backed reveal holds for its reviewed family dwell plus a reading
 * beat, then moves into the transition—and therefore the clip—on its own. Correct
 * answers only, and only in a continuous drive where a transition actually
 * follows: a miss needs its reading time and its miss-reason buttons, and mock
 * is excluded with the rest of the clip machinery by the session-end reveal
 * policy.
 *
 * @returns {number|null} dwell in ms, or null when the learner keeps the tap
 */
export function turnClipWillDemonstrateReveal({
  screenModel,
  attempt,
  nextStepKind,
  roadMovement,
  reducedMotion,
  clipsEnabled
} = {}) {
  const surface = screenModel?.activeSurfaceModel;
  const family = surface?.family;
  return screenModel?.screen === 'reveal'
    && screenModel.correct === true
    && screenModel.timeout !== true
    && screenModel.continuityActive === true
    && nextStepKind === 'transition'
    && ['unaided', 'assisted'].includes(attempt?.outcome)
    && screenModel.experience?.revealPolicy !== 'session-end'
    && roadMovement === true
    && reducedMotion !== true
    && clipsEnabled === true
    && TURN_CLIP_REVEAL_FAMILIES.has(family)
    && hasTurnClip(surface?.geometry?.sceneId, surface?.expectedResult);
}

/**
 * The whole reveal decision, made once from one set of inputs: whether the
 * clip will demonstrate the answer, and how long the reveal therefore waits
 * before advancing itself.
 *
 * These two answers must never disagree. A reveal that suppresses the glyph
 * because a clip will play, but does not auto-advance, leaves a motionless
 * dead end; one that auto-advances without the clip playing yanks the screen
 * away. They used to be derived at separate call sites from separately
 * assembled inputs, and agreed only because both ran in the same synchronous
 * pass.
 */
export function revealDecision(input = {}) {
  const willPlay = turnClipWillDemonstrateReveal(input);
  const family = input.screenModel?.activeSurfaceModel?.family;
  return Object.freeze({
    willPlay,
    autoAdvanceMs: willPlay ? revealHoldMs(family) : null
  });
}

export function revealAutoAdvanceMs(input = {}) {
  return revealDecision(input).autoAdvanceMs;
}

/**
 * The same question for a silent junction. It has no reveal screen and never
 * becomes a scored attempt, so it went its own way through the renderer and
 * was missed when clip-backed reveals stopped drawing the gold route — the
 * explicit "go straight" suppressed its line while the silent one still drew
 * it, over the very same scene and clip.
 */
export function nullEventClipWillDemonstrate({
  surfaceModel,
  nullEventState,
  roadMovement,
  reducedMotion,
  clipsEnabled
} = {}) {
  return nullEventState === 'correct'
    && roadMovement === true
    && reducedMotion !== true
    && clipsEnabled === true
    && hasTurnClip(surfaceModel?.geometry?.sceneId, surfaceModel?.expectedResult);
}
