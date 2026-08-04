import {
  ROAD_PHASES,
  createMovingRoadState,
  reduceMovingRoad
} from './moving-road-state.js';
import { selectMovingRoadTrials } from './moving-road-data.js';
import { MOVING_ROAD_COPY } from './moving-road-copy.js';

const RESULTS = Object.freeze([
  Object.freeze({ id: 'turn-left', key: 'left' }),
  Object.freeze({ id: 'continue-forward', key: 'straight' }),
  Object.freeze({ id: 'turn-right', key: 'right' })
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderMovingRoadStage(state, copy) {
  const progress = state.reducedMotion
    ? 0.5
    : Math.min(1, state.elapsedMs / state.durationMs);
  const junctionOffset = -180 + progress * 360;
  const outcomeText = state.phase === ROAD_PHASES.REVEAL
    ? copy[state.outcome]
    : '';

  return `
    <svg viewBox="0 0 640 360" role="img" aria-label="${escapeHtml(outcomeText || copy.instruction)}">
      <rect width="640" height="360" fill="#76945f"></rect>
      <rect class="road" x="218" width="204" height="360"></rect>
      <line class="road-edge" x1="218" x2="218" y2="360"></line>
      <line class="road-edge" x1="422" x2="422" y2="360"></line>
      <line class="road-line" x1="320" x2="320" y2="360"></line>
      <g class="junction-group" transform="translate(0 ${junctionOffset})">
        <rect class="road" x="0" y="85" width="640" height="130"></rect>
        <line class="road-edge" x1="0" x2="640" y1="85" y2="85"></line>
        <line class="road-edge" x1="0" x2="640" y1="215" y2="215"></line>
        <line class="road-line" x1="0" x2="218" y1="150" y2="150"></line>
        <line class="road-line" x1="422" x2="640" y1="150" y2="150"></line>
      </g>
      <g class="learner-car" transform="translate(286 268)">
        <rect class="wheel" x="0" y="22" width="10" height="31" rx="4"></rect>
        <rect class="wheel" x="58" y="22" width="10" height="31" rx="4"></rect>
        <rect class="body" x="7" width="54" height="78" rx="18"></rect>
        <path class="window" d="M18 13h32l5 20H13z"></path>
      </g>
      ${outcomeText ? `<text class="result-text" x="320" y="38">${escapeHtml(outcomeText)}</text>` : ''}
    </svg>
  `;
}

export async function startMovingRoadExperiment({
  documentRef = document,
  windowRef = window,
  random = Math.random
} = {}) {
  const app = documentRef.querySelector('#app');
  if (!app) {
    throw new Error('moving-road app mount is missing');
  }

  let locale = 'en';
  let trials = [];
  let trialIndex = 0;
  let trial = null;
  let roadState = null;
  let started = false;
  let audioReady = false;
  let audio = null;
  let frameId = null;
  let lastFrameAt = null;
  let errorKey = null;

  const copy = () => MOVING_ROAD_COPY[locale];

  function createState(selectedTrial) {
    return createMovingRoadState({
      commandId: selectedTrial.commandId,
      acceptedResult: selectedTrial.acceptedResult,
      durationMs: 6000,
      decisionAtMs: 3000,
      reducedMotion: windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  }

  function stageMarkup() {
    return roadState
      ? renderMovingRoadStage(roadState, copy())
      : '<div class="error" role="alert"></div>';
  }

  function render() {
    const strings = copy();
    const reveal = roadState?.phase === ROAD_PHASES.REVEAL;
    const decisionOpen = started
      && audioReady
      && roadState?.phase === ROAD_PHASES.DECISION_OPEN;
    const resultText = reveal ? strings[roadState.outcome] : '';

    documentRef.documentElement.lang = locale;
    documentRef.title = strings.title;
    app.innerHTML = `
      <section class="experiment" aria-labelledby="experiment-title">
        <header class="experiment-header">
          <div>
            <h1 id="experiment-title">${strings.title}</h1>
            <p class="instruction">${strings.instruction}</p>
            <p class="disclosure">${strings.disclosure}</p>
          </div>
          <nav class="locale-controls" aria-label="Language / Idioma">
            <button type="button" data-locale="en" aria-pressed="${locale === 'en'}">EN</button>
            <button type="button" data-locale="es" aria-pressed="${locale === 'es'}">ES</button>
          </nav>
        </header>
        <div class="trial">
          <div class="stage" data-stage>${stageMarkup()}</div>
          <p class="command-reveal">
            ${reveal ? `<strong lang="es">${escapeHtml(trial.es)}</strong><span>${escapeHtml(trial.en)}</span>` : ''}
          </p>
          <div class="playback-controls">
            ${!started
              ? `<button type="button" data-action="start">${strings.start}</button>`
              : `<button type="button" data-action="replay" ${reveal ? 'disabled' : ''}>${strings.replay}</button>
                 <button type="button" data-action="pause" ${reveal || roadState.reducedMotion ? 'disabled' : ''}>
                   ${roadState.paused ? strings.resume : strings.pause}
                 </button>`}
          </div>
          <div class="answer-controls">
            ${RESULTS.map(result => `
              <button type="button" data-result="${result.id}" ${decisionOpen ? '' : 'disabled'}>
                ${strings[result.key]}
              </button>
            `).join('')}
          </div>
          <p class="result-region ${errorKey ? 'error' : ''}" data-outcome="${roadState?.outcome ?? ''}" aria-live="polite">
            ${errorKey ? strings[errorKey] : resultText}
          </p>
          ${reveal ? `<div class="playback-controls"><button type="button" data-action="another">${strings.another}</button></div>` : ''}
        </div>
      </section>
    `;
  }

  function stopAnimation() {
    if (frameId !== null) {
      windowRef.cancelAnimationFrame(frameId);
      frameId = null;
    }
    lastFrameAt = null;
  }

  function updateAnimatedStage() {
    const stage = app.querySelector('[data-stage]');
    if (stage) {
      stage.innerHTML = renderMovingRoadStage(roadState, copy());
    }
    for (const button of app.querySelectorAll('[data-result]')) {
      button.disabled = !(audioReady && roadState.phase === ROAD_PHASES.DECISION_OPEN);
    }
  }

  function tick(timestamp) {
    if (lastFrameAt === null) {
      lastFrameAt = timestamp;
    } else {
      roadState = reduceMovingRoad(roadState, {
        type: 'TICK',
        deltaMs: timestamp - lastFrameAt
      });
      lastFrameAt = timestamp;
      updateAnimatedStage();
    }
    if (!roadState.paused && roadState.phase !== ROAD_PHASES.REVEAL) {
      frameId = windowRef.requestAnimationFrame(tick);
    }
  }

  async function playRecording() {
    errorKey = null;
    audioReady = false;
    audio?.pause();
    audio = new windowRef.Audio(trial.audioPath);
    try {
      await audio.play();
      audioReady = true;
      return true;
    } catch {
      errorKey = 'audioError';
      render();
      return false;
    }
  }

  async function beginTrial() {
    started = true;
    render();
    const playable = await playRecording();
    if (!playable) {
      return;
    }
    render();
    if (!roadState.reducedMotion) {
      stopAnimation();
      frameId = windowRef.requestAnimationFrame(tick);
    }
  }

  app.addEventListener('click', async event => {
    const localeButton = event.target.closest('[data-locale]');
    if (localeButton) {
      locale = localeButton.dataset.locale;
      render();
      return;
    }

    const resultButton = event.target.closest('[data-result]');
    if (resultButton && !resultButton.disabled) {
      roadState = reduceMovingRoad(roadState, {
        type: 'ANSWER',
        resultId: resultButton.dataset.result
      });
      stopAnimation();
      render();
      return;
    }

    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    if (actionButton.dataset.action === 'start') {
      await beginTrial();
    } else if (actionButton.dataset.action === 'replay') {
      roadState = reduceMovingRoad(roadState, { type: 'REPLAY' });
      await playRecording();
      render();
    } else if (actionButton.dataset.action === 'pause') {
      roadState = reduceMovingRoad(roadState, { type: 'TOGGLE_PAUSE' });
      if (roadState.paused) {
        stopAnimation();
      } else {
        frameId = windowRef.requestAnimationFrame(tick);
      }
      render();
    } else if (actionButton.dataset.action === 'another') {
      trialIndex = (trialIndex + 1) % trials.length;
      trial = trials[trialIndex];
      roadState = createState(trial);
      started = false;
      audioReady = false;
      await beginTrial();
    }
  });

  try {
    const [commandResponse, manifestResponse] = await Promise.all([
      fetch('../../data/commands.json'),
      fetch('../../data/audio-manifest.json')
    ]);
    if (!commandResponse.ok || !manifestResponse.ok) {
      throw new Error('production data request failed');
    }
    trials = selectMovingRoadTrials(
      await commandResponse.json(),
      await manifestResponse.json()
    );
    trialIndex = Math.min(trials.length - 1, Math.floor(random() * trials.length));
    trial = trials[trialIndex];
    roadState = createState(trial);
    render();
  } catch {
    errorKey = 'loadError';
    app.innerHTML = `
      <section class="experiment">
        <h1>${copy().title}</h1>
        <p class="error" role="alert">${copy()[errorKey]}</p>
      </section>
    `;
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  startMovingRoadExperiment();
}
