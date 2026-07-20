import { generateControlSurface, reduceControlResponse, renderControlSurface } from './control-surfaces.js';
import { translate } from './i18n.js';
import { generateManoeuvreSurface, renderManoeuvreSurface } from './manoeuvre-surfaces.js';
import { generateSpatialSurface, renderSpatialSurface } from './spatial-surfaces.js';
import { createSurfaceModel, seededRandom } from './surface-model.js';
import {
  YARIS_SURFACE_IDS,
  generateYarisSurface,
  reduceYarisResponse,
  renderYarisSurface
} from './yaris-surfaces.js';

export { YARIS_SURFACE_IDS } from './yaris-surfaces.js';

export const SUPPORTED_SURFACE_IDS = Object.freeze([
  'junction-v2',
  'roundabout-v2',
  'u-turn-v1',
  'overtake-v1',
  'parking-v1',
  'stopping-v1',
  'wheel-center-v1',
  'secure-yaris-v1',
  'option-grid-v1',
  ...YARIS_SURFACE_IDS
]);

const SUPPORTED_SURFACES = new Set(SUPPORTED_SURFACE_IDS);

export function supportedCommands(commands, onUnsupported = () => {}) {
  return commands.filter(command => {
    const supported = SUPPORTED_SURFACES.has(command.surfaceId);
    if (!supported) onUnsupported(`Excluded ${command.id}: unsupported surface ${command.surfaceId}`);
    return supported;
  });
}

const SPATIAL_SURFACE_IDS = new Set(['junction-v2', 'roundabout-v2']);
const MANOEUVRE_SURFACE_IDS = new Set(['u-turn-v1', 'overtake-v1', 'parking-v1', 'stopping-v1']);
const CONTROL_SURFACE_IDS = new Set(['wheel-center-v1', 'secure-yaris-v1']);
const SEMANTIC_RESULTS = Object.freeze(['adapt-speed', 'involuntary-stop', 'exam-finish']);
const SEMANTIC_LAYOUT_SEED_SALT = 0x9e3779b9;

export const SEMANTIC_RESULT_ICONS = Object.freeze({
  'adapt-speed': '⏬',
  'involuntary-stop': '🚧',
  'exam-finish': '🏁'
});

/**
 * Generates one immutable model for every active production surface.
 */
export function generateSurface(command, seed) {
  if (SPATIAL_SURFACE_IDS.has(command?.surfaceId)) return generateSpatialSurface(command, seed);
  if (MANOEUVRE_SURFACE_IDS.has(command?.surfaceId)) return generateManoeuvreSurface(command, seed);
  if (CONTROL_SURFACE_IDS.has(command?.surfaceId)) return generateControlSurface(command, seed);
  if (YARIS_SURFACE_IDS.includes(command?.surfaceId)) return generateYarisSurface(command, seed);
  if (command?.surfaceId === 'option-grid-v1') return generateSemanticSurface(command, seed);
  throw new Error(`Unsupported surface: ${command?.surfaceId}`);
}

/**
 * Normalizes native surface events to one completion response. Incomplete and
 * unknown events remain trial-local and cannot score.
 */
export function reduceSurfaceResponse(model, responseState = {}, event = {}) {
  if (model?.family === 'wheel' || model?.family === 'secure-manual') {
    return reduceControlResponse(model, responseState, event);
  }
  if (model?.family === 'yaris') return reduceYarisResponse(model, responseState, event);
  if (event.type !== 'select-target') return responseState;
  const target = model?.targets?.find(candidate => candidate.id === event.targetId);
  if (!target) return responseState;
  return {
    complete: true,
    selectedResult: target.resultId,
    selectedTargetId: target.id
  };
}

/**
 * Renders the exact retained model for prompt or reveal without regenerating.
 */
export function renderSurfaceModel(model, responseState = {}, locale, options = {}) {
  if (!model) throw new Error('Surface model is required');
  const state = {
    ...responseState,
    ...options,
    selectedTargetId: options.selectedTargetId ?? responseState.selectedTargetId
  };
  if (model.family === 'junction' || model.family === 'roundabout') {
    return renderSpatialSurface(model, locale, state);
  }
  if (['u-turn', 'overtake', 'parking', 'stopping'].includes(model.family)) {
    return renderManoeuvreSurface(model, locale, state);
  }
  if (model.family === 'wheel' || model.family === 'secure-manual') {
    return renderControlSurface(model, state, locale, Boolean(options.disabled));
  }
  if (model.family === 'yaris') {
    return renderYarisSurface(model, state, locale, Boolean(options.disabled));
  }
  if (model.family === 'semantic') return renderSemanticSurface(model, locale, state);
  throw new Error(`Unsupported surface model: ${model.family}`);
}

function generateSemanticSurface(command, seed) {
  if (!SEMANTIC_RESULTS.includes(command?.acceptedResult) || command.actionId !== command.acceptedResult) {
    throw new Error(`Unsupported semantic action: ${command?.actionId}`);
  }
  const layoutSeed = (seed ^ SEMANTIC_LAYOUT_SEED_SALT) >>> 0;
  const shuffledResults = shuffleResults(SEMANTIC_RESULTS, seededRandom(layoutSeed));
  return createSurfaceModel({
    id: `option-grid-v1:${seed}`,
    family: 'semantic',
    version: 1,
    seed,
    expectedResult: command.acceptedResult,
    targets: shuffledResults.map((resultId, index) => ({
      id: `semantic-${resultId}`,
      resultId,
      kind: 'semantic-choice',
      x: 25 + (index % 2) * 50,
      y: index < 2 ? 30 : 75,
      width: 42,
      height: 30
    })),
    geometry: { layout: 'semantic-grid', columns: 2 },
    meta: { commandId: command.id, declaredException: true }
  });
}

function shuffleResults(results, rng) {
  const shuffled = [...results];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function renderSemanticSurface(model, locale, state) {
  const buttons = model.targets.map(target => {
    const correct = target.resultId === model.expectedResult;
    const selected = Boolean(state.reveal && target.id === state.selectedTargetId);
    const selectionState = selected ? (correct ? 'correct' : 'wrong') : null;
    const accessibleOutcome = selectionState
      ? ` — ${translate(locale, selectionState === 'correct' ? 'surface.selectionCorrect' : 'surface.selectionWrong')}`
      : '';
    const revealAttributes = state.reveal && correct ? ' aria-current="true"' : '';
    const selectedAttributes = selected
      ? ` data-selected="true" data-selection-state="${selectionState}"`
      : '';
    const marker = state.reveal && correct
      ? '<span class="target-status-marker correct" aria-hidden="true">✓</span>'
      : selectionState === 'wrong'
        ? '<span class="target-status-marker wrong" aria-hidden="true">×</span>'
        : '';
    const icon = `<span class="option-icon" aria-hidden="true">${SEMANTIC_RESULT_ICONS[target.resultId]}</span>`;
    return `<button class="surface-option semantic-option" type="button" data-target="${escapeAttribute(target.id)}" data-result="${escapeAttribute(target.resultId)}" aria-label="${escapeAttribute(translate(locale, `actionResult.${target.resultId}`) + accessibleOutcome)}"${selectedAttributes}${revealAttributes}${state.disabled ? ' disabled' : ''}>${marker}${icon}<span>${escapeHtml(translate(locale, `actionResult.${target.resultId}`))}</span></button>`;
  }).join('');
  return `<div class="surface-grid semantic-grid" data-surface="option-grid-v1">${buttons}</div>`;
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
