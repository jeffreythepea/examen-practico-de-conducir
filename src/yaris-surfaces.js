import { translate } from './i18n.js';
import { PRECHECK_COMMAND_SCENES, precheckSceneForCommand, renderPrecheckIcon } from './precheck-scenes.js';
import { assertNonOverlappingTargets } from './surface-geometry.js';
import { createSurfaceModel } from './surface-model.js';

export const YARIS_SURFACE_IDS = Object.freeze([
  'yaris-dashboard-v2',
  'yaris-climate-v2',
  'yaris-door-v2',
  'yaris-body-v2',
  'yaris-engine-bay-v2'
]);

export const YARIS_DIAGRAMS = deepFreeze({
  'yaris-dashboard-v2': {
    viewBox: '0 0 400 300',
    manualPublication: 'PZ49X-52A96-EN',
    manualPages: [130, 133, 134, 270, 271, 276, 277],
    provenance: 'manual-derived-original-schematic',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, instrument displays and exterior-light controls, pages 130, 133-134, 270-271 and 276-277',
    equipmentAmbiguity: true,
    art: `<path class="yaris-panel" d="M42 52Q200 10 358 52L338 164Q200 190 62 164Z"/>
      <circle class="yaris-dial" cx="108" cy="96" r="43"/>
      <circle class="yaris-dial" cx="292" cy="96" r="43"/>
      <path class="yaris-gauge-mark" d="M80 113Q108 137 136 113M264 113Q292 137 320 113"/>
      <path class="yaris-gauge-needle" d="M108 116L91 91M292 116L310 88"/>
      <rect class="yaris-display" x="169" y="70" width="62" height="58" rx="9"/>
      <circle class="yaris-wheel" cx="286" cy="226" r="49"/>
      <circle class="yaris-wheel" cx="286" cy="226" r="15"/>
      <path class="yaris-control-line" d="M286 211V179M273 234L244 252M299 234L328 252"/>
      <g data-schematic-group="left-light-stalk">
        <path class="yaris-control-line" d="M239 221H54L40 234"/>
        <rect class="yaris-control-ring" x="52" y="205" width="43" height="39" rx="8"/>
        <rect class="yaris-control-ring" x="105" y="205" width="43" height="39" rx="8"/>
        <path class="yaris-light-symbol" d="M61 216q12 7 0 14M69 214l10-6M71 224h11M69 234l10 6M114 216q12 7 0 14M122 214l10-6M124 224h11M122 234l10 6M181 207l18-12M181 239l18 12"/>
      </g>`,
    hotspots: {
      'temperature-gauge': { resultId: 'locate-engine-temperature', x: 27, y: 32, width: 12, height: 16, kind: 'gauge-location', interaction: 'locate', labelKey: 'surface.yaris.temperatureGauge', labelPlacement: { x: 22, y: 17, width: 30 } },
      'fuel-gauge': { resultId: 'locate-fuel-level', x: 73, y: 32, width: 12, height: 16, kind: 'gauge-location', interaction: 'locate', labelKey: 'surface.yaris.fuelGauge', labelPlacement: { x: 78, y: 17, width: 30 } },
      'high-beam': { resultId: 'high-beams', x: 47, y: 75, width: 12, height: 16, kind: 'stalk-control', interaction: 'operate', controlGroup: 'left-light-stalk', labelKey: 'surface.yaris.highBeam', stateKind: 'power', initialState: false, desiredState: true, labelPlacement: { x: 72, y: 88, width: 26 } },
      'front-fog': { resultId: 'front-fog-lights', x: 31, y: 75, width: 12, height: 16, kind: 'stalk-ring-control', interaction: 'operate', controlGroup: 'left-light-stalk', labelKey: 'surface.yaris.frontFog', stateKind: 'power', initialState: false, desiredState: true, labelPlacement: { x: 44, y: 88, width: 28 } },
      'rear-fog': { resultId: 'rear-fog-light', x: 18, y: 75, width: 12, height: 16, kind: 'stalk-ring-control', interaction: 'operate', controlGroup: 'left-light-stalk', labelKey: 'surface.yaris.rearFog', stateKind: 'power', initialState: false, desiredState: true, labelPlacement: { x: 16, y: 88, width: 26 } }
    }
  },
  'yaris-climate-v2': {
    viewBox: '0 0 400 300',
    manualPublication: 'PZ49X-52A96-EN',
    manualPages: [434, 435, 438],
    provenance: 'manual-derived-original-schematic',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, automatic climate controls and defoggers, pages 434-435 and 438',
    equipmentAmbiguity: false,
    art: `<path class="yaris-panel" d="M78 34H322L344 266H56Z"/>
      <rect class="yaris-display" x="157" y="57" width="86" height="48" rx="9"/>
      <circle class="yaris-dial" cx="119" cy="162" r="45"/>
      <path class="yaris-control-line" d="M94 174Q119 130 144 174"/>
      <rect class="yaris-control-bank" x="117" y="226" width="166" height="28" rx="14"/>
      <path class="yaris-airflow" d="M137 240q6-10 12 0t12 0M187 240q6-10 12 0t12 0M237 240q6-10 12 0t12 0"/>
      <g data-schematic-group="right-demister-controls">
        <circle class="yaris-dial" cx="281" cy="162" r="66"/>
        <rect class="yaris-control-face" x="253" y="110" width="56" height="44" rx="14"/>
        <rect class="yaris-control-face" x="253" y="170" width="56" height="44" rx="14"/>
        <path class="yaris-control-line" d="M264 143Q281 118 298 143M264 203V181h34v22M270 191h22M274 183v16M281 183v16M288 183v16"/>
      </g>`,
    hotspots: {
      'front-demist': { resultId: 'front-demist', x: 70, y: 44, width: 12, height: 16, kind: 'climate-button', interaction: 'operate', controlGroup: 'right-demister-controls', labelKey: 'surface.yaris.frontDemist', stateKind: 'power', initialState: false, desiredState: true, labelPlacement: { x: 70, y: 29, width: 30 } },
      'rear-demist': { resultId: 'rear-demist', x: 70, y: 64, width: 12, height: 16, kind: 'climate-button', interaction: 'operate', controlGroup: 'right-demister-controls', labelKey: 'surface.yaris.rearDemist', stateKind: 'power', initialState: false, desiredState: true, labelPlacement: { x: 70, y: 81, width: 30 } }
    }
  },
  'yaris-door-v2': {
    viewBox: '0 0 400 300',
    manualPublication: 'PZ49X-52A96-EN',
    manualPages: [230],
    provenance: 'manual-derived-original-schematic',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, driver-door power-window and window-lock controls, page 230',
    equipmentAmbiguity: false,
    art: `<path class="yaris-door-card" d="M33 53Q194 21 353 68L329 257H69Q46 187 33 53Z"/>
      <path class="yaris-door-handle" d="M250 74h63q16 0 16 16t-16 16h-63q-16 0-16-16t16-16Z"/>
      <path class="yaris-armrest" d="M61 139Q177 111 298 142L276 231Q163 249 78 218Z"/>
      <rect class="yaris-window-switch" x="144" y="157" width="47" height="38" rx="8" transform="rotate(-7 167 176)"/>
      <rect class="yaris-window-switch" x="199" y="151" width="47" height="38" rx="8" transform="rotate(-7 222 170)"/>
      <rect class="yaris-window-switch" x="151" y="202" width="47" height="29" rx="8" transform="rotate(-7 174 216)"/>
      <rect class="yaris-window-switch" x="206" y="195" width="47" height="29" rx="8" transform="rotate(-7 229 210)"/>
      <rect class="yaris-control-face" x="87" y="103" width="43" height="41" rx="10"/>
      <path class="yaris-lock-symbol" d="M99 123v-7a10 10 0 0 1 20 0v7M95 123h28v15H95Z"/>`,
    hotspots: {
      'window-lock': { resultId: 'lock-rear-windows', x: 27, y: 41, width: 12, height: 16, kind: 'window-lock-button', interaction: 'operate', labelKey: 'surface.yaris.windowLock', stateKind: 'locked', initialState: false, desiredState: true, labelPlacement: { x: 27, y: 59, width: 34 } }
    }
  },
  'yaris-body-v2': {
    viewBox: '0 0 400 300',
    manualPublication: 'PZ49X-52A96-EN',
    manualPages: [178, 481, 493],
    provenance: 'manual-derived-original-schematic',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, back-door opener, hood release, and 12-volt battery location, pages 178, 481 and 493',
    equipmentAmbiguity: false,
    art: `<path class="yaris-body-outline" d="M42 149Q60 98 128 81L243 77Q298 84 334 125L365 139V199H38Z"/>
      <path class="yaris-window" d="M137 89h98q41 7 70 40l-177-1Z"/>
      <line class="yaris-body-divider" x1="231" y1="80" x2="232" y2="198"/>
      <circle class="yaris-wheel-fill" cx="108" cy="202" r="31"/>
      <circle class="yaris-wheel-fill" cx="300" cy="202" r="31"/>
      <path class="yaris-seat" d="M244 120v39h49M244 159l-13 35M293 159l14 35"/>
      <rect class="yaris-battery-cover" x="247" y="163" width="52" height="25" rx="6"/>
      <path class="yaris-boot-control" d="M348 139v38h-24M342 157h18"/>
      <rect class="yaris-inset" x="49" y="222" width="75" height="56" rx="12"/>
      <path class="yaris-bonnet-control" d="M65 263l43-25M70 240h34l5 17H75Z"/>`,
    hotspots: {
      'battery-under-rear-right-seat': { resultId: 'locate-battery', x: 68, y: 59, width: 12, height: 16, kind: 'under-seat-location', interaction: 'locate', labelKey: 'surface.yaris.battery', labelPlacement: { x: 64, y: 77, width: 38 } },
      'bonnet-release': { resultId: 'open-bonnet-check-levels', x: 22, y: 83, width: 12, height: 16, kind: 'release-lever', interaction: 'operate', labelKey: 'surface.yaris.bonnetRelease', stateKind: 'open', initialState: false, desiredState: true, labelPlacement: { x: 22, y: 68, width: 28 } },
      'boot-release': { resultId: 'open-boot', x: 88, y: 52, width: 12, height: 16, kind: 'release-switch', interaction: 'operate', labelKey: 'surface.yaris.bootRelease', stateKind: 'open', initialState: false, desiredState: true, labelPlacement: { x: 83, y: 42, width: 28 } }
    }
  },
  'yaris-engine-bay-v2': {
    viewBox: '0 0 400 300',
    manualPublication: 'PZ49X-52A96-EN',
    manualPages: [485, 486, 489],
    provenance: 'manual-derived-original-schematic',
    reference: 'Toyota Yaris Hybrid 2019 Owner Manual, engine-compartment overview, oil dipstick, and coolant reservoirs, pages 485-486 and 489',
    equipmentAmbiguity: false,
    art: `<path class="yaris-engine-outline" d="M35 55Q200 16 365 55L346 263Q200 287 54 263Z"/>
      <rect class="yaris-engine-block" x="112" y="69" width="154" height="116" rx="24"/>
      <rect class="yaris-engine-box" x="47" y="73" width="58" height="63" rx="11"/>
      <rect class="yaris-engine-box" x="280" y="69" width="66" height="78" rx="11"/>
      <circle class="yaris-reservoir" cx="276" cy="114" r="27"/>
      <circle class="yaris-reservoir" cx="321" cy="159" r="22"/>
      <path class="yaris-dipstick" d="M100 179q-18 3-17 20t20 18h39M91 180a10 10 0 1 0 0 20a10 10 0 1 0 0-20"/>
      <path class="yaris-radiator" d="M75 231Q200 204 325 231M75 241Q200 214 325 241M75 251Q200 224 325 251"/>
      <path class="yaris-hose" d="M265 115Q230 126 237 171M322 160Q294 180 262 170"/>`,
    hotspots: {
      'engine-oil': { resultId: 'locate-oil-check', x: 29, y: 58, width: 12, height: 16, kind: 'fluid-location', interaction: 'locate', labelKey: 'surface.yaris.engineOil', labelPlacement: { x: 29, y: 76, width: 32 } },
      coolant: { resultId: 'locate-coolant-check', x: 69, y: 38, width: 12, height: 16, kind: 'fluid-location', interaction: 'locate', labelKey: 'surface.yaris.coolant', labelPlacement: { x: 69, y: 54, width: 38 } }
    }
  }
});

