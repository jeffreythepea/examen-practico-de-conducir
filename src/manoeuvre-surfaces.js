import { translate } from './i18n.js';
import { assertNonOverlappingTargets, svgRoadPath, targetBox } from './surface-geometry.js';
import { createSurfaceModel, seededRandom } from './surface-model.js';

const STAGE = Object.freeze({ stageWidth: 400, stageHeight: 300 });
const POSITION_JITTER = 1.5;

export const MANOEUVRE_SURFACE_IDS = Object.freeze([
  'u-turn-v1',
  'overtake-v1',
  'parking-v1',
  'stopping-v1'
]);

export const MANOEUVRE_TEMPLATES = freezeTemplates({
  'u-turn-v1': [
    {
      id: 'clear-two-way-turnaround',
      expectedResult: 'change-direction',
      features: ['two-way-road', 'clear-side-road'],
      correctRoute: [
        { x: 60, y: 94 }, { x: 60, y: 48 }, { x: 56, y: 36 },
        { x: 44, y: 36 }, { x: 40, y: 50 }, { x: 40, y: 82 }
      ],
      targets: [
        { id: 'reverse-lane-endpoint', resultId: 'change-direction', kind: 'manoeuvre-route', feature: 'reverse-direction', x: 40, y: 82 },
        { id: 'continue-ahead', resultId: 'continue-forward', kind: 'route-choice', feature: 'straight-route', x: 60, y: 14 }
      ]
    },
    {
      id: 'clear-junction-turnaround',
      expectedResult: 'change-direction',
      features: ['two-way-road', 'clear-junction'],
      correctRoute: [
        { x: 58, y: 94 }, { x: 58, y: 52 }, { x: 70, y: 42 },
        { x: 56, y: 30 }, { x: 44, y: 38 }, { x: 42, y: 54 }, { x: 42, y: 82 }
      ],
      targets: [
        { id: 'junction-reverse-endpoint', resultId: 'change-direction', kind: 'manoeuvre-route', feature: 'reverse-direction', x: 42, y: 82 },
        { id: 'junction-ahead', resultId: 'continue-forward', kind: 'route-choice', feature: 'straight-route', x: 58, y: 14 }
      ]
    }
  ],
  'overtake-v1': [
    {
      id: 'clear-two-lane-pass',
      expectedResult: 'overtake',
      features: ['two-lane-road', 'vehicle-ahead', 'clear-opposing-lane'],
      correctRoute: [{ x: 66, y: 94 }, { x: 66, y: 72 }, { x: 34, y: 55 }, { x: 34, y: 28 }],
      targets: [
        { id: 'passing-lane', resultId: 'overtake', kind: 'overtaking-route', feature: 'passing-lane', x: 34, y: 28 },
        { id: 'following-position', resultId: 'follow-vehicle', kind: 'lane-choice', feature: 'follow-lane', x: 66, y: 46 }
      ]
    },
    {
      id: 'clear-return-lane',
      expectedResult: 'overtake',
      features: ['two-lane-road', 'vehicle-ahead-high', 'clear-return-gap'],
      correctRoute: [{ x: 66, y: 94 }, { x: 66, y: 70 }, { x: 34, y: 52 }, { x: 34, y: 24 }],
      targets: [
        { id: 'passing-path', resultId: 'overtake', kind: 'overtaking-route', feature: 'passing-lane', x: 34, y: 24 },
        { id: 'wait-behind', resultId: 'follow-vehicle', kind: 'lane-choice', feature: 'follow-lane', x: 66, y: 52 }
      ]
    }
  ],
  'parking-v1': [
    {
      id: 'marked-bays-clear-entry',
      expectedResult: 'park',
      features: ['marked-bays', 'driveway', 'restricted-marking'],
      targets: [
        { id: 'open-bay', resultId: 'park', kind: 'legal-space', feature: 'open-bay', x: 28, y: 30 },
        { id: 'driveway-bay', resultId: 'blocked-access', kind: 'illegal-space', feature: 'driveway', explanationKey: 'surface.restricted.blockedAccess', x: 72, y: 30 },
        { id: 'hatched-bay', resultId: 'marked-restriction', kind: 'illegal-space', feature: 'restricted-marking', explanationKey: 'surface.restricted.markedRestriction', x: 50, y: 72 }
      ]
    },
    {
      id: 'curb-bays-clear-space',
      expectedResult: 'park',
      features: ['curb-bays', 'crosswalk', 'no-parking-sign'],
      targets: [
        { id: 'clear-curb-bay', resultId: 'park', kind: 'legal-space', feature: 'open-bay', x: 72, y: 30 },
        { id: 'crosswalk-bay', resultId: 'crosswalk', kind: 'illegal-space', feature: 'crosswalk', explanationKey: 'surface.restricted.crosswalk', x: 28, y: 30 },
        { id: 'no-parking-bay', resultId: 'signed-no-parking', kind: 'illegal-space', feature: 'no-parking-sign', explanationKey: 'surface.restricted.noParkingSign', x: 50, y: 72 }
      ]
    }
  ],
  'stopping-v1': [
    {
      id: 'urban-curb-clear',
      expectedResult: 'voluntary-stop',
      features: ['curb', 'driveway', 'crosswalk'],
      targets: [
        { id: 'clear-curb', resultId: 'voluntary-stop', kind: 'legal-stop', feature: 'clear-curb', x: 78, y: 34 },
        { id: 'driveway', resultId: 'blocked-access', kind: 'restricted-stop', feature: 'driveway', explanationKey: 'surface.restricted.blockedAccess', x: 78, y: 62 },
        { id: 'crosswalk', resultId: 'crosswalk', kind: 'restricted-stop', feature: 'crosswalk', explanationKey: 'surface.restricted.crosswalk', x: 42, y: 18 }
      ]
    },
    {
      id: 'no-stopping-curb-clear',
      expectedResult: 'voluntary-stop',
      features: ['curb', 'no-stopping-sign', 'crosswalk'],
      targets: [
        { id: 'clear-left-curb', resultId: 'voluntary-stop', kind: 'legal-stop', feature: 'clear-curb', x: 22, y: 34 },
        { id: 'no-stopping-curb', resultId: 'signed-no-stopping', kind: 'restricted-stop', feature: 'no-stopping-sign', explanationKey: 'surface.restricted.noStoppingSign', x: 22, y: 62 },
        { id: 'upper-crosswalk', resultId: 'crosswalk', kind: 'restricted-stop', feature: 'crosswalk', explanationKey: 'surface.restricted.crosswalk', x: 58, y: 18 }
      ]
    }
  ]
});

