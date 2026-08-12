import { translate } from './i18n.js';
import { drivingScene } from './driving-scenes.js';
import { renderPostAnswerMotion } from './post-answer-motion-view.js';
import { assertNonOverlappingTargets, svgRoadPath, targetBox } from './surface-geometry.js';
import { createSurfaceModel, seededRandom } from './surface-model.js';

const STAGE = Object.freeze({ stageWidth: 400, stageHeight: 300 });
const POSITION_JITTER = 1.5;

// Distinct, localized accessible names per target feature — describes what a
// sighted user already sees (position/visible feature only), never which
// target is correct for the current command. Decoy features that already
// carry an explanationKey (see MANOEUVRE_TEMPLATES) reuse that key instead of
// duplicating a string here; this only covers features with no such key.
const FEATURE_LABEL_KEYS = Object.freeze({
  'reverse-direction': 'surface.feature.reverseDirection',
  'straight-route': 'surface.feature.straightRoute',
  'passing-lane': 'surface.feature.passingLane',
  'follow-lane': 'surface.feature.followLane',
  'correct-travel-lane': 'surface.feature.correctTravelLane',
  'right-curb-start': 'surface.feature.curbsidePosition',
  'opposing-lane': 'surface.feature.opposingLane',
  'open-bay': 'surface.feature.openBay',
  'clear-curb': 'surface.feature.clearCurb'
});

export const MANOEUVRE_SURFACE_IDS = Object.freeze([
  'u-turn-v1',
  'overtake-v1',
  'join-traffic-v1',
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
      correctRouteTargetIndex: 2,
      correctRoute: [
        { x: 59, y: 68 }, { x: 53, y: 56 }, { x: 44, y: 37 },
        { x: 44, y: 18 }, { x: 53, y: 14 }
      ],
      targets: [
        { id: 'passing-lane', resultId: 'overtake', kind: 'overtaking-route', feature: 'passing-lane', x: 44, y: 37 },
        { id: 'following-position', resultId: 'follow-vehicle', kind: 'lane-choice', feature: 'follow-lane', x: 58.5, y: 54 }
      ]
    },
    {
      id: 'clear-return-lane',
      expectedResult: 'overtake',
      features: ['two-lane-road', 'vehicle-ahead-high', 'clear-return-gap'],
      correctRouteTargetIndex: 2,
      correctRoute: [
        { x: 59, y: 68 }, { x: 53, y: 57 }, { x: 44, y: 39 },
        { x: 44, y: 18 }, { x: 53, y: 14 }
      ],
      targets: [
        { id: 'passing-path', resultId: 'overtake', kind: 'overtaking-route', feature: 'passing-lane', x: 44, y: 39 },
        { id: 'wait-behind', resultId: 'follow-vehicle', kind: 'lane-choice', feature: 'follow-lane', x: 58.5, y: 56 }
      ]
    }
  ],
  'join-traffic-v1': [
    {
      id: 'curbside-safe-merge',
      expectedResult: 'join-traffic',
      features: ['right-curb-start', 'correct-travel-lane', 'opposing-lane'],
      correctRoute: [
        { x: 66, y: 40 }, { x: 62, y: 38 }, { x: 58, y: 37 },
        { x: 54, y: 38 }, { x: 50, y: 40 }
      ],
      targets: [
        { id: 'merge-correct-lane', resultId: 'join-traffic', kind: 'manoeuvre-route', feature: 'correct-travel-lane', x: 50, y: 40 },
        { id: 'remain-at-curb', resultId: 'stay-parked', kind: 'lane-choice', feature: 'right-curb-start', x: 69, y: 55 },
        { id: 'enter-opposing-lane', resultId: 'wrong-lane', kind: 'lane-choice', feature: 'opposing-lane', x: 31, y: 40 }
      ]
    }
  ],
  'parking-v1': [
    {
      id: 'marked-bays-clear-entry',
      expectedResult: 'park',
      features: ['marked-bays', 'driveway', 'restricted-marking'],
      correctRoute: [
        { x: 50, y: 74 }, { x: 54, y: 67 }, { x: 62, y: 55 },
        { x: 69, y: 45 }, { x: 74, y: 37 }
      ],
      targets: [
        { id: 'open-bay', resultId: 'park', kind: 'legal-space', feature: 'open-bay', x: 74, y: 37 },
        { id: 'driveway-bay', resultId: 'blocked-access', kind: 'illegal-space', feature: 'driveway', explanationKey: 'surface.restricted.blockedAccess', x: 86, y: 15 },
        { id: 'hatched-bay', resultId: 'marked-restriction', kind: 'illegal-space', feature: 'restricted-marking', explanationKey: 'surface.restricted.markedRestriction', x: 28, y: 48 }
      ]
    },
    {
      id: 'curb-bays-clear-space',
      expectedResult: 'park',
      features: ['curb-bays', 'crosswalk', 'no-parking-sign'],
      correctRoute: [
        { x: 50, y: 74 }, { x: 54, y: 67 }, { x: 62, y: 55 },
        { x: 69, y: 45 }, { x: 74, y: 37 }
      ],
      targets: [
        { id: 'clear-curb-bay', resultId: 'park', kind: 'legal-space', feature: 'open-bay', x: 74, y: 37 },
        { id: 'crosswalk-bay', resultId: 'crosswalk', kind: 'illegal-space', feature: 'crosswalk', explanationKey: 'surface.restricted.crosswalk', x: 43, y: 15 },
        { id: 'no-parking-bay', resultId: 'signed-no-parking', kind: 'illegal-space', feature: 'no-parking-sign', explanationKey: 'surface.restricted.noParkingSign', x: 85, y: 86 }
      ]
    }
  ],
  // One photo-grounded template (2026-08-12 scene regen): every candidate
  // stopping spot ranges along the right curb — open curb ahead of the car,
  // the garage vado (illegal even unsigned), and the stretch by the crosswalk.
  // The signed-no-stopping variant retired with the sign; parking before a
  // dropped curb is prohibited without one.
  'stopping-v1': [
    {
      id: 'urban-curb-clear',
      expectedResult: 'voluntary-stop',
      features: ['curb', 'driveway', 'crosswalk'],
      correctRoute: [
        { x: 50, y: 74 }, { x: 56, y: 72 }, { x: 63, y: 70 },
        { x: 70, y: 66 }, { x: 75, y: 62 }
      ],
      targets: [
        { id: 'clear-curb', resultId: 'voluntary-stop', kind: 'legal-stop', feature: 'clear-curb', x: 75, y: 62 },
        { id: 'driveway', resultId: 'blocked-access', kind: 'restricted-stop', feature: 'driveway', explanationKey: 'surface.restricted.blockedAccess', x: 70, y: 43 },
        { id: 'crosswalk', resultId: 'crosswalk', kind: 'restricted-stop', feature: 'crosswalk', explanationKey: 'surface.restricted.crosswalk', x: 59, y: 22 }
      ]
    }
  ]
});

