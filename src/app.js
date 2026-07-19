import { createAudioPlayer, validateAudioManifest } from './audio.js';
import { commandsForPhase, validateCatalog } from './catalog.js';
import { createFeedbackCuePlayer } from './feedback-audio.js';
import { setDocumentLocale, translate } from './i18n.js';
import {
  STORAGE_KEY,
  defaultState,
  exportState,
  importState,
  loadState,
  saveState
} from './storage.js';
import {
  generateSurface,
  reduceSurfaceResponse,
  renderSurfaceModel,
  supportedCommands
} from './surfaces.js';
import { createSession, recordAttempt, summarizeSession } from './training.js';

export const MISS_REASONS = Object.freeze(['hearing', 'meaning', 'mapping', 'target', 'accidental', 'other']);
export const TRIAL_TIME_MS = 8_000;
const SURFACE_RETRY_INCREMENT = 0x9e3779b9;
const RESULT_ONLY_SURFACE_FAMILIES = Object.freeze([
  'junction',
  'roundabout',
  'u-turn',
  'overtake',
  'parking',
  'stopping',
  'semantic'
]);

export function promptControlsDisabled(model) {
  return model.screen !== 'prompt' || Boolean(model.replayPending) || !model.activeSurfaceModel;
}

export function feedbackCueForTransition(before, after, event) {
  if (before === after) return null;
  if (event.type === 'SHOW_SPANISH' && !before.textShown && after.textShown) {
    return 'spanish-hint';
  }
  if (before.screen !== 'prompt' || after.screen !== 'reveal' || after.timeout) return null;
  if (after.outcome === 'incorrect') return 'incorrect';
  if (after.outcome === 'unaided' || after.outcome === 'assisted') return 'correct';
  return null;
}

export function nextSurfaceSeed(cryptoRef = globalThis.crypto) {
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('Cryptographic surface seed generation is unavailable');
  }
  const values = new Uint32Array(1);
  cryptoRef.getRandomValues(values);
  return values[0];
}

