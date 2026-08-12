import test from 'node:test';
import assert from 'node:assert/strict';
import { TURN_CLIPS, turnThroughIntro } from '../src/turn-through.js';

const TARGETS = Object.freeze([
  Object.freeze({ id: 'left', resultId: 'turn-left', kind: 'road', x: 15, y: 50, width: 18, height: 18 }),
  Object.freeze({ id: 'right', resultId: 'turn-right', kind: 'road', x: 85, y: 50, width: 18, height: 18 }),
  Object.freeze({ id: 'straight', resultId: 'go-straight', kind: 'road', x: 50, y: 15, width: 18, height: 18 })
]);

const JUNCTION_MODEL = Object.freeze({
  family: 'junction',
  expectedResult: 'turn-right',
  targets: TARGETS,
  geometry: Object.freeze({ sceneId: 'four-way-intersection-photo-v1' })
});

function intro(overrides = {}) {
  return turnThroughIntro({
    surfaceModel: JUNCTION_MODEL,
    selectedTargetId: 'right',
    outcome: 'unaided',
    motionEnabled: true,
    nextStepKind: 'transition',
    ...overrides
  });
}

test('produces a frozen intro toward the chosen road on a correct answer', () => {
  const result = intro();
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(result, {
    sceneId: 'four-way-intersection-photo-v1',
    asset: './assets/driving/four-way-intersection-photo-v1.webp',
    dx: 12.25,
    dy: 0,
    scale: 1.22,
    rotate: -2,
    yawDeg: -13.48,
    settleDx: -3.06,
    startScale: 1,
    midScale: 1.12,
    turnScale: 1.2,
    originX: 50,
    originY: 50,
    durationMs: 1400,
    clip: null
  });
});

test('a frozen road-motion pose carries into the intro start', () => {
  const posed = intro({ startPose: { scale: 1.06, originX: 50, originY: 82 } });
  assert.equal(posed.startScale, 1.06);
  assert.equal(posed.midScale, 1.12);
  assert.equal(posed.originX, 50);
  assert.equal(posed.originY, 82);
});

test('the mid and turn beats never zoom out below a deep start pose', () => {
  const deep = intro({ startPose: { scale: 1.18, originX: 54, originY: 86 } });
  assert.equal(deep.startScale, 1.18);
  assert.equal(deep.midScale, 1.24);
  assert.ok(deep.turnScale > deep.midScale);
  assert.ok(deep.turnScale < 1.3);
});

test('invalid start poses fall back to the identity pose', () => {
  for (const startPose of [
    null,
    'pose',
    { scale: 0.8, originX: 50, originY: 82 },
    { scale: 2.4, originX: 50, originY: 82 },
    { scale: 1.06, originX: -5, originY: 82 },
    { scale: Number.NaN, originX: 50, originY: 82 }
  ]) {
    const result = intro({ startPose });
    assert.equal(result.startScale, 1);
    assert.equal(result.originX, 50);
    assert.equal(result.originY, 50);
  }
});

test('assisted answers also earn the intro', () => {
  assert.ok(intro({ outcome: 'assisted' }));
});

test('is deterministic for identical inputs', () => {
  assert.deepEqual(intro(), intro());
});

test('direction follows the chosen target: left, right, straight', () => {
  const left = intro({ selectedTargetId: 'left' });
  assert.ok(left.dx < 0);
  assert.equal(left.rotate, 2);
  const right = intro({ selectedTargetId: 'right' });
  assert.ok(right.dx > 0);
  assert.equal(right.rotate, -2);
  const straight = intro({ selectedTargetId: 'straight' });
  assert.equal(straight.dx, 0);
  assert.equal(straight.rotate, 0);
  assert.ok(straight.dy < 0);
});

test('yaw mirrors left/right and stays flat straight-ahead', () => {
  const left = intro({ selectedTargetId: 'left' });
  const right = intro({ selectedTargetId: 'right' });
  assert.ok(left.yawDeg > 0);
  assert.ok(right.yawDeg < 0);
  assert.equal(left.yawDeg, -right.yawDeg);
  assert.equal(intro({ selectedTargetId: 'straight' }).yawDeg, 0);
});

test('yaw magnitude clamps at both ends', () => {
  const nearCentre = {
    ...JUNCTION_MODEL,
    targets: [{ id: 'nudge', resultId: 'turn-right', kind: 'road', x: 53, y: 50, width: 18, height: 18 }]
  };
  assert.equal(Math.abs(intro({ surfaceModel: nearCentre, selectedTargetId: 'nudge' }).yawDeg), 8);
  const farEdge = {
    ...JUNCTION_MODEL,
    targets: [{ id: 'edge', resultId: 'turn-right', kind: 'road', x: 100, y: 50, width: 18, height: 18 }]
  };
  assert.equal(Math.abs(intro({ surfaceModel: farEdge, selectedTargetId: 'edge' }).yawDeg), 16);
});

test('cruise settle opposes the pan and is 0 straight-ahead', () => {
  const left = intro({ selectedTargetId: 'left' });
  const right = intro({ selectedTargetId: 'right' });
  assert.ok(left.settleDx > 0);
  assert.ok(right.settleDx < 0);
  assert.equal(right.settleDx, -3.06);
  assert.equal(intro({ selectedTargetId: 'straight' }).settleDx, 0);
});

