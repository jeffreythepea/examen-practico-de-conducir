import { CONTINUITY_SCENE_FAMILIES } from './continuity-transition-view.js';
import { buildSimulatedExamRoute } from './simulated-exam-route.js';

const ROUTE_FAMILY = Object.freeze({
  'preparation-bridge': 'departure',
  'departure-consequence': 'departure',
  'urban-cruise': 'urban-cruise',
  'rural-cruise': 'rural-cruise',
  arrival: 'arrival',
  'parked-closure': 'parked'
});

export function continuityEnabledForExperience(experience, settings) {
  if (!experience) return false;
  // Confusion pairs depends on pair-adjacent ordering, which narrative
  // reordering would break.
  if (experience.challengeId === 'confusion-pairs') return false;
  return settings?.continuousDrive !== false;
}

export function prepareContinuitySession(session, commands, rng = Math.random) {
  if (!Array.isArray(session) || session.length === 0) throw new Error('Invalid continuity session');
  const items = session.map(sessionItemSnapshot);
  const draftRoute = buildSimulatedExamRoute(items, commands, rng);
  const commandIds = draftRoute
    .filter(step => step.kind === 'command')
    .map(step => step.commandId);
  const commandById = new Map(session.map(command => [command.id, command]));
  const orderedSession = commandIds.map(commandId => commandById.get(commandId));
  if (orderedSession.some(command => !command)) throw new Error('Invalid continuity route command');
  const route = buildSimulatedExamRoute(orderedSession.map(sessionItemSnapshot), commands, rng);
  return Object.freeze({
    session: Object.freeze([...orderedSession]),
    continuity: Object.freeze({ route, nextRouteStepIndex: 0 })
  });
}

export function currentContinuityStep(activeSession) {
  const continuity = activeSession?.continuity;
  if (!continuity) return null;
  return continuity.route[continuity.nextRouteStepIndex] ?? null;
}

export function continuityTransitionViewModel(step, { motionEnabled, progressText }) {
  if (!step || step.kind !== 'transition') throw new Error('Invalid continuity transition step');
  const family = ROUTE_FAMILY[step.sceneId];
  if (!family) throw new Error(`Unknown continuity route scene: ${String(step.sceneId)}`);
  return Object.freeze({
    family,
    sceneId: CONTINUITY_SCENE_FAMILIES[family].sceneId,
    progressText,
    motionEnabled,
    sceneTappable: true
  });
}

function sessionItemSnapshot(command) {
  const variant = command?.audioVariant;
  if (!command || !variant) throw new Error('Invalid continuity session command');
  return {
    commandId: command.id,
    phrasingId: variant.phrasingId,
    voiceId: variant.voiceId,
    speed: variant.speed
  };
}
