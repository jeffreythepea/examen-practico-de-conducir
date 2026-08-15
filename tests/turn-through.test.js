import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  CLIP_SURFACE_SCENES,
  TURN_CLIPS,
  TURN_THROUGH_FAMILIES,
  turnThroughIntro
} from '../src/turn-through.js';
import { REVEAL_DWELL_MS_BY_FAMILY } from '../src/app.js';
import { generateSurface } from '../src/surfaces.js';
import { activeCommands } from '../src/catalog.js';
import commands from '../data/commands.json' with { type: 'json' };

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

test('registers immutable turn and manoeuvre clips with stable IDs and illustrative provenance', () => {
  assert.ok(Object.isFrozen(TURN_CLIPS));
  assert.deepEqual(Object.keys(TURN_CLIPS).sort(), [
    'four-way-intersection-photo-v1',
    'join-traffic-photo-v1',
    'overtaking-photo-v1',
    'parallel-parking-gap-photo-v1',
    'roundabout-four-photo-v3',
    'u-turn-photo-v1',
    'urban-roadside-photo-v2'
  ]);
  assert.deepEqual(Object.keys(TURN_CLIPS['four-way-intersection-photo-v1']).sort(),
    ['continue-forward', 'turn-left', 'turn-right']);
  assert.deepEqual(Object.keys(TURN_CLIPS['parallel-parking-gap-photo-v1']), ['park']);
  assert.deepEqual(Object.keys(TURN_CLIPS['overtaking-photo-v1']), ['overtake']);
  assert.deepEqual(Object.keys(TURN_CLIPS['urban-roadside-photo-v2']), ['voluntary-stop']);
  assert.deepEqual(Object.keys(TURN_CLIPS['u-turn-photo-v1']), ['change-direction']);
  assert.deepEqual(Object.keys(TURN_CLIPS['join-traffic-photo-v1']), ['join-traffic']);
  assert.deepEqual(Object.keys(TURN_CLIPS['roundabout-four-photo-v3']), [
    'roundabout-exit-1', 'roundabout-exit-2', 'roundabout-exit-3', 'roundabout-change-direction'
  ]);
  for (const clips of Object.values(TURN_CLIPS)) {
    for (const clip of Object.values(clips)) {
      assert.ok(Object.isFrozen(clip));
      assert.match(clip.videoId, /^[a-z-]+-v1$/);
      assert.equal(clip.asset, `./assets/driving/${clip.videoId}.mp4`);
      assert.equal(clip.poster, `./assets/driving/${clip.videoId}-poster.webp`);
      assert.equal(clip.provenance, 'ai-generated-illustrative');
      assert.ok(Number.isFinite(clip.durationMs) && clip.durationMs > 0 && clip.durationMs <= 10_000);
      assert.ok(Number.isFinite(clip.holdMs) && clip.holdMs >= 0);
      // The hold rides inside intro.durationMs, and the intro validator
      // throws above 10 s — a longer clip would crash the transition mid-drive
      // rather than fail here. Worst case today is 6,000 + 2,500.
      assert.ok(
        clip.durationMs + clip.holdMs <= 10_000,
        `${clip.videoId} exceeds the intro ceiling with its hold`
      );
    }
  }
});

test('every registered turn clip and poster is a nonempty packaged media asset', async () => {
  for (const clips of Object.values(TURN_CLIPS)) {
    for (const clip of Object.values(clips)) {
      const [video, poster] = await Promise.all([
        readFile(new URL(`../${clip.asset.slice(2)}`, import.meta.url)),
        readFile(new URL(`../${clip.poster.slice(2)}`, import.meta.url))
      ]);
      assert.ok(video.length > 100_000, clip.videoId);
      assert.equal(video.subarray(4, 8).toString('ascii'), 'ftyp', `${clip.videoId} must be MP4`);
      assert.ok(poster.length > 10_000, clip.videoId);
      assert.equal(poster.subarray(0, 4).toString('ascii'), 'RIFF', `${clip.videoId} poster must be WebP`);
      assert.equal(poster.subarray(8, 12).toString('ascii'), 'WEBP', `${clip.videoId} poster must be WebP`);
    }
  }
});

