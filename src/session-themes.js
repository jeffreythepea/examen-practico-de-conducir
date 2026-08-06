// Theme registry and selection layer for Solo E2
// See docs/superpowers/specs/2026-08-06-examiner-modes-themed-drives-design.md for themed drive contract

const PHASES = new Set(['driving', 'precheck']);

const FIRST_DRIVE_ACTIONS = new Set([
  'continue-forward',
  'operate-indicator',
  'turn-left',
  'turn-right',
  'voluntary-stop'
]);

const CITY_CIRCUIT_ACTIONS = new Set([
  'adapt-speed',
  'continue-forward',
  'involuntary-stop',
  'operate-indicator',
  'park',
  'turn-left',
  'turn-right',
  'voluntary-stop'
]);

const ROUNDABOUT_ACTIONS = new Set([
  'roundabout-exit-1',
  'roundabout-exit-2',
  'roundabout-exit-3',
  'roundabout-exit-4',
  'roundabout-exit-5'
]);

const MANOEUVRE_ACTIONS = new Set([
  'change-direction',
  'involuntary-stop',
  'overtake',
  'park',
  'secure-vehicle',
  'voluntary-stop'
]);

function nonempty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
}

function validateThemeRegistry(value) {
  // Check for null or non-array
  if (!Array.isArray(value)) {
    throw new Error('Invalid theme registry');
  }
  // Check for empty array
  if (value.length === 0) {
    throw new Error('Invalid theme registry');
  }
  const ids = new Set();
  for (let index = 0; index < value.length; index++) {
    const theme = value[index];
    // Check for non-object or array
    if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
      throw new Error('Invalid theme registry');
    }
    // Check for missing required fields
    if (!('id' in theme) || !('titleKey' in theme) || !('descriptionKey' in theme) ||
        !('criteria' in theme) || !('simulated' in theme)) {
      throw new Error('Invalid theme registry');
    }
    // Validate id: non-empty string
    if (typeof theme.id !== 'string' || theme.id.trim().length === 0) {
      throw new Error('Invalid theme registry');
    }
    // Validate titleKey: non-empty string
    if (typeof theme.titleKey !== 'string' || theme.titleKey.trim().length === 0) {
      throw new Error('Invalid theme registry');
    }
    // Validate descriptionKey: non-empty string
    if (typeof theme.descriptionKey !== 'string' || theme.descriptionKey.trim().length === 0) {
      throw new Error('Invalid theme registry');
    }
    // Validate criteria: must be a function
    if (typeof theme.criteria !== 'function') {
      throw new Error('Invalid theme registry');
    }
    // Validate simulated: must be a boolean
    if (typeof theme.simulated !== 'boolean') {
      throw new Error('Invalid theme simulated flag');
    }
    // Check for duplicate id
    if (ids.has(theme.id)) {
      throw new Error(`Duplicate theme id: ${theme.id}`);
    }
    ids.add(theme.id);
  }
  // If we get here, all themes are valid. Now freeze each theme and the array.
  const themes = value.map(theme => Object.freeze({
    id: theme.id,
    titleKey: theme.titleKey,
    descriptionKey: theme.descriptionKey,
    criteria: theme.criteria,
    simulated: theme.simulated
  }));
  return Object.freeze(themes);
}

