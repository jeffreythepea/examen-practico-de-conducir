import test from 'node:test';
import assert from 'node:assert/strict';
import {
  JUNCTION_APPROACH_MS,
  JUNCTION_END_SCALE,
  JUNCTION_MOTION_PHASES,
  createJunctionMotion,
  junctionMotionView,
  reduceJunctionMotion
} from '../src/junction-motion.js';

test('approach view advances on one six-second eased timeline', () => {
  const motion = createJunctionMotion({ enabled: true, startedAt: 1_000 });

  assert.equal(JUNCTION_APPROACH_MS, 6_000);
  assert.equal(JUNCTION_END_SCALE, 1.34);
  assert.deepEqual(junctionMotionView(motion, 1_000), {
    phase: 'approaching-locked',
    progress: 0,
    scale: 1,
    locked: true,
    moving: true,
    elapsedMs: 0,
    remainingMs: 6_000
  });

  assert.deepEqual(junctionMotionView(motion, 4_000), {
    phase: 'approaching-locked',
    progress: 0.5,
    scale: 1.17,
    locked: true,
    moving: true,
    elapsedMs: 3_000,
    remainingMs: 3_000
  });
  assert.deepEqual(junctionMotionView(motion, 8_000), {
    phase: 'approaching-locked',
    progress: 1,
    scale: 1.34,
    locked: true,
    moving: false,
    elapsedMs: 6_000,
    remainingMs: 0
  });
});

test('audio completion unlocks before the endpoint and waits when audio outlasts motion', () => {
  const locked = createJunctionMotion({ enabled: true, startedAt: 1_000 });
  const interactive = reduceJunctionMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  assert.equal(interactive.phase, JUNCTION_MOTION_PHASES.APPROACHING_INTERACTIVE);
  assert.equal(junctionMotionView(interactive, 2_000).locked, false);

  const late = reduceJunctionMotion(locked, { type: 'AUDIO_COMPLETED', at: 7_000 });
  assert.equal(late.phase, JUNCTION_MOTION_PHASES.WAITING);
  assert.equal(junctionMotionView(late, 20_000).progress, 1);
  assert.equal(junctionMotionView(late, 20_000).moving, false);
});

test('answer freezes interactive motion at the answer-time position', () => {
  const locked = createJunctionMotion({ enabled: true, startedAt: 1_000 });
  const interactive = reduceJunctionMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  const answered = reduceJunctionMotion(interactive, { type: 'ANSWERED', at: 4_000 });

  assert.equal(answered.phase, JUNCTION_MOTION_PHASES.WAITING);
  assert.equal(junctionMotionView(answered, 20_000).progress, 0.5);
  assert.equal(junctionMotionView(answered, 20_000).scale, 1.17);
  assert.strictEqual(
    reduceJunctionMotion(answered, { type: 'ANSWERED', at: 5_000 }),
    answered
  );
});

test('animation completion freezes only an interactive approach', () => {
  const locked = createJunctionMotion({ enabled: true, startedAt: 1_000 });
  assert.strictEqual(
    reduceJunctionMotion(locked, { type: 'APPROACH_ENDED', at: 7_000 }),
    locked
  );

  const interactive = reduceJunctionMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  const waiting = reduceJunctionMotion(interactive, { type: 'APPROACH_ENDED', at: 7_000 });
  assert.equal(waiting.phase, JUNCTION_MOTION_PHASES.WAITING);
  assert.equal(junctionMotionView(waiting, 7_000).progress, 1);
});

test('disabled and failed motion return an immutable static view', () => {
  const disabled = createJunctionMotion({ enabled: false });
  assert.equal(Object.isFrozen(disabled), true);
  assert.deepEqual(junctionMotionView(disabled, 1_000), {
    phase: 'static',
    progress: 0,
    scale: 1,
    locked: false,
    moving: false,
    elapsedMs: 0,
    remainingMs: 6_000
  });
  assert.strictEqual(
    reduceJunctionMotion(disabled, { type: 'ANSWERED', at: 1_000 }),
    disabled
  );

  const active = createJunctionMotion({ enabled: true, startedAt: 1_000 });
  const failed = reduceJunctionMotion(active, { type: 'FAILED', at: 1_500 });
  assert.equal(failed.phase, JUNCTION_MOTION_PHASES.STATIC);
  assert.equal(junctionMotionView(failed, 2_000).scale, 1);
});

test('motion records clamp time, remain frozen, and validate public inputs', () => {
  const motion = createJunctionMotion({ enabled: true, startedAt: 1_000 });
  assert.equal(Object.isFrozen(motion), true);
  assert.equal(Object.isFrozen(junctionMotionView(motion, 500)), true);
  assert.equal(junctionMotionView(motion, 500).progress, 0);

  for (const startedAt of [NaN, Infinity, '1000']) {
    assert.throws(() => createJunctionMotion({ enabled: true, startedAt }), /startedAt/);
  }
  for (const now of [NaN, Infinity, '1000']) {
    assert.throws(() => junctionMotionView(motion, now), /now/);
  }
  assert.throws(() => reduceJunctionMotion(motion, { type: 'MISSING', at: 1_000 }), /event type/);
  assert.throws(() => reduceJunctionMotion(motion, { type: 'ANSWERED', at: NaN }), /event at/);
});
