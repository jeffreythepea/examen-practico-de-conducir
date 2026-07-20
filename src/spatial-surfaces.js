import { createSurfaceModel, seededRandom } from './surface-model.js';
import { drivingScene } from './driving-scenes.js';
import {
  assertNonOverlappingTargets,
  jitterAngle,
  polarPoint,
  svgRoadPath,
  targetBox
} from './surface-geometry.js';

const FOUR_EXIT_ANGLES = Object.freeze([-12, -83, -163, -206]);
const FIVE_EXIT_ANGLES = Object.freeze([24, -22, -90, -154, -200]);
const ROUNDABOUT_SCENES = Object.freeze({
  4: Object.freeze({
    sceneId: 'roundabout-four-photo-v1',
    angles: FOUR_EXIT_ANGLES,
    routeCircle: Object.freeze({ x: 50, y: 48, radius: 20 }),
    targetAnchors: Object.freeze([
      Object.freeze({ x: 87, y: 43 }),
      Object.freeze({ x: 55, y: 11 }),
      Object.freeze({ x: 13, y: 39 }),
      Object.freeze({ x: 13, y: 67 })
    ])
  }),
  5: Object.freeze({
    sceneId: 'roundabout-five-photo-v1',
    angles: FIVE_EXIT_ANGLES,
    routeCircle: Object.freeze({ x: 50, y: 46, radius: 21 }),
    targetAnchors: Object.freeze([
      Object.freeze({ x: 87, y: 67 }),
      Object.freeze({ x: 87, y: 34 }),
      Object.freeze({ x: 50, y: 11 }),
      Object.freeze({ x: 13, y: 34 }),
      Object.freeze({ x: 13, y: 67 })
    ])
  })
});
const ROAD_MOUTH_JITTER = 0.75;
const ROUTE_ANGLE_JITTER = 2;
const JUNCTION_ACTION_RESULTS = Object.freeze(['turn-right', 'turn-left', 'continue-forward']);
const JUNCTION_TARGETS = Object.freeze([
  Object.freeze({ id: 'left', resultId: 'turn-left', x: 15, y: 42 }),
  Object.freeze({ id: 'straight', resultId: 'continue-forward', x: 50, y: 15 }),
  Object.freeze({ id: 'right', resultId: 'turn-right', x: 85, y: 42 })
]);
const STAGE = Object.freeze({ stageWidth: 400, stageHeight: 300 });
const ROAD_LABELS = Object.freeze({
  en: Object.freeze({
    select: 'Select this road',
    correctSelection: 'Correct selection',
    wrongSelection: 'Wrong selection',
    prefix: 'Correct road: ',
    'turn-right': 'turn right',
    'turn-left': 'turn left',
    'continue-forward': 'continue straight',
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
    'continue-forward': 'continúe de frente',
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

  const scene = ROUNDABOUT_SCENES[exitCount];
  const angles = scene.angles.map(angle => jitterAngle(angle, ROUTE_ANGLE_JITTER, rng));
  const targets = scene.targetAnchors.map((anchor, index) => roadExitTarget(index + 1, anchor, rng));
  const exitJoins = angles.map(angle => polarPoint(
    scene.routeCircle.x,
    scene.routeCircle.y,
    scene.routeCircle.radius,
    angle
  ));
  assertNonOverlappingTargets(targets);

  return createSurfaceModel({
    id: `roundabout-v2:${seed}`,
    family: 'roundabout',
    version: 2,
    seed,
    expectedResult: command.acceptedResult,
    targets,
    geometry: {
      entry: 'bottom',
      exitCount,
      angles,
      exitJoins,
      routeCircle: scene.routeCircle,
      sceneId: scene.sceneId
    },
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

  const scene = model.geometry.sceneId ? drivingScene(model.geometry.sceneId) : null;
  const sceneImage = scene
    ? `<img class="driving-scene-image" data-scene="${escapeAttribute(scene.id)}" data-provenance="${escapeAttribute(scene.provenance)}" src="${escapeAttribute(scene.asset)}" alt="${escapeAttribute(locale === 'es' ? scene.alt.es : scene.alt.en)}">`
    : '';

  return `<div class="surface-stage ${model.family}${scene ? ' driving-photo-stage' : ''}" data-surface="${surfaceId}">
    ${sceneImage}
    <svg viewBox="0 0 100 100"${scene ? ' preserveAspectRatio="none"' : ''} aria-hidden="true" focusable="false">
      ${roadDrawing(model)}
      ${route}
    </svg>
    ${targets}
    ${resultLabel}
  </div>`;
}

function generateJunction(command, seed) {
  if (!JUNCTION_ACTION_RESULTS.includes(command?.acceptedResult) || command.actionId !== command.acceptedResult) {
    throw new Error(`Unsupported junction action: ${command?.actionId}`);
  }
  const rng = seededRandom(seed);
  const targets = JUNCTION_TARGETS.map(target => targetBox(
    target.id,
    target.resultId,
    jitterCoordinate(target.x, rng),
    jitterCoordinate(target.y, rng),
    STAGE
  ));
  assertNonOverlappingTargets(targets);

  return createSurfaceModel({
    id: `junction-v2:${seed}`,
    family: 'junction',
    version: 2,
    seed,
    expectedResult: command.acceptedResult,
    targets,
    geometry: { entry: 'bottom', sceneId: 'four-way-intersection-photo-v1' },
    meta: { commandId: command.id }
  });
}

function jitterCoordinate(base, rng) {
  return Math.round((base + (rng() * 3 - 1.5)) * 100) / 100;
}

function roundaboutOrdinal(command) {
  const match = /^roundabout-exit-([1-5])$/.exec(command?.acceptedResult);
  if (!match || command.actionId !== command.acceptedResult) {
    throw new Error(`Unsupported roundabout action: ${command?.actionId}`);
  }
  return Number(match[1]);
}

function roadExitTarget(ordinal, anchor, rng) {
  const resultId = `roundabout-exit-${ordinal}`;
  return targetBox(
    `exit-${ordinal}`,
    resultId,
    jitterRoadMouthCoordinate(anchor.x, rng),
    jitterRoadMouthCoordinate(anchor.y, rng),
    STAGE
  );
}

function jitterRoadMouthCoordinate(base, rng) {
  return Math.round((base + (rng() * 2 - 1) * ROAD_MOUTH_JITTER) * 100) / 100;
}

function roadDrawing(model) {
  if (model.geometry.sceneId) return '';

  if (model.family === 'junction') {
    const outgoingRoads = model.targets.map(target =>
      `<path d="${svgRoadPath([{ x: 50, y: 45 }, target])}" class="spatial-road"/>`
    ).join('');
    return `<path d="M 50 100 L 50 45" class="spatial-road"/>
      ${outgoingRoads}
      <path d="M 50 98 L 50 54" class="road-marking"/>`;
  }

  const exitRoads = model.targets.map((target, index) => {
    return `<path d="${svgRoadPath([model.geometry.exitJoins[index], target])}" class="spatial-road"/>`;
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
  const ringPoint = model.geometry.exitJoins[index];
  const circle = model.geometry.routeCircle;
  const entryY = circle.y + circle.radius;
  const largeArc = Math.abs(90 - angle) > 180 ? 1 : 0;
  return `<path data-correct-route d="M 50 100 L ${circle.x} ${entryY} A ${circle.radius} ${circle.radius} 0 ${largeArc} 0 ${ringPoint.x} ${ringPoint.y} L ${target.x} ${target.y}"/>`;
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
