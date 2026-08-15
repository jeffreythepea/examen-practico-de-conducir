import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SESSION_THEMES,
  THEME_IDS,
  eligibleCommandsForTheme,
  selectThemeCommands,
  validateSessionThemes
} from '../src/session-themes.js';

const EXPECTED_THEME_IDS = [
  'first-drive',
  'city-circuit',
  'roundabout-circuit',
  'manoeuvres',
  'precheck-inspection',
  'full-mock'
];

test('theme registry contains exactly six stable theme IDs', () => {
  assert.deepEqual(THEME_IDS, EXPECTED_THEME_IDS);
  assert.equal(SESSION_THEMES.length, EXPECTED_THEME_IDS.length);
});

test('each theme record has required fields and correct types', () => {
  for (const theme of SESSION_THEMES) {
    assert.equal(typeof theme.id, 'string');
    assert.equal(typeof theme.titleKey, 'string');
    assert.equal(typeof theme.descriptionKey, 'string');
    assert.equal(typeof theme.criteria, 'function');
    assert.equal(typeof theme.simulated, 'boolean');
    // Ensure no extra fields beyond the frozen ones
    assert.equal(Object.keys(theme).length, 5);
  }
});

test('full-mock theme is marked as simulated', async () => {
  const fullMock = SESSION_THEMES.find(t => t.id === 'full-mock');
  assert.ok(fullMock);
  assert.equal(fullMock.simulated, true);
});

test('other themes are not simulated', () => {
  const nonMock = SESSION_THEMES.filter(t => t.id !== 'full-mock');
  for (const theme of nonMock) {
    assert.equal(theme.simulated, false);
  }
});

test('theme registry and records are frozen', () => {
  assert.equal(Object.isFrozen(SESSION_THEMES), true);
  assert.equal(SESSION_THEMES.every(Object.isFrozen), true);
  assert.equal(Object.isFrozen(THEME_IDS), true);
});

test('validateSessionThemes returns the registry if valid', () => {
  assert.deepEqual(validateSessionThemes(SESSION_THEMES), SESSION_THEMES);
});

test('validateSessionThemes throws on invalid input', () => {
  assert.throws(() => validateSessionThemes(null), /Invalid theme registry/);
  assert.throws(() => validateSessionThemes([]), /Invalid theme registry/);
  assert.throws(() => validateSessionThemes([{}]), /Invalid theme registry/);
  assert.throws(() => validateSessionThemes([{ id: 'test' }]), /Invalid theme registry/);
  assert.throws(() => validateSessionThemes([{ id: 'test', titleKey: 't', descriptionKey: 'd', criteria: () => {} }]), /Invalid theme registry/);
  assert.throws(() => validateSessionThemes([{ id: 'test', titleKey: 't', descriptionKey: 'd', criteria: () => {}, simulated: 'yes' }]), /Invalid theme simulated flag/);
  assert.throws(() => validateSessionThemes([
    { id: 'a', titleKey: 't', descriptionKey: 'd', criteria: () => {}, simulated: false },
    { id: 'a', titleKey: 't2', descriptionKey: 'd2', criteria: () => {}, simulated: false }
  ]), /Duplicate theme id/);
});

test('selectThemeCommands throws on invalid commands', async () => {
  assert.throws(() => selectThemeCommands(null, 'first-drive', 5), /Invalid commands catalog/);
  assert.throws(() => selectThemeCommands([], 'first-drive', 5), /Invalid commands catalog/);
  assert.throws(() => selectThemeCommands([{}], 'first-drive', 5), /command.id/);
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  assert.throws(
    () => selectThemeCommands([commands[0], commands[0]], 'first-drive', 5),
    /Duplicate command id/
  );
});

test('selectThemeCommands throws on unknown theme', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  assert.throws(() => selectThemeCommands(commands, 'unknown-theme', 5), /Unknown theme:/);
});

test('selectThemeCommands throws on invalid session length', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 0), /Session length must be a positive integer/);
  assert.throws(() => selectThemeCommands(commands, 'first-drive', -1), /Session length must be a positive integer/);
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 2.5), /Session length must be a positive integer/);
});

test('selectThemeCommands throws on invalid RNG', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 5, null), /RNG must be a function/);
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 5, () => 'not a number'), /RNG must return a number between 0 and 1/);
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 5, () => 1.5), /RNG must return a number between 0 and 1/);
  assert.throws(() => selectThemeCommands(commands, 'first-drive', 5, () => -0.1), /RNG must return a number between 0 and 1/);
  let calls = 0;
  assert.throws(
    () => selectThemeCommands(commands, 'first-drive', 5, () => (++calls === 1 ? 0.5 : Number.NaN)),
    /RNG must return a number between 0 and 1/
  );
});

test('selection uses the first injected RNG draw rather than consuming a validation draw', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const draws = [0, 0.99, 0.25, 0.75];
  let calls = 0;
  selectThemeCommands(commands, 'first-drive', 3, () => draws[calls++]);
  assert.equal(calls, 4);
});

test('selectThemeCommands returns deterministic order for fixed RNG', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const rng1 = () => 0.1;
  const rng2 = () => 0.1;
  const result1 = selectThemeCommands(commands, 'first-drive', 3, rng1);
  const result2 = selectThemeCommands(commands, 'first-drive', 3, rng2);
  assert.deepEqual(result1, result2);
});

