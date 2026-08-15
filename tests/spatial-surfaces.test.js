import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNonOverlappingTargets } from '../src/surface-geometry.js';
import { generateSpatialSurface, renderSpatialSurface } from '../src/spatial-surfaces.js';

function command(action, surfaceId = 'roundabout-v2') {
  return {
    id: `command-${action}`,
    actionId: action,
    acceptedResult: action,
    surfaceId
  };
}

test('active roundabouts always use one four-branch scene with three exits and a return target', () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const action = ['roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-change-direction'][seed % 4];
    const model = generateSpatialSurface(command(action), seed);
    assert.equal(model.geometry.sceneId, 'roundabout-four-photo-v3');
    assert.equal(model.geometry.physicalBranchCount, 4);
    assert.equal(model.geometry.numberedExitCount, 3);
  }
});

test('entry stays at bottom and exit order follows counterclockwise circulation from the driver entry', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17);
  assert.equal(model.geometry.entry, 'bottom');
  assert.deepEqual(model.targets.map(target => target.resultId), [
    'roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-change-direction'
  ]);
  assertNonOverlappingTargets(model.targets);
});

test('spatial generation is reproducible for one seed and varies across seeds', () => {
  const target = command('roundabout-exit-2');
  assert.deepEqual(generateSpatialSurface(target, 17), generateSpatialSurface(target, 17));
  assert.notDeepEqual(
    generateSpatialSurface(target, 17).geometry.angles,
    generateSpatialSurface(target, 18).geometry.angles
  );
});

test('spatial geometry varies subtly while junctions expose left, straight, and right roads', () => {
  const junction = generateSpatialSurface(command('turn-left', 'junction-v2'), 42);
  assert.equal(junction.geometry.entry, 'bottom');
  assert.equal(junction.geometry.sceneId, 'four-way-intersection-photo-v1');
  assert.deepEqual(junction.targets.map(target => target.resultId), [
    'turn-left', 'continue-forward', 'turn-right'
  ]);

  const roundabout = generateSpatialSurface(command('roundabout-change-direction'), 42);
  const bases = [0, -90, -180, -270];
  roundabout.geometry.angles.forEach((angle, index) => assert.ok(Math.abs(angle - bases[index]) <= 8));
  for (const target of [...junction.targets, ...roundabout.targets]) {
    assert.ok(target.width >= 11);
    assert.ok(target.height >= 14.67);
  }
  assertNonOverlappingTargets(junction.targets);
  assertNonOverlappingTargets(roundabout.targets);
});

test('junction targets remain inside the three photographed road mouths', () => {
  const bands = {
    'turn-left': [12, 18, 39, 45],
    // Far-leg right-lane centre, not the mouth centre (task #15).
    'continue-forward': [51, 57, 12, 18],
    'turn-right': [82, 88, 39, 45]
  };
  for (let seed = 1; seed <= 64; seed += 1) {
    const model = generateSpatialSurface(command('turn-right', 'junction-v2'), seed);
    for (const target of model.targets) {
      const [minX, maxX, minY, maxY] = bands[target.resultId];
      assert.ok(target.x >= minX && target.x <= maxX,
        `${target.id} x=${target.x} must stay on its photographed road`);
      assert.ok(target.y >= minY && target.y <= maxY,
        `${target.id} y=${target.y} must stay on its photographed road`);
    }
    assertNonOverlappingTargets(model.targets);
  }
});

test('junction models retain one immutable correct route ending at the accepted road mouth', () => {
  for (const action of ['turn-left', 'continue-forward', 'turn-right']) {
    const model = generateSpatialSurface(command(action, 'junction-v2'), 42);
    const accepted = model.targets.find(target => target.resultId === action);

    // The approach rides the photographed right lane (task #12): the v1
    // photo's Tier 2 retouch painted a centerline the old x=50 path straddled.
    const approach = [
      { x: 62, y: 100 },
      { x: 60, y: 45 }
    ];
    assert.deepEqual(model.geometry.correctRoute, action === 'continue-forward'
      ? [...approach, { x: 56, y: 30 }, { x: accepted.x, y: accepted.y }]
      : [...approach, { x: accepted.x, y: accepted.y }]);
    assert.ok(Object.isFrozen(model.geometry.correctRoute));
    assert.ok(model.geometry.correctRoute.every(Object.isFrozen));
  }
});

test('straight-ahead junction commands use the photographed center road across seed variation', () => {
  for (let seed = 0; seed < 64; seed += 1) {
    const model = generateSpatialSurface(command('continue-forward', 'junction-v2'), seed);
    assert.equal(model.expectedResult, 'continue-forward');
    assert.equal(model.targets.find(target => target.id === 'straight').resultId, 'continue-forward');
    assert.doesNotThrow(() => renderSpatialSurface(model, 'en', { reveal: true }));
  }
});