export const YARIS_COMMAND_CONTRACT = deepFreeze({
  'c-pre-aceite': contract('yaris-engine-bay-v2', 'yaris-manual-v1-eng', 'engine-oil', 'locate', 'locate-oil-check', [485, 486]),
  'c-pre-refrigerante': contract('yaris-engine-bay-v2', 'yaris-manual-v1-eng', 'coolant', 'locate', 'locate-coolant-check', [485, 489]),
  'c-pre-bateria': contract('yaris-body-v2', 'yaris-manual-v1-eng', 'battery-under-rear-right-seat', 'locate', 'locate-battery', [493]),
  'c-pre-capo': contract('yaris-body-v2', 'yaris-manual-v1-eng', 'bonnet-release', 'operate', 'open-bonnet-check-levels', [481, 485], { stateKind: 'open', initialState: false, desiredState: true }),
  'c-pre-combustible': contract('yaris-dashboard-v2', 'yaris-manual-v1-dash', 'fuel-gauge', 'locate', 'locate-fuel-level', [130, 133], { equipmentAmbiguity: true }),
  'c-pre-temperatura': contract('yaris-dashboard-v2', 'yaris-manual-v1-dash', 'temperature-gauge', 'locate', 'locate-engine-temperature', [133, 134], { equipmentAmbiguity: true }),
  'c-pre-bloquear-elevalunas': contract('yaris-door-v2', 'yaris-manual-v1-dash', 'window-lock', 'operate', 'lock-rear-windows', [230], { stateKind: 'locked', initialState: false, desiredState: true }),
  'c-pre-desbloquear-elevalunas': contract('yaris-door-v2', 'yaris-manual-v1-dash', 'window-lock', 'operate', 'unlock-rear-windows', [230], { stateKind: 'locked', initialState: true, desiredState: false }),
  'c-pre-desempanar-delantera': contract('yaris-climate-v2', 'yaris-manual-v1-body', 'front-demist', 'operate', 'front-demist', [434, 435, 438], { stateKind: 'power', initialState: false, desiredState: true }),
  'c-pre-desempanar-trasera': contract('yaris-climate-v2', 'yaris-manual-v1-body', 'rear-demist', 'operate', 'rear-demist', [434, 435, 438], { stateKind: 'power', initialState: false, desiredState: true }),
  'c-pre-largo-alcance': contract('yaris-dashboard-v2', 'yaris-manual-v1-light', 'high-beam', 'operate', 'high-beams', [270, 271], { stateKind: 'power', initialState: false, desiredState: true }),
  'c-pre-niebla-delantera': contract('yaris-dashboard-v2', 'yaris-manual-v1-light', 'front-fog', 'operate', 'front-fog-lights', [270, 276, 277], { stateKind: 'power', initialState: false, desiredState: true, equipmentAmbiguity: true }),
  'c-pre-niebla-trasera': contract('yaris-dashboard-v2', 'yaris-manual-v1-light', 'rear-fog', 'operate', 'rear-fog-light', [270, 276, 277], { stateKind: 'power', initialState: false, desiredState: true, equipmentAmbiguity: true }),
  'c-pre-maletero': contract('yaris-body-v2', 'yaris-manual-v1-body', 'boot-release', 'operate', 'open-boot', [178], { stateKind: 'open', initialState: false, desiredState: true })
});

