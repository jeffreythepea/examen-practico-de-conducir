const ACTIVE_PHASES = Object.freeze(['running', 'complete']);
const ACTIVE_FAMILIES = Object.freeze([
  'junction',
  'roundabout',
  'parking',
  'stopping',
  'u-turn',
  'overtake',
  'join-traffic'
]);
const MAX_DURATION_MS = 10_000;
const EPSILON = 0.001;

// Small top-down car silhouette, nose pointing along local +x (the reference
// direction animateMotion's rotate="auto" aligns to the path tangent).
const CAR_BODY_PATH = 'M -2.4 -1.1 L 0.8 -1.1 Q 2.4 -1.1 2.4 0 Q 2.4 1.1 0.8 1.1 L -2.4 1.1 Q -2.9 1.1 -2.9 0 Q -2.9 -1.1 -2.4 -1.1 Z';
const CAR_WINDSHIELD_PATH = 'M 0.1 -0.7 L 1.1 -0.4 Q 1.5 0 1.1 0.4 L 0.1 0.7 Z';

/**
 * Render neutral, decorative post-answer movement geometry.
 * Invalid or static input intentionally produces no markup.
 *
 * preserveAspectRatio="none" here must match the main scene SVG's own
 * preserveAspectRatio for every family this renders (manoeuvre-surfaces.js,
 * spatial-surfaces.js both stretch to fill their driving-photo-stage). Without
 * it, this overlay pillarboxes instead of stretching and the same {x,y} route
 * data lands at a different pixel position than the route it's tracing.
 *
 * @param {{
 *   phase: 'static'|'running'|'complete',
 *   family: 'junction'|'roundabout'|'parking'|'stopping'|'u-turn'|'overtake'|'join-traffic'|null,
 *   progress: number,
 *   moving: boolean,
 *   durationMs: number,
 *   elapsedMs: number,
 *   remainingMs: number,
 *   route: Array<{x: number, y: number}>
 * }} viewModel
 * @returns {string}
 */
export function renderPostAnswerMotion(viewModel) {
  if (!viewModel || typeof viewModel !== 'object' || Array.isArray(viewModel)) return '';
  if (viewModel.phase === 'static') return '';

  const model = validateActiveView(viewModel);
  if (!model) return '';
  const route = routePath(model.route);
  const endpoint = model.route.at(-1);
  const marker = model.phase === 'running'
    ? `<g class="post-answer-motion-marker">
        ${carGlyph()}
        <animateMotion path="${route}" dur="${number(model.durationMs)}ms" begin="-${number(model.elapsedMs)}ms" fill="freeze" calcMode="linear" rotate="auto"></animateMotion>
      </g>`
    : `<g class="post-answer-motion-marker" transform="translate(${number(endpoint.x)} ${number(endpoint.y)}) rotate(${number(finalHeadingDegrees(model.route))})">
        ${carGlyph()}
      </g>`;

  return `<span class="post-answer-motion" data-post-answer-motion-phase="${model.phase}" data-post-answer-motion-family="${model.family}" data-post-answer-motion-moving="${model.moving}" aria-hidden="true" style="${timingStyle(model)}">
    <svg class="post-answer-motion-graphic" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      ${marker}
    </svg>
  </span>`;
}

function validateActiveView(viewModel) {
  const {
    phase, family, progress, moving, durationMs, elapsedMs, remainingMs, route
  } = viewModel;
  if (!ACTIVE_PHASES.includes(phase)
      || !ACTIVE_FAMILIES.includes(family)
      || !bounded(progress, 0, 1)
      || typeof moving !== 'boolean'
      || !bounded(durationMs, Number.MIN_VALUE, MAX_DURATION_MS)
      || !bounded(elapsedMs, 0, durationMs)
      || !bounded(remainingMs, 0, durationMs)
      || Math.abs(elapsedMs + remainingMs - durationMs) > EPSILON
      || !validRoute(route)) {
    return null;
  }
  if (phase === 'running' && moving !== (progress < 1)) return null;
  if (phase === 'complete'
      && (progress !== 1 || moving !== false || elapsedMs !== durationMs || remainingMs !== 0)) {
    return null;
  }
  return { phase, family, progress, moving, durationMs, elapsedMs, remainingMs, route };
}

function validRoute(route) {
  return Array.isArray(route)
    && route.length >= 2
    && route.every(point => point
      && typeof point === 'object'
      && !Array.isArray(point)
      && bounded(point.x, 0, 100)
      && bounded(point.y, 0, 100));
}

function bounded(value, minimum, maximum) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum;
}

function carGlyph() {
  return `<path d="${CAR_BODY_PATH}" vector-effect="non-scaling-stroke"></path><path d="${CAR_WINDSHIELD_PATH}" fill="var(--green-dark)" vector-effect="non-scaling-stroke"></path>`;
}

function finalHeadingDegrees(route) {
  const to = route.at(-1);
  const from = route.at(-2);
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}

function routePath(route) {
  return route
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${number(point.x)} ${number(point.y)}`)
    .join(' ');
}

function timingStyle(model) {
  return [
    `--post-answer-motion-progress:${number(model.progress)}`,
    `--post-answer-motion-duration:${number(model.durationMs)}ms`,
    `--post-answer-motion-elapsed:${number(model.elapsedMs)}ms`,
    `--post-answer-motion-remaining:${number(model.remainingMs)}ms`
  ].join(';');
}

function number(value) {
  return String(Math.round(value * 10_000) / 10_000);
}
