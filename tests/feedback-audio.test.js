import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUE_DEFINITIONS,
  FEEDBACK_CUES,
  createFeedbackCuePlayer
} from '../src/feedback-audio.js';

test('feedback cues expose an exact bounded synthesized vocabulary', () => {
  assert.deepEqual(FEEDBACK_CUES, ['correct', 'incorrect', 'spanish-hint']);
  assert.equal(Object.isFrozen(FEEDBACK_CUES), true);
  assert.equal(Object.isFrozen(CUE_DEFINITIONS), true);

  for (const cue of FEEDBACK_CUES) {
    const tones = CUE_DEFINITIONS[cue];
    assert.ok(tones.length > 0);
    assert.equal(Object.isFrozen(tones), true);
    for (const tone of tones) {
      assert.equal(Object.isFrozen(tone), true);
      assert.ok(tone.frequency > 0);
      assert.ok(tone.start >= 0);
      assert.ok(tone.duration > 0);
      assert.ok(tone.gain > 0 && tone.gain <= 0.2);
      assert.ok(tone.start + tone.duration < 0.6);
      assert.ok(['sine', 'square', 'sawtooth', 'triangle'].includes(tone.type));
    }
  }
});

test('disabled, busy, and unsupported cues fail closed without creating audio state', async () => {
  let contexts = 0;
  const player = createFeedbackCuePlayer({
    contextFactory: () => {
      contexts += 1;
      return createFakeContext();
    }
  });

  assert.equal(await player.play('correct', { enabled: false }), false);
  assert.equal(await player.play('correct', { enabled: true, busy: true }), false);
  assert.equal(await player.play('future-cue', { enabled: true }), false);
  assert.equal(contexts, 0);
});

test('valid cues schedule their complete definition and stop clears active oscillators', async () => {
  const context = createFakeContext();
  const player = createFeedbackCuePlayer({ contextFactory: () => context });

  assert.equal(await player.play('spanish-hint', { enabled: true, busy: false }), true);
  assert.equal(context.oscillators.length, CUE_DEFINITIONS['spanish-hint'].length);
  context.oscillators.forEach((oscillator, index) => {
    const tone = CUE_DEFINITIONS['spanish-hint'][index];
    assert.equal(oscillator.type, tone.type);
    assert.deepEqual(oscillator.frequency.calls[0], ['setValueAtTime', tone.frequency, context.currentTime + tone.start]);
    assert.equal(oscillator.startedAt, context.currentTime + tone.start);
    assert.equal(oscillator.stoppedAt, context.currentTime + tone.start + tone.duration);
    assert.equal(oscillator.connections[0], context.gains[index]);
  });
  context.gains.forEach(gain => assert.equal(gain.connections[0], context.destination));

  player.stop();
  context.oscillators.forEach(oscillator => assert.ok(oscillator.stopCalls >= 2));
});

test('context construction and resume failures are non-throwing', async () => {
  const unavailable = createFeedbackCuePlayer({ contextFactory: () => { throw new Error('blocked'); } });
  assert.equal(await unavailable.play('correct', { enabled: true }), false);

  const suspended = createFakeContext({ state: 'suspended', resumeRejects: true });
  const blocked = createFeedbackCuePlayer({ contextFactory: () => suspended });
  assert.equal(await blocked.play('incorrect', { enabled: true }), false);
  assert.equal(suspended.oscillators.length, 0);
});

function createFakeContext({ state = 'running', resumeRejects = false } = {}) {
  const context = {
    currentTime: 10,
    state,
    destination: { id: 'destination' },
    oscillators: [],
    gains: [],
    async resume() {
      if (resumeRejects) throw new Error('resume blocked');
      this.state = 'running';
    },
    createOscillator() {
      const oscillator = {
        type: '',
        frequency: fakeParam(),
        connections: [],
        stopCalls: 0,
        addEventListener(type, listener) {
          if (type === 'ended') this.onEnded = listener;
        },
        connect(node) { this.connections.push(node); },
        start(time) { this.startedAt = time; },
        stop(time) {
          this.stopCalls += 1;
          this.stoppedAt = time ?? this.stoppedAt;
        }
      };
      context.oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      const gain = {
        gain: fakeParam(),
        connections: [],
        connect(node) { this.connections.push(node); }
      };
      context.gains.push(gain);
      return gain;
    }
  };
  return context;
}

function fakeParam() {
  return {
    calls: [],
    setValueAtTime(value, time) { this.calls.push(['setValueAtTime', value, time]); },
    linearRampToValueAtTime(value, time) { this.calls.push(['linearRampToValueAtTime', value, time]); }
  };
}