/**
 * Builds an immutable Yaris model from either the active v1 catalog mapping or
 * its future v2 diagram ID. The manual citation and hotspot mapping are stable;
 * the schematic art is intentionally original and replaceable.
 *
 * @param {{ id: string, actionId: string, acceptedResult: string, surfaceId: string }} command
 * @param {number} seed
 * @returns {Readonly<object>}
 */
export function generateYarisSurface(command, seed) {
  const commandContract = YARIS_COMMAND_CONTRACT[command?.id];
  if (!commandContract) throw new Error(`Unsupported Yaris command: ${command?.id}`);
  if (command.actionId !== commandContract.resultId || command.acceptedResult !== commandContract.resultId) {
    throw new Error(`Unsupported Yaris result: ${command?.acceptedResult}`);
  }
  if (command.surfaceId !== commandContract.legacySurfaceId && command.surfaceId !== commandContract.diagramId) {
    throw new Error(`Unsupported Yaris surface: ${command.surfaceId}`);
  }

  const diagram = YARIS_DIAGRAMS[commandContract.diagramId];
  const scene = PRECHECK_COMMAND_SCENES[command.id] ? precheckSceneForCommand(command.id) : null;
  const sourceTargets = scene?.targets ?? diagram.hotspots;
  const targets = Object.entries(sourceTargets).map(([id, hotspot]) => ({
    id,
    resultId: id === commandContract.hotspotId ? command.acceptedResult : hotspot.resultId,
    x: hotspot.x,
    y: hotspot.y,
    width: hotspot.width,
    height: hotspot.height,
    kind: hotspot.kind,
    interaction: hotspot.interaction,
    labelKey: hotspot.labelKey,
    labelPlacement: hotspot.labelPlacement,
    ...(hotspot.iconKey ? { iconKey: hotspot.iconKey } : {}),
    ...(hotspot.anchorDescription ? { anchorDescription: hotspot.anchorDescription } : {}),
    ...(hotspot.controlGroup ? { controlGroup: hotspot.controlGroup } : {}),
    ...(hotspot.stateKind ? {
      stateKind: id === commandContract.hotspotId ? commandContract.stateKind : hotspot.stateKind,
      initialState: id === commandContract.hotspotId ? commandContract.initialState : hotspot.initialState,
      desiredState: id === commandContract.hotspotId ? commandContract.desiredState : hotspot.desiredState
    } : {})
  }));
  assertNonOverlappingTargets(targets);

  return createSurfaceModel({
    id: `${commandContract.diagramId}:${seed}`,
    family: 'yaris',
    version: 2,
    seed,
    expectedResult: command.acceptedResult,
    targets,
    geometry: {
      diagramId: commandContract.diagramId,
      viewBox: diagram.viewBox,
      schematicVersion: 2,
      ...(scene ? { sceneId: scene.id, photoAsset: scene.asset } : {})
    },
    meta: {
      commandId: command.id,
      diagramId: commandContract.diagramId,
      hotspotId: commandContract.hotspotId,
      responseMode: commandContract.responseMode,
      manualPublication: diagram.manualPublication,
      manualPages: commandContract.manualPages,
      reference: scene?.reference ?? diagram.reference,
      provenance: scene?.provenance ?? diagram.provenance,
      equipmentAmbiguity: Boolean(commandContract.equipmentAmbiguity),
      ...(commandContract.stateKind ? {
        stateKind: commandContract.stateKind,
        initialState: commandContract.initialState,
        desiredState: commandContract.desiredState
      } : {})
    }
  });
}

