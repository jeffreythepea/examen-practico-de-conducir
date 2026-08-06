import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceActiveSession,
  createActiveSession,
  discardActiveSession,
  resolveActiveSession,
  validateStoredActiveSession
} from '../src/active-session.js';
import { EXAMINERS } from '../src/examiners.js';

const commands = [{
  id: 'c-der', actionId: 'turn-right', phase: 'driving', surfaceId: 'junction-v2',
  phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha', en: 'turn right' }]
}, {
  id: 'c-pre-aceite', actionId: 'locate-oil', phase: 'precheck', surfaceId: 'engine-v2',
  phrasings: [{ id: 'c-pre-aceite-canonical', es: 'Localice el aceite', en: 'locate oil' }]
}];

const audioManifest = [{
  id: 'audio-1', commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'voice-a',
  speed: 0.9, provider: 'elevenlabs', path: 'audio/one.mp3'
}, {
  id: 'audio-2', commandId: 'c-pre-aceite', phrasingId: 'c-pre-aceite-canonical', voiceId: 'voice-b',
  speed: 0.9, provider: 'elevenlabs', path: 'audio/two.mp3'
}];

const settings = {
  phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
  feedbackSounds: true, roadMovement: true, length: 'medium', mode: 'recommended'
};

function session(overrides = {}) {
  return createActiveSession({
    id: 'session-1',
    startedAt: 123,
    items: [
      { commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'voice-a', speed: 0.9 },
      { commandId: 'c-pre-aceite', phrasingId: 'c-pre-aceite-canonical', voiceId: 'voice-b', speed: 0.9 }
    ],
    nextIndex: 0,
    attemptIds: [],
    settings,
    target: { kind: 'recommended' },
    ...overrides
  });
}

test('active session serializes stable command and audio variant IDs but no live surface, timer, DOM, or audio objects', () => {
  const value = session();
  assert.deepEqual(Object.keys(value).sort(), ['attemptIds', 'experience', 'id', 'items', 'nextIndex', 'settings', 'startedAt', 'target', 'version']);
  assert.equal(value.version, 2);
  assert.deepEqual(value.experience, {
    modeId: 'practice', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: null, replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  });
  assert.deepEqual(Object.keys(value.items[0]).sort(), ['commandId', 'phrasingId', 'speed', 'voiceId']);
  assert.equal(JSON.stringify(value).includes('activeSurfaceModel'), false);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.items), true);
  assert.equal(Object.isFrozen(value.items[0]), true);
  assert.equal(Object.isFrozen(value.experience), true);
});

test('advancing appends one attempt and moves to the next unscored command', () => {
  const before = session();
  const after = advanceActiveSession(before, { nextIndex: 1, attemptId: 'attempt-1' });
  assert.equal(after.nextIndex, 1);
  assert.deepEqual(after.attemptIds, ['attempt-1']);
  assert.equal(before.nextIndex, 0);
  assert.throws(() => advanceActiveSession(after, { nextIndex: 2, attemptId: 'attempt-1' }), /attemptId/);
});

test('resolution rejects duplicate, missing, or unsupported command or audio variant IDs', () => {
  assert.throws(() => resolveActiveSession(session({ items: [session().items[0], session().items[0]] }), { commands, audioManifest }), /duplicate command/i);
  assert.throws(() => resolveActiveSession(session({ items: [{ ...session().items[0], commandId: 'missing' }] }), { commands, audioManifest }), /command/i);
  assert.throws(() => resolveActiveSession(session({ items: [{ ...session().items[0], voiceId: 'missing' }] }), { commands, audioManifest }), /audio variant/i);
});

test('resolution restores the exact selected phrasing, voice, and speed', () => {
  const resolved = resolveActiveSession(session(), { commands, audioManifest });
  assert.equal(resolved.index, 0);
  assert.deepEqual(resolved.attemptIds, []);
  assert.equal(resolved.sessionItems[0].id, 'c-der');
  assert.deepEqual(resolved.sessionItems[0].audioVariant, audioManifest[0]);
  assert.deepEqual(resolved.sessionItems[1].audioVariant, audioManifest[1]);
  assert.deepEqual(resolved.settings, settings);
  assert.deepEqual(resolved.target, { kind: 'recommended' });
  assert.equal(resolved.experience.modeId, 'practice');
});

test('active sessions validate supported targets while accepting sessions without one', () => {
  const legacy = session({ target: undefined });
  assert.equal(Object.hasOwn(legacy, 'target'), false);

  for (const target of [
    { kind: 'recommended' }, { kind: 'needs-practice' }, { kind: 'not-tested' },
    { kind: 'lesson-flags' }, { kind: 'not-ready' }, { kind: 'free' },
    { kind: 'command', commandId: 'c-der' }
  ]) assert.deepEqual(session({ target }).target, target);

  assert.throws(() => session({ target: { kind: 'missing' } }), /activeSession\.target/);
  assert.throws(() => session({ target: { kind: 'command' } }), /commandId/);
  assert.throws(() => session({ target: { kind: 'free', commandId: 'c-der' } }), /activeSession\.target/);
});