const SURFACE_CONTRACTS = Object.freeze({
  'u-turn-v1': Object.freeze({ action: 'change-direction', family: 'u-turn' }),
  'overtake-v1': Object.freeze({ action: 'overtake', family: 'overtake' }),
  'parking-v1': Object.freeze({ action: 'park', family: 'parking' }),
  'stopping-v1': Object.freeze({ action: 'voluntary-stop', family: 'stopping' })
});

const FAMILY_SURFACES = Object.freeze(Object.fromEntries(
  Object.entries(SURFACE_CONTRACTS).map(([surfaceId, contract]) => [contract.family, surfaceId])
));

/**
 * Builds one deterministic model from a named, reviewed scenario template.
 * Randomness chooses a template and adds restrained positional variation; it
 * never decides which location is accepted or restricted.
 *
 * @param {{ id: string, actionId: string, acceptedResult: string, surfaceId: string }} command
 * @param {number} seed
 * @returns {Readonly<object>}
 */
export function generateManoeuvreSurface(command, seed) {
  const contract = SURFACE_CONTRACTS[command?.surfaceId];
  if (!contract) throw new Error(`Unsupported manoeuvre surface: ${command?.surfaceId}`);
  if (command.actionId !== contract.action || command.acceptedResult !== contract.action) {
    throw new Error(`Unsupported ${contract.family} action: ${command?.actionId}`);
  }

  const rng = seededRandom(seed);
  // Sequential integer seeds correlate in the first PRNG sample. Discard it so
  // seed sweeps exercise both reviewed templates without changing semantics.
  rng();
  const templates = MANOEUVRE_TEMPLATES[command.surfaceId];
  const template = templates[Math.floor(rng() * templates.length)];
  const targets = template.targets.map(target => jitteredTarget(target, rng));
  assertNonOverlappingTargets(targets);
  const correctTarget = targets.find(target => target.resultId === template.expectedResult);

  return createSurfaceModel({
    id: `${command.surfaceId}:${seed}`,
    family: contract.family,
    version: 1,
    seed,
    expectedResult: template.expectedResult,
    targets,
    geometry: {
      entry: 'bottom',
      templateId: template.id,
      features: template.features,
      ...(template.correctRoute ? { correctRoute: routeToTarget(template.correctRoute, correctTarget) } : {})
    },
    meta: {
      commandId: command.id,
      provisionalLocationRules: command.surfaceId === 'parking-v1' || command.surfaceId === 'stopping-v1'
    }
  });
}