test('a playable clip suppresses its route while static fallback keeps it', () => {
  const junction = generateSpatialSurface(command('turn-right', 'junction-v2'), 7);
  assert.doesNotMatch(renderSpatialSurface(junction, 'en', {
    reveal: true, turnClipWillPlay: true
  }), /data-correct-route/);

  const roundabout = generateSpatialSurface(command('roundabout-exit-2'), 7);
  assert.match(renderSpatialSurface(roundabout, 'en', { reveal: true }), /data-correct-route/);
});

test('canonical targets stay within the photographed mouths and return outbound lane', () => {
  const bands = [
    [86, 88, 37, 39],
    [53, 55, 12, 14],
    [12, 14, 37, 39],
    [40, 42, 87, 89]
  ];
  for (let seed = 1; seed <= 64; seed += 1) {
    const model = generateSpatialSurface(command('roundabout-exit-1'), seed);
    model.targets.forEach((target, index) => {
        const [minX, maxX, minY, maxY] = bands[index];
        assert.ok(target.x >= minX && target.x <= maxX,
          `${target.id} x=${target.x} must remain in its photographed mouth`);
        assert.ok(target.y >= minY && target.y <= maxY,
          `${target.id} y=${target.y} must remain in its photographed mouth`);
    });
    const returning = model.targets.at(-1);
    assert.ok(returning.x + returning.width / 2 < 48, 'return target must clear splitter and inbound lane');
  }
});

test('roundabout reveal routes stay on the photographed lane and finish at the selected road mouth', () => {
  const results = ['roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-change-direction'];
  for (const [index, result] of results.entries()) {
      const model = generateSpatialSurface(command(result), 41 + index);
      const target = model.targets[index];
      const join = model.geometry.exitJoins?.[index];
      const circle = model.geometry.routeCircle;

      assert.ok(join, `${result} needs a calibrated lane join`);
      assert.ok(circle, `${result} needs a calibrated roundabout lane`);
      assert.ok(Math.abs(Math.hypot(join.x - circle.x, join.y - circle.y) - circle.radius) < 0.1,
        `${result} join must remain on the roundabout lane`);

      const route = model.geometry.correctRoute;
      assert.deepEqual(route[0], { x: 56, y: 100 });
      assert.deepEqual(route.at(-1), { x: target.x, y: target.y });
      assert.ok(route.length >= 7, 'roundabout route must retain enough lane points for smooth movement');
      for (const point of route.slice(2, -1)) {
        assert.ok(Math.abs(Math.hypot(point.x - circle.x, point.y - circle.y) - circle.radius) < 0.1,
          `${result} movement point must remain on the roundabout lane`);
      }

      const markup = renderSpatialSurface(model, 'en', { reveal: true });
      assert.match(markup, new RegExp(`L ${join.x} ${join.y} L ${target.x} ${target.y}`),
        `${result} must connect the retained lane join to its exact target`);
  }
});

test('renderer draws unlabeled localized road targets and disables every target during replay', () => {
  const model = generateSpatialSurface(command('roundabout-exit-2'), 17);
  const markup = renderSpatialSurface(model, 'es', { disabled: true });

  assert.equal(model.geometry.sceneId, 'roundabout-four-photo-v3');
  assert.match(markup, /^<div class="surface-stage roundabout driving-photo-stage" data-surface="roundabout-v2">/);
  assert.match(markup, /class="driving-scene-image"[^>]+data-scene="roundabout-four-photo-v3"/);
  assert.match(markup, /src="\.\/assets\/driving\/roundabout-four-photo-v3\.webp"/);
  assert.match(markup, /<svg viewBox="0 0 100 100" preserveAspectRatio="none"[^>]+aria-hidden="true"[^>]+focusable="false"/);
  assert.equal((markup.match(/class="road-target"/g) ?? []).length, 4);
  assert.equal((markup.match(/ disabled/g) ?? []).length, 4);
  const labels = [...markup.matchAll(/ aria-label="([^"]+)"/g)].map(([, label]) => label);
  assert.equal(labels.length, 4);
  assert.ok(labels.every(label => label.length > 0));
  assert.equal(new Set(labels).size, labels.length, 'every target label must be distinct');
  assert.deepEqual(labels, ['Primera salida', 'Segunda salida', 'Tercera salida', 'Cambio de sentido por el ramal de entrada']);
  assert.doesNotMatch(markup, /surface-result-label|data-correct-route|aria-current/);
});

