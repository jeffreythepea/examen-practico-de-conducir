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
    view({ family: 'wheel' }),
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
  assert.match(markup, /<svg[^>]*viewBox="0 0 100 100"[^>]*preserveAspectRatio="none"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(markup, /<g class="post-answer-motion-marker">/);
  assert.match(markup, /<path d="M -2\.4 -1\.1[^"]*"/);
  assert.match(markup, /<animateMotion path="M 50 94 L 50 60 L 84 42" dur="1200ms" begin="-600ms" fill="freeze" calcMode="linear" rotate="auto"\/?>/);

  assert.doesNotMatch(markup, /button|tabindex|role=|aria-live|aria-label/i);
  assert.doesNotMatch(markup, /correct|incorrect|accepted|rejected|target|result/i);
  assert.doesNotMatch(markup, />\s*[^<\s][^<]*</);
  // "car only, no trail" — the path itself is never drawn, only the moving glyph.
  assert.doesNotMatch(markup, /post-answer-motion-route/);
});

test('complete views place the same neutral marker, oriented along the route\'s final heading, at the route endpoint', () => {
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
  // final segment is (50,60) -> (84,42): atan2(-18, 34) ≈ -27.8973 degrees
  assert.match(markup, /<g class="post-answer-motion-marker" transform="translate\(84 42\) rotate\(-27\.8973\)">/);
  assert.doesNotMatch(markup, /animateMotion/);
});

const ALL_FAMILIES = ['junction', 'roundabout', 'parking', 'stopping', 'u-turn', 'overtake', 'join-traffic'];

test('accepts every frozen family without mutating the view', () => {
  for (const family of ALL_FAMILIES) {
    const input = view({ family });
    const snapshot = structuredClone(input);
    assert.notEqual(renderPostAnswerMotion(input), '');
    assert.deepEqual(input, snapshot);
  }
});

test('scales its coordinate space the same way as the photo-backed scene it overlays', () => {
  // Every family this renders for uses a driving-photo-stage (3:2) scene, whose main
  // SVG stretches its 0-100 viewBox with preserveAspectRatio="none" (manoeuvre-surfaces.js,
  // spatial-surfaces.js). Without the same attribute here, this overlay's SVG falls back
  // to the default "xMidYMid meet" and pillarboxes instead of stretching, so an identical
  // {x,y} point lands at a different pixel position than the route it's meant to trace.
  for (const family of ALL_FAMILIES) {
    const markup = renderPostAnswerMotion(view({ family }));
    assert.match(markup, /<svg class="post-answer-motion-graphic" viewBox="0 0 100 100" preserveAspectRatio="none"/);
  }
});

test('orients the completed marker to the final segment heading at shallow and sharp turns', () => {
  const shallow = renderPostAnswerMotion(view({
    phase: 'complete', progress: 1, moving: false, elapsedMs: 1_200, remainingMs: 0,
    route: [{ x: 10, y: 50 }, { x: 90, y: 52 }]
  }));
  // nearly straight, slightly downward: atan2(2, 80) ≈ 1.4321 degrees
  assert.match(shallow, /rotate\(1\.4321\)/);

  const sharp = renderPostAnswerMotion(view({
    phase: 'complete', progress: 1, moving: false, elapsedMs: 1_200, remainingMs: 0,
    route: [{ x: 50, y: 90 }, { x: 50, y: 80 }, { x: 20, y: 20 }]
  }));
  // final leg doubles back up and to the left: atan2(-60, -30) ≈ -116.5651 degrees
  assert.match(sharp, /rotate\(-116\.5651\)/);
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
  assert.match(css, /\.post-answer-motion-marker\s*\{[\s\S]*?fill:\s*var\(--gold\)/);
  assert.doesNotMatch(css, /post-answer-motion-route|post-answer-route-draw/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.post-answer-motion\s*\{[\s\S]*?display:\s*none;/);
  assert.match(css, /post-answer-motion:end/);
});