/**
 * Renders targets without visible answer labels. Reveal mode marks the accepted
 * route or space and, when applicable, explains the selected restricted feature.
 *
 * @param {Readonly<object>} model
 * @param {'en'|'es'} locale
 * @param {{ disabled?: boolean, reveal?: boolean, selectedTargetId?: string }} state
 * @returns {string}
 */
export function renderManoeuvreSurface(model, locale, state = {}) {
  const surfaceId = FAMILY_SURFACES[model?.family];
  if (!surfaceId) throw new Error(`Unsupported manoeuvre model: ${model?.family}`);

  const usesRoadTargets = model.family === 'u-turn' || model.family === 'overtake';
  const instructionKey = usesRoadTargets ? 'surface.selectRoad' : 'surface.selectSpace';
  const targetLabelKey = usesRoadTargets ? 'surface.selectRoad' : 'surface.targetSpace';
  const selectedTarget = model.targets.find(target => target.id === state.selectedTargetId);
  const restriction = state.reveal && selectedTarget?.explanationKey
    ? `<p class="surface-restriction-label">${escapeHtml(translate(locale, selectedTarget.explanationKey))}</p>`
    : '';
  const resultLabel = state.reveal
    ? `<p class="surface-result-label">${escapeHtml(translate(locale, usesRoadTargets ? 'surface.correctRoute' : 'surface.correctSpace'))}</p>`
    : '';
  const correctRoute = state.reveal && model.geometry.correctRoute
    ? `<path data-correct-route d="${escapeAttribute(svgRoadPath(model.geometry.correctRoute))}"/>`
    : '';

  return `<div class="manoeuvre-surface">
    <p class="surface-instruction">${escapeHtml(translate(locale, instructionKey))}</p>
    <div class="surface-stage manoeuvre ${model.family}" data-surface="${surfaceId}">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        ${manoeuvreDrawing(model)}
        ${correctRoute}
      </svg>
      ${model.targets.map(target => targetButton(
        target,
        model,
        translate(locale, targetLabelKey),
        {
          ...state,
          correctSelectionLabel: translate(locale, 'surface.selectionCorrect'),
          wrongSelectionLabel: translate(locale, 'surface.selectionWrong')
        }
      )).join('')}
      ${resultLabel}
      ${restriction}
    </div>
  </div>`;
}

function jitteredTarget(templateTarget, rng) {
  const box = targetBox(
    templateTarget.id,
    templateTarget.resultId,
    jitterPosition(templateTarget.x, rng),
    jitterPosition(templateTarget.y, rng),
    { ...STAGE, kind: templateTarget.kind }
  );
  return {
    ...box,
    feature: templateTarget.feature,
    ...(templateTarget.explanationKey ? { explanationKey: templateTarget.explanationKey } : {})
  };
}

function jitterPosition(base, rng) {
  return Math.round((base + (rng() * 2 - 1) * POSITION_JITTER) * 100) / 100;
}

function routeToTarget(route, target) {
  return route.map((point, index) => index === route.length - 1
    ? { x: target.x, y: target.y }
    : { ...point });
}

function targetButton(target, model, ariaLabel, state) {
  const correct = target.resultId === model.expectedResult;
  const selected = state.reveal && target.id === state.selectedTargetId;
  const selectionState = selected ? (correct ? 'correct' : 'wrong') : null;
  const selectionLabel = selectionState === 'correct'
    ? state.correctSelectionLabel
    : state.wrongSelectionLabel;
  const current = state.reveal && correct ? ' aria-current="true"' : '';
  const selectedAttributes = selected
    ? ` data-selected="true" data-selection-state="${selectionState}"`
    : '';
  const accessibleLabel = selected ? `${ariaLabel} — ${selectionLabel}` : ariaLabel;
  const marker = state.reveal && correct
    ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
    : selectionState === 'wrong'
      ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
      : '';
  const disabled = state.disabled ? ' disabled' : '';
  return `<button class="manoeuvre-target" type="button" data-target="${escapeAttribute(target.id)}" data-result="${escapeAttribute(target.resultId)}"${selectedAttributes}${current} aria-pressed="${selected}" aria-label="${escapeAttribute(accessibleLabel)}"${disabled} style="--target-x:${target.x}%;--target-y:${target.y}%;--target-width:${target.width}%;--target-height:${target.height}%">${marker}</button>`;
}