test('roundabout and junction photo plates replace their old synthetic roads', () => {
  const five = generateSpatialSurface({ ...command('roundabout-exit-5'), active: false }, 42, { exitCount: 5 });
  assert.equal(five.geometry.sceneId, 'roundabout-five-photo-v1');
  const fiveMarkup = renderSpatialSurface(five, 'en');
  assert.match(fiveMarkup, /data-scene="roundabout-five-photo-v1"/);
  assert.match(fiveMarkup, /src="\.\/assets\/driving\/roundabout-five-photo-v1\.webp"/);
  assert.doesNotMatch(fiveMarkup, /class="roundabout-road"|class="roundabout-island"/);

  const junction = generateSpatialSurface(command('turn-left', 'junction-v2'), 42);
  assert.equal(junction.geometry.sceneId, 'four-way-intersection-photo-v1');
  const junctionMarkup = renderSpatialSurface(junction, 'en');
  assert.match(junctionMarkup, /class="surface-stage junction driving-photo-stage"/);
  assert.match(junctionMarkup, /data-scene="four-way-intersection-photo-v1"/);
  assert.match(junctionMarkup, /src="\.\/assets\/driving\/four-way-intersection-photo-v1\.webp"/);
  assert.equal((junctionMarkup.match(/class="road-target"/g) ?? []).length, 3);
  assert.doesNotMatch(junctionMarkup, /class="spatial-road"|class="road-marking"/);
});

test('road motion keeps each spatial photograph, route, and targets in one calibrated scene', () => {
  const junction = generateSpatialSurface(command('turn-left', 'junction-v2'), 42);
  const motion = Object.freeze({
    phase: 'approaching-interactive',
    progress: 0.25,
    scale: 1.085,
    endScale: 1.06,
    origin: Object.freeze({ x: 50, y: 82 }),
    locked: false,
    moving: true,
    elapsedMs: 1_500,
    remainingMs: 4_500
  });
  const markup = renderSpatialSurface(junction, 'en', { motion, reveal: true, turnClipWillPlay: true });

  assert.match(markup, /class="surface-stage junction driving-photo-stage road-motion-stage"/);
  assert.match(markup, /class="road-motion-viewport"/);
  assert.match(markup, /class="road-motion-scene"/);
  assert.match(markup, /data-road-motion="approaching-interactive"/);
  assert.match(markup, /data-road-motion-running="true"/);
  assert.match(markup, /--road-motion-scale:1\.085/);
  assert.match(markup, /--road-motion-end-scale:1\.06/);
  assert.match(markup, /--road-motion-origin-x:50%/);
  assert.match(markup, /--road-motion-origin-y:82%/);
  assert.match(markup, /--road-motion-elapsed:1500ms/);

  const scene = markup.match(/<div class="road-motion-scene"[\s\S]*?<\/div>/)?.[0];
  assert.ok(scene);
  assert.match(scene, /class="driving-scene-image"/);
  // Clip-backed junction: the motion video supersedes the gold route line.
  assert.doesNotMatch(scene, /data-correct-route/);
  assert.equal((scene.match(/class="road-target"/g) ?? []).length, 3);
  assert.doesNotMatch(scene, /surface-result-label/);
  assert.match(markup, /<\/div>\s*<p class="surface-result-label"/);

  const staticFallback = renderSpatialSurface(junction, 'en', {
    motion, reveal: true, turnClipWillPlay: false
  });
  assert.match(staticFallback, /data-correct-route/);
  assert.doesNotMatch(renderSpatialSurface(junction, 'en'), /road-motion-scene/);
  const roundabout = generateSpatialSurface(command('roundabout-exit-2'), 17);
  const roundaboutMarkup = renderSpatialSurface(roundabout, 'en', {
    reveal: true,
    motion: {
      ...motion,
      endScale: 1.03,
      origin: Object.freeze({ x: 50, y: 80 })
    }
  });
  assert.match(roundaboutMarkup, /class="road-motion-scene"/);
  assert.match(roundaboutMarkup, /--road-motion-end-scale:1\.03/);
  assert.match(roundaboutMarkup, /--road-motion-origin-y:80%/);
  // Static fallback keeps the in-scene route when the clip will not play.
  assert.match(roundaboutMarkup, /<svg[\s\S]*data-correct-route/);
});

test('a reveal without a playable clip keeps the static fallback route', () => {
  const model = generateSpatialSurface(command('turn-right', 'junction-v2'), 42);
  const markup = renderSpatialSurface(model, 'en', {
    disabled: true,
    reveal: true,
    turnClipWillPlay: false
  });

  assert.doesNotMatch(markup, /animateMotion/);
  assert.match(markup, /data-correct-route/);
});