/**
 * Converts one diagram activation into trial-local state. Locate targets finish
 * on one tap. Operated targets finish when the selected control reaches its
 * declared target state; a valid different hotspot returns its own result ID.
 *
 * @param {Readonly<object>} model
 * @param {Readonly<object>} responseState
 * @param {Readonly<object>} event
 * @returns {object}
 */
export function reduceYarisResponse(model, responseState = {}, event = {}) {
  if (model?.family !== 'yaris') throw new Error(`Unsupported Yaris model: ${model?.family}`);
  if (event.type !== 'activate') throw new Error(`Unsupported Yaris event: ${event.type}`);
  const target = model.targets.find(candidate => candidate.id === event.targetId);
  if (!target) throw new Error(`Unknown Yaris target: ${event.targetId}`);

  if (target.interaction === 'locate') {
    return {
      complete: true,
      selectedResult: target.resultId,
      selectedTargetId: target.id
    };
  }
  if (target.interaction !== 'operate') throw new Error(`Unsupported Yaris interaction: ${target.interaction}`);

  const controlStates = validatedControlStates(model, responseState.controlStates);
  const currentState = Object.hasOwn(controlStates, target.id) ? controlStates[target.id] : target.initialState;
  const nextState = !currentState;
  controlStates[target.id] = nextState;
  const complete = nextState === target.desiredState;
  return {
    complete,
    selectedResult: complete ? target.resultId : null,
    selectedTargetId: target.id,
    controlStates
  };
}

