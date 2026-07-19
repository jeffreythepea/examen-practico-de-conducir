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

test('spatial geometry varies subtly while junctions expose only left and right roads', () => {
  const junction = generateSpatialSurface(command('turn-left', 'junction-v2'), 42);
  assert.equal(junction.geometry.entry, 'bottom');
  assert.deepEqual(junction.targets.map(target => target.resultId), ['turn-right', 'turn-left']);
  assert.deepEqual(junction.geometry.angles.map(Math.round), [-8, -184]);

  const roundabout = generateSpatialSurface(command('roundabout-exit-4'), 42, { exitCount: 5 });
  const bases = [-12, -55, -98, -141, -184];
  roundabout.geometry.angles.forEach((angle, index) => assert.ok(Math.abs(angle - bases[index]) <= 8));
  for (const target of [...junction.targets, ...roundabout.targets]) {
    assert.ok(target.width >= 11);
    assert.ok(target.height >= 14.67);
  }
  assertNonOverlappingTargets(junction.targets);
  assertNonOverlappingTargets(roundabout.targets);
});

test('renderer draws unlabeled localized road targets and disables every target during replay', () => {
  const model = generateSpatialSurface(command('roundabout-exit-2'), 17, { exitCount: 4 });
  const markup = renderSpatialSurface(model, 'es', { disabled: true });

  assert.match(markup, /^<div class="surface-stage roundabout" data-surface="roundabout-v2">/);
  assert.match(markup, /<svg[^>]+aria-hidden="true"[^>]+focusable="false"/);
  assert.equal((markup.match(/class="road-target"/g) ?? []).length, 4);
  assert.equal((markup.match(/ disabled/g) ?? []).length, 4);
  assert.equal((markup.match(/aria-label="Seleccione esta vía"/g) ?? []).length, 4);
  assert.doesNotMatch(markup, /surface-result-label|data-correct-route|aria-current/);
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
  assert.match(wrongButton, /aria-label="Seleccione esta vía — Selección incorrecta"/);
  assert.match(wrongButton, /class="target-status-marker wrong"[^>]*>×</);
  assert.match(markup, /class="target-status-marker correct"[^>]*>✓</);
});

test('road target styles preserve a normalized 44px minimum and reveal route treatment', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.road-target\s*\{[^}]*position:\s*absolute[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(styles, /\[data-correct-route\]\s*\{/);
  assert.match(styles, /\.surface-result-label\s*\{/);
  assert.match(styles, /\.surface-stage:has\(\.surface-result-label\)\s*\{[^}]*margin-bottom:/s);
  assert.match(styles, /\.surface-result-label\s*\{[^}]*top:\s*calc\(100% \+ 0\.75rem\)/s);
});