const SURFACE_CONTRACTS = Object.freeze({
  'u-turn-v1': Object.freeze({ action: 'change-direction', family: 'u-turn' }),
  'overtake-v1': Object.freeze({ action: 'overtake', family: 'overtake' }),
  'join-traffic-v1': Object.freeze({ action: 'join-traffic', family: 'join-traffic' }),
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
      ...(contract.family === 'u-turn' ? { sceneId: 'u-turn-photo-v1' } : {}),
      ...(contract.family === 'overtake' ? { sceneId: 'overtaking-photo-v1' } : {}),
      ...(contract.family === 'join-traffic' ? { sceneId: 'join-traffic-photo-v1' } : {}),
      ...(contract.family === 'parking' ? { sceneId: 'parallel-parking-gap-photo-v1' } : {}),
      ...(contract.family === 'stopping' ? { sceneId: 'urban-roadside-photo-v1' } : {}),
      ...(contract.family === 'overtake' ? {
        learnerVehicle: { x: 59, y: 80, width: 14, height: 22 },
        leadVehicle: { x: 53, y: 26, width: 7, height: 10 }
      } : {}),
      ...(contract.family === 'join-traffic' ? {
        learnerVehicle: { x: 68, y: 60, width: 20, height: 28 }
      } : {}),
      ...(template.correctRoute ? {
        correctRoute: routeToTarget(template.correctRoute, correctTarget, template.correctRouteTargetIndex)
      } : {})
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

  const usesRoadTargets = model.family === 'u-turn'
    || model.family === 'overtake'
    || model.family === 'join-traffic';
  const instructionKey = usesRoadTargets ? 'surface.selectRoad' : 'surface.selectSpace';
  const targetLabelKey = usesRoadTargets ? 'surface.selectRoad' : 'surface.targetSpace';
  const selectedTarget = model.targets.find(target => target.id === state.selectedTargetId);
  const restriction = state.reveal && selectedTarget?.explanationKey
    ? `<p class="surface-restriction-label">${escapeHtml(translate(locale, selectedTarget.explanationKey))}</p>`
    : '';
  const resultLabel = state.reveal
    ? `<p class="surface-result-label">${escapeHtml(translate(locale, usesRoadTargets ? 'surface.correctRoute' : 'surface.correctSpace'))}</p>`
    : '';
  const postAnswerMotion = renderPostAnswerMotion(state.postAnswerMotion);
  // The car glyph is the whole route indicator once it's eligible to animate;
  // the static line is only a fallback for ineligible/reduced-motion cases.
  const correctRoute = state.reveal && model.geometry.correctRoute && !postAnswerMotion
    ? `<path data-correct-route d="${escapeAttribute(svgRoadPath(model.geometry.correctRoute))}"/>`
    : '';

  const scene = model.geometry.sceneId ? drivingScene(model.geometry.sceneId) : null;
  const sceneImage = scene
    ? `<img class="driving-scene-image" data-scene="${escapeAttribute(scene.id)}" data-provenance="${escapeAttribute(scene.provenance)}" src="${escapeAttribute(scene.asset)}" alt="${escapeAttribute(locale === 'es' ? scene.alt.es : scene.alt.en)}">`
    : '';
  const sceneContents = `${sceneImage}
      <svg viewBox="0 0 100 100"${scene ? ' preserveAspectRatio="none"' : ''} aria-hidden="true" focusable="false">
        ${manoeuvreDrawing(model, Boolean(scene))}
        ${correctRoute}
      </svg>
      ${postAnswerMotion}
      ${model.targets.map(target => targetButton(
        target,
        model,
        translate(locale, target.explanationKey ?? FEATURE_LABEL_KEYS[target.feature] ?? targetLabelKey),
        {
          ...state,
          correctSelectionLabel: translate(locale, 'surface.selectionCorrect'),
          wrongSelectionLabel: translate(locale, 'surface.selectionWrong')
        }
      )).join('')}`;
  const roadMotion = validRoadMotion(state.motion);
  const renderedScene = roadMotion
    ? `<div class="road-motion-viewport">
      <div class="road-motion-scene" data-road-motion="${escapeAttribute(roadMotion.phase)}" data-road-motion-running="${roadMotion.moving === true}" style="${roadMotionStyle(roadMotion)}">
        ${sceneContents}
      </div>
    </div>`
    : sceneContents;

  return `<div class="manoeuvre-surface">
    <p class="surface-instruction">${escapeHtml(translate(locale, instructionKey))}</p>
    <div class="surface-stage manoeuvre ${model.family}${scene ? ' driving-photo-stage' : ''}${roadMotion ? ' road-motion-stage' : ''}" data-surface="${surfaceId}">
      ${renderedScene}
      ${resultLabel}
      ${restriction}
    </div>
  </div>`;
}

function validRoadMotion(motion) {
  if (!motion || typeof motion.phase !== 'string' || typeof motion.moving !== 'boolean') return null;
  const values = [
    motion.scale,
    motion.endScale,
    motion.origin?.x,
    motion.origin?.y,
    motion.elapsedMs
  ];
  return values.every(Number.isFinite) ? motion : null;
}

function roadMotionStyle(motion) {
  return [
    `--road-motion-scale:${motion.scale}`,
    `--road-motion-end-scale:${motion.endScale}`,
    `--road-motion-origin-x:${motion.origin.x}%`,
    `--road-motion-origin-y:${motion.origin.y}%`,
    `--road-motion-elapsed:${motion.elapsedMs}ms`
  ].join(';');
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

function routeToTarget(route, target, targetIndex = route.length - 1) {
  return route.map((point, index) => index === targetIndex
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
  return `<button class="manoeuvre-target" type="button" data-target="${escapeAttribute(target.id)}" data-result="${escapeAttribute(target.resultId)}" data-feature="${escapeAttribute(target.feature)}"${selectedAttributes}${current} aria-pressed="${selected}" aria-label="${escapeAttribute(accessibleLabel)}"${disabled} style="--target-x:${target.x}%;--target-y:${target.y}%;--target-width:${target.width}%;--target-height:${target.height}%">${marker}</button>`;
}

function manoeuvreDrawing(model, photoBacked = false) {
  if (model.family === 'u-turn') {
    if (photoBacked) return '';
    const side = model.geometry.templateId === 'clear-two-way-turnaround'
      ? '<path d="M 50 48 L 8 48" class="manoeuvre-side-road"/>'
      : '<path d="M 8 48 L 92 48" class="manoeuvre-side-road"/>';
    return `<path d="M 50 100 L 50 0" class="manoeuvre-road"/>
      ${side}
      <path d="M 50 96 L 50 8" class="road-marking"/>`;
  }

  if (model.family === 'overtake') {
    if (photoBacked) return '';
    const learner = model.geometry.learnerVehicle;
    const lead = model.geometry.leadVehicle;
    return `<rect x="18" y="0" width="64" height="100" class="manoeuvre-road-fill"/>
      <path d="M 50 0 L 50 100" class="road-marking"/>
      <rect x="${lead.x - lead.width / 2}" y="${lead.y - lead.height / 2}" width="${lead.width}" height="${lead.height}" rx="3" class="scenario-vehicle lead-vehicle"/>
      <rect x="${learner.x - learner.width / 2}" y="${learner.y - learner.height / 2}" width="${learner.width}" height="${learner.height}" rx="3" class="scenario-vehicle learner-vehicle"/>
      <path d="M ${learner.x} ${learner.y - 4} L ${learner.x} ${learner.y - 17}" class="vehicle-direction"/>`;
  }

  const features = model.targets.map(target => featureDrawing(target, photoBacked)).join('');
  if (model.family === 'parking') {
    if (photoBacked) return features;
    return `<rect x="4" y="8" width="92" height="84" class="manoeuvre-road-fill"/>
      <path d="M 5 50 L 95 50" class="parking-curb"/>
      <path d="M 13 12 V 45 M 40 12 V 45 M 60 12 V 45 M 87 12 V 45" class="parking-bays"/>
      ${features}`;
  }

  if (photoBacked) return features;
  return `<rect x="12" y="0" width="76" height="100" class="manoeuvre-road-fill"/>
    <path d="M 12 0 V 100 M 88 0 V 100" class="parking-curb"/>
    <path d="M 50 0 V 100" class="road-marking"/>
    ${features}`;
}

function featureDrawing(target, photoBacked = false) {
  const x = target.x;
  const y = target.y;
  if (photoBacked && (target.feature === 'crosswalk' || target.feature === 'driveway' || target.feature === 'restricted-marking')) {
    return '';
  }
  if (target.feature === 'crosswalk') {
    return `<path d="M ${x - 8} ${y - 5} H ${x + 8} M ${x - 8} ${y} H ${x + 8} M ${x - 8} ${y + 5} H ${x + 8}" class="scenario-crosswalk"/>`;
  }
  if (target.feature === 'driveway') {
    return `<path d="M ${x - 9} ${y + 7} V ${y - 7} H ${x + 9} V ${y + 7}" class="scenario-driveway"/>`;
  }
  if (target.feature === 'restricted-marking') {
    return `<path d="M ${x - 7} ${y - 6} L ${x + 7} ${y + 6} M ${x + 7} ${y - 6} L ${x - 7} ${y + 6}" class="scenario-restriction"/>`;
  }
  if (target.feature === 'no-parking-sign') return prohibitionSign(x, y, 'no-parking', photoBacked);
  if (target.feature === 'no-stopping-sign') return prohibitionSign(x, y, 'no-stopping', photoBacked);
  return '';
}

function prohibitionSign(x, y, type, photoBacked = false) {
  const centerY = roundCoordinate(y - 7);
  const lines = type === 'no-stopping'
    ? '<path d="M -3.5 -3.5 L 3.5 3.5" class="road-sign-prohibition"/><path d="M 3.5 -3.5 L -3.5 3.5" class="road-sign-prohibition"/>'
    : '<path d="M -3.5 3.5 L 3.5 -3.5" class="road-sign-prohibition"/>';
  const transform = photoBacked
    ? `translate(${x} ${centerY}) scale(0.666667 1)`
    : `translate(${x} ${centerY})`;
  return `<g data-road-sign="${type}" transform="${transform}">
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