/**
 * Renders the original schematic with invisible-before-reveal hit regions,
 * localized accessible names, and native pressed/current state.
 *
 * @param {Readonly<object>} model
 * @param {Readonly<object>} responseState
 * @param {'en'|'es'} locale
 * @param {boolean} disabled
 * @returns {string}
 */
export function renderYarisSurface(model, responseState = {}, locale, disabled = false) {
  if (model?.family !== 'yaris') throw new Error(`Unsupported Yaris model: ${model?.family}`);
  const diagram = YARIS_DIAGRAMS[model.geometry.diagramId];
  if (!diagram) throw new Error(`Missing Yaris diagram: ${model.geometry.diagramId}`);
  const reveal = Boolean(responseState.reveal);
  const disabledAttribute = disabled ? ' disabled' : '';
  const controls = model.targets.map(target => renderHotspot(
    target,
    model,
    responseState,
    locale,
    reveal,
    disabledAttribute
  )).join('');
  const instructionKey = model.meta.responseMode === 'locate'
    ? 'surface.yaris.locateInstruction'
    : 'surface.yaris.operateInstruction';
  const ambiguity = model.meta.equipmentAmbiguity
    ? `<p class="yaris-equipment-note" data-equipment-ambiguity="true">${escapeHtml(translate(locale, 'surface.yaris.equipmentVariant'))}</p>`
    : '';
  const scene = model.geometry.sceneId ? precheckSceneForCommand(model.meta.commandId) : null;
  const illustrationNote = scene
    ? `<p class="precheck-illustration-note">${escapeHtml(translate(locale, 'surface.precheck.illustrative'))}</p>`
    : '';
  const visual = scene
    ? `<img class="precheck-photo" src="${escapeAttribute(scene.asset)}" alt="${escapeAttribute(translate(locale, scene.altKey))}">`
    : `<svg viewBox="${escapeAttribute(diagram.viewBox)}" aria-hidden="true" focusable="false">${diagram.art}</svg>`;

  return `<div class="yaris-surface" data-response-mode="${escapeAttribute(model.meta.responseMode)}">
    <p class="surface-instruction">${escapeHtml(translate(locale, instructionKey))}</p>
    ${ambiguity}
    ${illustrationNote}
    <div class="surface-stage yaris-schematic${scene ? ' precheck-photo-stage' : ''}" data-surface="${escapeAttribute(model.geometry.diagramId)}"${scene ? ` data-scene="${escapeAttribute(scene.id)}"` : ''} data-manual-publication="${escapeAttribute(model.meta.manualPublication)}" data-manual-pages="${escapeAttribute(model.meta.manualPages.join(','))}">
      ${visual}
      ${controls}
    </div>
  </div>`;
}

