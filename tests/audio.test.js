import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioPlayer, findAudioVariant, validateAudioManifest } from '../src/audio.js';

const commands = [
  { id: 'c-der', phrasings: [{ id: 'c-der-canonical' }] },
  { id: 'c-pre-largo-alcance', phrasings: [{ id: 'c-pre-largo-alcance-canonical' }] }
];

const variant = Object.freeze({
  id: 'c-der-canonical-voice-a-0.9',
  commandId: 'c-der',
  phrasingId: 'c-der-canonical',
  voiceId: 'voice-a',
  speed: 0.9,
  provider: 'elevenlabs',
  model: 'eleven_multilingual_v2',
  path: './audio/c-der/c-der-canonical/voice-a/0.9.mp3'
});

function validManifest() {
  return [structuredClone(variant)];
}

test('validates unique, complete audio variants that reference catalog commands and phrasings', () => {
  assert.doesNotThrow(() => validateAudioManifest(validManifest(), commands));

  const duplicate = validManifest();
  duplicate.push(structuredClone(variant));
  assert.throws(() => validateAudioManifest(duplicate, commands), /duplicate id/);

  const unknownCommand = validManifest();
  unknownCommand[0].commandId = 'missing';
  assert.throws(() => validateAudioManifest(unknownCommand, commands), /unknown commandId/);

  const unknownPhrasing = validManifest();
  unknownPhrasing[0].phrasingId = 'missing-canonical';
  assert.throws(() => validateAudioManifest(unknownPhrasing, commands), /unknown phrasingId/);

  const unsupportedSpeed = validManifest();
  unsupportedSpeed[0].speed = 1.25;
  assert.throws(() => validateAudioManifest(unsupportedSpeed, commands), /invalid speed/);

  const absolutePath = validManifest();
  absolutePath[0].path = '/audio/c-der.mp3';
  assert.throws(() => validateAudioManifest(absolutePath, commands), /path must be relative/);

  const traversalPath = validManifest();
  traversalPath[0].path = 'audio/../../data/commands.json';
  assert.throws(() => validateAudioManifest(traversalPath, commands), /path must not traverse directories/);

  for (const field of ['provider', 'model', 'voiceId', 'path']) {
    const incomplete = validManifest();
    incomplete[0][field] = '';
    assert.throws(() => validateAudioManifest(incomplete, commands), new RegExp(`missing ${field}`));
  }
});

test('returns an immutable exact audio variant and rejects unavailable selections', () => {
  const manifest = validManifest();
  const selected = findAudioVariant(manifest, {
    commandId: 'c-der',
    phrasingId: 'c-der-canonical',
    voiceId: 'voice-a',
    speed: 0.9
  });

  assert.deepEqual(selected, variant);
  assert.ok(Object.isFrozen(selected));
  assert.throws(() => findAudioVariant(manifest, {
    commandId: 'c-der',
    phrasingId: 'c-der-canonical',
    voiceId: 'voice-a',
    speed: 1
  }), /Audio unavailable for c-der/);
});

test('resolves playback only after ended', async () => {
  const fixture = audioFixture();
  const player = createAudioPlayer(fixture.dependencies);
  const result = player.play(variant);

  assert.equal(fixture.instances.length, 1);
  await fixture.instances[0].started;
  let settled = false;
  void result.then(() => { settled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);

  fixture.instances[0].emit('ended');
  assert.deepEqual(await result, { scored: true, replays: 0 });
});

test('returns an unscored result when playback errors, aborts, or the document becomes hidden', async () => {
  for (const trigger of ['error', 'abort', 'visibilitychange']) {
    const fixture = audioFixture();
    const player = createAudioPlayer(fixture.dependencies);
    const result = player.play(variant);
    await fixture.instances[0].started;

    if (trigger === 'visibilitychange') {
      fixture.document.hidden = true;
      fixture.document.emit('visibilitychange');
    } else {
      fixture.instances[0].emit(trigger);
    }

    assert.deepEqual(await result, { scored: false, reason: trigger });
    assert.equal(fixture.instances[0].paused, true);
  }
});

test('replay increments only after a successful playback start', async () => {
  const fixture = audioFixture({ rejectStarts: [true, false] });
  const player = createAudioPlayer(fixture.dependencies);

  assert.deepEqual(await player.replay(), { scored: false, reason: 'no-audio' });

  const failed = player.play(variant);
  assert.deepEqual(await failed, { scored: false, reason: 'error' });
  assert.deepEqual(await player.replay(), { scored: false, reason: 'no-audio' });

  const playing = player.play(variant);
  await fixture.instances[1].started;
  fixture.instances[1].emit('ended');
  assert.deepEqual(await playing, { scored: true, replays: 0 });

  const replay = player.replay();
  await fixture.instances[2].started;
  fixture.instances[2].emit('ended');
  assert.deepEqual(await replay, { scored: true, replays: 1 });
});

test('does not replay a prior command after the next command fails to start', async () => {
  const fixture = audioFixture({ rejectStarts: [false, true] });
  const player = createAudioPlayer(fixture.dependencies);

  const first = player.play(variant);
  await fixture.instances[0].started;
  fixture.instances[0].emit('ended');
  await first;

  const unavailable = player.play({ ...variant, id: 'different-command', path: './audio/different.mp3' });
  assert.deepEqual(await unavailable, { scored: false, reason: 'error' });
  assert.deepEqual(await player.replay(), { scored: false, reason: 'no-audio' });
  assert.equal(fixture.instances.length, 2);
});

test('prefers a recorded asset and does not invoke browser speech when the MP3 completes', async () => {
  const audio = audioFixture();
  const fallback = fallbackFixture();
  const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });

  const result = player.play(variant, { text: 'Gire a la derecha', speed: 0.9 });
  await audio.instances[0].started;
  audio.instances[0].emit('ended');

  assert.deepEqual(await result, { scored: true, replays: 0 });
  assert.equal(fallback.calls.length, 0);
});