test('active sessions default missing road movement on and retain explicit false', () => {
  const legacySettings = { ...settings };
  delete legacySettings.roadMovement;
  assert.equal(session({ settings: legacySettings }).settings.roadMovement, true);
  assert.equal(session({ settings: { ...settings, roadMovement: false } }).settings.roadMovement, false);
  assert.throws(
    () => session({ settings: { ...settings, roadMovement: 'on' } }),
    /activeSession\.settings\.roadMovement/
  );
});

test('version-1 sessions normalize immutably to the compatibility Practice and Mixed snapshot', () => {
  const current = session();
  const legacy = structuredClone(current);
  legacy.version = 1;
  delete legacy.experience;
  const before = structuredClone(legacy);

  const migrated = validateStoredActiveSession(legacy);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.experience, {
    modeId: 'practice', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: null, replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  });
  assert.deepEqual(legacy, before);
  assert.deepEqual(migrated.items, current.items);
  assert.deepEqual(migrated.settings, current.settings);
});

test('experience snapshots reject unknown or preset-inconsistent values', () => {
  const compatibility = session().experience;
  for (const experience of [
    { ...compatibility, modeId: 'unknown' },
    { ...compatibility, examinerChoice: 'unknown' },
    { ...compatibility, themeId: 'unknown' },
    { ...compatibility, replayPolicy: 'none' },
    { ...compatibility, revealPolicy: 'session-end' },
    { ...compatibility, simulated: true },
    { ...compatibility, resolvedExaminerId: 'roger' },
    { ...compatibility, examinerChoice: 'today' },
    { ...compatibility, examinerChoice: 'roger', resolvedExaminerId: 'sarah' }
  ]) assert.throws(() => session({ experience }), /activeSession\.experience/);

  const mockExperience = {
    modeId: 'mock', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: null, replayPolicy: 'none', revealPolicy: 'session-end', simulated: true
  };
  assert.throws(() => session({ experience: mockExperience }), /settings\.speed for experience/);
  assert.throws(() => session({
    experience: mockExperience,
    settings: { ...settings, speed: 1, hintPolicy: 'available', timed: true }
  }), /settings\.hintPolicy for experience/);
  assert.throws(() => session({
    experience: mockExperience,
    settings: { ...settings, speed: 1, hintPolicy: 'unavailable', timed: false }
  }), /settings\.timed for experience/);
});

test('Today and fixed examiner snapshots enforce one resolved examiner voice while Mixed preserves existing voices', () => {
  const roger = EXAMINERS.find(({ id }) => id === 'roger');
  const fixedExperience = {
    modeId: 'practice', examinerChoice: 'roger', resolvedExaminerId: 'roger',
    themeId: null, replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  };
  const fixedItems = session().items.map(item => ({ ...item, voiceId: roger.voiceId }));
  assert.doesNotThrow(() => session({ items: fixedItems, experience: fixedExperience }));
  assert.doesNotThrow(() => session({
    items: fixedItems,
    experience: { ...fixedExperience, examinerChoice: 'today' }
  }));
  assert.throws(() => session({ experience: fixedExperience }), /voiceId for examiner/);
  assert.doesNotThrow(() => session());
});

test('resolution rejects commands outside the snapshotted theme', () => {
  const experience = {
    modeId: 'practice', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: 'precheck-inspection', replayPolicy: 'unlimited', revealPolicy: 'immediate', simulated: false
  };
  assert.throws(() => resolveActiveSession(session({ experience }), { commands, audioManifest }), /outside theme/i);
  const precheckOnly = session({ items: [session().items[1]], experience });
  assert.doesNotThrow(() => resolveActiveSession(precheckOnly, { commands, audioManifest }));
});

test('completed Mock snapshots remain valid and preserve session-end policy', () => {
  const experience = {
    modeId: 'mock', examinerChoice: 'mixed', resolvedExaminerId: null,
    themeId: 'full-mock', replayPolicy: 'none', revealPolicy: 'session-end', simulated: true
  };
  const completed = session({
    nextIndex: 2,
    attemptIds: ['attempt-1', 'attempt-2'],
    experience,
    settings: { ...settings, speed: 1, hintPolicy: 'unavailable', timed: true }
  });
  assert.equal(completed.nextIndex, completed.items.length);
  assert.deepEqual(validateStoredActiveSession(completed).experience, experience);
});

test('malformed session containers fail through active-session validation', () => {
  for (const value of [null, undefined, [], 'session']) {
    assert.throws(() => validateStoredActiveSession(value), /activeSession|cloneable/);
  }
});

test('resolution accepts a completed session whose index equals command count', () => {
  const resolved = resolveActiveSession(session({ nextIndex: 2, attemptIds: ['attempt-1', 'attempt-2'] }), { commands, audioManifest });
  assert.equal(resolved.index, 2);
});

test('discard returns state with activeSession null and leaves attempts unchanged', () => {
  const state = { attempts: [{ id: 'attempt-1' }], activeSession: session(), future: true };
  const discarded = discardActiveSession(state);
  assert.equal(discarded.activeSession, null);
  assert.equal(discarded.attempts, state.attempts);
  assert.equal(state.activeSession.id, 'session-1');
});
