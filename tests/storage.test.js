import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  defaultState,
  exportState,
  importState,
  loadState,
  migrateState,
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

test('creates fresh version 3 defaults with recommended practice and an empty lesson log', () => {
  const first = defaultState();
  const second = defaultState();

  assert.deepEqual(first, {
    schemaVersion: 3,
    settings: {
      locale: 'en',
      phase: 'mixed',
      speed: 0.9,
      hintPolicy: 'available',
      timed: false,
      feedbackSounds: true,
      length: 'medium',
      mode: 'recommended'
    },
    attempts: [],
    actionProgress: {},
    lessonFlags: [],
    activeSession: null
  });
  assert.notEqual(first, second);
  assert.notEqual(first.settings, second.settings);
});

test('schema 1 save migrates sequentially to schema 3 with activeSession null', () => {
  const legacy = {
    schemaVersion: 1,
    settings: { ...defaultState().settings },
    attempts: [completedAttempt()],
    actionProgress: { 'turn-right': { consecutiveUnaided: 1, nextDueAt: 123 } },
    futureTopLevel: { keep: true }
  };
  const migrated = migrateState(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.activeSession, null);
  assert.equal(migrated.settings.mode, 'recommended');
  assert.deepEqual(migrated.lessonFlags, []);
  assert.deepEqual(migrated.attempts, legacy.attempts);
  assert.deepEqual(migrated.futureTopLevel, { keep: true });
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(Object.hasOwn(legacy, 'activeSession'), false);
});

test('schema 2 migration normalizes legacy modes and preserves a valid active session', () => {
  const activeSession = {
    version: 1,
    id: 'session-1',
    startedAt: 123,
    items: [{ commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'voice-es', speed: 0.9 }],
    nextIndex: 0,
    attemptIds: [],
    settings: {
      phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
      feedbackSounds: true, length: 'medium', mode: 'weakest-first'
    }
  };
  const state = {
    ...defaultState(), schemaVersion: 2,
    settings: { ...defaultState().settings, mode: 'weakest-first' },
    activeSession
  };
  delete state.lessonFlags;
  const migrated = importState(JSON.stringify(state));
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.settings.mode, 'recommended');
  assert.equal(migrated.activeSession.settings.mode, 'recommended');
  assert.deepEqual(migrated.lessonFlags, []);
});

test('schema 3 rejects active-session attempts that are absent from completed history', () => {
  const activeSession = {
    version: 1, id: 'session-1', startedAt: 123,
    items: [{ commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'voice-es', speed: 0.9 }],
    nextIndex: 1,
    attemptIds: ['missing-attempt'],
    settings: {
      phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
      feedbackSounds: true, length: 'medium', mode: 'recommended'
    }
  };
  assert.throws(
    () => importState(JSON.stringify({ ...defaultState(), activeSession })),
    /activeSession\.attemptIds reference/
  );
});

test('migration validates atomically and does not write an invalid candidate', () => {
  const storage = new MemoryStorage(JSON.stringify({
    schemaVersion: 1,
    settings: { ...defaultState().settings, speed: 4 },
    attempts: [],
    actionProgress: {}
  }));
  const before = storage.value;
  const loaded = loadState(storage);
  assert.match(loaded.recoveryError, /Invalid settings\.speed/);
  assert.equal(storage.value, before);
  assert.equal(storage.writes, 0);
});

test('future schema remains rejected without mutation', () => {
  const future = { ...defaultState(), schemaVersion: 4 };
  const before = structuredClone(future);
  assert.throws(() => migrateState(future), /Unsupported schema: 4/);
  assert.deepEqual(future, before);
});

test('feedback-sound preference persists, validates, and safely defaults for older backups', () => {
  const disabled = {
    ...defaultState(),
    settings: { ...defaultState().settings, feedbackSounds: false }
  };
  assert.equal(importState(exportState(disabled)).settings.feedbackSounds, false);

  const older = defaultState();
  delete older.settings.feedbackSounds;
  assert.equal(importState(JSON.stringify(older)).settings.feedbackSounds, true);

  assert.throws(
    () => importState(JSON.stringify({
      ...defaultState(),
      settings: { ...defaultState().settings, feedbackSounds: 'on' }
    })),
    /Invalid settings\.feedbackSounds/
  );
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
  assert.throws(() => importState('{"schemaVersion":4}'), /Unsupported schema/);
});

