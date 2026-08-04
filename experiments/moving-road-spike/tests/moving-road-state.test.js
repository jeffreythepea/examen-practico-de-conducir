import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD_PHASES,
  createMovingRoadState,
  reduceMovingRoad
} from '../moving-road-state.js';

const CONFIG = Object.freeze({
  commandId: 'c-der',
  acceptedResult: 'turn-right',
  durationMs: 6000,
  decisionAtMs: 3000,
  reducedMotion: false
});

test('opens the decision at its exact threshold and clamps elapsed time', () => {
  const base = createMovingRoadState(CONFIG);

  assert.equal(base.phase, ROAD_PHASES.APPROACHING);
  assert.equal(reduceMovingRoad(base, { type: 'TICK', deltaMs: 2999 }).phase, ROAD_PHASES.APPROACHING);
  assert.equal(reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 }).phase, ROAD_PHASES.DECISION_OPEN);

  const finished = reduceMovingRoad(base, { type: 'TICK', deltaMs: 7000 });
  assert.equal(finished.elapsedMs, 6000);
  assert.equal(finished.phase, ROAD_PHASES.DECISION_OPEN);
});

test('ignores answers before the decision and reveals correct or incorrect outcomes after it', () => {
  const base = createMovingRoadState(CONFIG);
  assert.equal(
    reduceMovingRoad(base, { type: 'ANSWER', resultId: 'turn-right' }),
    base
  );

  const open = reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 });
  const correct = reduceMovingRoad(open, { type: 'ANSWER', resultId: 'turn-right' });
  const incorrect = reduceMovingRoad(open, { type: 'ANSWER', resultId: 'turn-left' });

  assert.equal(correct.phase, ROAD_PHASES.REVEAL);
  assert.equal(correct.selectedResult, 'turn-right');
  assert.equal(correct.outcome, 'correct');
  assert.equal(incorrect.outcome, 'incorrect');
});

test('pause freezes ticks and replay is counted only before reveal', () => {
  const base = createMovingRoadState(CONFIG);
  const paused = reduceMovingRoad(base, { type: 'TOGGLE_PAUSE' });
  assert.equal(reduceMovingRoad(paused, { type: 'TICK', deltaMs: 3000 }), paused);

  const replayed = reduceMovingRoad(base, { type: 'REPLAY' });
  assert.equal(replayed.replayCount, 1);
  const revealed = reduceMovingRoad(
    reduceMovingRoad(base, { type: 'TICK', deltaMs: 3000 }),
    { type: 'ANSWER', resultId: 'turn-right' }
  );
  assert.equal(reduceMovingRoad(revealed, { type: 'REPLAY' }), revealed);
  assert.equal(reduceMovingRoad(revealed, { type: 'TICK', deltaMs: 1 }), revealed);
});

test('reduced motion starts with an answerable static junction', () => {
  const state = createMovingRoadState({ ...CONFIG, reducedMotion: true });

  assert.equal(state.phase, ROAD_PHASES.DECISION_OPEN);
  assert.equal(state.elapsedMs, 3000);
});

test('reset returns a fresh frozen trial with no reveal or replay state', () => {
  const base = createMovingRoadState(CONFIG);
  const revealed = reduceMovingRoad(
    reduceMovingRoad(reduceMovingRoad(base, { type: 'REPLAY' }), { type: 'TICK', deltaMs: 3000 }),
    { type: 'ANSWER', resultId: 'turn-left' }
  );
  const reset = reduceMovingRoad(revealed, { type: 'RESET' });

  assert.notEqual(reset, base);
  assert.deepEqual(reset, base);
  assert.equal(reset.replayCount, 0);
  assert.equal(reset.outcome, null);
  assert.ok(Object.isFrozen(reset));
});

test('rejects malformed configuration and events', () => {
  assert.throws(() => createMovingRoadState({ ...CONFIG, commandId: '' }), /commandId/);
  assert.throws(() => createMovingRoadState({ ...CONFIG, acceptedResult: 'swerve' }), /acceptedResult/);
  assert.throws(() => createMovingRoadState({ ...CONFIG, durationMs: 0 }), /durationMs/);
  assert.throws(() => createMovingRoadState({ ...CONFIG, decisionAtMs: 7000 }), /decisionAtMs/);
  assert.throws(() => createMovingRoadState({ ...CONFIG, reducedMotion: 'no' }), /reducedMotion/);

  const base = createMovingRoadState(CONFIG);
  assert.throws(() => reduceMovingRoad(base, { type: 'TICK', deltaMs: -1 }), /deltaMs/);
  assert.throws(() => reduceMovingRoad(base, { type: 'ANSWER', resultId: 'swerve' }), /resultId/);
  assert.throws(() => reduceMovingRoad(base, { type: 'UNKNOWN' }), /event type/);
});
