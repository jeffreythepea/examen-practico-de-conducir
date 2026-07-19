import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceModel, seededRandom, validateSurfaceModel } from '../src/surface-model.js';

test('seeded randomness is reproducible and seed-sensitive', () => {
  const first = seededRandom(42);
  const second = seededRandom(42);
  const other = seededRandom(43);

  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
  assert.notEqual(seededRandom(42)(), other());
});

test('surface models are immutable, serializable, and require their expected target', () => {
  const model = createSurfaceModel({
    id: 'roundabout-v2:42',
    family: 'roundabout',
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [{ id: 'exit-3', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit' }],
    geometry: { entry: 'bottom', exits: 4 },
    meta: {}
  });

  assert.equal(validateSurfaceModel(model), true);
  assert.equal(Object.isFrozen(model), true);
  assert.deepEqual(JSON.parse(JSON.stringify(model)), model);
  assert.throws(() => createSurfaceModel({ ...model, targets: [] }), /expected target/i);
});

test('surface models deeply freeze nested geometry, metadata, and target details', () => {
  const model = createSurfaceModel({
    id: 'roundabout-v2:42',
    family: 'roundabout',
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [{
      id: 'exit-3', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit',
      details: { label: { position: 'outside' } }
    }],
    geometry: { entry: 'bottom', exits: [{ angle: 90 }] },
    meta: { eligibleTargetIds: ['exit-3'] }
  });

  assert.equal(Object.isFrozen(model.geometry.exits[0]), true);
  assert.equal(Object.isFrozen(model.meta.eligibleTargetIds), true);
  assert.equal(Object.isFrozen(model.targets[0].details.label), true);
  assert.throws(() => { model.geometry.exits[0].angle = 120; }, TypeError);
  assert.throws(() => { model.meta.eligibleTargetIds.push('exit-4'); }, TypeError);
  assert.throws(() => { model.targets[0].details.label.position = 'inside'; }, TypeError);
});

test('surface models require plain JSON-safe geometry and metadata', () => {
  const input = {
    id: 'roundabout-v2:42',
    family: 'roundabout',
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [{ id: 'exit-3', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit' }],
    geometry: { entry: 'bottom' },
    meta: {}
  };
  const cyclicGeometry = { entry: 'bottom' };
  cyclicGeometry.self = cyclicGeometry;

  for (const [overrides, error] of [
    [{ geometry: undefined }, /geometry/i],
    [{ meta: undefined }, /meta/i],
    [{ geometry: new Map() }, /plain|JSON-safe/i],
    [{ meta: { callback() {} } }, /JSON-safe/i],
    [{ meta: { optional: undefined } }, /JSON-safe/i],
    [{ geometry: { angle: Infinity } }, /JSON-safe/i],
    [{ geometry: cyclicGeometry }, /JSON-safe/i]
  ]) {
    assert.throws(() => createSurfaceModel({ ...input, ...overrides }), error);
  }
});

test('surface models reject values that JSON would silently serialize differently', () => {
  const input = {
    id: 'roundabout-v2:42',
    family: 'roundabout',
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [{ id: 'exit-3', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit' }],
    geometry: { entry: 'bottom' },
    meta: {}
  };
  const symbolMeta = {};
  symbolMeta[Symbol('discarded')] = true;
  const hiddenMeta = {};
  Object.defineProperty(hiddenMeta, 'discarded', { value: true });

  for (const [overrides, error] of [
    [{ geometry: { coordinate: -0 } }, /JSON-safe/i],
    [{ meta: symbolMeta }, /JSON-safe/i],
    [{ meta: hiddenMeta }, /JSON-safe/i],
    [{ meta: { targetIds: ['exit-3', , 'exit-5'] } }, /JSON-safe/i]
  ]) {
    assert.throws(() => createSurfaceModel({ ...input, ...overrides }), error);
  }
});

test('surface models reject duplicate target IDs while allowing unique physical targets for one result', () => {
  const input = {
    id: 'roundabout-v2:42',
    family: 'roundabout',
    version: 2,
    seed: 42,
    expectedResult: 'roundabout-exit-3',
    targets: [
      { id: 'exit-3-a', resultId: 'roundabout-exit-3', x: 50, y: 8, width: 14, height: 14, kind: 'road-exit' },
      { id: 'exit-3-b', resultId: 'roundabout-exit-3', x: 60, y: 8, width: 14, height: 14, kind: 'road-exit' }
    ],
    geometry: { entry: 'bottom' },
    meta: {}
  };

  assert.equal(validateSurfaceModel(input), true);
  assert.throws(
    () => createSurfaceModel({ ...input, targets: [{ ...input.targets[0] }, { ...input.targets[0] }] }),
    /duplicate target id/i
  );
});
