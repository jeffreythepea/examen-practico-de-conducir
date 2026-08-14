import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateManoeuvreSurface } from '../src/manoeuvre-surfaces.js';
import { generateSpatialSurface } from '../src/spatial-surfaces.js';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
const SWEEP_SEEDS = Object.freeze([0, 1, 17, 42, 255, 0xffffffff]);
const JUNCTION_RESULTS = Object.freeze(['turn-left', 'continue-forward', 'turn-right']);

function commandFor(surfaceId, acceptedResult) {
  const command = commands.find(candidate =>
    candidate.surfaceId === surfaceId && candidate.acceptedResult === acceptedResult
  );
  assert.ok(command, `catalog needs ${surfaceId} command accepting ${acceptedResult}`);
  return command;
}

function acceptedTarget(model) {
  const target = model.targets.find(candidate => candidate.resultId === model.expectedResult);
  assert.ok(target, `${model.id} needs one accepted target`);
  assert.equal(model.targets.filter(candidate => candidate.resultId === model.expectedResult).length, 1,
    `${model.id} needs exactly one accepted target`);
  return target;
}

function assertRoute(route, context) {
  assert.ok(Array.isArray(route) && route.length >= 2, `${context} needs a retained route with at least two points`);
  assert.equal(Object.isFrozen(route), true, `${context} route must be immutable`);
  for (const [index, point] of route.entries()) {
    assert.equal(Object.isFrozen(point), true, `${context} point ${index} must be immutable`);
    assert.equal(Number.isFinite(point.x), true, `${context} point ${index} x must be finite`);
    assert.equal(Number.isFinite(point.y), true, `${context} point ${index} y must be finite`);
    assert.ok(point.x >= 0 && point.x <= 100, `${context} point ${index} x=${point.x} must remain in stage`);
    assert.ok(point.y >= 0 && point.y <= 100, `${context} point ${index} y=${point.y} must remain in stage`);
  }
}

function assertPointEqual(actual, expected, context, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual.x - expected.x) <= tolerance && Math.abs(actual.y - expected.y) <= tolerance,
    `${context}: expected (${expected.x}, ${expected.y}), received (${actual.x}, ${actual.y})`
  );
}

function assertInsideTarget(point, target, context) {
  assert.ok(Math.abs(point.x - target.x) <= target.width / 2,
    `${context} x=${point.x} must end inside ${target.id}`);
  assert.ok(Math.abs(point.y - target.y) <= target.height / 2,
    `${context} y=${point.y} must end inside ${target.id}`);
}

test('junction fixtures expose one retained entry-to-accepted-target route for every direction', () => {
  const exposureGaps = new Set();

  for (const result of JUNCTION_RESULTS) {
    const command = commandFor('junction-v2', result);
    for (const seed of SWEEP_SEEDS) {
      const model = generateSpatialSurface(command, seed);
      const target = acceptedTarget(model);
      const context = `${command.id} seed ${seed}`;
      const route = model.geometry.correctRoute;
      if (!Array.isArray(route)) {
        exposureGaps.add('junction-v2 does not retain geometry.correctRoute');
        continue;
      }

      assertRoute(route, context);
      // Entry rides the photographed right lane, not the painted centerline.
      assertPointEqual(route[0], { x: 62, y: 100 }, `${context} learner entry`);
      assertInsideTarget(route.at(-1), target, `${context} endpoint`);
      assertPointEqual(route.at(-1), target, `${context} exact accepted target`);
    }
  }

  assert.deepEqual([...exposureGaps], [], 'Production route exposure gaps must be resolved before animation integration');
});