test('reveal marks the correct target, draws its route, and shows a localized result label', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17);
  const markup = renderSpatialSurface(model, 'en', { reveal: true });

  assert.match(markup, /data-correct-route/);
  assert.match(markup, /data-result="roundabout-exit-3"[^>]+aria-current="true"/);
  assert.match(markup, /class="surface-result-label">Correct road: third exit</);
  assert.equal((markup.match(/aria-current="true"/g) ?? []).length, 1);
});

test('spatial reveal distinguishes the selected wrong road from the correct road without color alone', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17);
  const wrong = model.targets.find(target => target.resultId !== model.expectedResult);
  const markup = renderSpatialSurface(model, 'es', { reveal: true, selectedTargetId: wrong.id });
  const wrongButton = markup.match(new RegExp(`<button[^>]+data-target="${wrong.id}"[^>]*>[\\s\\S]*?</button>`))?.[0];
  assert.ok(wrongButton);
  assert.match(wrongButton, /data-selection-state="wrong"/);
  assert.match(wrongButton, /aria-label="Primera salida — Selección incorrecta"/);
  assert.match(wrongButton, /class="target-status-marker wrong"[^>]*>×</);
  assert.match(markup, /class="target-status-marker correct"[^>]*>✓</);
});

test('every spatial target exposes a non-empty, distinct, bilingual accessible name that never reveals the answer', () => {
  const cases = [
    ['turn-left', 'junction-v2'],
    ['turn-right', 'junction-v2'],
    ['continue-forward', 'junction-v2'],
    ['roundabout-exit-1', 'roundabout-v2'],
    ['roundabout-exit-3', 'roundabout-v2'],
    ['roundabout-change-direction', 'roundabout-v2']
  ];
  for (const [action, surfaceId] of cases) {
    for (let seed = 1; seed <= 8; seed += 1) {
      const model = generateSpatialSurface(command(action, surfaceId), seed);
      for (const [locale, correctWord] of [['en', 'correct'], ['es', 'correct']]) {
        const markup = renderSpatialSurface(model, locale, { disabled: true });
        const labels = [...markup.matchAll(/ aria-label="([^"]+)"/g)].map(([, label]) => label);
        assert.equal(labels.length, model.targets.length, `${surfaceId} seed ${seed} (${locale}) must label every target`);
        assert.ok(labels.every(label => label.trim().length > 0), `${surfaceId} seed ${seed} (${locale}) labels must be non-empty`);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${surfaceId} seed ${seed} (${locale}) labels must be pairwise distinct`
        );
        assert.ok(
          labels.every(label => !label.toLowerCase().includes(correctWord)),
          `${surfaceId} seed ${seed} (${locale}) labels must not claim correctness: ${labels.join(', ')}`
        );
      }
    }
  }
});

test('road target styles preserve a normalized 44px minimum and reveal route treatment', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.road-target\s*\{[^}]*position:\s*absolute[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.road-target\s+\.target-status-marker\s*\{[^}]*top:\s*0\.15rem[^}]*right:\s*0\.15rem/s,
    'road result markers must sit fully inside their target instead of leaving clipped fragments');
  assert.match(styles, /\[data-correct-route\]\s*\{/);
  assert.match(styles, /\.surface-result-label\s*\{/);
  assert.match(styles, /\.surface-stage:has\(\.surface-result-label\)\s*\{[^}]*margin-bottom:/s);
  assert.match(styles, /\.surface-result-label\s*\{[^}]*top:\s*calc\(100% \+ 0\.75rem\)/s);
});

test('road motion CSS resumes one calibrated six-second transform and respects reduced motion', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.surface-stage\.road-motion-stage\s*\{[^}]*overflow:\s*visible/s);
  assert.match(styles, /\.road-motion-viewport\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.road-motion-scene\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*transform-origin:\s*var\(--road-motion-origin-x\) var\(--road-motion-origin-y\)/s);
  assert.match(styles, /\.road-motion-scene\[data-road-motion-running="true"\]\s*\{[^}]*animation-duration:\s*6000ms[^}]*animation-delay:\s*calc\(-1 \* var\(--road-motion-elapsed,\s*0ms\)\)[^}]*animation-timing-function:\s*ease-in-out/s);
  assert.match(styles, /@keyframes road-camera-push[\s\S]*?to\s*\{\s*transform:\s*scale\(var\(--road-motion-end-scale\)\)/s);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.road-motion-scene\s*\{[^}]*animation:\s*none !important[^}]*transform:\s*none !important/s);
});
