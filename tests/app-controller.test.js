import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureFocusSnapshot,
  lessonEditorDraftFromForm,
  persistedActiveSessionAfterAttempt,
  restoreFocusSnapshot
} from '../src/app.js';
import { createActiveSession } from '../src/active-session.js';

function activeSession() {
  return createActiveSession({
    id: 'session-1',
    startedAt: 1,
    items: [
      { commandId: 'c-der', phrasingId: 'p-der', voiceId: 'voice-1', speed: 0.9 },
      { commandId: 'c-izq', phrasingId: 'p-izq', voiceId: 'voice-1', speed: 0.9 }
    ],
    settings: {
      phase: 'mixed', speed: 0.9, hintPolicy: 'available', timed: false,
      feedbackSounds: true, length: 'short', mode: 'recommended'
    },
    target: { kind: 'recommended' }
  });
}

test('completed attempts clear the persisted active session instead of offering Resume', () => {
  const first = persistedActiveSessionAfterAttempt(activeSession(), {
    nextIndex: 1,
    attemptId: 'attempt-1'
  });
  assert.equal(first.nextIndex, 1);

  const completed = persistedActiveSessionAfterAttempt(first, {
    nextIndex: 2,
    attemptId: 'attempt-2'
  });
  assert.equal(completed, null);
});

test('lesson editor drafts are read from the live form before a locale rerender', () => {
  const values = new Map([
    ['[name="commandId"]', { value: 'c-der' }],
    ['[name="flagId"]', { value: 'flag-1' }],
    ['[name="category"]', { value: 'audio' }],
    ['[name="note"]', { value: 'Keep this unsaved draft 🚗' }]
  ]);
  const form = { querySelector: selector => values.get(selector) ?? null };

  assert.deepEqual(lessonEditorDraftFromForm(form), {
    commandId: 'c-der',
    flagId: 'flag-1',
    category: 'audio',
    note: 'Keep this unsaved draft 🚗'
  });
});

function element(attributes, overrides = {}) {
  return {
    disabled: false,
    hidden: false,
    getAttribute(name) { return attributes[name] ?? null; },
    ...overrides
  };
}

test('focus snapshots distinguish repeated readiness actions by command and flag', () => {
  const oldButton = element({
    'data-action': 'open-lesson-flag',
    'data-command-id': 'c-pre-frenos',
    'data-flag-id': 'flag-2'
  });
  let focused = 0;
  const replacement = element({}, { focus() { focused += 1; } });
  const expectedSelector = '[data-action="open-lesson-flag"][data-command-id="c-pre-frenos"][data-flag-id="flag-2"]';
  const app = {
    contains: candidate => candidate === oldButton,
    querySelector: selector => selector === expectedSelector ? replacement : null
  };

  const snapshot = captureFocusSnapshot(app, { activeElement: oldButton });
  assert.equal(snapshot.selector, expectedSelector);
  assert.equal(restoreFocusSnapshot(app, snapshot), true);
  assert.equal(focused, 1);
});

test('resolve and save actions restore focus to the corresponding lesson note control', () => {
  for (const fixture of [
    {
      attributes: {
        'data-action': 'resolve-lesson-flag',
        'data-command-id': 'c-der',
        'data-flag-id': 'flag-1'
      },
      fallback: '[data-action="reopen-lesson-flag"][data-command-id="c-der"][data-flag-id="flag-1"]'
    },
    {
      attributes: {
        'data-action': 'save-lesson-flag',
        'data-command-id': 'c-der',
        'data-flag-id': 'flag-1'
      },
      fallback: '[data-action="open-lesson-flag"][data-command-id="c-der"][data-flag-id="flag-1"]'
    }
  ]) {
    const oldButton = element(fixture.attributes);
    let focused = 0;
    const replacement = element({}, { focus() { focused += 1; } });
    const app = {
      contains: candidate => candidate === oldButton,
      querySelector: selector => selector === fixture.fallback ? replacement : null
    };
    const snapshot = captureFocusSnapshot(app, { activeElement: oldButton });
    assert.equal(restoreFocusSnapshot(app, snapshot), true);
    assert.equal(focused, 1);
  }
});