test('four- and five-exit roundabout fixtures retain circle, lane join, and exact accepted endpoint', () => {
  const exposureGaps = new Set();
  const sceneIds = { 4: 'roundabout-four-photo-v2', 5: 'roundabout-five-photo-v1' };

  for (const exitCount of [4, 5]) {
    for (let ordinal = 1; ordinal <= exitCount; ordinal += 1) {
      const result = `roundabout-exit-${ordinal}`;
      const command = commandFor('roundabout-v2', result);
      for (const seed of SWEEP_SEEDS) {
        const model = generateSpatialSurface(command, seed, { exitCount });
        const target = acceptedTarget(model);
        const circle = model.geometry.routeCircle;
        const join = model.geometry.exitJoins[ordinal - 1];
        const context = `${exitCount}-exit ${command.id} seed ${seed}`;

        assert.equal(model.geometry.exitCount, exitCount, `${context} must retain its generated exit count`);
        assert.equal(model.geometry.sceneId, sceneIds[exitCount], `${context} must retain its audited scene`);
        assert.equal(model.geometry.exitJoins.length, exitCount, `${context} needs one lane join per exit`);
        assert.ok(circle && Number.isFinite(circle.x) && Number.isFinite(circle.y) && Number.isFinite(circle.radius),
          `${context} needs a finite retained route circle`);
        assert.ok(join && Number.isFinite(join.x) && Number.isFinite(join.y),
          `${context} needs a finite retained accepted lane join`);
        assert.ok(Math.abs(Math.hypot(join.x - circle.x, join.y - circle.y) - circle.radius) < 1e-9,
          `${context} accepted lane join must remain on the retained route circle`);
        assert.equal(target.resultId, result, `${context} accepted target must match its requested ordinal`);

        const route = model.geometry.correctRoute;
        if (!Array.isArray(route)) {
          exposureGaps.add(`${exitCount}-exit roundabout-v2 does not retain geometry.correctRoute`);
          continue;
        }

        assertRoute(route, context);
        assertPointEqual(route[0], { x: 50, y: 100 }, `${context} learner entry`);
        assert.ok(route.some(point =>
          Math.abs(point.x - circle.x) < 1e-9
          && Math.abs(point.y - (circle.y + circle.radius)) < 1e-9
        ), `${context} route must retain the bottom entry to the circle`);
        assert.ok(route.some(point => Math.abs(point.x - join.x) < 1e-9 && Math.abs(point.y - join.y) < 1e-9),
          `${context} route must retain its accepted lane join`);
        assertInsideTarget(route.at(-1), target, `${context} endpoint`);
        assertPointEqual(route.at(-1), target, `${context} exact accepted target`);
      }
    }
  }

  assert.deepEqual([...exposureGaps], [], 'Production route exposure gaps must be resolved before animation integration');
});

test('parking fixtures retain reviewed legal routes across both templates and seed variation', () => {
  const templates = new Set();
  const command = commandFor('parking-v1', 'park');

  for (let seed = 0; seed < 64; seed += 1) {
    const model = generateManoeuvreSurface(command, seed);
    const target = acceptedTarget(model);
    const route = model.geometry.correctRoute;
    const context = `${model.geometry.templateId} seed ${seed}`;
    templates.add(model.geometry.templateId);

    assertRoute(route, context);
    assertPointEqual(route[0], { x: 50, y: 74 }, `${context} reviewed learner entry`);
    assertInsideTarget(route.at(-1), target, `${context} endpoint`);
    assertPointEqual(route.at(-1), target, `${context} exact accepted legal target`);
    for (const rejected of model.targets.filter(candidate => candidate !== target)) {
      const endsInsideRejected = Math.abs(route.at(-1).x - rejected.x) <= rejected.width / 2
        && Math.abs(route.at(-1).y - rejected.y) <= rejected.height / 2;
      assert.equal(endsInsideRejected, false, `${context} must not end inside rejected target ${rejected.id}`);
    }
  }

  assert.deepEqual([...templates].sort(), ['curb-bays-clear-space', 'marked-bays-clear-entry']);
});

test('stopping fixtures retain reviewed clear-curb routes across both templates and seed variation', () => {
  const templates = new Set();
  const command = commandFor('stopping-v1', 'voluntary-stop');

  for (let seed = 0; seed < 64; seed += 1) {
    const model = generateManoeuvreSurface(command, seed);
    const target = acceptedTarget(model);
    const route = model.geometry.correctRoute;
    const context = `${model.geometry.templateId} seed ${seed}`;
    templates.add(model.geometry.templateId);

    assertRoute(route, context);
    // urban-roadside-photo-v2 (2026-08-14): the learner car sits lower and
    // larger, so the reviewed route enters just ahead of its roof.
    assertPointEqual(route[0], { x: 47, y: 55 }, `${context} reviewed learner entry`);
    assertInsideTarget(route.at(-1), target, `${context} endpoint`);
    assertPointEqual(route.at(-1), target, `${context} exact accepted legal target`);
    for (const rejected of model.targets.filter(candidate => candidate !== target)) {
      const endsInsideRejected = Math.abs(route.at(-1).x - rejected.x) <= rejected.width / 2
        && Math.abs(route.at(-1).y - rejected.y) <= rejected.height / 2;
      assert.equal(endsInsideRejected, false, `${context} must not end inside rejected target ${rejected.id}`);
    }
  }

  assert.deepEqual([...templates].sort(), ['urban-curb-clear']);
});
