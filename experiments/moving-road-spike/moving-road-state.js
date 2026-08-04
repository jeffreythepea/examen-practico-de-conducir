export const ROAD_PHASES = Object.freeze({
  APPROACHING: 'approaching',
  DECISION_OPEN: 'decision-open',
  REVEAL: 'reveal'
});

const RESULT_IDS = new Set(['turn-left', 'continue-forward', 'turn-right']);

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function requirePositiveFinite(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive finite number`);
  }
}

function freezeState(state) {
  return Object.freeze(state);
}

export function createMovingRoadState(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('config must be an object');
  }
  requireNonEmptyString(config.commandId, 'commandId');
  if (!RESULT_IDS.has(config.acceptedResult)) {
    throw new TypeError('acceptedResult must be a supported road result');
  }
  requirePositiveFinite(config.durationMs, 'durationMs');
  requirePositiveFinite(config.decisionAtMs, 'decisionAtMs');
  if (config.decisionAtMs > config.durationMs) {
    throw new RangeError('decisionAtMs cannot exceed durationMs');
  }
  if (typeof config.reducedMotion !== 'boolean') {
    throw new TypeError('reducedMotion must be boolean');
  }

  return freezeState({
    phase: config.reducedMotion ? ROAD_PHASES.DECISION_OPEN : ROAD_PHASES.APPROACHING,
    commandId: config.commandId,
    acceptedResult: config.acceptedResult,
    elapsedMs: config.reducedMotion ? config.decisionAtMs : 0,
    durationMs: config.durationMs,
    decisionAtMs: config.decisionAtMs,
    paused: false,
    reducedMotion: config.reducedMotion,
    selectedResult: null,
    outcome: null,
    replayCount: 0
  });
}

export function reduceMovingRoad(state, event) {
  if (!state || typeof state !== 'object' || !Object.isFrozen(state)) {
    throw new TypeError('state must be a frozen moving-road state');
  }
  if (!event || typeof event.type !== 'string') {
    throw new TypeError('event type must be provided');
  }

  switch (event.type) {
    case 'TICK': {
      if (!Number.isFinite(event.deltaMs) || event.deltaMs < 0) {
        throw new TypeError('deltaMs must be a non-negative finite number');
      }
      if (state.paused || state.phase === ROAD_PHASES.REVEAL || event.deltaMs === 0) {
        return state;
      }
      const elapsedMs = Math.min(state.durationMs, state.elapsedMs + event.deltaMs);
      const phase = elapsedMs >= state.decisionAtMs
        ? ROAD_PHASES.DECISION_OPEN
        : ROAD_PHASES.APPROACHING;
      return freezeState({ ...state, elapsedMs, phase });
    }
    case 'TOGGLE_PAUSE':
      if (state.phase === ROAD_PHASES.REVEAL) {
        return state;
      }
      return freezeState({ ...state, paused: !state.paused });
    case 'ANSWER':
      if (!RESULT_IDS.has(event.resultId)) {
        throw new TypeError('resultId must be a supported road result');
      }
      if (state.phase !== ROAD_PHASES.DECISION_OPEN) {
        return state;
      }
      return freezeState({
        ...state,
        phase: ROAD_PHASES.REVEAL,
        paused: false,
        selectedResult: event.resultId,
        outcome: event.resultId === state.acceptedResult ? 'correct' : 'incorrect'
      });
    case 'REPLAY':
      if (state.phase === ROAD_PHASES.REVEAL) {
        return state;
      }
      return freezeState({ ...state, replayCount: state.replayCount + 1 });
    case 'RESET':
      return createMovingRoadState({
        commandId: state.commandId,
        acceptedResult: state.acceptedResult,
        durationMs: state.durationMs,
        decisionAtMs: state.decisionAtMs,
        reducedMotion: state.reducedMotion
      });
    default:
      throw new TypeError(`unknown event type: ${event.type}`);
  }
}
