import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderPostAnswerMotion } from '../src/post-answer-motion-view.js';

function view(overrides = {}) {
  return {
    phase: 'running',
    family: 'junction',
    progress: 0.5,
    moving: true,
    durationMs: 1_200,
    elapsedMs: 600,
    remainingMs: 600,
    route: [
      { x: 50, y: 94 },
      { x: 50, y: 60 },
      { x: 84, y: 42 }
    ],
    ...overrides
  };
}

test('static and malformed views fail closed with no markup', () => {
  assert.equal(renderPostAnswerMotion({
    phase: 'static', family: null, progress: 0, moving: false,
    durationMs: 0, elapsedMs: 0, remainingMs: 0, route: []
  }), '');

  for (const malformed of [
    undefined,
    null,
    [],
    {},
    view({ phase: 'future' }),
    view({ family: 'overtake' }),
    view({ progress: Number.NaN }),
    view({ progress: -0.01 }),
    view({ moving: 'true' }),
    view({ durationMs: 0 }),
    view({ elapsedMs: -1 }),
    view({ remainingMs: 1_201 }),
    view({ route: [{ x: 50, y: 50 }] }),
    view({ route: [{ x: 50, y: 50 }, { x: '<script>', y: 50 }] }),
    view({ route: [{ x: 50, y: 50 }, { x: 101, y: 50 }] })
  ]) {
    assert.equal(renderPostAnswerMotion(malformed), '');
  }
});

test('renders one neutral decorative running route with stable metadata', () => {
  const markup = renderPostAnswerMotion(view());

  assert.match(markup, /^<span class="post-answer-motion"/);
  assert.match(markup, /data-post-answer-motion-phase="running"/);
  assert.match(markup, /data-post-answer-motion-family="junction"/);
  assert.match(markup, /data-post-answer-motion-moving="true"/);
  assert.match(markup, /--post-answer-motion-progress:0\.5/);
  assert.match(markup, /--post-answer-motion-duration:1200ms/);
  assert.match(markup, /--post-answer-motion-elapsed:600ms/);
  assert.match(markup, /--post-answer-motion-remaining:600ms/);
  assert.match(markup, /aria-hidden="true"/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 100 100"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(markup, /<path class="post-answer-motion-route" d="M 50 94 L 50 60 L 84 42" pathLength="1"/);
  assert.match(markup, /<circle class="post-answer-motion-marker" cx="0" cy="0"/);
  assert.match(markup, /<animateMotion path="M 50 94 L 50 60 L 84 42" dur="1200ms" begin="-600ms" fill="freeze" calcMode="linear"/);

  assert.doesNotMatch(markup, /button|tabindex|role=|aria-live|aria-label/i);
  assert.doesNotMatch(markup, /correct|incorrect|accepted|rejected|target|result/i);
  assert.doesNotMatch(markup, />\s*[^<\s][^<]*</);
});

test('complete views place the same neutral marker at the route endpoint', () => {
  const markup = renderPostAnswerMotion(view({
    phase: 'complete',
    progress: 1,
    moving: false,
    elapsedMs: 1_200,
    remainingMs: 0
  }));

  assert.match(markup, /data-post-answer-motion-phase="complete"/);
  assert.match(markup, /data-post-answer-motion-moving="false"/);
  assert.match(markup, /--post-answer-motion-progress:1/);
  assert.match(markup, /<circle class="post-answer-motion-marker" cx="84" cy="42"/);
  assert.doesNotMatch(markup, /animateMotion/);
});

test('accepts every frozen first-slice family without mutating the view', () => {
  for (const family of ['junction', 'roundabout', 'parking', 'stopping']) {
    const input = view({ family });
    const snapshot = structuredClone(input);
    assert.notEqual(renderPostAnswerMotion(input), '');
    assert.deepEqual(input, snapshot);
  }
});

test('timing and phase contradictions fail closed', () => {
  for (const invalid of [
    view({ durationMs: 1_200, elapsedMs: 700, remainingMs: 600 }),
    view({ phase: 'complete', progress: 0.9, moving: false }),
    view({ phase: 'complete', progress: 1, moving: true, elapsedMs: 1_200, remainingMs: 0 })
  ]) {
    assert.equal(renderPostAnswerMotion(invalid), '');
  }
});

test('post-answer movement CSS is calibrated, noninteractive, and reduced-motion safe', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /post-answer-motion:begin/);
  assert.match(css, /\.post-answer-motion\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?pointer-events:\s*none;/);
  assert.match(css, /\.post-answer-motion-route\s*\{[\s\S]*?stroke-dasharray:\s*1;[\s\S]*?animation:/);
  assert.match(css, /\.post-answer-motion-marker\s*\{[\s\S]*?fill:\s*var\(--gold\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.post-answer-motion\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /post-answer-motion:end/);
});
