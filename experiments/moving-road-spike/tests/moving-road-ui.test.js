import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MOVING_ROAD_COPY } from '../moving-road-copy.js';
import { renderMovingRoadStage } from '../moving-road.js';
import { createMovingRoadState, reduceMovingRoad } from '../moving-road-state.js';

const ROOT = resolve(new URL('../', import.meta.url).pathname);
const [html, css, controller] = await Promise.all([
  readFile(resolve(ROOT, 'index.html'), 'utf8'),
  readFile(resolve(ROOT, 'styles.css'), 'utf8'),
  readFile(resolve(ROOT, 'moving-road.js'), 'utf8')
]);

const EXPECTED_COPY = {
  en: {
    title: 'Moving-road experiment',
    instruction: 'Listen, then choose the road before the junction.',
    start: 'Start',
    replay: 'Replay',
    pause: 'Pause',
    resume: 'Resume',
    left: 'Left',
    straight: 'Straight',
    right: 'Right',
    correct: 'Correct',
    incorrect: 'Incorrect',
    another: 'Try another',
    loadError: 'The experimental trial could not be loaded.',
    audioError: 'The Spanish recording could not be played.',
    disclosure: 'This Spanish voice is AI-generated.'
  },
  es: {
    title: 'Experimento de carretera en movimiento',
    instruction: 'Escuche y elija la vía antes del cruce.',
    start: 'Empezar',
    replay: 'Repetir',
    pause: 'Pausar',
    resume: 'Continuar',
    left: 'Izquierda',
    straight: 'Recto',
    right: 'Derecha',
    correct: 'Correcto',
    incorrect: 'Incorrecto',
    another: 'Otra',
    loadError: 'No se pudo cargar el ejercicio experimental.',
    audioError: 'No se pudo reproducir la grabación en español.',
    disclosure: 'Esta voz en español ha sido generada por IA.'
  }
};

test('page shell exposes the localized application mount and mobile assets', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /id="app"/);
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /type="module" src="moving-road\.js"/);
});

test('copy contract supplies every exact English and Spanish label', () => {
  assert.deepEqual(MOVING_ROAD_COPY, EXPECTED_COPY);
  assert.ok(Object.isFrozen(MOVING_ROAD_COPY));
  assert.ok(Object.isFrozen(MOVING_ROAD_COPY.en));
  assert.ok(Object.isFrozen(MOVING_ROAD_COPY.es));
});

test('visual contract supports reduced motion, touch size, focus, and local-only assets', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /url\(\s*https?:/);
});

test('controller consumes the pure reducer and real production data boundary', () => {
  assert.match(controller, /createMovingRoadState/);
  assert.match(controller, /reduceMovingRoad/);
  assert.match(controller, /selectMovingRoadTrials/);
  assert.match(controller, /fetch\('\.\.\/\.\.\/data\/commands\.json'\)/);
  assert.match(controller, /fetch\('\.\.\/\.\.\/data\/audio-manifest\.json'\)/);
});

test('rendered stage keeps the learner fixed while moving the junction and names outcomes in text', () => {
  const base = createMovingRoadState({
    commandId: 'c-der',
    acceptedResult: 'turn-right',
    durationMs: 6000,
    decisionAtMs: 3000,
    reducedMotion: false
  });
  const open = reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 });
  const reveal = reduceMovingRoad(open, { type: 'ANSWER', resultId: 'turn-right' });
  const svg = renderMovingRoadStage(reveal, MOVING_ROAD_COPY.en);

  assert.match(svg, /class="road"/);
  assert.match(svg, /class="junction-group"/);
  assert.match(svg, /class="learner-car"/);
  assert.match(svg, /class="result-text"[^>]*>Correct</);
});