const RAW_THEMES = [
  {
    id: 'first-drive',
    titleKey: 'theme.first-drive.title',
    descriptionKey: 'theme.first-drive.description',
    simulated: false,
    criteria: (command) => command.phase === 'driving'
      && FIRST_DRIVE_ACTIONS.has(command.actionId)
  },
  {
    id: 'city-circuit',
    titleKey: 'theme.city-circuit.title',
    descriptionKey: 'theme.city-circuit.description',
    simulated: false,
    criteria: (command) => command.phase === 'driving'
      && CITY_CIRCUIT_ACTIONS.has(command.actionId)
  },
  {
    id: 'roundabout-circuit',
    titleKey: 'theme.roundabout-circuit.title',
    descriptionKey: 'theme.roundabout-circuit.description',
    simulated: false,
    criteria: (command) => command.phase === 'driving'
      && ROUNDABOUT_ACTIONS.has(command.actionId)
  },
  {
    id: 'manoeuvres',
    titleKey: 'theme.manoeuvres.title',
    descriptionKey: 'theme.manoeuvres.description',
    simulated: false,
    criteria: (command) => command.phase === 'driving'
      && MANOEUVRE_ACTIONS.has(command.actionId)
  },
  {
    id: 'precheck-inspection',
    titleKey: 'theme.precheck-inspection.title',
    descriptionKey: 'theme.precheck-inspection.description',
    simulated: false,
    criteria: (command) => {
      // Pre-check phase: vehicle inspections
      return command.phase === 'precheck';
    }
  },
  {
    id: 'full-mock',
    titleKey: 'theme.full-mock.title',
    descriptionKey: 'theme.full-mock.description',
    simulated: true,
    criteria: (command) => {
      // All commands for a full mock test
      return true;
    }
  }
];

export const SESSION_THEMES = validateThemeRegistry(RAW_THEMES);
export const THEME_IDS = Object.freeze(
  SESSION_THEMES.map(({ id }) => id)
);

function validateThemeId(themeId, themes = SESSION_THEMES) {
  if (!themes.some(t => t.id === themeId)) {
    throw new Error(`Unknown theme: ${String(themeId)}`);
  }
}

function validateCommands(commands) {
  if (!Array.isArray(commands) || commands.length === 0) {
    throw new Error('Invalid commands catalog');
  }
  const ids = new Set();
  for (const command of commands) {
    if (!command || typeof command !== 'object' || Array.isArray(command)) {
      throw new Error('Invalid command in catalog');
    }
    nonempty(command.id, 'command.id');
    if (ids.has(command.id)) throw new Error(`Duplicate command id: ${command.id}`);
    ids.add(command.id);
    nonempty(command.actionId, 'command.actionId');
    nonempty(command.phase, 'command.phase');
    if (!PHASES.has(command.phase)) throw new Error(`Invalid command phase: ${command.phase}`);
    nonempty(command.surfaceId, 'command.surfaceId');
    if (!Array.isArray(command.phrasings) || command.phrasings.length === 0) {
      throw new Error('Command must have at least one phrasing');
    }
  }
}

function validateSessionLength(sessionLength) {
  if (!Number.isInteger(sessionLength) || sessionLength <= 0) {
    throw new Error('Session length must be a positive integer');
  }
}

function validateRng(rng) {
  if (typeof rng !== 'function') {
    throw new Error('RNG must be a function');
  }
}

function randomIndex(rng, upperExclusive) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error('RNG must return a number between 0 and 1');
  }
  return Math.floor(value * upperExclusive);
}

function shuffledCopy(values, rng) {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(rng, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function cloneAndFreeze(value) {
  const clone = structuredClone(value);
  return deepFreeze(clone);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function selectThemeCommands(commands, themeId, sessionLength, rng = Math.random) {
  // Validate inputs
  validateCommands(commands);
  validateThemeId(themeId);
  validateSessionLength(sessionLength);
  validateRng(rng);

  // Get theme
  const theme = SESSION_THEMES.find(t => t.id === themeId);
  if (!theme) {
    // This should not happen because of validateThemeId, but for safety
    throw new Error(`Unknown theme: ${String(themeId)}`);
  }

  // Filter commands by theme criteria
  const filtered = commands.filter(command => theme.criteria(command));
  if (filtered.length === 0) {
    throw new Error(`No commands match theme ${themeId}`);
  }

  const shuffled = shuffledCopy(filtered, rng);

  // Take up to sessionLength commands
  const selected = shuffled.slice(0, sessionLength);

  return cloneAndFreeze(selected);
}

export function eligibleCommandsForTheme(commands, themeId) {
  validateCommands(commands);
  validateThemeId(themeId);
  const theme = SESSION_THEMES.find(candidate => candidate.id === themeId);
  return cloneAndFreeze(commands.filter(command => theme.criteria(command)));
}

export function validateSessionThemes(value) {
  return validateThemeRegistry(value);
}