test('uses exact browser speech after an MP3 error or rejected play start', async () => {
  for (const failure of ['event', 'rejection']) {
    const audio = audioFixture({ rejectStarts: [failure === 'rejection'] });
    const fallback = fallbackFixture();
    const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });
    const request = { text: 'Encienda las luces de cruce', speed: 0.75 };

    const result = player.play(variant, request);
    await audio.instances[0].started;
    if (failure === 'event') audio.instances[0].emit('error');

    assert.deepEqual(await result, { scored: true, replays: 0 });
    assert.deepEqual(fallback.calls, [request]);
  }
});

test('a browser-speech descriptor bypasses HTML audio entirely', async () => {
  const audio = audioFixture();
  const fallback = fallbackFixture();
  const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });
  const speechVariant = {
    ...variant,
    provider: 'browser-speech',
    model: 'web-speech-api',
    voiceId: 'browser-speech',
    path: null
  };

  assert.deepEqual(
    await player.play(speechVariant, { text: 'Compruebe el líquido de frenos', speed: 0.9 }),
    { scored: true, replays: 0 }
  );
  assert.equal(audio.instances.length, 0);
  assert.equal(fallback.calls.length, 1);
});

test('replay retains successful fallback mode, exact text, and speed without retrying a broken MP3', async () => {
  const audio = audioFixture();
  const fallback = fallbackFixture();
  const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });
  const request = { text: 'Accione el intermitente', speed: 1 };

  const initial = player.play(variant, request);
  await audio.instances[0].started;
  audio.instances[0].emit('error');
  assert.deepEqual(await initial, { scored: true, replays: 0 });

  assert.deepEqual(await player.replay(), { scored: true, replays: 1 });
  assert.equal(audio.instances.length, 1);
  assert.deepEqual(fallback.calls, [request, request]);
});

test('total recorded and browser-speech failure remains unscored and clears replay', async () => {
  const audio = audioFixture();
  const fallback = fallbackFixture({ results: [{ scored: false, reason: 'unsupported' }] });
  const player = createAudioPlayer({ ...audio.dependencies, fallbackPlayer: fallback.player });

  const result = player.play(variant, { text: 'Siga todo recto', speed: 0.9 });
  await audio.instances[0].started;
  audio.instances[0].emit('error');

  assert.deepEqual(await result, { scored: false, reason: 'unsupported' });
  assert.deepEqual(await player.replay(), { scored: false, reason: 'no-audio' });
});

test('reports whether browser speech fallback is supported', () => {
  const audio = audioFixture();
  const supported = createAudioPlayer({
    ...audio.dependencies,
    fallbackPlayer: fallbackFixture().player,
    fallbackSupported: true
  });
  const unsupported = createAudioPlayer({
    ...audio.dependencies,
    fallbackPlayer: fallbackFixture().player,
    fallbackSupported: false
  });

  assert.equal(supported.supportsFallback(), true);
  assert.equal(unsupported.supportsFallback(), false);
});

function audioFixture({ rejectStarts = [] } = {}) {
  const instances = [];
  const document = eventTarget({ hidden: false });
  class FakeAudio {
    constructor(path) {
      this.path = path;
      this.events = new Map();
      this.paused = false;
      this.started = new Promise(resolve => { this.resolveStarted = resolve; });
      this.rejectStart = rejectStarts.shift() ?? false;
      instances.push(this);
    }

    addEventListener(type, listener) {
      this.events.set(type, listener);
    }

    removeEventListener(type) {
      this.events.delete(type);
    }

    play() {
      this.resolveStarted();
      return this.rejectStart ? Promise.reject(new Error('start failed')) : Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    emit(type) {
      this.events.get(type)?.();
    }
  }
  return { instances, document, dependencies: { AudioCtor: FakeAudio, document } };
}

function fallbackFixture({ results = [] } = {}) {
  const calls = [];
  return {
    calls,
    player: {
      play: async request => {
        calls.push(structuredClone(request));
        return results.shift() ?? { scored: true };
      },
      cancel: () => {}
    }
  };
}

function eventTarget(properties) {
  const events = new Map();
  return {
    ...properties,
    addEventListener(type, listener) {
      events.set(type, listener);
    },
    removeEventListener(type) {
      events.delete(type);
    },
    emit(type) {
      events.get(type)?.();
    }
  };
}
