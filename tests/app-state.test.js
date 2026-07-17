import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureFocusSnapshot,
  focusScreen,
  localizedVehicleAnswer,
  promptControlsDisabled,
  reduceScreen,
  restoreFocusSnapshot,
  restoreOrDeferFocus,
  selectAudioVariant
} from '../src/app.js';

const settings = Object.freeze({
  locale: 'en', phase: 'driving', speed: 0.9, hintPolicy: 'available', timed: false, length: 'short'
});
const session = Object.freeze([
  Object.freeze({
    id: 'c-der', actionId: 'turn-right', phase: 'driving', acceptedResult: 'turn-right',
    surfaceId: 'junction-v1', phrasings: [{ id: 'c-der-canonical', es: 'Gire a la derecha', en: 'turn right' }]
  }),
  Object.freeze({
    id: 'c-izq', actionId: 'turn-left', phase: 'driving', acceptedResult: 'turn-left',
    surfaceId: 'junction-v1', phrasings: [{ id: 'c-izq-canonical', es: 'Gire a la izquierda', en: 'turn left' }]
  })
]);
const rightVariant = Object.freeze({
  id: 'right-roger', commandId: 'c-der', phrasingId: 'c-der-canonical', voiceId: 'roger', speed: 0.9,
  path: 'audio/right.mp3'
});

function setupModel() {
  return { screen: 'setup', settings, session: [], index: 0 };
}

function promptModel({ textShown = false } = {}) {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000 });
  if (textShown) model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  return model;
}

test('screen reducer follows setup to loading, prompt, reveal, the next prompt, and results only through Continue', () => {
  let model = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 0);

  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: rightVariant, completedAt: 1_000 });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.promptStartedAt, 1_000);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_900 });
  assert.equal(model.screen, 'reveal');
  assert.equal(model.outcome, 'unaided');
  assert.equal(model.responseMs, 900);
  assert.equal(model.index, 0, 'answer reveal must not advance automatically');

  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.index, 1);

  const leftVariant = { ...rightVariant, id: 'left-roger', commandId: 'c-izq', phrasingId: 'c-izq-canonical' };
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant: leftVariant, completedAt: 2_000 });
  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 2_300 });
  assert.equal(model.screen, 'reveal');
  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.screen, 'results');
});

test('Spanish hint stays in the prompt and makes a later correct response assisted', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.textShown, true);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_500 });
  assert.equal(model.outcome, 'assisted');
});

test('replay locks the prompt, ignores stale completion, and counts one matching completion exactly once', () => {
  let model = promptModel();
  const chosen = model.variant;
  model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 7 });
  assert.equal(model.replayPending, true);
  assert.equal(promptControlsDisabled(model), true);
  assert.strictEqual(reduceScreen(model, { type: 'SHOW_SPANISH' }), model);
  assert.strictEqual(
    reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_050 }),
    model
  );

  const wrongOperation = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 6, completedAt: 1_100 });
  assert.strictEqual(wrongOperation, model);
  model = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 7, completedAt: 1_100 });
  assert.equal(model.replayPending, false);
  assert.equal(model.replays, 1);
  assert.strictEqual(model.variant, chosen);
  const duplicate = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId: 7, completedAt: 1_200 });
  assert.strictEqual(duplicate, model);

  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-right', completedAt: 1_250 });
  const revealed = model;
  model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId: 7, reason: 'error' });
  assert.strictEqual(model, revealed, 'a stale replay failure must not leave or rescore the reveal');
});

test('a matching replay failure returns the still-active prompt to unscored retry', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId: 8 });
  model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId: 8, reason: 'error' });
  assert.equal(model.replays, 0);
  assert.equal(model.screen, 'loading-audio');
  assert.equal(model.outcome, null);
});

test('wrong answers and timeouts reveal an optional six-reason diagnosis', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SELECT_RESULT', selectedResult: 'turn-left', completedAt: 1_250 });
  assert.equal(model.outcome, 'incorrect');
  assert.deepEqual(model.allowedMissReasons, ['hearing', 'meaning', 'mapping', 'target', 'accidental', 'other']);
  model = reduceScreen(model, { type: 'SET_MISS_REASON', reason: 'meaning' });
  assert.equal(model.missReason, 'meaning');

  let timed = promptModel();
  timed = reduceScreen(timed, { type: 'TIMEOUT', completedAt: 9_000 });
  assert.equal(timed.outcome, 'incorrect');
  assert.equal(timed.timeout, true);
  assert.equal(timed.selectedResult, null);
});

