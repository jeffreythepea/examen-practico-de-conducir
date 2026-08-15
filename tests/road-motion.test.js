import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateSurface } from '../src/surfaces.js';
import {
  ROAD_APPROACH_MS,
  ROAD_MOTION_PHASES,
  ROAD_MOTION_PROFILES,
  createRoadMotion,
  reduceRoadMotion,
  roadMotionProfile,
  roadMotionView
} from '../src/road-motion.js';

const SCENE_PROFILES = Object.freeze({
  'four-way-intersection-photo-v1': [1.06, 50, 82],
  'roundabout-four-photo-v2': [1.03, 50, 80],
  'roundabout-five-photo-v1': [1.03, 50, 80],
  'roundabout-four-photo-v3': [1.03, 50, 80],
  'u-turn-photo-v1': [1.05, 50, 84],
  'overtaking-photo-v1': [1.18, 54, 86],
  'join-traffic-photo-v1': [1.06, 66, 84],
  'parallel-parking-gap-photo-v1': [1.06, 65, 84],
  'urban-roadside-photo-v1': [1.06, 66, 84],
  'urban-roadside-photo-v2': [1.03, 47, 88]
});
const JUNCTION_SCENE = 'four-way-intersection-photo-v1';
const MOTION_SURFACE_IDS = new Set([
  'junction-v2',
  'roundabout-v2',
  'u-turn-v1',
  'overtake-v1',
  'join-traffic-v1',
  'parking-v1',
  'stopping-v1'
]);
const commands = JSON.parse(
  await readFile(new URL('../data/commands.json', import.meta.url), 'utf8')
);

test('road motion exposes every approved immutable scene calibration', () => {
  assert.equal(ROAD_APPROACH_MS, 6_000);
  assert.deepEqual(
    Object.keys(ROAD_MOTION_PROFILES).toSorted(),
    Object.keys(SCENE_PROFILES).toSorted()
  );
  for (const [sceneId, expected] of Object.entries(SCENE_PROFILES)) {
    const profile = roadMotionProfile(sceneId);
    assert.deepEqual(
      [profile.endScale, profile.originX, profile.originY],
      expected,
      sceneId
    );
    assert.equal(Object.isFrozen(profile), true);
  }
  assert.equal(Object.isFrozen(ROAD_MOTION_PROFILES), true);
  assert.equal(roadMotionProfile('unknown-photo-v1'), null);
});

test('approach view advances on one six-second scene-calibrated eased timeline', () => {
  const motion = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });

  assert.deepEqual(roadMotionView(motion, 1_000), {
    phase: 'approaching-locked',
    progress: 0,
    scale: 1,
    endScale: 1.06,
    origin: { x: 50, y: 82 },
    locked: true,
    moving: true,
    elapsedMs: 0,
    remainingMs: 6_000
  });

  assert.deepEqual(roadMotionView(motion, 4_000), {
    phase: 'approaching-locked',
    progress: 0.5,
    scale: 1.03,
    endScale: 1.06,
    origin: { x: 50, y: 82 },
    locked: true,
    moving: true,
    elapsedMs: 3_000,
    remainingMs: 3_000
  });
  assert.deepEqual(roadMotionView(motion, 8_000), {
    phase: 'approaching-locked',
    progress: 1,
    scale: 1.06,
    endScale: 1.06,
    origin: { x: 50, y: 82 },
    locked: true,
    moving: false,
    elapsedMs: 6_000,
    remainingMs: 0
  });
});

test('each scene uses its own endpoint and focal origin', () => {
  for (const [sceneId, [endScale, x, y]] of Object.entries(SCENE_PROFILES)) {
    const motion = createRoadMotion({ enabled: true, startedAt: 1_000, sceneId });
    const view = roadMotionView(motion, 7_000);
    assert.equal(view.scale, endScale, sceneId);
    assert.equal(view.endScale, endScale, sceneId);
    assert.deepEqual(view.origin, { x, y }, sceneId);
    assert.equal(Object.isFrozen(view.origin), true);
  }
});

test('audio completion unlocks before the endpoint and waits when audio outlasts motion', () => {
  const locked = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });
  const interactive = reduceRoadMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  assert.equal(interactive.phase, ROAD_MOTION_PHASES.APPROACHING_INTERACTIVE);
  assert.equal(roadMotionView(interactive, 2_000).locked, false);

  const late = reduceRoadMotion(locked, { type: 'AUDIO_COMPLETED', at: 7_000 });
  assert.equal(late.phase, ROAD_MOTION_PHASES.WAITING);
  assert.equal(roadMotionView(late, 20_000).progress, 1);
  assert.equal(roadMotionView(late, 20_000).moving, false);
});

