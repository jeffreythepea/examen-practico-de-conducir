import { translate } from './i18n.js';
import { createSurfaceModel, seededRandom } from './surface-model.js';

export const CONTROL_SURFACE_IDS = Object.freeze(['wheel-center-v1', 'secure-yaris-v1']);
export const YARIS_SECURE_SEQUENCE = Object.freeze(['parking-brake', 'selector-park']);
export const WHEEL_CENTER_TOLERANCE_DEGREES = 5;

const WHEEL_MIN_DEGREES = -90;
const WHEEL_MAX_DEGREES = 90;

/**
 * Builds a deterministic steering or Yaris securing-control model.
 *
 * The secure-vehicle model intentionally treats the depressed brake pedal as
 * context. Its only learner-operated steps are the hand parking-brake lever,
 * then selector P, matching Yaris manual pages 236, 264, and 269.
 *
 * @param {{ id: string, actionId: string, acceptedResult: string, surfaceId: string }} command
 * @param {number} seed
 * @returns {Readonly<object>}
 */
export function generateControlSurface(command, seed) {
  if (command?.surfaceId === 'wheel-center-v1') return generateWheelModel(command, seed);
  if (command?.surfaceId === 'secure-yaris-v1') return generateSecureYarisModel(command, seed);
  throw new Error(`Unsupported control surface: ${command?.surfaceId}`);
}

/**
 * Reduces a native control event to trial-local response state. Incomplete
 * states carry no selected result and therefore remain unscored by the app.
 *
 * @param {Readonly<object>} model
 * @param {Readonly<object>} responseState
 * @param {Readonly<object>} event
 * @returns {object}
 */
export function reduceControlResponse(model, responseState = {}, event = {}) {
  if (model?.family === 'wheel') return reduceWheelResponse(model, event);
  if (model?.family === 'secure-yaris') return reduceSecureResponse(model, responseState, event);
  throw new Error(`Unsupported control model: ${model?.family}`);
}

/**
 * Renders native, keyboard-accessible controls without attaching event
 * handlers. Task 7 owns routing data-control-event values through the reducer.
 *
 * @param {Readonly<object>} model
 * @param {Readonly<object>} responseState
 * @param {'en'|'es'} locale
 * @param {boolean} disabled
 * @returns {string}
 */
export function renderControlSurface(model, responseState = {}, locale, disabled = false) {
  if (model?.family === 'wheel') return renderWheel(model, responseState, locale, disabled);
  if (model?.family === 'secure-yaris') return renderSecureYaris(model, responseState, locale, disabled);
  throw new Error(`Unsupported control model: ${model?.family}`);
}

function generateWheelModel(command, seed) {
  assertCommandContract(command, 'steering-straight', 'wheel');
  const rng = seededRandom(seed);
  const magnitude = 30 + Math.round(rng() * 60);
  const initialWheelDegrees = (rng() < 0.5 ? -1 : 1) * magnitude;
  return createSurfaceModel({
    id: `wheel-center-v1:${seed}`,
    family: 'wheel',
    version: 1,
    seed,
    expectedResult: 'steering-straight',
    targets: [
      {
        id: 'wheel-center',
        resultId: 'steering-straight',
        kind: 'centered-wheel-position',
        x: 50,
        y: 50,
        width: 12,
        height: 12
      }
    ],
    geometry: {
      minDegrees: WHEEL_MIN_DEGREES,
      maxDegrees: WHEEL_MAX_DEGREES,
      stepDegrees: 1,
      initialWheelDegrees
    },
    meta: {
      commandId: command.id,
      toleranceDegrees: WHEEL_CENTER_TOLERANCE_DEGREES
    }
  });
}

function generateSecureYarisModel(command, seed) {
  assertCommandContract(command, 'secure-vehicle', 'secure-yaris');
  return createSurfaceModel({
    id: `secure-yaris-v1:${seed}`,
    family: 'secure-yaris',
    version: 1,
    seed,
    expectedResult: 'secure-vehicle',
    targets: [
      {
        id: 'parking-brake',
        resultId: 'parking-brake-set',
        kind: 'hand-parking-brake-lever',
        x: 30,
        y: 50,
        width: 34,
        height: 44
      },
      {
        id: 'selector-park',
        resultId: 'secure-vehicle',
        kind: 'selector-position',
        x: 70,
        y: 50,
        width: 34,
        height: 44
      }
    ],
    geometry: {
      controlLayout: 'yaris-centre-console',
      parkingBrakeControl: 'hand-lever',
      brakePedal: 'held'
    },
    meta: {
      commandId: command.id,
      sequence: YARIS_SECURE_SEQUENCE,
      brakePedalHeld: true,
      manualPublication: 'PZ49X-52A96-EN',
      manualPages: [236, 264, 269]
    }
  });
}