test('failed or interrupted audio returns to retry without creating a scoreable answer', () => {
  let loading = reduceScreen(setupModel(), { type: 'START_SESSION', session });
  loading = reduceScreen(loading, { type: 'AUDIO_FAILED', reason: 'error' });
  assert.equal(loading.screen, 'loading-audio');
  assert.equal(loading.audioError, 'error');
  assert.equal(loading.outcome, null);

  let prompt = promptModel();
  prompt = reduceScreen(prompt, { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' });
  assert.equal(prompt.screen, 'loading-audio');
  assert.equal(prompt.audioError, 'visibilitychange');
  assert.equal(prompt.outcome, null);
});

test('switching interface language preserves the active command and selected audio', () => {
  const model = promptModel();
  const changed = reduceScreen(model, { type: 'SET_LOCALE', locale: 'es' });
  assert.equal(changed.settings.locale, 'es');
  assert.strictEqual(changed.session, model.session);
  assert.strictEqual(changed.variant, model.variant);
  assert.equal(changed.index, model.index);
});

test('audio selection randomly chooses between available voices and returns one immutable trial variant', () => {
  const manifest = [
    rightVariant,
    { ...rightVariant, id: 'right-sarah', voiceId: 'sarah', path: 'audio/right-sarah.mp3' },
    { ...rightVariant, id: 'right-fast', speed: 1 }
  ];
  const selection = { commandId: 'c-der', phrasingId: 'c-der-canonical', speed: 0.9 };

  const roger = selectAudioVariant(manifest, selection, () => 0);
  const sarah = selectAudioVariant(manifest, selection, () => 0.999);
  assert.equal(roger.voiceId, 'roger');
  assert.equal(sarah.voiceId, 'sarah');
  assert.ok(Object.isFrozen(roger));
  assert.throws(() => selectAudioVariant(manifest, { ...selection, speed: 0.75 }, () => 0), /Audio unavailable/);
});

test('vehicle procedures select an explicit locale field without mixing languages', () => {
  const command = {
    vehicle: {
      answer: 'Abra el capó.',
      answerEn: 'Open the bonnet.'
    }
  };
  assert.equal(localizedVehicleAnswer(command, 'en'), 'Open the bonnet.');
  assert.equal(localizedVehicleAnswer(command, 'es'), 'Abra el capó.');
});

test('screen focus moves only on screen transitions', () => {
  let focusCalls = 0;
  const target = { focus(options) { focusCalls += 1; assert.deepEqual(options, { preventScroll: true }); } };
  const documentRef = { querySelector(selector) { assert.equal(selector, '[data-screen-focus]'); return target; } };

  assert.equal(focusScreen(documentRef, { previousScreen: 'prompt', nextScreen: 'reveal' }), true);
  assert.equal(focusCalls, 1);
  assert.equal(focusScreen(documentRef, { previousScreen: 'reveal', nextScreen: 'reveal' }), false);
  assert.equal(focusCalls, 1);
});

function focusElement(attributes, options = {}) {
  return {
    disabled: false,
    ...options,
    getAttribute(name) {
      return attributes[name] ?? null;
    }
  };
}

function focusFixture(activeElement, replacements, { insideApp = true } = {}) {
  const queries = [];
  const app = {
    contains(element) {
      return insideApp && element === activeElement;
    },
    querySelector(selector) {
      queries.push(selector);
      return replacements.get(selector) ?? null;
    }
  };
  return { app, documentRef: { activeElement }, queries };
}

test('same-screen setup and locale rerenders restore the equivalent replacement control', () => {
  for (const [attribute, value] of [['data-setting', 'phase'], ['data-locale', 'es']]) {
    const oldControl = focusElement({ [attribute]: value });
    let focused = 0;
    const newControl = focusElement({ [attribute]: value }, {
      focus(options) {
        focused += 1;
        assert.deepEqual(options, { preventScroll: true });
      }
    });
    const selector = `[${attribute}="${value}"]`;
    const { app, documentRef } = focusFixture(oldControl, new Map([[selector, newControl]]));

    const snapshot = captureFocusSnapshot(app, documentRef);
    assert.equal(restoreFocusSnapshot(app, snapshot), true);
    assert.equal(focused, 1);
  }
});

test('same-screen hint and diagnosis rerenders restore a usable prompt/reveal control', () => {
  const oldHint = focusElement({ 'data-action': 'show-spanish' });
  let replayFocused = 0;
  const newReplay = focusElement({ 'data-action': 'replay' }, {
    focus() { replayFocused += 1; }
  });
  const hintFixture = focusFixture(oldHint, new Map([
    ['[data-action="show-spanish"]', null],
    ['[data-action="replay"]', newReplay]
  ]));
  const hintSnapshot = captureFocusSnapshot(hintFixture.app, hintFixture.documentRef);
  assert.equal(restoreFocusSnapshot(hintFixture.app, hintSnapshot), true);
  assert.equal(replayFocused, 1, 'a removed Show Spanish control falls back to Replay');

  const oldReason = focusElement({ 'data-miss-reason': 'meaning' });
  let reasonFocused = 0;
  const newReason = focusElement({ 'data-miss-reason': 'meaning' }, {
    focus() { reasonFocused += 1; }
  });
  const reasonSelector = '[data-miss-reason="meaning"]';
  const reasonFixture = focusFixture(oldReason, new Map([[reasonSelector, newReason]]));
  const reasonSnapshot = captureFocusSnapshot(reasonFixture.app, reasonFixture.documentRef);
  assert.equal(restoreFocusSnapshot(reasonFixture.app, reasonSnapshot), true);
  assert.equal(reasonFocused, 1);
});

test('focus restoration preserves text selection and never steals focus from outside the app', () => {
  const oldInput = focusElement({ id: 'notes' }, {
    selectionStart: 2,
    selectionEnd: 5,
    selectionDirection: 'backward'
  });
  let restoredSelection;
  const newInput = focusElement({ id: 'notes' }, {
    focus() {},
    setSelectionRange(...selection) { restoredSelection = selection; }
  });
  const selector = '[id="notes"]';
  const inside = focusFixture(oldInput, new Map([[selector, newInput]]));
  assert.equal(restoreFocusSnapshot(inside.app, captureFocusSnapshot(inside.app, inside.documentRef)), true);
  assert.deepEqual(restoredSelection, [2, 5, 'backward']);

  let outsideFocused = 0;
  const outside = focusFixture(oldInput, new Map([[selector, {
    disabled: false,
    focus() { outsideFocused += 1; }
  }]]), { insideApp: false });
  assert.equal(captureFocusSnapshot(outside.app, outside.documentRef), null);
  assert.equal(restoreFocusSnapshot(outside.app, null), false);
  assert.equal(outsideFocused, 0);
  assert.deepEqual(outside.queries, []);
});

test('replay focus survives its disabled render and returns when replay completes', () => {
  const body = focusElement({ id: 'body' });
  const oldReplay = focusElement({ 'data-action': 'replay' });
  const disabledReplay = focusElement({ 'data-action': 'replay' }, { disabled: true });
  let enabledReplayFocused = 0;
  const documentRef = { activeElement: oldReplay, body, documentElement: focusElement({ id: 'html' }) };
  const app = {
    replacement: disabledReplay,
    contains(element) {
      return [oldReplay, disabledReplay, this.replacement].includes(element);
    },
    querySelector(selector) {
      assert.equal(selector, '[data-action="replay"]');
      return this.replacement;
    }
  };

  const replaySnapshot = captureFocusSnapshot(app, documentRef);
  documentRef.activeElement = body;
  let deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: replaySnapshot,
    deferredSnapshot: null
  });
  assert.strictEqual(deferred, replaySnapshot, 'disabled replay retains its focus identity across playback');
  assert.strictEqual(documentRef.activeElement, body);

  const enabledReplay = focusElement({ 'data-action': 'replay' }, {
    focus(options) {
      enabledReplayFocused += 1;
      assert.deepEqual(options, { preventScroll: true });
      documentRef.activeElement = enabledReplay;
    }
  });
  app.replacement = enabledReplay;
  const completionSnapshot = captureFocusSnapshot(app, documentRef);
  assert.equal(completionSnapshot, null, 'body focus has no new control identity');
  deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: completionSnapshot,
    deferredSnapshot: deferred
  });
  assert.equal(deferred, null);
  assert.equal(enabledReplayFocused, 1);
  assert.strictEqual(documentRef.activeElement, enabledReplay, 'completion must not leave focus on body');
});

test('deferred replay restoration does not override a deliberate move outside the app', () => {
  const body = focusElement({ id: 'body' });
  const outsideControl = focusElement({ id: 'outside' });
  const replaySnapshot = {
    selector: '[data-action="replay"]',
    fallbackSelectors: [],
    selection: null
  };
  let replayFocused = 0;
  const enabledReplay = focusElement({ 'data-action': 'replay' }, {
    focus() { replayFocused += 1; }
  });
  const documentRef = {
    activeElement: outsideControl,
    body,
    documentElement: focusElement({ id: 'html' })
  };
  const app = {
    contains() { return false; },
    querySelector() { return enabledReplay; }
  };

  const deferred = restoreOrDeferFocus(app, documentRef, {
    snapshot: null,
    deferredSnapshot: replaySnapshot
  });
  assert.equal(deferred, null);
  assert.equal(replayFocused, 0);
  assert.strictEqual(documentRef.activeElement, outsideControl);
});