test('answer freezes interactive motion at the answer-time position', () => {
  const locked = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });
  const interactive = reduceRoadMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  const answered = reduceRoadMotion(interactive, { type: 'ANSWERED', at: 4_000 });

  assert.equal(answered.phase, ROAD_MOTION_PHASES.WAITING);
  assert.equal(roadMotionView(answered, 20_000).progress, 0.5);
  assert.equal(roadMotionView(answered, 20_000).scale, 1.03);
  assert.strictEqual(
    reduceRoadMotion(answered, { type: 'ANSWERED', at: 5_000 }),
    answered
  );
});

test('every generated motion target remains fully visible at its calibrated endpoint', () => {
  const motionCommands = commands.filter(command => MOTION_SURFACE_IDS.has(command.surfaceId));

  for (const command of motionCommands) {
    for (let seed = 0; seed < 64; seed += 1) {
      const model = generateSurface(command, seed);
      const profile = roadMotionProfile(model.geometry.sceneId);
      assert.ok(profile, `${command.id} seed ${seed} must have a motion profile`);

      for (const target of model.targets) {
        const bounds = {
          left: target.x - target.width / 2,
          right: target.x + target.width / 2,
          top: target.y - target.height / 2,
          bottom: target.y + target.height / 2
        };
        const transformed = {
          left: profile.originX + profile.endScale * (bounds.left - profile.originX),
          right: profile.originX + profile.endScale * (bounds.right - profile.originX),
          top: profile.originY + profile.endScale * (bounds.top - profile.originY),
          bottom: profile.originY + profile.endScale * (bounds.bottom - profile.originY)
        };
        const context = `${command.id} ${model.geometry.sceneId} seed ${seed} target ${target.id}`;
        assert.ok(transformed.left >= 0, `${context} left ${transformed.left}`);
        assert.ok(transformed.right <= 100, `${context} right ${transformed.right}`);
        assert.ok(transformed.top >= 0, `${context} top ${transformed.top}`);
        assert.ok(transformed.bottom <= 100, `${context} bottom ${transformed.bottom}`);
      }
    }
  }
});

test('animation completion freezes only an interactive approach', () => {
  const locked = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });
  assert.strictEqual(
    reduceRoadMotion(locked, { type: 'APPROACH_ENDED', at: 7_000 }),
    locked
  );

  const interactive = reduceRoadMotion(locked, { type: 'AUDIO_COMPLETED', at: 2_000 });
  const waiting = reduceRoadMotion(interactive, { type: 'APPROACH_ENDED', at: 7_000 });
  assert.equal(waiting.phase, ROAD_MOTION_PHASES.WAITING);
  assert.equal(roadMotionView(waiting, 7_000).progress, 1);
});

test('disabled, unsupported, and failed motion return an immutable static view', () => {
  for (const disabled of [
    createRoadMotion({ enabled: false }),
    createRoadMotion({ enabled: true, startedAt: 1_000, sceneId: 'unsupported' })
  ]) {
    assert.equal(Object.isFrozen(disabled), true);
    assert.deepEqual(roadMotionView(disabled, 1_000), {
      phase: 'static',
      progress: 0,
      scale: 1,
      endScale: 1,
      origin: { x: 50, y: 50 },
      locked: false,
      moving: false,
      elapsedMs: 0,
      remainingMs: 6_000
    });
    assert.strictEqual(
      reduceRoadMotion(disabled, { type: 'ANSWERED', at: 1_000 }),
      disabled
    );
  }

  const active = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });
  const failed = reduceRoadMotion(active, { type: 'FAILED', at: 1_500 });
  assert.equal(failed.phase, ROAD_MOTION_PHASES.STATIC);
  assert.equal(roadMotionView(failed, 2_000).scale, 1);
});

test('motion records clamp time, remain frozen, and validate public inputs', () => {
  const motion = createRoadMotion({
    enabled: true,
    startedAt: 1_000,
    sceneId: JUNCTION_SCENE
  });
  assert.equal(Object.isFrozen(motion), true);
  assert.equal(Object.isFrozen(roadMotionView(motion, 500)), true);
  assert.equal(roadMotionView(motion, 500).progress, 0);

  for (const startedAt of [NaN, Infinity, '1000']) {
    assert.throws(
      () => createRoadMotion({ enabled: true, startedAt, sceneId: JUNCTION_SCENE }),
      /startedAt/
    );
  }
  for (const now of [NaN, Infinity, '1000']) {
    assert.throws(() => roadMotionView(motion, now), /now/);
  }
  assert.throws(() => reduceRoadMotion(motion, { type: 'MISSING', at: 1_000 }), /event type/);
  assert.throws(() => reduceRoadMotion(motion, { type: 'ANSWERED', at: NaN }), /event at/);
});
