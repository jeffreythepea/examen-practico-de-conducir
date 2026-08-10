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

test('roundabouts normally have four exits and five-exit maps do not imply exit five', () => {
  const counts = { four: 0, five: 0, fiveWithNonFiveTarget: 0 };
  for (let seed = 1; seed <= 500; seed += 1) {
    const action = `roundabout-exit-${(seed % 4) + 1}`;
    const model = generateSpatialSurface(command(action), seed);
    counts[model.geometry.exitCount === 4 ? 'four' : 'five'] += 1;
    if (model.geometry.exitCount === 5 && action !== 'roundabout-exit-5') counts.fiveWithNonFiveTarget += 1;
  }
  assert.ok(counts.four > counts.five * 2);
  assert.ok(counts.fiveWithNonFiveTarget > 0);
  assert.equal(generateSpatialSurface(command('roundabout-exit-5'), 99).geometry.exitCount, 5);
});

test('entry stays at bottom and exit order follows counterclockwise circulation from the driver entry', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17, { exitCount: 4 });
  assert.equal(model.geometry.entry, 'bottom');
  assert.deepEqual(model.targets.map(target => target.resultId), [
    'roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-exit-4'
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

  const roundabout = generateSpatialSurface(command('roundabout-exit-4'), 42, { exitCount: 5 });
  const bases = [24, -22, -90, -154, -200];
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
    'continue-forward': [47, 53, 12, 18],
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

    assert.deepEqual(model.geometry.correctRoute, [
      { x: 50, y: 100 },
      { x: 50, y: 45 },
      { x: accepted.x, y: accepted.y }
    ]);
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

test('four- and five-exit targets stay within their photographed road mouths', () => {
  const bands = {
    4: [
      [86, 88, 42, 44],
      [54, 56, 10, 12],
      [12, 14, 38, 40],
      [12, 14, 66, 68]
    ],
    5: [
      [86, 88, 66, 68],
      [86, 88, 33, 35],
      [49, 51, 10, 12],
      [12, 14, 33, 35],
      [12, 14, 66, 68]
    ]
  };

  for (const exitCount of [4, 5]) {
    for (let seed = 1; seed <= 64; seed += 1) {
      const model = generateSpatialSurface(command('roundabout-exit-1'), seed, { exitCount });
      model.targets.forEach((target, index) => {
        const [minX, maxX, minY, maxY] = bands[exitCount][index];
        assert.ok(target.x >= minX && target.x <= maxX,
          `${exitCount}-exit ${target.id} x=${target.x} must remain in its photographed mouth`);
        assert.ok(target.y >= minY && target.y <= maxY,
          `${exitCount}-exit ${target.id} y=${target.y} must remain in its photographed mouth`);
      });
    }
  }
});

test('roundabout reveal routes stay on the photographed lane and finish at the selected road mouth', () => {
  for (const exitCount of [4, 5]) {
    for (let ordinal = 1; ordinal <= exitCount; ordinal += 1) {
      const model = generateSpatialSurface(command(`roundabout-exit-${ordinal}`), 40 + ordinal, { exitCount });
      const target = model.targets[ordinal - 1];
      const join = model.geometry.exitJoins?.[ordinal - 1];
      const circle = model.geometry.routeCircle;

      assert.ok(join, `${exitCount}-exit route ${ordinal} needs a calibrated lane join`);
      assert.ok(circle, `${exitCount}-exit scene needs a calibrated roundabout lane`);
      assert.ok(Math.abs(Math.hypot(join.x - circle.x, join.y - circle.y) - circle.radius) < 0.1,
        `${exitCount}-exit route ${ordinal} join must remain on the roundabout lane`);

      const route = model.geometry.correctRoute;
      assert.deepEqual(route[0], { x: 50, y: 100 });
      assert.deepEqual(route.at(-1), { x: target.x, y: target.y });
      assert.ok(route.length >= 7, 'roundabout route must retain enough lane points for smooth movement');
      for (const point of route.slice(2, -1)) {
        assert.ok(Math.abs(Math.hypot(point.x - circle.x, point.y - circle.y) - circle.radius) < 0.1,
          `${exitCount}-exit route ${ordinal} movement point must remain on the roundabout lane`);
      }

      const markup = renderSpatialSurface(model, 'en', { reveal: true });
      assert.match(markup, new RegExp(`L ${join.x} ${join.y} L ${target.x} ${target.y}`),
        `${exitCount}-exit route ${ordinal} must connect the retained lane join to its exact target`);
    }
  }
});

test('renderer draws unlabeled localized road targets and disables every target during replay', () => {
  const model = generateSpatialSurface(command('roundabout-exit-2'), 17, { exitCount: 4 });
  const markup = renderSpatialSurface(model, 'es', { disabled: true });

  assert.equal(model.geometry.sceneId, 'roundabout-four-photo-v2');
  assert.match(markup, /^<div class="surface-stage roundabout driving-photo-stage" data-surface="roundabout-v2">/);
  assert.match(markup, /class="driving-scene-image"[^>]+data-scene="roundabout-four-photo-v2"/);
  assert.match(markup, /src="\.\/assets\/driving\/roundabout-four-photo-v2\.webp"/);
  assert.match(markup, /<svg viewBox="0 0 100 100" preserveAspectRatio="none"[^>]+aria-hidden="true"[^>]+focusable="false"/);
  assert.equal((markup.match(/class="road-target"/g) ?? []).length, 4);
  assert.equal((markup.match(/ disabled/g) ?? []).length, 4);
  const labels = [...markup.matchAll(/ aria-label="([^"]+)"/g)].map(([, label]) => label);
  assert.equal(labels.length, 4);
  assert.ok(labels.every(label => label.length > 0));
  assert.equal(new Set(labels).size, labels.length, 'every target label must be distinct');
  assert.deepEqual(labels, ['Primera salida', 'Segunda salida', 'Tercera salida', 'Cuarta salida']);
  assert.doesNotMatch(markup, /surface-result-label|data-correct-route|aria-current/);
});

test('roundabout and junction photo plates replace their old synthetic roads', () => {
  const five = generateSpatialSurface(command('roundabout-exit-5'), 42, { exitCount: 5 });
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
  const markup = renderSpatialSurface(junction, 'en', { motion, reveal: true });

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
  assert.match(scene, /<svg[\s\S]*data-correct-route/);
  assert.equal((scene.match(/class="road-target"/g) ?? []).length, 3);
  assert.doesNotMatch(scene, /surface-result-label/);
  assert.match(markup, /<\/div>\s*<p class="surface-result-label"/);

  assert.doesNotMatch(renderSpatialSurface(junction, 'en'), /road-motion-scene/);
  const roundabout = generateSpatialSurface(command('roundabout-exit-2'), 17, { exitCount: 4 });
  const roundaboutMarkup = renderSpatialSurface(roundabout, 'en', {
    motion: {
      ...motion,
      endScale: 1.03,
      origin: Object.freeze({ x: 50, y: 80 })
    }
  });
  assert.match(roundaboutMarkup, /class="road-motion-scene"/);
  assert.match(roundaboutMarkup, /--road-motion-end-scale:1\.03/);
  assert.match(roundaboutMarkup, /--road-motion-origin-y:80%/);
});

test('correct post-answer movement stays decorative inside the calibrated spatial scene, replacing the static route line', () => {
  const model = generateSpatialSurface(command('turn-right', 'junction-v2'), 42);
  const markup = renderSpatialSurface(model, 'en', {
    disabled: true,
    reveal: true,
    postAnswerMotion: {
      phase: 'running', family: 'junction', progress: 0, moving: true,
      durationMs: 1_300, elapsedMs: 0, remainingMs: 1_300,
      route: model.geometry.correctRoute
    }
  });

  assert.match(markup, /class="post-answer-motion"[\s\S]*class="road-target"/);
  assert.match(markup, /aria-hidden="true"[\s\S]*<animateMotion/);
  assert.doesNotMatch(markup, /post-answer-motion[^>]*(?:button|tabindex|aria-live)/);
  // "car only, no trail" — the static ghost route is dropped once the car glyph is eligible.
  assert.doesNotMatch(markup, /data-correct-route/);
});

test('reveal marks the correct target, draws its route, and shows a localized result label', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17, { exitCount: 4 });
  const markup = renderSpatialSurface(model, 'en', { reveal: true });

  assert.match(markup, /data-correct-route/);
  assert.match(markup, /data-result="roundabout-exit-3"[^>]+aria-current="true"/);
  assert.match(markup, /class="surface-result-label">Correct road: third exit</);
  assert.equal((markup.match(/aria-current="true"/g) ?? []).length, 1);
});

test('spatial reveal distinguishes the selected wrong road from the correct road without color alone', () => {
  const model = generateSpatialSurface(command('roundabout-exit-3'), 17, { exitCount: 4 });
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
    ['roundabout-exit-5', 'roundabout-v2']
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
