import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POST_ANSWER_MOTION_FAMILIES,
  POST_ANSWER_MOTION_PHASES,
  createPostAnswerMotion,
  postAnswerMotionView,
  reducePostAnswerMotion
} from '../src/post-answer-motion.js';

const route = () => [
  { x: 50, y: 94 },
  { x: 50, y: 60 },
  { x: 84, y: 42 }
];

test('exports the reviewed immutable first-slice vocabulary', () => {
  assert.deepEqual(POST_ANSWER_MOTION_PHASES, {
    STATIC: 'static',
    RUNNING: 'running',
    COMPLETE: 'complete'
  });
  assert.deepEqual(POST_ANSWER_MOTION_FAMILIES, [
    'junction',
    'roundabout',
    'parking',
    'stopping',
    'u-turn',
    'overtake',
    'join-traffic'
  ]);
  assert.equal(Object.isFrozen(POST_ANSWER_MOTION_PHASES), true);
  assert.equal(Object.isFrozen(POST_ANSWER_MOTION_FAMILIES), true);
});

test('disabled or ineligible requests return one deeply immutable static contract', () => {
  for (const request of [
    undefined,
    {},
    { eligible: false },
    {
      eligible: false,
      family: 'unsupported',
      route: [{ x: Number.NaN, y: 200 }],
      startedAt: Number.NaN,
      durationMs: -1
    }
  ]) {
    const state = createPostAnswerMotion(request);
    assert.deepEqual(state, {
      phase: 'static',
      family: null,
      startedAt: null,
      durationMs: 0,
      route: []
    });
    assert.equal(Object.isFrozen(state), true);
    assert.equal(Object.isFrozen(state.route), true);
  }
});

test('creates a deeply frozen caller-independent running state', () => {
  const inputRoute = route();
  const snapshot = structuredClone(inputRoute);
  const state = createPostAnswerMotion({
    eligible: true,
    family: 'junction',
    route: inputRoute,
    startedAt: 1_000,
    durationMs: 1_200
  });

  assert.deepEqual(state, {
    phase: 'running',
    family: 'junction',
    startedAt: 1_000,
    durationMs: 1_200,
    route: snapshot
  });
  assert.notStrictEqual(state.route, inputRoute);
  assert.notStrictEqual(state.route[0], inputRoute[0]);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.route), true);
  assert.equal(state.route.every(Object.isFrozen), true);

  inputRoute[0].x = 1;
  inputRoute.push({ x: 2, y: 3 });
  assert.deepEqual(state.route, snapshot);
});

test('accepts every reviewed family without inspecting scoring fields', () => {
  for (const family of POST_ANSWER_MOTION_FAMILIES) {
    const state = createPostAnswerMotion({
      eligible: true,
      family,
      route: route(),
      startedAt: 10,
      durationMs: 1_500,
      correct: false,
      selectedResult: 'wrong',
      expectedResult: 'different'
    });
    assert.equal(state.family, family);
    assert.deepEqual(Object.keys(state), [
      'phase', 'family', 'startedAt', 'durationMs', 'route'
    ]);
  }
});

test('rejects unsupported eligible families', () => {
  for (const family of [undefined, null, '', 'wheel', 'yaris', 'Junction']) {
    assert.throws(
      () => createPostAnswerMotion({
        eligible: true,
        family,
        route: route(),
        startedAt: 1,
        durationMs: 1_000
      }),
      /Invalid post-answer motion family/
    );
  }
});

test('rejects malformed, non-finite, and out-of-stage eligible routes', () => {
  for (const invalidRoute of [
    undefined,
    null,
    {},
    [],
    [{ x: 50, y: 50 }],
    [{ x: 50, y: 50 }, null],
    [{ x: 50, y: 50 }, { x: Number.NaN, y: 50 }],
    [{ x: 50, y: 50 }, { x: 50, y: Number.POSITIVE_INFINITY }],
    [{ x: -0.01, y: 50 }, { x: 50, y: 50 }],
    [{ x: 50, y: 50 }, { x: 100.01, y: 50 }],
    [{ x: 50, y: -1 }, { x: 50, y: 50 }],
    [{ x: 50, y: 50 }, { x: 50, y: 101 }]
  ]) {
    assert.throws(
      () => createPostAnswerMotion({
        eligible: true,
        family: 'parking',
        route: invalidRoute,
        startedAt: 1,
        durationMs: 1_000
      }),
      /Invalid post-answer motion route/
    );
  }
});

