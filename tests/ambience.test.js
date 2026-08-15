import test from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENCE_CLIPS, createAmbiencePlayer, pickAmbienceClip } from '../src/ambience.js';

function fakeAudioCtor(log) {
  return class FakeAudio {
    constructor(src) {
      this.src = src;
      this.loop = false;
      this.volume = 1;
      this.paused = true;
      log.push({ event: 'construct', src });
    }

    play() {
      this.paused = false;
      log.push({ event: 'play' });
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
      log.push({ event: 'pause' });
    }
  };
}

test('exposes the generated ambience clips, engine bed included', () => {
  assert.deepEqual(Object.keys(AMBIENCE_CLIPS).sort(), ['city', 'engine', 'rural']);
  assert.equal(Object.isFrozen(AMBIENCE_CLIPS), true);
  for (const path of Object.values(AMBIENCE_CLIPS)) {
    assert.match(path, /^audio\/ambience\/(city|engine|rural)\.mp3$/);
  }
});

test('starting a clip constructs one looping element held well under speech volume', () => {
  const log = [];
  const player = createAmbiencePlayer({ AudioCtor: fakeAudioCtor(log) });

  player.start('city');

  assert.equal(player.isPlaying(), true);
  assert.equal(player.activeClip(), 'city');
  assert.equal(log[0].event, 'construct');
  assert.equal(log[0].src, AMBIENCE_CLIPS.city);
  assert.equal(log.filter(entry => entry.event === 'play').length, 1);
});

test('starting the same clip twice resumes without reconstructing the element', () => {
  const log = [];
  const player = createAmbiencePlayer({ AudioCtor: fakeAudioCtor(log) });

  player.start('rural');
  player.start('rural');

  assert.equal(log.filter(entry => entry.event === 'construct').length, 1);
  assert.equal(log.filter(entry => entry.event === 'play').length, 2);
});

test('starting a different clip stops the previous element first', () => {
  const log = [];
  const player = createAmbiencePlayer({ AudioCtor: fakeAudioCtor(log) });

  player.start('city');
  player.start('rural');

  assert.equal(player.activeClip(), 'rural');
  assert.equal(log.filter(entry => entry.event === 'pause').length, 1);
  assert.equal(log.filter(entry => entry.event === 'construct').length, 2);
});

test('stop pauses playback and clears state; stopping when idle is a no-op', () => {
  const log = [];
  const player = createAmbiencePlayer({ AudioCtor: fakeAudioCtor(log) });

  player.start('city');
  player.stop();

  assert.equal(player.isPlaying(), false);
  assert.equal(player.activeClip(), null);
  assert.equal(log.filter(entry => entry.event === 'pause').length, 1);

  assert.doesNotThrow(() => player.stop());
});

test('rejects unknown clip ids', () => {
  const player = createAmbiencePlayer({ AudioCtor: fakeAudioCtor([]) });
  assert.throws(() => player.start('highway'), /Unknown ambience clip/);
});

test('play/construct failures never throw and leave the player stopped', () => {
  class ThrowingAudio {
    constructor() { throw new Error('no Audio support'); }
  }
  const player = createAmbiencePlayer({ AudioCtor: ThrowingAudio });
  assert.doesNotThrow(() => player.start('city'));
  assert.equal(player.isPlaying(), false);
});

test('missing AudioCtor is a silent no-op', () => {
  const player = createAmbiencePlayer({ AudioCtor: undefined });
  assert.doesNotThrow(() => player.start('city'));
  assert.equal(player.isPlaying(), false);
});

test('the bed is the cabin, and it does not vary between sessions', () => {
  // The learner is inside the car the whole time and every driving clip is
  // muted, so the engine is the only thing under the drive. A street texture
  // arriving at random would contradict the scene it plays over.
  assert.equal(pickAmbienceClip(), 'engine');
  assert.equal(pickAmbienceClip(() => 0), 'engine');
  assert.equal(pickAmbienceClip(() => 0.99), 'engine');
  assert.equal(AMBIENCE_CLIPS.engine, 'audio/ambience/engine.mp3');
});
