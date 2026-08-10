// Pure simulated exam route planner
// Builds an immutable route plan from already-selected session items.
// No attempt, scoring, timing, audio, persistence, DOM, or translation behavior.

const VALID_PHASES = new Set(['precheck', 'driving']);
// C: a silent junction. The scene must come from a road-motion family with an
// explicit straight-ahead target so the learner can answer "continue ahead".
const NULL_EVENT_SCENE = 'four-way-intersection-photo-v1';
const NULL_EVENT_PROBABILITY = 0.5;
const TRANSITION_SCENES = {
  preparationBridge: 'preparation-bridge',
  departureConsequence: 'departure-consequence',
  urbanCruise: 'urban-cruise',
  ruralCruise: 'rural-cruise',
  arrival: 'arrival',
  parkedClosure: 'parked-closure'
};

function nonemptyString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${path}`);
  }
}

function validateItems(items, path = 'items') {
  if (!Array.isArray(items)) {
    throw new Error(`Invalid ${path}: must be an array`);
  }
  if (items.length === 0) {
    throw new Error(`Invalid ${path}: must not be empty`);
  }
  const seenCommandIds = new Set();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemPath = `${path}[${i}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid ${itemPath}: must be an object`);
    }
    nonemptyString(item.commandId, `${itemPath}.commandId`);
    nonemptyString(item.phrasingId, `${itemPath}.phrasingId`);
    nonemptyString(item.voiceId, `${itemPath}.voiceId`);
    if (typeof item.speed !== 'number' || !Number.isFinite(item.speed)) {
      throw new Error(`Invalid ${itemPath}.speed`);
    }
    if (seenCommandIds.has(item.commandId)) {
      throw new Error(`Invalid duplicate session item: ${item.commandId}`);
    }
    seenCommandIds.add(item.commandId);
  }
}

function validateCommands(commands, path = 'commands') {
  if (!Array.isArray(commands)) {
    throw new Error(`Invalid ${path}: must be an array`);
  }
  if (commands.length === 0) {
    throw new Error(`Invalid ${path}: must not be empty`);
  }
  const seenIds = new Set();
  for (const command of commands) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) {
      throw new Error(`Invalid command in ${path}`);
    }
    nonemptyString(command.id, `${path}.id`);
    if (seenIds.has(command.id)) {
      throw new Error(`Duplicate command id: ${command.id}`);
    }
    seenIds.add(command.id);
    if (!VALID_PHASES.has(command.phase)) {
      throw new Error(`Invalid command phase: ${command.phase}`);
    }
  }
}

function findCommand(commands, commandId) {
  return commands.find(cmd => cmd.id === commandId);
}

function getItemPhase(commands, item) {
  const command = findCommand(commands, item.commandId);
  if (!command) {
    throw new Error(`Unknown command: ${item.commandId}`);
  }
  return command.phase;
}

function getSpecialCommandType(commandId) {
  if (commandId === 'c-cint') return 'cint';
  if (commandId === 'c-arr') return 'arr';
  if (commandId === 'c-incorp') return 'incorp';
  if (commandId === 'c-final') return 'final';
  if (commandId === 'c-inmov') return 'inmov';
  return null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneAndFreeze(value) {
  const clone = structuredClone(value);
  return deepFreeze(clone);
}

function buildCommandStep(item, itemIndex, chapter) {
  return cloneAndFreeze({
    kind: 'command',
    itemIndex,
    commandId: item.commandId,
    chapter
  });
}

function buildTransitionStep(id, sceneId, chapter) {
  return cloneAndFreeze({
    kind: 'transition',
    id,
    sceneId,
    chapter
  });
}

function randomUnit(rng) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('RNG must return a number between 0 and 1');
  }
  return value;
}

function chooseTransitionScene(rng, allowedScenes) {
  if (allowedScenes.length === 0) return null;
  if (allowedScenes.length === 1) return allowedScenes[0];
  const index = Math.floor(randomUnit(rng) * allowedScenes.length);
  return allowedScenes[index];
}

export function buildSimulatedExamRoute(items, commands, rng = Math.random) {
  // Validate inputs
  validateItems(items);
  validateCommands(commands);
  if (typeof rng !== 'function') {
    throw new Error('RNG must be a function');
  }

  // Verify all items reference known commands and collect their phases
  const itemsWithPhase = items.map((item, index) => {
    const phase = getItemPhase(commands, item);
    if (getSpecialCommandType(item.commandId) && phase !== 'driving') {
      throw new Error(`Invalid phase for ${item.commandId}: ${phase}`);
    }
    return { ...item, index, phase };
  });

  // Partition items into groups preserving original relative order
  const precheckItems = [];
  const cintItems = [];
  const arrItems = [];
  const incorpItems = [];
  const ordinaryDrivingItems = [];
  const finalItems = [];
  const inmovItems = [];

  for (const item of itemsWithPhase) {
    const specialType = getSpecialCommandType(item.commandId);
    if (item.phase === 'precheck') {
      precheckItems.push(item);
    } else if (specialType === 'cint') {
      cintItems.push(item);
    } else if (specialType === 'arr') {
      arrItems.push(item);
    } else if (specialType === 'incorp') {
      incorpItems.push(item);
    } else if (specialType === 'final') {
      finalItems.push(item);
    } else if (specialType === 'inmov') {
      inmovItems.push(item);
    } else {
      ordinaryDrivingItems.push(item);
    }
  }

  // Build the route steps in narrative order
  const steps = [];
  let transitionCounter = 0;
  let nullEventCounter = 0;

  function addTransition(sceneId, chapter) {
    const id = `transition-${transitionCounter++}-${sceneId}`;
    steps.push(buildTransitionStep(id, sceneId, chapter));
  }

  function addNullEvent(chapter) {
    steps.push(cloneAndFreeze({
      kind: 'null-event',
      id: `null-${nullEventCounter++}`,
      sceneId: NULL_EVENT_SCENE,
      chapter
    }));
  }

  // At most one cruise slot per route becomes a silent junction (a null
  // event), and only when at least one real cruise transition remains.
  const cruiseSlotCount = Math.max(0, ordinaryDrivingItems.length - 1);
  let nullEventSlot = -1;
  if (cruiseSlotCount >= 2 && randomUnit(rng) >= 1 - NULL_EVENT_PROBABILITY) {
    nullEventSlot = Math.floor(randomUnit(rng) * cruiseSlotCount);
  }

  // Chapter 1: Precheck
  for (const item of precheckItems) {
    steps.push(buildCommandStep(item, item.index, 'precheck'));
  }

  // Chapter 2: Start and departure
  // Fastening the seatbelt happens seated in the still-parked car: directly
  // after the prechecks, before the engine start and before any driving
  // scene. No transition may precede or follow it within this block.
  for (const item of cintItems) {
    steps.push(buildCommandStep(item, item.index, 'departure'));
  }

  const hasArr = arrItems.length > 0;
  const hasIncorp = incorpItems.length > 0;

  if (!hasArr && (hasIncorp || ordinaryDrivingItems.length > 0 || finalItems.length > 0 || inmovItems.length > 0)) {
    // No c-arr but there are driving commands: insert preparation bridge
    addTransition(TRANSITION_SCENES.preparationBridge, 'departure');
  }

  // c-arr comes after precheck (or preparation bridge)
  for (const item of arrItems) {
    steps.push(buildCommandStep(item, item.index, 'departure'));
  }

  // c-incorp comes after c-arr (or after preparation bridge if no c-arr)
  for (const item of incorpItems) {
    steps.push(buildCommandStep(item, item.index, 'departure'));
  }

  // Departure consequence transition after c-incorp when present
  if (hasIncorp) {
    addTransition(TRANSITION_SCENES.departureConsequence, 'departure');
  }

  // Chapter 3: Driving (ordinary driving commands)
  // Insert cruise transitions between ordinary driving commands
  for (let i = 0; i < ordinaryDrivingItems.length; i++) {
    const item = ordinaryDrivingItems[i];
    steps.push(buildCommandStep(item, item.index, 'driving'));

    // Add cruise transition between ordinary driving commands (not after the last one)
    if (i < ordinaryDrivingItems.length - 1) {
      if (i === nullEventSlot) {
        addNullEvent('driving');
      } else {
        const sceneId = chooseTransitionScene(rng, [TRANSITION_SCENES.urbanCruise, TRANSITION_SCENES.ruralCruise]);
        addTransition(sceneId, 'driving');
      }
    }
  }

  // Chapter 4: Finish
  // Arrival transition before terminal actions when applicable
  const hasTerminalCommands = finalItems.length > 0 || inmovItems.length > 0;
  const hasDrivingCommands = arrItems.length > 0 || incorpItems.length > 0 || ordinaryDrivingItems.length > 0;

  if (hasTerminalCommands && hasDrivingCommands) {
    addTransition(TRANSITION_SCENES.arrival, 'finish');
  }

  // c-final
  for (const item of finalItems) {
    steps.push(buildCommandStep(item, item.index, 'finish'));
  }

  // c-inmov
  for (const item of inmovItems) {
    steps.push(buildCommandStep(item, item.index, 'finish'));
  }

  // Parked closure after terminal actions when applicable
  if (hasTerminalCommands) {
    addTransition(TRANSITION_SCENES.parkedClosure, 'finish');
  }

  // Return deeply frozen array
  return cloneAndFreeze(steps);
}