function assertCommandContract(command, expectedAction, family) {
  if (command?.actionId !== expectedAction || command?.acceptedResult !== expectedAction) {
    throw new Error(`Unsupported ${family} action: ${command?.actionId}`);
  }
}

function reduceWheelResponse(model, event) {
  if (event.type !== 'set-wheel') throw new Error(`Unsupported wheel event: ${event.type}`);
  if (!Number.isFinite(event.degrees)) throw new Error('Wheel degrees must be finite');
  if (event.degrees < model.geometry.minDegrees || event.degrees > model.geometry.maxDegrees) {
    throw new Error('Wheel degrees are outside the control range');
  }
  const wheelDegrees = event.degrees;
  if (Math.abs(wheelDegrees) > model.meta.toleranceDegrees) {
    return { complete: false, wheelDegrees };
  }
  return {
    complete: true,
    selectedResult: model.expectedResult,
    selectedTargetId: 'wheel-center',
    wheelDegrees
  };
}

function reduceSecureResponse(model, responseState, event) {
  if (event.type !== 'activate') throw new Error(`Unsupported secure-vehicle event: ${event.type}`);
  const sequence = model.meta.sequence;
  if (!sequence.includes(event.targetId)) {
    throw new Error(`Unknown secure-vehicle target: ${event.targetId}`);
  }
  const completedSteps = Array.isArray(responseState.completedSteps)
    ? [...responseState.completedSteps]
    : [];
  if (!completedSteps.every((targetId, index) => targetId === sequence[index])) {
    throw new Error('Invalid secure-vehicle response state');
  }
  const nextStepIndex = completedSteps.length;
  if (event.targetId !== sequence[nextStepIndex]) {
    return {
      complete: false,
      incorrect: true,
      selectedResult: null,
      selectedTargetId: event.targetId,
      completedSteps,
      nextStepIndex
    };
  }

  completedSteps.push(event.targetId);
  const complete = completedSteps.length === sequence.length;
  if (!complete) return { complete: false, completedSteps, nextStepIndex: completedSteps.length };
  return {
    complete: true,
    selectedResult: model.expectedResult,
    selectedTargetId: event.targetId,
    completedSteps,
    nextStepIndex: completedSteps.length
  };
}

function renderWheel(model, responseState, locale, disabled) {
  const requestedDegrees = Number.isFinite(responseState.wheelDegrees)
    ? responseState.wheelDegrees
    : model.geometry.initialWheelDegrees;
  const wheelDegrees = Math.max(model.geometry.minDegrees, Math.min(model.geometry.maxDegrees, requestedDegrees));
  const disabledAttribute = disabled ? ' disabled' : '';
  const reveal = Boolean(responseState.reveal);
  const learnerCorrect = reveal
    && responseState.complete === true
    && responseState.selectedResult === model.expectedResult
    && Math.abs(wheelDegrees) <= model.meta.toleranceDegrees;
  const marker = reveal
    ? learnerCorrect
      ? '<span class="target-status-marker correct control-marker" aria-hidden="true">✓</span>'
      : '<span class="target-status-marker wrong control-marker" aria-hidden="true">×</span>'
    : '';
  const learnerOutcome = reveal
    ? translate(locale, learnerCorrect ? 'surface.selectionCorrect' : 'surface.selectionWrong')
    : '';
  const learnerLabel = reveal
    ? `<p class="wheel-position-label">${escapeHtml(translate(locale, 'surface.wheelFinalPosition'))} — ${escapeHtml(learnerOutcome)}</p>`
    : '';
  const correctReference = reveal && !learnerCorrect
    ? `<div class="wheel-control-stage wheel-correct-reference" data-wheel-position="correct-reference">
        ${renderWheelGraphic(0)}
        <span class="target-status-marker correct control-marker" aria-hidden="true">✓</span>
        <output class="wheel-angle" aria-hidden="true">0°</output>
        <p class="wheel-position-label">${escapeHtml(translate(locale, 'surface.wheelCenteredReference'))}</p>
      </div>`
    : '';
  const resultLabel = reveal
    ? `<p class="surface-result-label">${escapeHtml(translate(locale, 'surface.correctControl'))}</p>`
    : '';
  return `<div class="control-surface wheel-control" data-surface="wheel-center-v1" data-complete="${Boolean(responseState.complete)}">
    <p class="surface-instruction">${escapeHtml(translate(locale, 'surface.centerWheel'))}</p>
    <div class="${reveal && !learnerCorrect ? 'wheel-reveal-comparison' : 'wheel-position-container'}">
      <div class="wheel-control-stage" data-wheel-position="learner"${reveal ? ` data-selection-state="${learnerCorrect ? 'correct' : 'wrong'}"` : ''}>
        ${renderWheelGraphic(wheelDegrees)}
        ${marker}
        <output class="wheel-angle" aria-hidden="true">${escapeHtml(formatDegrees(wheelDegrees))}</output>
        ${learnerLabel}
      </div>
      ${correctReference}
    </div>
    <input class="wheel-range" type="range" min="${model.geometry.minDegrees}" max="${model.geometry.maxDegrees}" step="${model.geometry.stepDegrees}" value="${wheelDegrees}" data-control-event="set-wheel" data-target="wheel-center" aria-label="${escapeAttribute(translate(locale, 'surface.wheelPosition') + (reveal ? ` — ${learnerOutcome}` : ''))}"${learnerCorrect ? ' aria-current="true"' : ''}${disabledAttribute}>
    ${resultLabel}
  </div>`;
}

