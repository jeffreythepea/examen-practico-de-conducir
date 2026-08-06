import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_PRESETS,
  SESSION_PRESET_IDS,
  applySessionPreset,
  sessionPresetById,
  validateSessionPresets
} from '../src/session-presets.js';
import { defaultState } from '../src/storage.js';

const EXPECTED = Object.freeze({
  learn: {
    settings: {
      phase: 'mixed', speed: 0.9, hintPolicy: 'shown', timed: false,
      length: 'medium', mode: 'recommended'
    },
    replayPolicy: 'unlimited',
    revealPolicy: 'immediate',
    simulated: false
  },
  practice: {
    settings: {
      phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
      length: 'medium', mode: 'recommended'
    },
    replayPolicy: 'unlimited',
    revealPolicy: 'immediate',
    simulated: false
  },
  mock: {
    settings: {
      phase: 'mixed', speed: 1, hintPolicy: 'unavailable', timed: true,
      length: 'medium', mode: 'recommended'
    },
    replayPolicy: 'none',
    revealPolicy: 'session-end',
    simulated: true
  }
});

test('exports Learn, Practice, and Mock presets in stable order', () => {
  assert.deepEqual(SESSION_PRESET_IDS, ['learn', 'practice', 'mock']);
  assert.deepEqual(SESSION_PRESETS.map(({ id }) => id), SESSION_PRESET_IDS);
});

test('each preset maps exactly to the approved setting and future-policy contract', () => {
  for (const [id, expected] of Object.entries(EXPECTED)) {
    const preset = sessionPresetById(id);
    assert.deepEqual(preset.settings, expected.settings);
    assert.equal(preset.replayPolicy, expected.replayPolicy);
    assert.equal(preset.revealPolicy, expected.revealPolicy);
    assert.equal(preset.simulated, expected.simulated);
    assert.equal(preset.titleKey, `experience.${id}.title`);
    assert.equal(preset.descriptionKey, `experience.${id}.description`);
  }
});

test('Practice owns the same semantic defaults as a fresh production save', () => {
  const fresh = defaultState().settings;
  const practice = sessionPresetById('practice').settings;
  for (const [field, value] of Object.entries(practice)) assert.equal(fresh[field], value);
});

test('preset registry and every nested record are deeply frozen', () => {
  assert.equal(Object.isFrozen(SESSION_PRESETS), true);
  assert.equal(Object.isFrozen(SESSION_PRESET_IDS), true);
  for (const preset of SESSION_PRESETS) {
    assert.equal(Object.isFrozen(preset), true);
    assert.equal(Object.isFrozen(preset.settings), true);
  }
});

test('applying a preset overrides owned fields while preserving unrelated base settings', () => {
  const base = {
    locale: 'es',
    phase: 'driving',
    speed: 0.75,
    hintPolicy: 'available',
    timed: false,
    feedbackSounds: false,
    roadMovement: false,
    length: 'all',
    mode: 'free',
    futureAdditiveSetting: 'preserved'
  };
  const result = applySessionPreset(base, 'mock');

  assert.deepEqual(result.settings, {
    ...base,
    ...EXPECTED.mock.settings
  });
  assert.equal(result.presetId, 'mock');
  assert.equal(result.replayPolicy, 'none');
  assert.equal(result.revealPolicy, 'session-end');
  assert.equal(result.simulated, true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.settings), true);
});

test('applying a preset never mutates caller-owned settings', () => {
  const base = defaultState().settings;
  const before = structuredClone(base);
  const result = applySessionPreset(base, 'learn');

  assert.deepEqual(base, before);
  assert.notEqual(result.settings, base);
});

test('lookups and application reject unknown presets and malformed settings', () => {
  assert.throws(() => sessionPresetById('unknown'), /unknown session preset/i);
  assert.throws(() => applySessionPreset({}, 'practice'), /base settings/i);
  assert.throws(() => applySessionPreset([], 'practice'), /base settings/i);
  assert.throws(() => applySessionPreset(defaultState().settings, 'unknown'), /unknown session preset/i);
});

test('preset validation rejects duplicates, unsupported policies, and malformed setting values', () => {
  assert.throws(() => validateSessionPresets([
    SESSION_PRESETS[0],
    { ...SESSION_PRESETS[1], id: SESSION_PRESETS[0].id }
  ]), /duplicate preset id/i);
  assert.throws(() => validateSessionPresets([
    { ...SESSION_PRESETS[0], replayPolicy: 'sometimes' }
  ]), /replay policy/i);
  assert.throws(() => validateSessionPresets([
    { ...SESSION_PRESETS[0], settings: { ...SESSION_PRESETS[0].settings, speed: 4 } }
  ]), /preset speed/i);
  assert.throws(() => validateSessionPresets([]), /session presets/i);
});
