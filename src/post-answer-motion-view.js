const ACTIVE_PHASES = Object.freeze(['running', 'complete']);
const ACTIVE_FAMILIES = Object.freeze([
  'junction',
  'roundabout',
  'parking',
  'stopping'
]);
const MAX_DURATION_MS = 10_000;
const EPSILON = 0.001;

/**
 * Render neutral, decorative post-answer movement geometry.
 * Invalid or static input intentionally produces no markup.
 *
 * @param {{
 *   phase: 'static'|'running'|'complete',
 *   family: 'junction'|'roundabout'|'parking'|'stopping'|null,
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
    ? `<circle class="post-answer-motion-marker" cx="0" cy="0" r="2" vector-effect="non-scaling-stroke">
        <animateMotion path="${route}" dur="${number(model.durationMs)}ms" begin="-${number(model.elapsedMs)}ms" fill="freeze" calcMode="linear"></animateMotion>
      </circle>`
    : `<circle class="post-answer-motion-marker" cx="${number(endpoint.x)}" cy="${number(endpoint.y)}" r="2" vector-effect="non-scaling-stroke"></circle>`;

  return `<span class="post-answer-motion" data-post-answer-motion-phase="${model.phase}" data-post-answer-motion-family="${model.family}" data-post-answer-motion-moving="${model.moving}" aria-hidden="true" style="${timingStyle(model)}">
    <svg class="post-answer-motion-graphic" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path class="post-answer-motion-route" d="${route}" pathLength="1" fill="none" vector-effect="non-scaling-stroke"></path>
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