test('rejects invalid eligible timing inputs', () => {
  for (const startedAt of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, '1']) {
    assert.throws(
      () => createPostAnswerMotion({
        eligible: true,
        family: 'roundabout',
        route: route(),
        startedAt,
        durationMs: 1_500
      }),
      /Invalid post-answer motion startedAt/
    );
  }
  for (const durationMs of [undefined, null, 0, -1, 10_001, Number.NaN, '1200']) {
    assert.throws(
      () => createPostAnswerMotion({
        eligible: true,
        family: 'roundabout',
        route: route(),
        startedAt: 1,
        durationMs
      }),
      /Invalid post-answer motion durationMs/
    );
  }
});

test('view progress is deterministic, bounded, and deeply frozen', () => {
  const state = createPostAnswerMotion({
    eligible: true,
    family: 'roundabout',
    route: route(),
    startedAt: 1_000,
    durationMs: 1_600
  });

  assert.deepEqual(postAnswerMotionView(state, 500), {
    phase: 'running',
    family: 'roundabout',
    progress: 0,
    moving: true,
    durationMs: 1_600,
    elapsedMs: 0,
    remainingMs: 1_600,
    route: state.route
  });
  assert.deepEqual(postAnswerMotionView(state, 1_800), {
    phase: 'running',
    family: 'roundabout',
    progress: 0.5,
    moving: true,
    durationMs: 1_600,
    elapsedMs: 800,
    remainingMs: 800,
    route: state.route
  });
  const ended = postAnswerMotionView(state, 3_000);
  assert.deepEqual(ended, {
    phase: 'running',
    family: 'roundabout',
    progress: 1,
    moving: false,
    durationMs: 1_600,
    elapsedMs: 1_600,
    remainingMs: 0,
    route: state.route
  });
  assert.equal(Object.isFrozen(ended), true);
  assert.equal(Object.isFrozen(ended.route), true);
  assert.throws(() => postAnswerMotionView(state, Number.NaN), /Invalid post-answer motion now/);
});

test('animation completion settles once and remains idempotent', () => {
  const running = createPostAnswerMotion({
    eligible: true,
    family: 'stopping',
    route: route(),
    startedAt: 1_000,
    durationMs: 1_300
  });
  const complete = reducePostAnswerMotion(running, { type: 'ANIMATION_ENDED' });

  assert.deepEqual(complete, {
    phase: 'complete',
    family: 'stopping',
    startedAt: null,
    durationMs: 1_300,
    route: running.route
  });
  assert.equal(Object.isFrozen(complete), true);
  assert.strictEqual(reducePostAnswerMotion(complete, { type: 'ANIMATION_ENDED' }), complete);
  assert.deepEqual(postAnswerMotionView(complete, 99_000), {
    phase: 'complete',
    family: 'stopping',
    progress: 1,
    moving: false,
    durationMs: 1_300,
    elapsedMs: 1_300,
    remainingMs: 0,
    route: complete.route
  });
});

test('failure falls back to the static reveal without a retry state', () => {
  const running = createPostAnswerMotion({
    eligible: true,
    family: 'parking',
    route: route(),
    startedAt: 1,
    durationMs: 1_300
  });
  const failed = reducePostAnswerMotion(running, { type: 'FAILED' });
  assert.equal(failed.phase, 'static');
  assert.deepEqual(postAnswerMotionView(failed, 99), {
    phase: 'static',
    family: null,
    progress: 0,
    moving: false,
    durationMs: 0,
    elapsedMs: 0,
    remainingMs: 0,
    route: []
  });
  assert.strictEqual(reducePostAnswerMotion(failed, { type: 'FAILED' }), failed);
});

test('invalid states, events, and view times fail closed', () => {
  assert.throws(
    () => reducePostAnswerMotion({}, { type: 'FAILED' }),
    /Invalid post-answer motion state/
  );
  const state = createPostAnswerMotion({ eligible: false });
  for (const event of [undefined, {}, { type: 'ANSWERED' }, { type: '' }]) {
    assert.throws(
      () => reducePostAnswerMotion(state, event),
      /Invalid post-answer motion event type/
    );
  }
  assert.throws(() => postAnswerMotionView({}, 1), /Invalid post-answer motion state/);
});