function renderHotspot(target, model, responseState, locale, reveal, disabledAttribute) {
  const controlStates = responseState.controlStates ?? {};
  const currentState = Object.hasOwn(controlStates, target.id) ? controlStates[target.id] : target.initialState;
  const baseLabel = translate(locale, target.labelKey);
  const stateLabel = target.interaction === 'operate'
    ? `: ${translate(locale, stateLabelKey(target.stateKind, currentState))}`
    : '';
  const pressed = target.interaction === 'operate' ? ` aria-pressed="${currentState}"` : '';
  const correct = target.resultId === model.expectedResult;
  const selected = reveal && target.id === responseState.selectedTargetId;
  const selectionState = selected ? (correct ? 'correct' : 'wrong') : null;
  const selectedAttributes = selected
    ? ` data-selected="true" data-selection-state="${selectionState}"`
    : '';
  const selectionLabel = selected
    ? ` — ${translate(locale, correct ? 'surface.selectionCorrect' : 'surface.selectionWrong')}`
    : '';
  const accessibleLabel = baseLabel + stateLabel + selectionLabel;
  const current = reveal && correct ? ' aria-current="true"' : '';
  const marker = reveal && correct
    ? '<span class="yaris-hotspot-marker correct" aria-hidden="true">✓</span>'
    : selectionState === 'wrong'
      ? '<span class="yaris-hotspot-marker wrong" aria-hidden="true">×</span>'
      : '';
  const visibleLabel = reveal
    ? `<span class="yaris-hotspot-label" aria-hidden="true" style="--label-x:${target.labelPlacement.x}%;--label-y:${target.labelPlacement.y}%;--label-width:${target.labelPlacement.width}%">${escapeHtml(baseLabel)}</span>`
    : '';

  const icon = target.iconKey ? renderPrecheckIcon(target.iconKey) : '';
  return `<button class="yaris-hotspot${target.iconKey ? ' precheck-photo-hotspot' : ''}" type="button" data-control-event="activate" data-target="${escapeAttribute(target.id)}"${selectedAttributes} aria-label="${escapeAttribute(accessibleLabel)}"${pressed}${current}${disabledAttribute} style="--hotspot-x:${target.x}%;--hotspot-y:${target.y}%;--hotspot-width:${target.width}%;--hotspot-height:${target.height}%">${icon}${marker}</button>${visibleLabel}`;
}

function stateLabelKey(stateKind, state) {
  if (stateKind === 'locked') return state ? 'surface.yaris.state.locked' : 'surface.yaris.state.unlocked';
  if (stateKind === 'open') return state ? 'surface.yaris.state.open' : 'surface.yaris.state.closed';
  return state ? 'surface.yaris.state.on' : 'surface.yaris.state.off';
}

function validatedControlStates(model, states) {
  if (states === undefined) return {};
  if (!states || typeof states !== 'object' || Array.isArray(states)) {
    throw new Error('Invalid Yaris control state');
  }
  const copy = {};
  for (const [targetId, state] of Object.entries(states)) {
    if (!model.targets.some(target => target.id === targetId && target.interaction === 'operate')) {
      throw new Error(`Unknown Yaris control state: ${targetId}`);
    }
    if (typeof state !== 'boolean') throw new Error(`Invalid Yaris control state: ${targetId}`);
    copy[targetId] = state;
  }
  return copy;
}

function contract(diagramId, legacySurfaceId, hotspotId, responseMode, resultId, manualPages, options = {}) {
  return { diagramId, legacySurfaceId, hotspotId, responseMode, resultId, manualPages, ...options };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
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