test('schema 3 round-trips validated lesson flags and rejects duplicate or malformed IDs', () => {
  const flag = {
    id: 'flag-1', commandId: 'c-der', category: 'wording', note: 'Ask the instructor.',
    createdAt: 100, updatedAt: 200, status: 'open'
  };
  const state = { ...defaultState(), lessonFlags: [flag] };
  assert.deepEqual(importState(exportState(state)).lessonFlags, [flag]);

  assert.throws(
    () => importState(JSON.stringify({ ...defaultState(), lessonFlags: [flag, { ...flag }] })),
    /duplicate lesson flag/i
  );
  assert.throws(
    () => importState(JSON.stringify({ ...defaultState(), lessonFlags: [{ ...flag, note: ' ' }] })),
    /note/i
  );
});

test('schema 3 accepts only recommended or free persisted practice modes', () => {
  for (const mode of ['recommended', 'free']) {
    const state = { ...defaultState(), settings: { ...defaultState().settings, mode } };
    assert.equal(importState(exportState(state)).settings.mode, mode);
  }
  assert.throws(
    () => importState(JSON.stringify({
      ...defaultState(), settings: { ...defaultState().settings, mode: 'weakest-first' }
    })),
    /settings\.mode/
  );
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

test('validates optional Stage 2 surface provenance without requiring it on prior attempts', () => {
  const provenance = {
    surfaceVersion: 2,
    surfaceSeed: 42,
    expectedResult: 'roundabout-exit-3',
    selectedTargetId: 'exit-3'
  };
  const state = {
    ...defaultState(),
    attempts: [completedAttempt(provenance)]
  };

  assert.deepEqual(importState(JSON.stringify(state)).attempts, state.attempts);
  assert.deepEqual(
    importState(JSON.stringify({ ...defaultState(), attempts: [completedAttempt()] })).attempts,
    [completedAttempt()]
  );

  for (const [field, value] of [
    ['surfaceVersion', 0],
    ['surfaceSeed', -1],
    ['expectedResult', ''],
    ['selectedTargetId', '']
  ]) {
    assert.throws(
      () => importState(JSON.stringify({
        ...defaultState(),
        attempts: [completedAttempt({ ...provenance, [field]: value })]
      })),
      new RegExp(`Invalid attempts\\[0\\]\\.${field}`)
    );
  }

  assert.deepEqual(
    importState(JSON.stringify({
      ...defaultState(),
      attempts: [completedAttempt({ ...provenance, selectedTargetId: null })]
    })).attempts,
    [completedAttempt({ ...provenance, selectedTargetId: null })]
  );
});

test('round-trips optional audio-provider provenance while accepting older attempts', () => {
  const withProvider = {
    ...defaultState(),
    attempts: [completedAttempt({ audioProvider: 'browser-speech' })]
  };
  assert.deepEqual(importState(JSON.stringify(withProvider)).attempts, withProvider.attempts);

  const legacy = { ...defaultState(), attempts: [completedAttempt()] };
  assert.deepEqual(importState(JSON.stringify(legacy)).attempts, legacy.attempts);

  for (const audioProvider of ['', 42, null]) {
    assert.throws(
      () => importState(JSON.stringify({
        ...defaultState(),
        attempts: [completedAttempt({ audioProvider })]
      })),
      /Invalid attempts\[0\]\.audioProvider/
    );
  }
});

test('imports historical provenance but never restores a schema-1 active surface model', () => {
  const futureAttempt = completedAttempt({
    surfaceVersion: 99,
    surfaceSeed: 42,
    expectedResult: 'turn-right',
    selectedTargetId: 'right'
  });
  const imported = importState(JSON.stringify({
    ...defaultState(),
    schemaVersion: 1,
    attempts: [futureAttempt],
    activeSurfaceModel: { id: 'do-not-restore' },
    activeSession: {
      id: 'future-session',
      activeSurfaceModel: { id: 'also-do-not-restore' }
    }
  }));

  assert.deepEqual(imported.attempts, [futureAttempt]);
  assert.equal(Object.hasOwn(imported, 'activeSurfaceModel'), false);
  assert.equal(imported.activeSession, null);
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