export function generateSurfaceWithRetries(command, requestedSeed, surfaceGenerator = generateSurface) {
  if (!Number.isInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 0xffff_ffff) {
    throw new Error('Surface seed must be a uint32');
  }
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seed = (requestedSeed + attempt * SURFACE_RETRY_INCREMENT) >>> 0;
    try {
      return { model: surfaceGenerator(command, seed), error: null };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  return { model: null, error: lastError };
}

export function localizedVehicleAnswer(command, locale) {
  if (!command.vehicle) return '';
  return locale === 'es' ? command.vehicle.answer : command.vehicle.answerEn;
}

const FOCUS_IDENTITY_ATTRIBUTES = Object.freeze([
  'data-setting',
  'data-locale',
  'data-action',
  'data-target',
  'data-control-event',
  'data-result',
  'data-miss-reason',
  'id',
  'name'
]);

export function captureFocusSnapshot(app, documentRef) {
  const activeElement = documentRef.activeElement;
  if (!activeElement || !app.contains(activeElement)) return null;
  const identity = FOCUS_IDENTITY_ATTRIBUTES
    .map(attribute => [attribute, activeElement.getAttribute?.(attribute)])
    .find(([, value]) => value !== null && value !== '');
  if (!identity) return null;

  const [attribute, value] = identity;
  const selection = Number.isInteger(activeElement.selectionStart)
    && Number.isInteger(activeElement.selectionEnd)
    ? {
        start: activeElement.selectionStart,
        end: activeElement.selectionEnd,
        direction: activeElement.selectionDirection ?? 'none'
      }
    : null;
  return {
    selector: attributeSelector(attribute, value),
    fallbackSelectors: attribute === 'data-action' && value === 'show-spanish'
      ? ['[data-action="replay"]']
      : [],
    selection
  };
}

export function restoreFocusSnapshot(app, snapshot) {
  if (!snapshot) return false;
  const candidates = [snapshot.selector, ...snapshot.fallbackSelectors];
  const target = candidates
    .map(selector => app.querySelector(selector))
    .find(element => element && isEnabledFocusTarget(element));
  if (!target) return false;

  target.focus({ preventScroll: true });
  if (snapshot.selection && typeof target.setSelectionRange === 'function') {
    target.setSelectionRange(
      snapshot.selection.start,
      snapshot.selection.end,
      snapshot.selection.direction
    );
  }
  return true;
}

export function restoreOrDeferFocus(app, documentRef, { snapshot, deferredSnapshot }) {
  const activeElement = documentRef.activeElement;
  const focusIsNeutral = !activeElement
    || activeElement === documentRef.body
    || activeElement === documentRef.documentElement;
  if (!focusIsNeutral) return null;

  const candidate = snapshot ?? deferredSnapshot;
  if (!candidate) return null;
  return restoreFocusSnapshot(app, candidate) ? null : candidate;
}

export function focusScreen(documentRef, { previousScreen, nextScreen }) {
  if (previousScreen === nextScreen) return false;
  const target = documentRef.querySelector('[data-screen-focus]');
  if (!target) return false;
  target.focus({ preventScroll: true });
  return true;
}

export function reduceScreen(model, event, { surfaceGenerator = generateSurface } = {}) {
  if (event.type === 'SET_LOCALE') {
    return { ...model, settings: { ...model.settings, locale: event.locale } };
  }
  if (event.type === 'GO_TO_SETUP') {
    return resetTrial({ ...model, screen: 'setup', settings: model.settings, session: [] }, 0);
  }
  if (event.type === 'START_SESSION') {
    return resetTrial({ ...model, screen: 'loading-audio', session: [...event.session] }, 0);
  }
  if (['AUDIO_COMPLETED', 'TRIAL_AUDIO_ENDED'].includes(event.type) && model.screen === 'loading-audio') {
    const continuingTrial = Boolean(model.activeSurfaceModel);
    const generated = continuingTrial
      ? { model: model.activeSurfaceModel, error: null }
      : generateSurfaceWithRetries(
          model.session[model.index],
          event.seed ?? nextSurfaceSeed(),
          surfaceGenerator
        );
    return {
      ...model,
      screen: 'prompt',
      variant: event.variant ? Object.freeze({ ...event.variant }) : model.variant,
      audioError: null,
      activeSurfaceModel: generated.model,
      surfaceResponse: continuingTrial ? model.surfaceResponse : {},
      surfaceError: generated.error?.message ?? null,
      textShown: continuingTrial ? model.textShown : model.settings.hintPolicy === 'shown',
      replays: continuingTrial ? model.replays : 0,
      promptStartedAt: event.completedAt,
      outcome: null,
      selectedResult: null,
      responseMs: null,
      timeout: false,
      missReason: null,
      allowedMissReasons: [],
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'AUDIO_FAILED' && model.screen === 'loading-audio') {
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'error',
      outcome: null,
      selectedResult: null,
      responseMs: null,
      timeout: false,
      missReason: null,
      allowedMissReasons: [],
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'AUDIO_INTERRUPTED' && ['prompt', 'loading-audio'].includes(model.screen)) {
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'interrupted',
      outcome: null,
      selectedResult: null,
      responseMs: null,
      timeout: false,
      missReason: null,
      allowedMissReasons: [],
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'RETRY_AUDIO' && model.screen === 'loading-audio') {
    return { ...model, audioError: null };
  }
  if (event.type === 'RETRY_SURFACE'
      && model.screen === 'prompt'
      && model.surfaceError
      && !model.activeSurfaceModel) {
    const generated = generateSurfaceWithRetries(
      model.session[model.index],
      event.seed ?? nextSurfaceSeed(),
      surfaceGenerator
    );
    return {
      ...model,
      activeSurfaceModel: generated.model,
      surfaceResponse: {},
      surfaceError: generated.error?.message ?? null,
      promptStartedAt: event.startedAt ?? model.promptStartedAt
    };
  }
  if (event.type === 'REPLAY_STARTED' && model.screen === 'prompt' && !model.replayPending) {
    return { ...model, replayPending: true, replayOperationId: event.operationId };
  }
  if (event.type === 'REPLAY_FAILED'
      && model.screen === 'prompt'
      && model.replayPending
      && model.replayOperationId === event.operationId) {
    return {
      ...model,
      screen: 'loading-audio',
      audioError: event.reason ?? 'error',
      outcome: null,
      selectedResult: null,
      responseMs: null,
      timeout: false,
      missReason: null,
      allowedMissReasons: [],
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'SHOW_SPANISH' && model.screen === 'prompt' && !model.replayPending) {
    return { ...model, textShown: true };
  }
  if (event.type === 'REPLAY_COMPLETED'
      && model.screen === 'prompt'
      && model.replayPending
      && model.replayOperationId === event.operationId) {
    return {
      ...model,
      replays: model.replays + 1,
      promptStartedAt: event.completedAt ?? model.promptStartedAt,
      replayPending: false,
      replayOperationId: null
    };
  }
  if (event.type === 'SELECT_RESULT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && RESULT_ONLY_SURFACE_FAMILIES.includes(model.activeSurfaceModel.family)
      && !model.replayPending) {
    const selectedTarget = model.activeSurfaceModel.targets
      .find(target => target.resultId === event.selectedResult);
    if (!selectedTarget) return model;
    const selectedResult = selectedTarget.resultId;
    const selectedTargetId = selectedTarget.id;
    const correct = selectedResult === model.activeSurfaceModel.expectedResult;
    return reveal(model, {
      selectedResult,
      selectedTargetId,
      surfaceResponse: { complete: true, selectedResult, selectedTargetId },
      correct,
      timeout: false,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'SURFACE_EVENT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && !model.replayPending) {
    let response;
    try {
      response = reduceSurfaceResponse(
        model.activeSurfaceModel,
        model.surfaceResponse,
        event.surfaceEvent
      );
    } catch {
      return model;
    }
    if (!response || typeof response !== 'object' || response === model.surfaceResponse) return model;
    if (!response.complete && !response.incorrect) return { ...model, surfaceResponse: { ...response } };
    if (response.complete && response.incorrect) return model;
    const selectedTargetId = response.selectedTargetId ?? null;
    const selectedTarget = model.activeSurfaceModel.targets
      .find(target => target.id === selectedTargetId);
    if (!selectedTarget) return model;
    const selectedResult = response.selectedResult ?? null;
    if (response.complete && selectedResult !== selectedTarget.resultId) return model;
    const correct = !response.incorrect && selectedResult === model.activeSurfaceModel.expectedResult;
    return reveal(model, {
      selectedResult,
      selectedTargetId,
      surfaceResponse: { ...response },
      correct,
      timeout: false,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'TIMEOUT'
      && model.screen === 'prompt'
      && model.activeSurfaceModel
      && !model.replayPending) {
    return reveal(model, {
      selectedResult: null,
      selectedTargetId: null,
      surfaceResponse: {
        ...model.surfaceResponse,
        complete: true,
        selectedResult: null,
        selectedTargetId: null
      },
      correct: false,
      timeout: true,
      completedAt: event.completedAt
    });
  }
  if (event.type === 'SET_MISS_REASON' && model.screen === 'reveal' && model.outcome === 'incorrect') {
    if (!MISS_REASONS.includes(event.reason)) return model;
    return { ...model, missReason: event.reason };
  }
  if (event.type === 'CONTINUE' && model.screen === 'reveal') {
    const nextIndex = model.index + 1;
    if (nextIndex >= model.session.length) return resetTrial({ ...model, screen: 'results' }, nextIndex);
    return resetTrial({ ...model, screen: 'loading-audio' }, nextIndex);
  }
  return model;
}

export function selectAudioVariant(manifest, selection, rng = Math.random) {
  const candidates = manifest.filter(variant =>
    variant.commandId === selection.commandId
    && variant.phrasingId === selection.phrasingId
    && variant.speed === selection.speed
  );
  if (candidates.length === 0) throw new Error(`Audio unavailable for ${selection.commandId}`);
  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  return Object.freeze({ ...candidates[index] });
}

function resetTrial(model, index) {
  return {
    ...model,
    index,
    variant: null,
    activeSurfaceModel: null,
    surfaceResponse: {},
    surfaceError: null,
    audioError: null,
    textShown: false,
    replays: 0,
    promptStartedAt: null,
    outcome: null,
    selectedResult: null,
    selectedTargetId: null,
    correct: false,
    responseMs: null,
    timeout: false,
    missReason: null,
    allowedMissReasons: [],
    replayPending: false,
    replayOperationId: null
  };
}

function reveal(model, { selectedResult, selectedTargetId, surfaceResponse, correct, timeout, completedAt }) {
  const responseMs = Number.isFinite(completedAt) && Number.isFinite(model.promptStartedAt)
    ? Math.max(0, completedAt - model.promptStartedAt)
    : null;
  const outcome = correct ? (model.textShown ? 'assisted' : 'unaided') : 'incorrect';
  return {
    ...model,
    screen: 'reveal',
    selectedResult,
    selectedTargetId,
    surfaceResponse,
    correct,
    timeout,
    responseMs,
    outcome,
    missReason: null,
    allowedMissReasons: outcome === 'incorrect' ? [...MISS_REASONS] : []
  };
}

const COMMANDS_URL = new URL('../data/commands.json', import.meta.url);
const AUDIO_MANIFEST_URL = new URL('../data/audio-manifest.json', import.meta.url);

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  void bootstrap();
}

async function bootstrap() {
  const app = document.querySelector('#app');
  let commands;
  let selectableCommands;
  let manifest;
  let player;
  let feedbackPlayer;
  let state;
  let model;
  let importError = '';
  let recoveryError = '';
  let audioBusy = false;
  let timerId = null;
  let timerTickId = null;
  let timerDeadline = null;
  let sessionAttemptIds = [];
  let currentAttemptId = null;
  let audioOperation = 0;
  let lastRenderedScreen = null;
  let deferredFocusSnapshot = null;

  try {
    [commands, manifest] = await Promise.all([
      fetch(COMMANDS_URL).then(requireJsonResponse),
      fetch(AUDIO_MANIFEST_URL).then(requireJsonResponse)
    ]);
    validateCatalog(commands);
    validateAudioManifest(manifest, commands);
    selectableCommands = supportedCommands(commands, message => console.warn(message));
    const loaded = loadState(window.localStorage);
    recoveryError = loaded.recoveryError ?? '';
    const { recoveryError: _ignored, ...savedState } = loaded;
    state = {
      ...savedState,
      settings: { ...savedState.settings, mode: practiceMode(savedState.settings.mode) }
    };
    model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
    player = createAudioPlayer({ AudioCtor: window.Audio, document });
    feedbackPlayer = createFeedbackCuePlayer();
  } catch (error) {
    const locale = 'en';
    app.innerHTML = `<p class="notice error" role="alert">${escapeHtml(translate(locale, 'error.init'))}</p>`;
    console.error(error);
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !['prompt', 'loading-audio'].includes(model.screen)) return;
    stopTimer();
    player.cancel('visibilitychange');
    model = reduceScreen(model, { type: 'AUDIO_INTERRUPTED', reason: 'visibilitychange' });
    render();
  });

  function locale() {
    return model.settings.locale;
  }

  function render() {
    const previousScreen = lastRenderedScreen;
    const focusSnapshot = previousScreen === model.screen
      ? captureFocusSnapshot(app, document)
      : null;
    setDocumentLocale(locale());
    document.title = translate(locale(), 'app.title');
    document.querySelector('#skip-link').textContent = translate(locale(), 'app.skip');
    const screen = model.screen === 'setup'
      ? renderSetup()
      : model.screen === 'loading-audio'
        ? renderLoading()
        : model.screen === 'prompt'
          ? renderPrompt()
          : model.screen === 'reveal'
            ? renderReveal()
            : renderResults();
    app.innerHTML = `${renderHeader()}${screen}`;
    bindCommonEvents();
    if (model.screen === 'setup') bindSetupEvents();
    if (model.screen === 'loading-audio') bindLoadingEvents();
    if (model.screen === 'prompt') bindPromptEvents();
    if (model.screen === 'reveal') bindRevealEvents();
    if (model.screen === 'results') bindResultsEvents();
    refreshTimerText();
    if (previousScreen === model.screen) {
      deferredFocusSnapshot = restoreOrDeferFocus(app, document, {
        snapshot: focusSnapshot,
        deferredSnapshot: deferredFocusSnapshot
      });
    } else {
      deferredFocusSnapshot = null;
    }
    focusScreen(document, { previousScreen, nextScreen: model.screen });
    lastRenderedScreen = model.screen;
  }

  function renderHeader() {
    return `<header class="app-header">
      <div>
        <h1>${translate(locale(), 'app.shortTitle')}</h1>
        <p>${translate(locale(), 'app.subtitle')}</p>
        <p class="audio-disclosure">${translate(locale(), 'audio.disclosure')}</p>
      </div>
      <div class="language-switch" role="group" aria-label="${translate(locale(), 'setting.language')}">
        <button type="button" data-locale="en" aria-pressed="${locale() === 'en'}">EN</button>
        <button type="button" data-locale="es" aria-pressed="${locale() === 'es'}">ES</button>
      </div>
    </header>`;
  }

  function renderSetup() {
    const pool = commandsForPhase(selectableCommands, state.settings.phase);
    const canStart = pool.length > 0 && pool.every(command => hasAudio(command, state.settings.speed));
    return `<section class="panel" aria-labelledby="setup-title">
      <h2 id="setup-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.setup')}</h2>
      ${recoveryError ? `<p class="notice" role="alert">${translate(locale(), 'error.recovery')}</p>` : ''}
      <div class="setup-grid">
        ${selectControl('phase', 'setting.phase', [
          ['driving', 'phase.driving'], ['precheck', 'phase.precheck'], ['mixed', 'phase.mixed']
        ])}
        ${selectControl('speed', 'setting.speed', [[0.75, '0.75×'], [0.9, '0.9×'], [1, '1×']], true)}
        ${selectControl('hintPolicy', 'setting.hint', [
          ['available', 'hint.available'], ['shown', 'hint.shown'], ['unavailable', 'hint.unavailable']
        ])}
        ${selectControl('timed', 'setting.timing', [[false, 'timing.off'], [true, 'timing.on']])}
        ${selectControl('feedbackSounds', 'setting.feedbackSounds', [
          [true, 'feedbackSounds.on'], [false, 'feedbackSounds.off']
        ])}
        ${selectControl('length', 'setting.length', [
          ['short', 'length.short'], ['medium', 'length.medium'], ['all', 'length.all']
        ])}
        ${selectControl('mode', 'setting.mode', [['weakest-first', 'mode.weak'], ['free', 'mode.free']])}
      </div>
      <p class="pool-count">${translate(locale(), 'summary.count', { count: pool.length })}</p>
      <div class="notice-group">
        <p class="notice">${translate(locale(), 'warning.source')}</p>
        ${state.settings.phase === 'driving' ? '' : `<p class="notice">${translate(locale(), 'warning.vehicle')}</p>`}
      </div>
      <button class="primary" type="button" data-action="start" ${canStart ? '' : 'disabled'}>${translate(locale(), 'action.start')}</button>
      ${canStart ? '' : `<p class="notice error" role="alert">${translate(locale(), 'error.audio')}</p>`}
      <hr>
      <div class="data-controls" role="group" aria-label="${translate(locale(), 'data.management')}">
        <button type="button" data-action="export">${translate(locale(), 'data.export')}</button>
        <button type="button" data-action="import">${translate(locale(), 'data.import')}</button>
        <button class="danger" type="button" data-action="reset">${translate(locale(), 'data.reset')}</button>
        <input type="file" data-import-file accept="application/json" hidden>
      </div>
      ${importError ? `<p class="notice error" role="alert">${importError}</p>` : ''}
    </section>`;
  }

  function renderLoading() {
    return `<section class="panel loading" aria-labelledby="loading-title">
      <p class="progress">${progressText()}</p>
      <h2 id="loading-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.loading')}</h2>
      ${model.audioError
        ? `<p class="notice error" role="alert">${translate(locale(), 'error.audio')}</p>
           <button class="primary" type="button" data-action="retry">${translate(locale(), 'action.retry')}</button>`
        : '<div class="spinner" aria-hidden="true"></div>'}
    </section>`;
  }

  function renderPrompt() {
    const command = currentCommand();
    const phrasing = command.phrasings[0];
    const controlsDisabled = promptControlsDisabled(model);
    return `<section class="panel prompt" aria-labelledby="prompt-title">
      <div class="prompt-meta">
        <p class="progress">${progressText()}</p>
        ${state.settings.timed ? `<p class="timer" data-timer>${timerText()}</p>` : ''}
      </div>
      <h2 id="prompt-title" data-screen-focus tabindex="-1">${translate(locale(), 'screen.prompt')}</h2>
      <p>${translate(locale(), 'prompt.listen')}</p>
      <p class="sr-status" role="status">${translate(locale(), 'status.audioReady')}</p>
      <div class="prompt-actions">
        <button type="button" data-action="replay" ${controlsDisabled ? 'disabled' : ''}>🔊 ${translate(locale(), 'action.replay')}</button>
        ${state.settings.hintPolicy === 'available' && !model.textShown
          ? `<button type="button" data-action="show-spanish" ${controlsDisabled ? 'disabled' : ''}>${translate(locale(), 'action.showSpanish')}</button>`
          : ''}
      </div>
      ${model.textShown ? `<p class="spanish-hint" lang="es">${escapeHtml(phrasing.es)}</p>` : ''}
      ${model.surfaceError
        ? `<div class="surface-error" role="alert">
             <p>${translate(locale(), 'surface.error')}</p>
             <button class="primary" type="button" data-action="surface-retry">${translate(locale(), 'surface.retry')}</button>
           </div>`
        : renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, locale(), {
            disabled: controlsDisabled
          })}
    </section>`;
  }

  function renderReveal() {
    const command = currentCommand();
    const phrasing = command.phrasings[0];
    return `<section class="panel reveal" aria-labelledby="outcome-title">
      <p class="progress">${progressText()}</p>
      <h2 id="outcome-title" role="status" aria-live="polite" class="outcome ${model.outcome}" data-screen-focus tabindex="-1">${translate(locale(), `result.${model.outcome}`)}</h2>
      ${renderSurfaceModel(model.activeSurfaceModel, model.surfaceResponse, locale(), {
        disabled: true,
        reveal: true,
        selectedTargetId: model.selectedTargetId
      })}
      <dl class="answer-details">
        <div><dt>${translate(locale(), 'reveal.spanish')}</dt><dd lang="es">${escapeHtml(phrasing.es)}</dd></div>
        ${locale() === 'en' ? `<div><dt>${translate(locale(), 'reveal.meaning')}</dt><dd>${escapeHtml(phrasing.en)}</dd></div>` : ''}
        <div><dt>${translate(locale(), 'reveal.expected')}</dt><dd>${escapeHtml(translate(locale(), `actionResult.${command.acceptedResult}`))}</dd></div>
        ${command.vehicle ? `<div><dt>${translate(locale(), 'reveal.vehicle')}</dt><dd lang="${locale()}">${escapeHtml(localizedVehicleAnswer(command, locale()))} <span class="source-page">p. ${command.vehicle.page}</span></dd></div>` : ''}
      </dl>
      ${model.outcome === 'incorrect' ? renderDiagnosis() : ''}
      <button class="primary" type="button" data-action="continue">${translate(locale(), 'action.continue')}</button>
    </section>`;
  }

  function renderDiagnosis() {
    return `<fieldset class="diagnosis">
      <legend>${translate(locale(), 'miss.title')}</legend>
      <p>${translate(locale(), 'miss.optional')}</p>
      <div class="diagnosis-grid">
        ${MISS_REASONS.map(reason => `<button type="button" data-miss-reason="${reason}" aria-pressed="${model.missReason === reason}">${translate(locale(), `miss.${reason}`)}</button>`).join('')}
      </div>
    </fieldset>`;
  }

  function renderResults() {
    const attempts = state.attempts.filter(attempt => sessionAttemptIds.includes(attempt.id));
    const summary = summarizeSession(attempts, model.session);
    return `<section class="panel results" aria-labelledby="results-title">
      <h2 id="results-title" role="status" aria-live="polite" aria-describedby="results-headline" data-screen-focus tabindex="-1">${translate(locale(), 'screen.results')}</h2>
      <p id="results-headline" class="headline">${translate(locale(), 'summary.unaidedPercent', { percent: summary.unaidedPercentage })}</p>
      <div class="result-counts">
        ${countCard('unaided', summary.counts.unaided)}
        ${countCard('assisted', summary.counts.assisted)}
        ${countCard('incorrect', summary.counts.incorrect)}
      </div>
      <dl class="summary-details">
        <div><dt>${translate(locale(), 'summary.averageTime')}</dt><dd>${summary.averageResponseMs === null ? '—' : translate(locale(), 'summary.milliseconds', { milliseconds: Math.round(summary.averageResponseMs) })}</dd></div>
        <div><dt>${translate(locale(), 'summary.replays')}</dt><dd>${summary.replayCount}</dd></div>
        <div><dt>${translate(locale(), 'summary.hints')}</dt><dd>${summary.hintCount}</dd></div>
      </dl>
      <h3>${translate(locale(), 'summary.weak')}</h3>
      ${summary.weakActions.length === 0
        ? `<p>${translate(locale(), 'summary.noWeak')}</p>`
        : `<ul class="weak-list">${summary.weakActions.slice(0, 5).map(item => {
            const command = selectableCommands.find(candidate => candidate.actionId === item.actionId);
            const phrasing = command.phrasings[0];
            return `<li>${escapeHtml(locale() === 'es' ? phrasing.es : phrasing.en)} — ${Math.round(item.weightedScore * 100)}%</li>`;
          }).join('')}</ul>`}
      <button class="primary" type="button" data-action="setup">${translate(locale(), 'action.newSession')}</button>
    </section>`;
  }

  function selectControl(setting, labelKey, values, labelsAreLiteral = false) {
    return `<label>${translate(locale(), labelKey)}
      <select data-setting="${setting}">
        ${values.map(([value, label]) => `<option value="${value}" ${String(state.settings[setting]) === String(value) ? 'selected' : ''}>${labelsAreLiteral ? label : translate(locale(), label)}</option>`).join('')}
      </select>
    </label>`;
  }

  function countCard(outcome, count) {
    return `<div class="count-card ${outcome}"><strong>${count}</strong><span>${translate(locale(), `result.${outcome}`)}</span></div>`;
  }

  function bindCommonEvents() {
    app.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => {
      updateSettings({ locale: button.dataset.locale });
    }));
  }

  function bindSetupEvents() {
    app.querySelectorAll('[data-setting]').forEach(control => control.addEventListener('change', () => {
      const setting = control.dataset.setting;
      const value = setting === 'speed'
        ? Number(control.value)
        : setting === 'timed' || setting === 'feedbackSounds'
          ? control.value === 'true'
          : control.value;
      updateSettings({ [setting]: value });
    }));
    app.querySelector('[data-action="start"]')?.addEventListener('click', startSession);
    app.querySelector('[data-action="export"]').addEventListener('click', downloadBackup);
    app.querySelector('[data-action="import"]').addEventListener('click', () => app.querySelector('[data-import-file]').click());
    app.querySelector('[data-action="reset"]').addEventListener('click', resetProgress);
    app.querySelector('[data-import-file]').addEventListener('change', event => {
      const [file] = event.target.files;
      if (file) void importBackup(file);
      event.target.value = '';
    });
  }

  function bindLoadingEvents() {
    app.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'RETRY_AUDIO' });
      render();
      void playCurrentCommand();
    });
  }

  function bindPromptEvents() {
    app.querySelector('[data-action="replay"]')?.addEventListener('click', () => void replayAudio());
    app.querySelector('[data-action="show-spanish"]')?.addEventListener('click', () => {
      const event = { type: 'SHOW_SPANISH' };
      const before = model;
      model = reduceScreen(model, event);
      const cue = feedbackCueForTransition(before, model, event);
      render();
      playFeedbackCue(cue);
    });
    app.querySelector('[data-action="surface-retry"]')?.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'RETRY_SURFACE', startedAt: Date.now() });
      if (model.surfaceError) console.warn(`Surface unavailable for ${currentCommand().id}: ${model.surfaceError}`);
      render();
      if (model.activeSurfaceModel) startTimer();
    });
    app.querySelectorAll('[data-target]:not([data-control-event])').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'select-target', targetId: button.dataset.target });
    }));
    app.querySelectorAll('[data-control-event="activate"]').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'activate', targetId: button.dataset.target });
    }));
    app.querySelectorAll('[data-control-event="select-gear"]').forEach(button => button.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'select-gear', targetId: button.dataset.target, gear: button.dataset.gear });
    }));
    app.querySelector('[data-control-event="submit-secure"]')?.addEventListener('click', () => {
      dispatchSurfaceEvent({ type: 'submit-secure' });
    });
    app.querySelectorAll('[data-control-event="set-wheel"]').forEach(control => control.addEventListener('input', () => {
      dispatchSurfaceEvent({ type: 'set-wheel', degrees: Number(control.value) });
    }));
  }

  function dispatchSurfaceEvent(surfaceEvent) {
    if (!model.activeSurfaceModel || promptControlsDisabled(model)) return;
    completeTrial({ type: 'SURFACE_EVENT', surfaceEvent, completedAt: Date.now() });
  }

  function bindRevealEvents() {
    app.querySelectorAll('[data-miss-reason]').forEach(button => button.addEventListener('click', () => {
      model = reduceScreen(model, { type: 'SET_MISS_REASON', reason: button.dataset.missReason });
      persistMissReason(model.missReason);
      render();
    }));
    app.querySelector('[data-action="continue"]').addEventListener('click', () => {
      currentAttemptId = null;
      model = reduceScreen(model, { type: 'CONTINUE' });
      render();
      if (model.screen === 'loading-audio') void playCurrentCommand();
    });
  }

  function bindResultsEvents() {
    app.querySelector('[data-action="setup"]').addEventListener('click', () => {
      model = reduceScreen(model, { type: 'GO_TO_SETUP' });
      sessionAttemptIds = [];
      render();
    });
  }

  function updateSettings(changes) {
    state = { ...state, settings: { ...state.settings, ...changes } };
    saveState(window.localStorage, state);
    model = { ...reduceScreen(model, { type: 'SET_LOCALE', locale: state.settings.locale }), settings: state.settings };
    importError = '';
    recoveryError = '';
    render();
  }

  function startSession() {
    sessionAttemptIds = [];
    const session = createSession(selectableCommands, {
      phase: state.settings.phase,
      length: state.settings.length,
      mode: state.settings.mode,
      attempts: state.attempts
    });
    model = reduceScreen({ ...model, settings: state.settings }, { type: 'START_SESSION', session });
    render();
    void playCurrentCommand();
  }

  async function playCurrentCommand() {
    if (audioBusy || model.screen !== 'loading-audio') return;
    feedbackPlayer.stop();
    audioBusy = true;
    const operation = ++audioOperation;
    const command = currentCommand();
    let variant = model.variant;
    try {
      if (!variant) {
        variant = selectAudioVariant(manifest, {
          commandId: command.id,
          phrasingId: command.phrasings[0].id,
          speed: state.settings.speed
        });
      }
      const result = await player.play(variant);
      if (operation !== audioOperation) return;
      if (!result.scored) {
        model = reduceScreen(model, { type: 'AUDIO_FAILED', reason: result.reason });
      } else {
        model = reduceScreen(model, { type: 'AUDIO_COMPLETED', variant, completedAt: Date.now() });
        if (model.surfaceError) console.warn(`Surface unavailable for ${command.id}: ${model.surfaceError}`);
      }
    } catch {
      model = reduceScreen(model, { type: 'AUDIO_FAILED', reason: 'error' });
    } finally {
      if (operation === audioOperation) {
        audioBusy = false;
        render();
        if (model.screen === 'prompt') startTimer();
      }
    }
  }

  async function replayAudio() {
    if (audioBusy || model.screen !== 'prompt') return;
    stopTimer();
    feedbackPlayer.stop();
    audioBusy = true;
    const operationId = ++audioOperation;
    model = reduceScreen(model, { type: 'REPLAY_STARTED', operationId });
    render();
    let result;
    try {
      result = await player.replay();
    } catch {
      result = { scored: false, reason: 'error' };
    }
    audioBusy = false;
    if (result.scored) {
      model = reduceScreen(model, { type: 'REPLAY_COMPLETED', operationId, completedAt: Date.now() });
    } else {
      model = reduceScreen(model, { type: 'REPLAY_FAILED', operationId, reason: result.reason });
    }
    render();
    if (model.screen === 'prompt') startTimer();
  }

  function completeTrial(event) {
    if (model.screen !== 'prompt') return;
    const before = model;
    model = reduceScreen(model, event);
    if (model === before) return;
    const cue = feedbackCueForTransition(before, model, event);
    if (model.screen !== 'reveal') {
      render();
      playFeedbackCue(cue);
      return;
    }
    stopTimer();
    const command = before.session[before.index];
    const result = recordAttempt(state, {
      audio: { scored: true },
      commandId: command.id,
      actionId: command.actionId,
      phrasingId: before.variant.phrasingId,
      voiceId: before.variant.voiceId,
      speed: before.variant.speed,
      phase: command.phase,
      surfaceId: command.surfaceId,
      surfaceModel: before.activeSurfaceModel,
      selectedResult: model.selectedResult,
      selectedTargetId: model.selectedTargetId,
      correct: model.correct,
      textShown: model.textShown,
      responseMs: model.responseMs,
      replays: model.replays,
      timed: state.settings.timed,
      timeout: model.timeout
    });
    if (result.scored) {
      state = result.state;
      currentAttemptId = result.attempt.id;
      sessionAttemptIds.push(result.attempt.id);
      saveState(window.localStorage, state);
    }
    render();
    playFeedbackCue(cue);
  }

  function playFeedbackCue(cue) {
    if (!cue) return;
    void feedbackPlayer.play(cue, {
      enabled: state.settings.feedbackSounds,
      busy: audioBusy
    });
  }

  function persistMissReason(reason) {
    if (!reason || !currentAttemptId) return;
    state = {
      ...state,
      attempts: state.attempts.map(attempt => attempt.id === currentAttemptId ? { ...attempt, missReason: reason } : attempt)
    };
    saveState(window.localStorage, state);
  }

  function startTimer() {
    stopTimer();
    if (!state.settings.timed || model.screen !== 'prompt' || !model.activeSurfaceModel) return;
    timerDeadline = Date.now() + TRIAL_TIME_MS;
    timerTickId = window.setInterval(refreshTimerText, 200);
    timerId = window.setTimeout(() => {
      completeTrial({ type: 'TIMEOUT', completedAt: Date.now() });
    }, TRIAL_TIME_MS);
    refreshTimerText();
  }

  function stopTimer() {
    if (timerId !== null) window.clearTimeout(timerId);
    if (timerTickId !== null) window.clearInterval(timerTickId);
    timerId = null;
    timerTickId = null;
    timerDeadline = null;
  }

  function refreshTimerText() {
    const timer = app.querySelector('[data-timer]');
    if (timer) timer.textContent = timerText();
  }

  function timerText() {
    const remaining = timerDeadline === null ? TRIAL_TIME_MS : Math.max(0, timerDeadline - Date.now());
    return translate(locale(), 'prompt.timer', { seconds: Math.ceil(remaining / 1_000) });
  }

  function currentCommand() {
    return model.session[model.index];
  }

  function progressText() {
    return translate(locale(), 'prompt.progress', { current: model.index + 1, total: model.session.length });
  }

  function hasAudio(command, speed) {
    return manifest.some(variant =>
      variant.commandId === command.id
      && variant.phrasingId === command.phrasings[0].id
      && variant.speed === speed
    );
  }

  function downloadBackup() {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'examen-practico-de-conducir-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file) {
    try {
      const candidate = importState(await file.text());
      if (!window.confirm(translate(locale(), 'data.importConfirm'))) return;
      state = {
        ...candidate,
        settings: { ...candidate.settings, mode: practiceMode(candidate.settings.mode) }
      };
      saveState(window.localStorage, state);
      model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
      importError = '';
      recoveryError = '';
    } catch {
      importError = translate(locale(), 'error.import');
    }
    render();
  }

  function resetProgress() {
    if (!window.confirm(translate(locale(), 'data.resetConfirm'))) return;
    stopTimer();
    player.cancel('reset');
    feedbackPlayer.stop();
    window.localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    state = { ...state, settings: { ...state.settings, mode: 'weakest-first' } };
    model = { screen: 'setup', settings: state.settings, session: [], index: 0 };
    sessionAttemptIds = [];
    currentAttemptId = null;
    importError = '';
    recoveryError = '';
    render();
  }

  render();
}

async function requireJsonResponse(response) {
  if (!response.ok) throw new Error(`Failed to load ${response.url}`);
  return response.json();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function practiceMode(value) {
  return ['weakest-first', 'free'].includes(value) ? value : 'weakest-first';
}

function attributeSelector(attribute, value) {
  const escaped = String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `[${attribute}="${escaped}"]`;
}

function isEnabledFocusTarget(element) {
  return element.disabled !== true
    && element.hidden !== true
    && element.getAttribute?.('aria-disabled') !== 'true';
}