function renderWheelGraphic(degrees) {
  return `<svg class="steering-wheel-graphic" viewBox="0 0 180 180" aria-hidden="true" focusable="false" style="--wheel-degrees:${degrees}deg">
    <circle cx="90" cy="90" r="70"/>
    <circle cx="90" cy="90" r="19"/>
    <path d="M90 71V20M73 101L31 127M107 101l42 26"/>
  </svg>`;
}

function renderSecureYaris(model, responseState, locale, disabled) {
  const completedSteps = Array.isArray(responseState.completedSteps) ? responseState.completedSteps : [];
  const reveal = Boolean(responseState.reveal);
  const correctTargetId = model.meta.sequence[Math.min(completedSteps.length, model.meta.sequence.length - 1)];
  const disabledAttribute = disabled ? ' disabled' : '';
  const controls = model.targets.map(target => {
    const pressed = completedSteps.includes(target.id);
    const labelKey = target.id === 'parking-brake' ? 'surface.handParkingBrake' : 'surface.selectorPark';
    const correct = target.id === correctTargetId;
    const selected = reveal && target.id === responseState.selectedTargetId;
    const selectionState = selected ? (correct ? 'correct' : 'wrong') : null;
    const selectionLabel = selectionState
      ? ` — ${translate(locale, selectionState === 'correct' ? 'surface.selectionCorrect' : 'surface.selectionWrong')}`
      : '';
    const current = reveal && correct ? ' aria-current="true"' : '';
    const selectedAttributes = selected
      ? ` data-selected="true" data-selection-state="${selectionState}"`
      : '';
    const marker = reveal && correct
      ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
      : selectionState === 'wrong'
        ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
        : '';
    const visual = target.id === 'parking-brake'
      ? '<span class="parking-brake-lever" aria-hidden="true"><span></span></span>'
      : '<span class="selector-park" aria-hidden="true">P</span>';
    return `<button class="secure-control-button" type="button" data-control-event="activate" data-target="${escapeAttribute(target.id)}"${selectedAttributes}${current} aria-pressed="${pressed}" aria-label="${escapeAttribute(translate(locale, labelKey) + selectionLabel)}"${disabledAttribute}>
      ${marker}
      ${visual}
      <span>${escapeHtml(translate(locale, labelKey))}</span>
    </button>`;
  }).join('');
  const sequenceError = responseState.incorrect
    ? `<p class="control-sequence-error" role="alert">${escapeHtml(translate(locale, 'surface.sequenceIncorrect'))}</p>`
    : '';
  const resultLabel = reveal
    ? `<p class="surface-result-label">${escapeHtml(translate(locale, 'surface.correctControl'))}</p>`
    : '';
  const disclosureKey = reveal
    ? 'surface.secureProvisionalRevealDisclosure'
    : 'surface.secureProvisionalPromptDisclosure';
  const disclosure = `<aside class="secure-sequence-disclosure" role="note" data-command="${escapeAttribute(model.meta.commandId)}" aria-labelledby="secure-sequence-disclosure-title" aria-describedby="secure-sequence-disclosure-detail">
      <strong id="secure-sequence-disclosure-title">${escapeHtml(translate(locale, 'surface.secureProvisionalTitle'))}</strong>
      <span id="secure-sequence-disclosure-detail">${escapeHtml(translate(locale, disclosureKey))}</span>
    </aside>`;

  return `<div class="control-surface secure-yaris-control" data-surface="secure-yaris-v1" data-complete="${Boolean(responseState.complete)}">
    <p class="surface-instruction">${escapeHtml(translate(locale, 'surface.operateSecureControls'))}</p>
    ${disclosure}
    <p class="control-context" data-context="brake-pedal-held"><span class="brake-pedal" aria-hidden="true"></span>${escapeHtml(translate(locale, 'surface.brakePedalHeld'))}</p>
    <div class="secure-control-grid">${controls}</div>
    ${sequenceError}
    ${resultLabel}
  </div>`;
}

function formatDegrees(degrees) {
  return `${degrees > 0 ? '+' : ''}${degrees}°`;
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
