const PHASES = new Set(['driving', 'precheck', 'mixed']);
const SPEEDS = new Set([0.75, 0.9, 1]);
const HINT_POLICIES = new Set(['available', 'shown', 'unavailable']);
const LENGTHS = new Set(['short', 'medium', 'all']);
const PRACTICE_MODES = new Set(['recommended', 'free']);
const REPLAY_POLICIES = new Set(['unlimited', 'none']);
const REVEAL_POLICIES = new Set(['immediate', 'session-end']);

const RAW_PRESETS = [
  {
    id: 'learn',
    titleKey: 'experience.learn.title',
    descriptionKey: 'experience.learn.description',
    settings: {
      phase: 'mixed',
      speed: 0.9,
      hintPolicy: 'shown',
      timed: false,
      length: 'medium',
      mode: 'recommended'
    },
    replayPolicy: 'unlimited',
    revealPolicy: 'immediate',
    simulated: false
  },
  {
    id: 'practice',
    titleKey: 'experience.practice.title',
    descriptionKey: 'experience.practice.description',
    settings: {
      phase: 'mixed',
      speed: 0.9,
      hintPolicy: 'available',
      timed: false,
      length: 'medium',
      mode: 'recommended'
    },
    replayPolicy: 'unlimited',
    revealPolicy: 'immediate',
    simulated: false
  },
  {
    id: 'mock',
    titleKey: 'experience.mock.title',
    descriptionKey: 'experience.mock.description',
    settings: {
      phase: 'mixed',
      speed: 1,
      hintPolicy: 'unavailable',
      timed: true,
      length: 'medium',
      mode: 'recommended'
    },
    replayPolicy: 'none',
    revealPolicy: 'session-end',
    simulated: true
  }
];

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value;
}

function nonempty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
}

function validatePresetSettings(settings) {
  record(settings, 'preset settings');
  if (!PHASES.has(settings.phase)) throw new Error('Invalid preset phase');
  if (!SPEEDS.has(settings.speed)) throw new Error('Invalid preset speed');
  if (!HINT_POLICIES.has(settings.hintPolicy)) throw new Error('Invalid preset hint policy');
  if (typeof settings.timed !== 'boolean') throw new Error('Invalid preset timing');
  if (!LENGTHS.has(settings.length)) throw new Error('Invalid preset length');
  if (!PRACTICE_MODES.has(settings.mode)) throw new Error('Invalid preset practice mode');
}

function freezePreset(preset) {
  return Object.freeze({
    id: preset.id,
    titleKey: preset.titleKey,
    descriptionKey: preset.descriptionKey,
    settings: Object.freeze({ ...preset.settings }),
    replayPolicy: preset.replayPolicy,
    revealPolicy: preset.revealPolicy,
    simulated: preset.simulated
  });
}

export function validateSessionPresets(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid session presets');
  const ids = new Set();
  const presets = value.map((preset, index) => {
    record(preset, `session preset ${index}`);
    for (const field of ['id', 'titleKey', 'descriptionKey']) nonempty(preset[field], `preset ${field}`);
    if (ids.has(preset.id)) throw new Error(`Duplicate preset id: ${preset.id}`);
    ids.add(preset.id);
    validatePresetSettings(preset.settings);
    if (!REPLAY_POLICIES.has(preset.replayPolicy)) throw new Error('Invalid replay policy');
    if (!REVEAL_POLICIES.has(preset.revealPolicy)) throw new Error('Invalid reveal policy');
    if (typeof preset.simulated !== 'boolean') throw new Error('Invalid preset simulated flag');
    return freezePreset(preset);
  });
  return Object.freeze(presets);
}

export const SESSION_PRESETS = validateSessionPresets(RAW_PRESETS);
export const SESSION_PRESET_IDS = Object.freeze(SESSION_PRESETS.map(({ id }) => id));

export function sessionPresetById(id, presets = SESSION_PRESETS) {
  const registry = presets === SESSION_PRESETS ? presets : validateSessionPresets(presets);
  const preset = registry.find(candidate => candidate.id === id);
  if (!preset) throw new Error(`Unknown session preset: ${String(id)}`);
  return preset;
}

export function applySessionPreset(baseSettings, presetId, presets = SESSION_PRESETS) {
  validateBaseSettings(baseSettings);
  const preset = sessionPresetById(presetId, presets);
  return Object.freeze({
    presetId: preset.id,
    settings: Object.freeze({ ...baseSettings, ...preset.settings }),
    replayPolicy: preset.replayPolicy,
    revealPolicy: preset.revealPolicy,
    simulated: preset.simulated
  });
}

function validateBaseSettings(settings) {
  record(settings, 'base settings');
  if (typeof settings.locale !== 'string') throw new Error('Invalid base settings locale');
  if (!PHASES.has(settings.phase)) throw new Error('Invalid base settings phase');
  if (!SPEEDS.has(settings.speed)) throw new Error('Invalid base settings speed');
  if (!HINT_POLICIES.has(settings.hintPolicy)) throw new Error('Invalid base settings hint policy');
  if (typeof settings.timed !== 'boolean') throw new Error('Invalid base settings timing');
  if (typeof settings.feedbackSounds !== 'boolean') throw new Error('Invalid base settings feedback sounds');
  if (typeof settings.roadMovement !== 'boolean') throw new Error('Invalid base settings road movement');
  if (!LENGTHS.has(settings.length)) throw new Error('Invalid base settings length');
  if (!PRACTICE_MODES.has(settings.mode)) throw new Error('Invalid base settings practice mode');
}
