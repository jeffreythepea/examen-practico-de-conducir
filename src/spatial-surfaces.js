import { createSurfaceModel, seededRandom } from './surface-model.js';
import {
  assertNonOverlappingTargets,
  jitterAngle,
  polarPoint,
  svgRoadPath,
  targetBox
} from './surface-geometry.js';

const FOUR_EXIT_ANGLES = Object.freeze([-18, -90, -162, -228]);
const FIVE_EXIT_ANGLES = Object.freeze([-12, -55, -98, -141, -184]);
const JUNCTION_RESULTS = Object.freeze(['turn-right', 'turn-left']);
const STAGE = Object.freeze({ stageWidth: 400, stageHeight: 300 });
const ROAD_LABELS = Object.freeze({
  en: Object.freeze({
    select: 'Select this road',
    correctSelection: 'Correct selection',
    wrongSelection: 'Wrong selection',
    prefix: 'Correct road: ',
    'turn-right': 'turn right',
    'turn-left': 'turn left',
    'roundabout-exit-1': 'first exit',
    'roundabout-exit-2': 'second exit',
    'roundabout-exit-3': 'third exit',
    'roundabout-exit-4': 'fourth exit',
    'roundabout-exit-5': 'fifth exit'
  }),
  es: Object.freeze({
    select: 'Seleccione esta vía',
    correctSelection: 'Selección correcta',
    wrongSelection: 'Selección incorrecta',
    prefix: 'Vía correcta: ',
    'turn-right': 'giro a la derecha',
    'turn-left': 'giro a la izquierda',
    'roundabout-exit-1': 'primera salida',
    'roundabout-exit-2': 'segunda salida',
    'roundabout-exit-3': 'tercera salida',
    'roundabout-exit-4': 'cuarta salida',
    'roundabout-exit-5': 'quinta salida'
  })
});

/**
 * Produces a deterministic driver-relative junction or roundabout model.
 *
 * @param {{ id: string, actionId: string, acceptedResult: string, surfaceId: string }} command
 * @param {number} seed
 * @param {{ exitCount?: number }} options
 */
export function generateSpatialSurface(command, seed, options = {}) {
  if (command?.surfaceId === 'junction-v2') return generateJunction(command, seed);
  if (command?.surfaceId !== 'roundabout-v2') {
    throw new Error(`Unsupported spatial surface: ${command?.surfaceId}`);
  }

  const ordinal = roundaboutOrdinal(command);
  const rng = seededRandom(seed);
  // Sequential seeds correlate in the PRNG's first sample; warm it once so
  // seed sweeps retain the intended predominantly four-exit distribution.
  rng();
  const exitCount = options.exitCount ?? (ordinal === 5 || rng() < 0.2 ? 5 : 4);
  if (exitCount !== 4 && exitCount !== 5) throw new Error('Roundabout exit count must be four or five');
  if (ordinal > exitCount) throw new Error('Requested roundabout exit is unavailable');

  const angles = (exitCount === 5 ? FIVE_EXIT_ANGLES : FOUR_EXIT_ANGLES)
    .map(angle => jitterAngle(angle, 8, rng));
  const targets = angles.map((angle, index) => roadExitTarget(index + 1, angle));
  assertNonOverlappingTargets(targets);

  return createSurfaceModel({
    id: `roundabout-v2:${seed}`,
    family: 'roundabout',
    version: 2,
    seed,
    expectedResult: command.acceptedResult,
    targets,
    geometry: { entry: 'bottom', exitCount, angles },
    meta: { commandId: command.id }
  });
}

/**
 * Renders one unlabeled spatial road stage. The localized text is exposed to
 * assistive technology until reveal, when the correct result is also visible.
 *
 * @param {Readonly<object>} model
 * @param {'en'|'es'} locale
 * @param {{ disabled?: boolean, reveal?: boolean }} state
 * @returns {string}
 */
export function renderSpatialSurface(model, locale, state = {}) {
  if (model?.family !== 'junction' && model?.family !== 'roundabout') {
    throw new Error(`Unsupported spatial model: ${model?.family}`);
  }
  const labels = locale === 'es' ? ROAD_LABELS.es : ROAD_LABELS.en;
  const surfaceId = `${model.family}-v2`;
  const correctTarget = model.targets.find(target => target.resultId === model.expectedResult);
  const route = state.reveal ? correctRoute(model, correctTarget) : '';
  const targets = model.targets.map(target => roadTargetButton(target, labels, model.expectedResult, state)).join('');
  const resultLabel = state.reveal
    ? `<p class="surface-result-label">${escapeHtml(labels.prefix + labels[model.expectedResult])}</p>`
    : '';

  return `<div class="surface-stage ${model.family}" data-surface="${surfaceId}">
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      ${roadDrawing(model)}
      ${route}
    </svg>
    ${targets}
    ${resultLabel}
  </div>`;
}