function manoeuvreDrawing(model) {
  if (model.family === 'u-turn') {
    const side = model.geometry.templateId === 'clear-two-way-turnaround'
      ? '<path d="M 50 48 L 8 48" class="manoeuvre-side-road"/>'
      : '<path d="M 8 48 L 92 48" class="manoeuvre-side-road"/>';
    return `<path d="M 50 100 L 50 0" class="manoeuvre-road"/>
      ${side}
      <path d="M 50 96 L 50 8" class="road-marking"/>`;
  }

  if (model.family === 'overtake') {
    const vehicleY = model.geometry.features.includes('vehicle-ahead-high') ? 35 : 42;
    return `<rect x="18" y="0" width="64" height="100" class="manoeuvre-road-fill"/>
      <path d="M 50 0 L 50 100" class="road-marking"/>
      <rect x="59" y="${vehicleY}" width="14" height="22" rx="4" class="scenario-vehicle"/>
      <path d="M 66 96 L 66 76" class="vehicle-direction"/>`;
  }

  const features = model.targets.map(target => featureDrawing(target)).join('');
  if (model.family === 'parking') {
    return `<rect x="4" y="8" width="92" height="84" class="manoeuvre-road-fill"/>
      <path d="M 5 50 L 95 50" class="parking-curb"/>
      <path d="M 13 12 V 45 M 40 12 V 45 M 60 12 V 45 M 87 12 V 45" class="parking-bays"/>
      ${features}`;
  }

  return `<rect x="12" y="0" width="76" height="100" class="manoeuvre-road-fill"/>
    <path d="M 12 0 V 100 M 88 0 V 100" class="parking-curb"/>
    <path d="M 50 0 V 100" class="road-marking"/>
    ${features}`;
}

function featureDrawing(target) {
  const x = target.x;
  const y = target.y;
  if (target.feature === 'crosswalk') {
    return `<path d="M ${x - 8} ${y - 5} H ${x + 8} M ${x - 8} ${y} H ${x + 8} M ${x - 8} ${y + 5} H ${x + 8}" class="scenario-crosswalk"/>`;
  }
  if (target.feature === 'driveway') {
    return `<path d="M ${x - 9} ${y + 7} V ${y - 7} H ${x + 9} V ${y + 7}" class="scenario-driveway"/>`;
  }
  if (target.feature === 'restricted-marking') {
    return `<path d="M ${x - 7} ${y - 6} L ${x + 7} ${y + 6} M ${x + 7} ${y - 6} L ${x - 7} ${y + 6}" class="scenario-restriction"/>`;
  }
  if (target.feature === 'no-parking-sign') return prohibitionSign(x, y, 'no-parking');
  if (target.feature === 'no-stopping-sign') return prohibitionSign(x, y, 'no-stopping');
  return '';
}

function prohibitionSign(x, y, type) {
  const centerY = roundCoordinate(y - 7);
  const lines = type === 'no-stopping'
    ? '<path d="M -3.5 -3.5 L 3.5 3.5" class="road-sign-prohibition"/><path d="M 3.5 -3.5 L -3.5 3.5" class="road-sign-prohibition"/>'
    : '<path d="M -3.5 3.5 L 3.5 -3.5" class="road-sign-prohibition"/>';
  return `<g data-road-sign="${type}" transform="translate(${x} ${centerY})">
    <circle r="5" class="road-sign-face"/>
    ${lines}
    <path d="M 0 5 V 14" class="scenario-sign-post"/>
  </g>`;
}

function roundCoordinate(value) {
  return Math.round(value * 100) / 100;
}

function freezeTemplates(input) {
  for (const templates of Object.values(input)) {
    for (const template of templates) deepFreeze(template);
    Object.freeze(templates);
  }
  return Object.freeze(input);
}

function deepFreeze(value) {
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) deepFreeze(nested);
  }
  return Object.freeze(value);
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
