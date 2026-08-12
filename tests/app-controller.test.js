import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adoptStableImages,
  adoptStableStages,
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

function fakeImage(attributes) {
  const map = new Map(Object.entries(attributes));
  const node = {
    get attributes() {
      return [...map.entries()].map(([name, value]) => ({ name, value }));
    },
    getAttribute: name => (map.has(name) ? map.get(name) : null),
    setAttribute(name, value) { map.set(name, value); },
    removeAttribute(name) { map.delete(name); },
    hasAttribute: name => map.has(name),
    replacedWith: null,
    replaceWith(replacement) { node.replacedWith = replacement; }
  };
  return node;
}

function fakeTree(images) {
  return { querySelectorAll: selector => (selector === 'img' ? images : []) };
}

test('re-renders adopt the previous scene image node when the asset is unchanged', () => {
  const previous = fakeImage({
    src: './assets/driving/four-way-intersection-photo-v1.webp',
    class: 'driving-scene-image',
    alt: 'Junction ahead',
    'data-stale': 'yes'
  });
  const next = fakeImage({
    src: './assets/driving/four-way-intersection-photo-v1.webp',
    class: 'driving-scene-image',
    alt: 'Cruce más adelante'
  });

  assert.equal(adoptStableImages(fakeTree([previous]), fakeTree([next])), 1);
  assert.equal(next.replacedWith, previous, 'live node keeps its identity across the re-render');
  assert.equal(previous.getAttribute('alt'), 'Cruce más adelante');
  assert.equal(previous.hasAttribute('data-stale'), false);
});

test('a scene change renders the new image instead of adopting the old node', () => {
  const previous = fakeImage({ src: './assets/driving/urban-roadside-photo-v1.webp' });
  const next = fakeImage({ src: './assets/driving/overtaking-photo-v1.webp' });

  assert.equal(adoptStableImages(fakeTree([previous]), fakeTree([next])), 0);
  assert.equal(next.replacedWith, null);
});

test('each retained image is adopted at most once', () => {
  const previous = fakeImage({ src: './assets/a.webp' });
  const first = fakeImage({ src: './assets/a.webp' });
  const second = fakeImage({ src: './assets/a.webp' });

  assert.equal(adoptStableImages(fakeTree([previous]), fakeTree([first, second])), 1);
  assert.equal(first.replacedWith, previous);
  assert.equal(second.replacedWith, null);
});

function fakeButton(disabled) {
  return {
    disabledAttribute: disabled,
    hasAttribute(name) { return name === 'disabled' && this.disabledAttribute; },
    toggleAttribute(name, force) {
      if (name === 'disabled') this.disabledAttribute = force;
    }
  };
}

function fakeStage({ surfaceId, outerHTML, buttons = [] }) {
  const node = {
    outerHTML,
    buttons,
    getAttribute: name => (name === 'data-surface' ? surfaceId : null),
    querySelectorAll: selector => (selector === 'button' ? buttons : []),
    replacedWith: null,
    replaceWith(replacement) { node.replacedWith = replacement; }
  };
  return node;
}

function fakeStageTree(stages) {
  return { querySelectorAll: selector => (selector === '.surface-stage' ? stages : []) };
}

test('the unlock render keeps the live stage node and flips disabled on its buttons', () => {
  const previous = fakeStage({
    surfaceId: 'generic-headlight-ring',
    outerHTML: '<div class="surface-stage" data-surface="generic-headlight-ring"><img src="./a.webp" decoding="sync"><button disabled="" style="--x:1"></button><button disabled="" style="--x:2"></button></div>',
    buttons: [fakeButton(true), fakeButton(true)]
  });
  const next = fakeStage({
    surfaceId: 'generic-headlight-ring',
    outerHTML: '<div class="surface-stage" data-surface="generic-headlight-ring"><img src="./a.webp" decoding="sync"><button style="--x:1"></button><button style="--x:2"></button></div>',
    buttons: [fakeButton(false), fakeButton(false)]
  });

  assert.equal(adoptStableStages(fakeStageTree([previous]), fakeStageTree([next])), 1);
  assert.equal(next.replacedWith, previous, 'live stage keeps its identity across the re-render');
  assert.deepEqual(previous.buttons.map(button => button.disabledAttribute), [false, false]);
});

test('a stage whose markup differs beyond disabled flags renders fresh', () => {
  const previous = fakeStage({
    surfaceId: 'roundabout-v2',
    outerHTML: '<div data-surface="roundabout-v2"><button disabled=""></button></div>',
    buttons: [fakeButton(true)]
  });
  const next = fakeStage({
    surfaceId: 'roundabout-v2',
    outerHTML: '<div data-surface="roundabout-v2"><button aria-current="true"></button></div>',
    buttons: [fakeButton(false)]
  });

  assert.equal(adoptStableStages(fakeStageTree([previous]), fakeStageTree([next])), 0);
  assert.equal(next.replacedWith, null);
  assert.equal(previous.buttons[0].disabledAttribute, true, 'rejected stages keep their state untouched');
});

test('stage adoption matches surfaces by id, not render order', () => {
  const previousOther = fakeStage({
    surfaceId: 'other-surface',
    outerHTML: '<div data-surface="other-surface"></div>'
  });
  const previous = fakeStage({
    surfaceId: 'junction-v3',
    outerHTML: '<div data-surface="junction-v3"><button disabled=""></button></div>',
    buttons: [fakeButton(true)]
  });
  const next = fakeStage({
    surfaceId: 'junction-v3',
    outerHTML: '<div data-surface="junction-v3"><button></button></div>',
    buttons: [fakeButton(false)]
  });

  assert.equal(adoptStableStages(fakeStageTree([previousOther, previous]), fakeStageTree([next])), 1);
  assert.equal(next.replacedWith, previous);
  assert.equal(previous.buttons[0].disabledAttribute, false);
});
