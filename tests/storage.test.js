import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  defaultState,
  exportState,
  importState,
  loadState,
  saveState
} from '../src/storage.js';

class MemoryStorage {
  constructor(value = null) {
    this.value = value;
    this.writes = 0;
    this.keys = [];
  }

  getItem(key) {
    this.keys.push(key);
    return this.value;
  }

  setItem(key, value) {
    this.keys.push(key);
    this.value = value;
    this.writes += 1;
  }
}

function completedAttempt(overrides = {}) {
  return {
    id: 'attempt-1',
    timestamp: 1,
    commandId: 'c-der',
    actionId: 'turn-right',
    phrasingId: 'c-der-canonical',
    voiceId: 'voice-es',
    speed: 0.9,
    phase: 'driving',
    surfaceId: 'junction-v1',
    selectedResult: 'turn-right',
    outcome: 'unaided',
    weight: 1,
    responseMs: 500,
    replays: 0,
    textShown: false,
    timed: false,
    timeout: false,
    ...overrides
  };
}

test('creates fresh version 1 defaults for English driving practice at 0.9 speed', () => {
  const first = defaultState();
  const second = defaultState();

  assert.deepEqual(first, {
    schemaVersion: 1,
    settings: {
      locale: 'en',
      phase: 'driving',
      speed: 0.9,
      hintPolicy: 'available',
      timed: false,
      length: 'short'
    },
    attempts: [],
    actionProgress: {}
  });
  assert.notEqual(first, second);
  assert.notEqual(first.settings, second.settings);
});

test('round trips a validated state through the dedicated storage key', () => {
  const storage = new MemoryStorage();
  const state = {
    ...defaultState(),
    settings: { ...defaultState().settings, locale: 'es', phase: 'precheck' },
    attempts: [completedAttempt()],
    actionProgress: { 'locate-battery': { consecutiveUnaided: 1, nextDueAt: 1 } }
  };

  saveState(storage, state);

  assert.equal(storage.writes, 1);
  assert.deepEqual(storage.keys, [STORAGE_KEY]);
  assert.deepEqual(loadState(storage), state);
  assert.equal(storage.keys.at(-1), STORAGE_KEY);
  assert.deepEqual(importState(exportState(state)), state);
});

test('recovers from corrupt saved text without overwriting it', () => {
  const storage = new MemoryStorage('{not valid JSON');

  const state = loadState(storage);

  assert.deepEqual(
    { ...state, recoveryError: undefined },
    { ...defaultState(), recoveryError: undefined }
  );
  assert.match(state.recoveryError, /Unexpected token|JSON/);
  assert.equal(storage.value, '{not valid JSON');
  assert.equal(storage.writes, 0);
});

test('rejects invalid imports before a caller replaces active state', () => {
  const activeState = {
    ...defaultState(),
    settings: { ...defaultState().settings, locale: 'es', phase: 'precheck' }
  };
  const before = structuredClone(activeState);

  assert.throws(
    () => importState('{"schemaVersion":1,"settings":{"locale":"fr"}}'),
    /Invalid settings.locale/
  );
  assert.deepEqual(activeState, before);
  assert.throws(() => importState('{"schemaVersion":2}'), /Unsupported schema/);
});

test('preserves compatible unknown additive fields through import and re-export', () => {
  const backup = {
    ...defaultState(),
    futureTopLevel: { source: 'a later version' },
    settings: {
      ...defaultState().settings,
      futureSetting: 'keep me'
    },
    attempts: [completedAttempt({ id: 'attempt-with-future-field', futureAttemptField: true })],
    actionProgress: {
      'turn-right': { consecutiveUnaided: 2, nextDueAt: 123, futureScheduleField: 'preserve' }
    }
  };

  const imported = importState(JSON.stringify(backup));

  assert.notEqual(imported, backup);
  assert.notEqual(imported.settings, backup.settings);
  assert.deepEqual(JSON.parse(exportState(imported)), backup);
});

test('validates before writing so invalid states never replace the saved backup', () => {
  const storage = new MemoryStorage('{"safe":true}');

  assert.throws(
    () => saveState(storage, { ...defaultState(), settings: { ...defaultState().settings, speed: 2 } }),
    /Invalid settings.speed/
  );

  assert.equal(storage.value, '{"safe":true}');
  assert.equal(storage.writes, 0);
});

test('rejects malformed known attempt and action-progress values before import or save', () => {
  const malformedAttempt = {
    ...defaultState(),
    attempts: [{}]
  };
  const malformedSchedule = {
    ...defaultState(),
    actionProgress: { 'turn-right': null }
  };
  const storage = new MemoryStorage('{"safe":true}');

  assert.throws(
    () => importState(JSON.stringify(malformedAttempt)),
    /Invalid attempts\[0\]\.id/
  );
  assert.throws(
    () => saveState(storage, malformedSchedule),
    /Invalid actionProgress\.turn-right/
  );
  assert.equal(storage.value, '{"safe":true}');
  assert.equal(storage.writes, 0);
});

test('validates every known Task 4 attempt field while retaining valid optional data', () => {
  const invalidValues = [
    ['id', ''],
    ['timestamp', null],
    ['commandId', ''],
    ['actionId', ''],
    ['phrasingId', ''],
    ['voiceId', ''],
    ['speed', 0.8],
    ['phase', 'sequential'],
    ['surfaceId', ''],
    ['selectedResult', 1],
    ['outcome', 'correct'],
    ['weight', 0.5],
    ['responseMs', -1],
    ['replays', -1],
    ['textShown', 'false'],
    ['timed', 'false'],
    ['timeout', 'false'],
    ['missReason', 1]
  ];

  for (const [field, value] of invalidValues) {
    const state = { ...defaultState(), attempts: [completedAttempt({ [field]: value })] };
    assert.throws(
      () => importState(JSON.stringify(state)),
      new RegExp(`Invalid attempts\\[0\\]\\.${field}`)
    );
  }

  assert.deepEqual(
    importState(JSON.stringify({
      ...defaultState(),
      attempts: [completedAttempt({ selectedResult: null, responseMs: null, missReason: 'meaning' })]
    })).attempts,
    [completedAttempt({ selectedResult: null, responseMs: null, missReason: 'meaning' })]
  );
});

test('validates known action-progress schedules without discarding additive fields', () => {
  const validProgress = {
    'turn-right': { consecutiveUnaided: 2, nextDueAt: 123, futureScheduleField: 'keep me' }
  };

  assert.deepEqual(
    importState(JSON.stringify({ ...defaultState(), actionProgress: validProgress })).actionProgress,
    validProgress
  );
  for (const [schedule, error] of [
    [{ consecutiveUnaided: -1, nextDueAt: 123 }, 'consecutiveUnaided'],
    [{ consecutiveUnaided: 1, nextDueAt: null }, 'nextDueAt'],
    [{ consecutiveUnaided: 1 }, 'nextDueAt'],
    [{ nextDueAt: 123 }, 'consecutiveUnaided']
  ]) {
    assert.throws(
      () => importState(JSON.stringify({ ...defaultState(), actionProgress: { 'turn-right': schedule } })),
      new RegExp(`Invalid actionProgress\\.turn-right\\.${error}`)
    );
  }
});
