import { translate } from './i18n.js';
import { createSurfaceModel, seededRandom } from './surface-model.js';

export const CONTROL_SURFACE_IDS = Object.freeze(['wheel-center-v1', 'secure-yaris-v1']);
export const MANUAL_SECURE_TARGETS = Object.freeze(['engine-stop', 'parking-brake', 'manual-gear']);
export const WHEEL_CENTER_TOLERANCE_DEGREES = 5;

const WHEEL_MIN_DEGREES = -90;
const WHEEL_MAX_DEGREES = 90;

/**
 * Builds a deterministic steering or generic manual securing-control model.
 * The secure-vehicle model follows RGC Article 92 while retaining its legacy
 * external surface ID so existing progress and response provenance remain valid.
 *
 * @param {{ id: string, actionId: string, acceptedResult: string, surfaceId: string }} command
 * @param {number} seed
 * @returns {Readonly<object>}
 */
export function generateControlSurface(command, seed) {
  if (command?.surfaceId === 'wheel-center-v1') return generateWheelModel(command, seed);
  if (command?.surfaceId === 'secure-yaris-v1') return generateSecureManualModel(command, seed);
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
  if (model?.family === 'secure-manual') return reduceSecureResponse(model, responseState, event);
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
  if (model?.family === 'secure-manual') return renderSecureManual(model, responseState, locale, disabled);
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

function generateSecureManualModel(command, seed) {
  assertCommandContract(command, 'secure-vehicle', 'secure-manual');
  const rng = seededRandom(seed);
  rng();
  const slope = rng() < 0.5 ? 'uphill' : 'downhill';
  const requiredGear = slope === 'uphill' ? 'first' : 'reverse';
  return createSurfaceModel({
    id: `secure-yaris-v1:${seed}`,
    family: 'secure-manual',
    version: 1,
    seed,
    expectedResult: 'secure-vehicle',
    targets: [
      {
        id: 'engine-stop',
        resultId: 'engine-stopped',
        kind: 'ignition-control',
        x: 17,
        y: 50,
        width: 26,
        height: 44
      },
      {
        id: 'parking-brake',
        resultId: 'parking-brake-set',
        kind: 'hand-parking-brake-lever',
        x: 50,
        y: 50,
        width: 26,
        height: 44
      },
      {
        id: 'manual-gear',
        resultId: 'secure-vehicle',
        kind: 'manual-gear-selector',
        x: 83,
        y: 50,
        width: 26,
        height: 44
      }
    ],
    geometry: {
      controlLayout: 'generic-manual-controls',
      parkingBrakeControl: 'hand-lever',
      gearPattern: 'h-pattern'
    },
    meta: {
      commandId: command.id,
      slope,
      requiredGear,
      legalReference: 'RGC Article 92'
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
  const state = validatedSecureState(responseState);
  const ready = state.engineStopped && state.parkingBrakeApplied && state.selectedGear !== null;
  if (event.type === 'submit-secure') {
    if (!ready) return { complete: false, ready: false, selectedResult: null, selectedTargetId: null, ...state };
    const correct = state.selectedGear === model.meta.requiredGear;
    return {
      complete: correct,
      ...(!correct ? { incorrect: true } : {}),
      ready: true,
      selectedResult: correct ? model.expectedResult : null,
      selectedTargetId: 'manual-gear',
      ...state
    };
  }
  if (!MANUAL_SECURE_TARGETS.includes(event.targetId)) {
    throw new Error(`Unknown secure-vehicle target: ${event.targetId}`);
  }
  if (event.type === 'activate' && event.targetId === 'engine-stop') {
    state.engineStopped = !state.engineStopped;
  } else if (event.type === 'activate' && event.targetId === 'parking-brake') {
    state.parkingBrakeApplied = !state.parkingBrakeApplied;
  } else if (event.type === 'select-gear' && event.targetId === 'manual-gear') {
    if (!['first', 'reverse'].includes(event.gear)) throw new Error(`Unsupported manual gear: ${event.gear}`);
    state.selectedGear = state.selectedGear === event.gear ? null : event.gear;
  } else {
    throw new Error(`Unsupported secure-vehicle event: ${event.type}`);
  }
  const selectionReady = state.engineStopped && state.parkingBrakeApplied && state.selectedGear !== null;
  return {
    complete: false,
    ready: selectionReady,
    selectedResult: null,
    selectedTargetId: event.targetId,
    ...state
  };
}

function validatedSecureState(responseState) {
  const engineStopped = responseState.engineStopped ?? false;
  const parkingBrakeApplied = responseState.parkingBrakeApplied ?? false;
  const selectedGear = responseState.selectedGear ?? null;
  if (typeof engineStopped !== 'boolean' || typeof parkingBrakeApplied !== 'boolean') {
    throw new Error('Invalid secure-vehicle response state');
  }
  if (selectedGear !== null && !['first', 'reverse'].includes(selectedGear)) {
    throw new Error('Invalid secure-vehicle response state');
  }
  return { engineStopped, parkingBrakeApplied, selectedGear };
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

function renderSecureManual(model, responseState, locale, disabled) {
  const state = validatedSecureState(responseState);
  const reveal = Boolean(responseState.reveal);
  const disabledAttribute = disabled ? ' disabled' : '';
  const engine = renderManualToggle({
    id: 'engine-stop', pressed: state.engineStopped, labelKey: 'surface.engineStop',
    visual: '<span class="engine-stop-icon" aria-hidden="true">⏻</span>', model, responseState, locale, reveal, disabledAttribute
  });
  const parkingBrake = renderManualToggle({
    id: 'parking-brake', pressed: state.parkingBrakeApplied, labelKey: 'surface.handParkingBrake',
    visual: '<span class="parking-brake-lever" aria-hidden="true"><span></span></span>', model, responseState, locale, reveal, disabledAttribute
  });
  const gearButtons = ['first', 'reverse'].map(gear => {
    const selected = state.selectedGear === gear;
    const correct = gear === model.meta.requiredGear;
    const selectedState = reveal && selected ? (correct ? 'correct' : 'wrong') : null;
    const current = reveal && correct ? ' aria-current="true"' : '';
    const selectedAttributes = selectedState
      ? ` data-selected="true" data-selection-state="${selectedState}"`
      : '';
    const marker = reveal && correct
      ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
      : selectedState === 'wrong'
        ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
        : '';
    const labelKey = gear === 'first' ? 'surface.manualFirst' : 'surface.manualReverse';
    return `<button class="manual-gear-button" type="button" data-control-event="select-gear" data-target="manual-gear" data-gear="${gear}"${selectedAttributes}${current} aria-pressed="${selected}" aria-label="${escapeAttribute(translate(locale, labelKey))}"${disabledAttribute}>${marker}<strong>${gear === 'first' ? '1' : 'R'}</strong><span>${escapeHtml(translate(locale, labelKey))}</span></button>`;
  }).join('');
  const resultLabel = reveal
    ? `<p class="surface-result-label">${escapeHtml(translate(locale, 'surface.correctControl'))}</p>`
    : '';
  const ready = state.engineStopped && state.parkingBrakeApplied && state.selectedGear !== null;
  const submitButton = reveal
    ? ''
    : `<button class="secure-submit-button" type="button" data-control-event="submit-secure"${ready && !disabled ? '' : ' disabled'}>${escapeHtml(translate(locale, 'surface.checkSecureAnswer'))}</button>`;
  const disclosureKey = reveal
    ? 'surface.secureProvisionalRevealDisclosure'
    : 'surface.secureProvisionalPromptDisclosure';
  const disclosure = `<aside class="secure-sequence-disclosure" role="note" data-command="${escapeAttribute(model.meta.commandId)}" aria-labelledby="secure-sequence-disclosure-title" aria-describedby="secure-sequence-disclosure-detail">
      <strong id="secure-sequence-disclosure-title">${escapeHtml(translate(locale, 'surface.secureProvisionalTitle'))}</strong>
      <span id="secure-sequence-disclosure-detail">${escapeHtml(translate(locale, disclosureKey))}</span>
    </aside>`;

  const slopeKey = model.meta.slope === 'uphill' ? 'surface.slopeUphill' : 'surface.slopeDownhill';
  return `<div class="control-surface secure-yaris-control secure-manual-control" data-surface="secure-yaris-v1" data-family="secure-manual" data-slope="${model.meta.slope}" data-complete="${Boolean(responseState.complete)}">
    <p class="surface-instruction">${escapeHtml(translate(locale, 'surface.operateSecureControls'))}</p>
    ${disclosure}
    <p class="manual-slope-context"><span class="slope-road" aria-hidden="true" data-slope="${model.meta.slope}"><svg class="slope-car" viewBox="0 0 64 32" focusable="false"><path class="slope-car-body" d="M4 23V18l7-2 7-8h23l10 8h7l2 7v3H4z"/><circle class="slope-car-wheel" cx="17" cy="25" r="5"/><circle class="slope-car-wheel" cx="48" cy="25" r="5"/><path class="slope-car-window" d="M22 11h16l7 6H17z"/><path class="slope-car-front" d="M56 17h4v6h-4z"/></svg></span>${escapeHtml(translate(locale, slopeKey))}</p>
    <div class="secure-control-grid">${engine}${parkingBrake}<div class="manual-gear-control"><span class="manual-gear-pattern" aria-hidden="true">1&nbsp;&nbsp;3&nbsp;&nbsp;5<br>│─┼─│<br>2&nbsp;&nbsp;4&nbsp;&nbsp;R</span><div class="manual-gear-options">${gearButtons}</div></div></div>
    ${submitButton}
    ${resultLabel}
  </div>`;
}

function renderManualToggle({ id, pressed, labelKey, visual, model, responseState, locale, reveal, disabledAttribute }) {
  const selected = reveal && id === responseState.selectedTargetId;
  const selectedState = selected ? (pressed ? 'correct' : 'wrong') : null;
  const current = reveal && !pressed ? ' aria-current="true"' : '';
  const selectedAttributes = selectedState
    ? ` data-selected="true" data-selection-state="${selectedState}"`
    : '';
  const marker = reveal && !pressed
    ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
    : selectedState === 'wrong'
      ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
      : '';
  return `<button class="secure-control-button" type="button" data-control-event="activate" data-target="${id}"${selectedAttributes}${current} aria-pressed="${pressed}" aria-label="${escapeAttribute(translate(locale, labelKey))}"${disabledAttribute}>${marker}${visual}<span>${escapeHtml(translate(locale, labelKey))}</span></button>`;
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
