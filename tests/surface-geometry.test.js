import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNonOverlappingTargets,
  boxesOverlap,
  jitterAngle,
  polarPoint,
  svgRoadPath,
  targetBox
} from '../src/surface-geometry.js';

test('polar points use standard SVG coordinates from the driver-relative origin', () => {
  assert.deepEqual(polarPoint(50, 50, 20, 0), { x: 70, y: 50 });
  assert.deepEqual(polarPoint(50, 50, 20, 90), { x: 50, y: 70 });
});

test('target boxes meet the 44px-equivalent normalized minimum and reject overlap', () => {
  const a = targetBox('a', 'turn-left', 20, 50, { stageWidth: 400, stageHeight: 300 });
  const b = targetBox('b', 'turn-right', 80, 50, { stageWidth: 400, stageHeight: 300 });

  assert.ok(a.width >= 11);
  assert.ok(a.height >= 14.67);
  assert.equal(boxesOverlap(a, b), false);
  assert.throws(() => assertNonOverlappingTargets([a, { ...a, id: 'copy' }]), /overlap/i);
});

test('touching target edges do not overlap', () => {
  const a = { x: 20, y: 50, width: 10, height: 10 };
  const b = { x: 30, y: 50, width: 10, height: 10 };

  assert.equal(boxesOverlap(a, b), false);
  assert.equal(assertNonOverlappingTargets([a, b]), true);
});

test('angle jitter stays inside its restrained bound', () => {
  const values = [0, 0.5, 0.999].map(value => jitterAngle(90, 8, () => value));

  assert.deepEqual(values.map(Math.round), [82, 90, 98]);
});

test('SVG road paths connect normalized points in order', () => {
  assert.equal(
    svgRoadPath([{ x: 50, y: 100 }, { x: 50, y: 60 }, { x: 20, y: 20 }]),
    'M 50 100 L 50 60 L 20 20'
  );
});