function generateJunction(command, seed) {
  if (!JUNCTION_RESULTS.includes(command?.acceptedResult) || command.actionId !== command.acceptedResult) {
    throw new Error(`Unsupported junction action: ${command?.actionId}`);
  }
  const rng = seededRandom(seed);
  const angles = [0, -180].map(angle => jitterAngle(angle, 8, rng));
  const targets = JUNCTION_RESULTS.map((resultId, index) => {
    const point = polarPoint(50, 45, 38, angles[index]);
    return targetBox(resultId.replace('turn-', ''), resultId, point.x, point.y, STAGE);
  });
  assertNonOverlappingTargets(targets);

  return createSurfaceModel({
    id: `junction-v2:${seed}`,
    family: 'junction',
    version: 2,
    seed,
    expectedResult: command.acceptedResult,
    targets,
    geometry: { entry: 'bottom', angles },
    meta: { commandId: command.id }
  });
}

function roundaboutOrdinal(command) {
  const match = /^roundabout-exit-([1-5])$/.exec(command?.acceptedResult);
  if (!match || command.actionId !== command.acceptedResult) {
    throw new Error(`Unsupported roundabout action: ${command?.actionId}`);
  }
  return Number(match[1]);
}

function roadExitTarget(ordinal, angle) {
  const resultId = `roundabout-exit-${ordinal}`;
  const point = polarPoint(50, 50, 39, angle);
  return targetBox(`exit-${ordinal}`, resultId, point.x, point.y, STAGE);
}

function roadDrawing(model) {
  if (model.family === 'junction') {
    const outgoingRoads = model.targets.map(target =>
      `<path d="${svgRoadPath([{ x: 50, y: 45 }, target])}" class="spatial-road"/>`
    ).join('');
    return `<path d="M 50 100 L 50 45" class="spatial-road"/>
      ${outgoingRoads}
      <path d="M 50 98 L 50 54" class="road-marking"/>`;
  }

  const exitRoads = model.targets.map((target, index) => {
    const ringPoint = polarPoint(50, 50, 25, model.geometry.angles[index]);
    return `<path d="${svgRoadPath([ringPoint, target])}" class="spatial-road"/>`;
  }).join('');
  return `<path d="M 50 100 L 50 75" class="spatial-road"/>
    ${exitRoads}
    <circle cx="50" cy="50" r="25" class="roundabout-road"/>
    <circle cx="50" cy="50" r="15" class="roundabout-island"/>
    <path d="M 50 98 L 50 80" class="road-marking"/>`;
}

function correctRoute(model, target) {
  if (model.family === 'junction') {
    return `<path data-correct-route d="${svgRoadPath([{ x: 50, y: 100 }, { x: 50, y: 45 }, target])}"/>`;
  }

  const index = model.targets.indexOf(target);
  const angle = model.geometry.angles[index];
  const ringPoint = polarPoint(50, 50, 25, angle);
  const largeArc = Math.abs(90 - angle) > 180 ? 1 : 0;
  return `<path data-correct-route d="M 50 100 L 50 75 A 25 25 0 ${largeArc} 0 ${ringPoint.x} ${ringPoint.y} L ${target.x} ${target.y}"/>`;
}

function roadTargetButton(target, labels, expectedResult, state) {
  const correct = target.resultId === expectedResult;
  const selected = Boolean(state.reveal && target.id === state.selectedTargetId);
  const selectionState = selected ? (correct ? 'correct' : 'wrong') : null;
  const selectionLabel = selectionState === 'correct' ? labels.correctSelection : labels.wrongSelection;
  const ariaLabel = selected ? `${labels.select} — ${selectionLabel}` : labels.select;
  const current = state.reveal && correct ? ' aria-current="true"' : '';
  const selectedAttributes = selected
    ? ` data-selected="true" data-selection-state="${selectionState}"`
    : '';
  const marker = state.reveal && correct
    ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
    : selectionState === 'wrong'
      ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
      : '';
  const disabled = state.disabled ? ' disabled' : '';
  return `<button class="road-target" type="button" data-target="${escapeAttribute(target.id)}" data-result="${escapeAttribute(target.resultId)}"${selectedAttributes}${current} aria-pressed="${selected}" aria-label="${escapeAttribute(ariaLabel)}"${disabled} style="--target-x:${target.x}%;--target-y:${target.y}%;--target-width:${target.width}%;--target-height:${target.height}%">${marker}</button>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}