test('roundabout exits pan toward the exit anchor', () => {
  const roundabout = {
    family: 'roundabout',
    expectedResult: 'take-exit-2',
    targets: [{ id: 'exit-2', resultId: 'take-exit-2', kind: 'road', x: 78, y: 30, width: 16, height: 16 }],
    geometry: { sceneId: 'roundabout-four-photo-v2' }
  };
  const result = intro({ surfaceModel: roundabout, selectedTargetId: 'exit-2' });
  assert.equal(result.sceneId, 'roundabout-four-photo-v2');
  assert.equal(result.dx, 9.8);
  assert.equal(result.dy, -7);
  assert.equal(result.rotate, -2);
});

test('returns null for wrong or missing outcomes', () => {
  assert.equal(intro({ outcome: 'incorrect' }), null);
  assert.equal(intro({ outcome: null }), null);
  assert.equal(intro({ outcome: undefined }), null);
});

test('returns null unless the next step is a transition', () => {
  assert.equal(intro({ nextStepKind: 'command' }), null);
  assert.equal(intro({ nextStepKind: 'null-event' }), null);
  assert.equal(intro({ nextStepKind: null }), null);
});

test('returns null when motion is disabled', () => {
  assert.equal(intro({ motionEnabled: false }), null);
  assert.equal(intro({ motionEnabled: undefined }), null);
});

test('returns null for ineligible families and missing surface models', () => {
  assert.equal(intro({ surfaceModel: { ...JUNCTION_MODEL, family: 'listen-only' } }), null);
  assert.equal(intro({ surfaceModel: null }), null);
});

test('returns null when the selected target is unknown', () => {
  assert.equal(intro({ selectedTargetId: 'no-such-road' }), null);
  assert.equal(intro({ selectedTargetId: null }), null);
});

test('returns null when the scene does not resolve to a photo asset', () => {
  assert.equal(intro({ surfaceModel: { ...JUNCTION_MODEL, geometry: { sceneId: 'unknown-scene' } } }), null);
  assert.equal(intro({ surfaceModel: { ...JUNCTION_MODEL, geometry: {} } }), null);
});

test('registers immutable four-way turn clips with stable IDs and illustrative provenance', () => {
  assert.ok(Object.isFrozen(TURN_CLIPS));
  assert.deepEqual(Object.keys(TURN_CLIPS), ['four-way-intersection-photo-v1']);
  const clips = TURN_CLIPS['four-way-intersection-photo-v1'];
  assert.deepEqual(Object.keys(clips).sort(), ['continue-forward', 'turn-left', 'turn-right']);
  for (const clip of Object.values(clips)) {
    assert.ok(Object.isFrozen(clip));
    assert.match(clip.videoId, /^four-way-(turn-left|turn-right|straight)-v1$/);
    assert.match(clip.asset, /^\.\/assets\/driving\/four-way-[a-z-]+-v1\.mp4$/);
    assert.match(clip.poster, /^\.\/assets\/driving\/four-way-[a-z-]+-v1-poster\.webp$/);
    assert.equal(clip.provenance, 'ai-generated-illustrative');
    assert.ok(Number.isFinite(clip.durationMs) && clip.durationMs > 0 && clip.durationMs <= 10_000);
  }
});

test('clip-backed intros carry the registered clip, its duration, and a no-op settle', () => {
  const straightModel = {
    ...JUNCTION_MODEL,
    targets: [{ id: 'ahead', resultId: 'continue-forward', kind: 'road', x: 50, y: 15, width: 18, height: 18 }]
  };
  const cases = [
    [intro({ clipsEnabled: true, selectedTargetId: 'right' }), 'four-way-turn-right-v1'],
    [intro({ clipsEnabled: true, selectedTargetId: 'left' }), 'four-way-turn-left-v1'],
    [intro({ clipsEnabled: true, surfaceModel: straightModel, selectedTargetId: 'ahead' }), 'four-way-straight-v1']
  ];
  for (const [result, videoId] of cases) {
    assert.equal(result.clip.videoId, videoId);
    assert.equal(result.durationMs, result.clip.durationMs, 'auto-advance derives from the clip duration');
    assert.equal(result.settleDx, 0, 'a real turn clip ends on a straight road, so the cruise settle is a no-op');
  }
});

test('clips stay withheld unless explicitly enabled (mock and failure paths)', () => {
  for (const result of [intro(), intro({ clipsEnabled: false }), intro({ clipsEnabled: 'yes' })]) {
    assert.equal(result.clip, null);
    assert.equal(result.durationMs, 1400);
    assert.equal(result.settleDx, -3.06);
  }
});

test('scenes and directions without a registered clip keep the CSS pan path', () => {
  const roundabout = {
    family: 'roundabout',
    expectedResult: 'take-exit-2',
    targets: [{ id: 'exit-2', resultId: 'take-exit-2', kind: 'road', x: 78, y: 30, width: 16, height: 16 }],
    geometry: { sceneId: 'roundabout-four-photo-v2' }
  };
  assert.equal(intro({ clipsEnabled: true, surfaceModel: roundabout, selectedTargetId: 'exit-2' }).clip, null);
  assert.equal(intro({ clipsEnabled: true, selectedTargetId: 'straight' }).clip, null,
    'the test fixture go-straight result has no clip; only continue-forward is registered');
});