test('selectThemeCommands never duplicates commands', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  // Use a large length to try to force duplicates if logic is wrong
  const result = selectThemeCommands(commands, 'first-drive', 100, () => 0.5);
  const ids = result.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('selectThemeCommands respects session length cap', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  // Get all commands that match first-drive
  const firstDriveTheme = SESSION_THEMES.find(t => t.id === 'first-drive');
  const allMatching = commands.filter(c => firstDriveTheme.criteria(c));
  // Request more than available
  const result = selectThemeCommands(commands, 'first-drive', allMatching.length + 5, () => 0.5);
  assert.equal(result.length, allMatching.length);
  // Request less than available
  const result2 = selectThemeCommands(commands, 'first-drive', 5, () => 0.5);
  assert.equal(result2.length, 5);
});

test('selectThemeCommands returns deeply frozen caller-independent values', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const result = selectThemeCommands(commands, 'first-drive', 3, () => 0.5);
  assert.equal(Object.isFrozen(result), true);
  for (const command of result) {
    assert.equal(Object.isFrozen(command), true);
    assert.equal(Object.isFrozen(command.phrasings), true);
    assert.equal(Object.isFrozen(command.phrasings[0]), true);
    const original = commands.find(candidate => candidate.id === command.id);
    assert.notEqual(command.phrasings, original.phrasings);
    assert.notEqual(command.phrasings[0], original.phrasings[0]);
    // Ensure we cannot mutate
    assert.throws(() => { command.id = 'mutated'; }, TypeError);
  }
});

test('selectThemeCommands filters by theme criteria', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  // Roundabout circuit contains the three numbered exits and its distinct return.
  const roundaboutResult = selectThemeCommands(commands, 'roundabout-circuit', 20, () => 0.5);
  for (const command of roundaboutResult) {
    assert.ok(command.actionId.startsWith('roundabout-exit-')
      || command.actionId === 'roundabout-change-direction');
  }
  // Test that precheck-inspection only returns precheck phase
  const precheckResult = selectThemeCommands(commands, 'precheck-inspection', 20, () => 0.5);
  for (const command of precheckResult) {
    assert.equal(command.phase, 'precheck');
  }
  // Test that full-mock returns all commands
  const fullMockResult = selectThemeCommands(commands, 'full-mock', commands.length, () => 0.5);
  assert.equal(fullMockResult.length, commands.filter(command => command.active !== false).length);
});

test('every theme has the approved stable command composition', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const expectedActionIds = {
    'first-drive': [
      'continue-forward', 'operate-indicator', 'turn-left', 'turn-right', 'voluntary-stop'
    ],
    'city-circuit': [
      'adapt-speed', 'continue-forward', 'involuntary-stop', 'operate-indicator',
      'park', 'turn-left', 'turn-right', 'voluntary-stop'
    ],
    'roundabout-circuit': [
      'roundabout-change-direction', 'roundabout-exit-1', 'roundabout-exit-2',
      'roundabout-exit-3'
    ],
    manoeuvres: [
      'change-direction', 'involuntary-stop', 'overtake', 'park',
      'secure-vehicle', 'voluntary-stop'
    ]
  };

  for (const [themeId, expected] of Object.entries(expectedActionIds)) {
    const selected = selectThemeCommands(commands, themeId, commands.length, () => 0.5);
    assert.deepEqual(selected.map(({ actionId }) => actionId).sort(), expected);
  }

  const prechecks = selectThemeCommands(commands, 'precheck-inspection', commands.length, () => 0.5);
  assert.equal(prechecks.length, commands.filter(({ phase }) => phase === 'precheck').length);
  assert.equal(prechecks.every(({ phase }) => phase === 'precheck'), true);

  const fullMock = selectThemeCommands(commands, 'full-mock', commands.length, () => 0.5);
  assert.deepEqual(
    fullMock.map(({ id }) => id).sort(),
    commands.filter(command => command.active !== false).map(({ id }) => id).sort()
  );
});

test('selectThemeCommands preserves original command values in independent copies', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const result = selectThemeCommands(commands, 'first-drive', 3, () => 0.5);
  // The returned objects should have the same values but be different references
  for (const [i, themeCommand] of result.entries()) {
    const original = commands.find(c => c.id === themeCommand.id);
    assert.ok(original);
    assert.equal(themeCommand.id, original.id);
    assert.equal(themeCommand.actionId, original.actionId);
    assert.equal(themeCommand.phase, original.phase);
    assert.notEqual(themeCommand, original); // Different reference
  }
});

test('eligibility filters without shuffling, truncating, duplicating, or mutating', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const before = structuredClone(commands);
  const expected = commands.filter(command => command.active !== false
    && (command.actionId.startsWith('roundabout-exit-')
      || command.actionId === 'roundabout-change-direction'));

  const eligible = eligibleCommandsForTheme(commands, 'roundabout-circuit');
  assert.deepEqual(eligible.map(({ id }) => id), expected.map(({ id }) => id));
  assert.equal(new Set(eligible.map(({ id }) => id)).size, eligible.length);
  assert.equal(Object.isFrozen(eligible), true);
  assert.equal(eligible.every(Object.isFrozen), true);
  assert.notEqual(eligible[0], expected[0]);
  assert.deepEqual(commands, before);
});

test('eligibility returns an explicit frozen empty result when a valid theme has no matches', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const drivingOnly = commands.filter(({ phase }) => phase === 'driving');
  const eligible = eligibleCommandsForTheme(drivingOnly, 'precheck-inspection');
  assert.deepEqual(eligible, []);
  assert.equal(Object.isFrozen(eligible), true);
});