test('approved final glyph-replacement media retains its frozen bytes and fast-start layout', async () => {
  const approved = [
    {
      sceneId: 'u-turn-photo-v1',
      resultId: 'change-direction',
      durationMs: 6000,
      videoSha256: '059f7c566ad5cc1e72d47c4f9f312deb37cc7b0be23023398ceed43e9be54b66',
      posterSha256: 'fcf2c93c8a82c6374b1d59892d1239842399014411e5af82ff99cdde8699bd82'
    },
    {
      sceneId: 'join-traffic-photo-v1',
      resultId: 'join-traffic',
      durationMs: 5000,
      videoSha256: '5dc8133a06912d9d8cb968130bcbb42c809d59febf401b08e90dbb0aa6a715e1',
      posterSha256: '45a82d0bcc63c3baae09f9fa0d596e3218303917e69b1521356b8842920d7038'
    }
  ];

  for (const expected of approved) {
    const clip = TURN_CLIPS[expected.sceneId][expected.resultId];
    const [video, poster] = await Promise.all([
      readFile(new URL(`../${clip.asset.slice(2)}`, import.meta.url)),
      readFile(new URL(`../${clip.poster.slice(2)}`, import.meta.url))
    ]);
    assert.equal(clip.durationMs, expected.durationMs, clip.videoId);
    assert.equal(createHash('sha256').update(video).digest('hex'), expected.videoSha256, clip.videoId);
    assert.equal(createHash('sha256').update(poster).digest('hex'), expected.posterSha256, clip.videoId);
    assert.ok(video.indexOf(Buffer.from('moov')) < video.indexOf(Buffer.from('mdat')),
      `${clip.videoId} must keep fast-start metadata before media data`);
  }
});

test('clips that end at rest hold their last frame before the transition moves on', () => {
  // Without the hold the manoeuvre cuts from the car still moving straight
  // into the cruise footage, and the stop never reads as a stop.
  const held = {
    'parallel-parking-gap-photo-v1': 'park',
    'urban-roadside-photo-v2': 'voluntary-stop'
  };
  const rolling = {
    'overtaking-photo-v1': 'overtake',
    'four-way-intersection-photo-v1': 'turn-left'
  };

  for (const [sceneId, resultId] of Object.entries(held)) {
    assert.equal(TURN_CLIPS[sceneId][resultId].holdMs, 2_500, `${resultId} ends stationary`);
  }
  for (const [sceneId, resultId] of Object.entries(rolling)) {
    assert.equal(TURN_CLIPS[sceneId][resultId].holdMs, 0, `${resultId} ends in motion`);
  }

  // The hold rides inside the intro duration, which drives both the clip
  // layer's fade and the transition's auto-advance.
  const stopping = intro({
    surfaceModel: {
      family: 'stopping',
      targets: [{ id: 'chosen', x: 50, y: 40, resultId: 'voluntary-stop' }],
      geometry: { sceneId: 'urban-roadside-photo-v2' }
    },
    selectedTargetId: 'chosen',
    clipsEnabled: true
  });
  const clip = TURN_CLIPS['urban-roadside-photo-v2']['voluntary-stop'];
  assert.equal(stopping.durationMs, clip.durationMs + clip.holdMs);
  assert.ok(stopping.durationMs > clip.durationMs, 'the stop must outlast its own footage');
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

test('the family registries that decide a reveal all agree with the dwell map', () => {
  // Four tables used to enumerate these families independently. A family
  // missing from the dwell map made the auto-advance NaN, which fires
  // immediately and flashes the reveal away; a family missing from the reveal
  // set double-demonstrated with both a glyph and a clip.
  assert.deepEqual(
    Object.keys(REVEAL_DWELL_MS_BY_FAMILY).sort(),
    [...TURN_THROUGH_FAMILIES].sort()
  );
  for (const dwell of Object.values(REVEAL_DWELL_MS_BY_FAMILY)) {
    assert.ok(Number.isFinite(dwell) && dwell > 0);
  }

  // Every clip-backed surface generates the scene the route builder expects,
  // and every registered clip scene is reachable from some surface.
  const generated = new Map();
  for (const command of activeCommands(commands)) {
    const surface = generateSurface(command, 0);
    const sceneId = surface?.geometry?.sceneId;
    if (sceneId) generated.set(command.surfaceId, sceneId);
  }
  for (const [surfaceId, sceneId] of Object.entries(CLIP_SURFACE_SCENES)) {
    assert.ok(TURN_CLIPS[sceneId], `${sceneId} is mapped from ${surfaceId} but has no clips`);
    if (generated.has(surfaceId)) {
      assert.equal(generated.get(surfaceId), sceneId, `${surfaceId} generates a different scene`);
    }
  }
  const mappedScenes = new Set(Object.values(CLIP_SURFACE_SCENES));
  for (const sceneId of Object.keys(TURN_CLIPS)) {
    assert.ok(mappedScenes.has(sceneId), `${sceneId} has clips no surface maps to`);
  }
});
