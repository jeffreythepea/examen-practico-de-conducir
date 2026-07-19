import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBrowserSpeechPlayer,
  supportsBrowserSpeech
} from '../src/browser-speech.js';

test('detects browser speech support only when synthesis and utterances are available', () => {
  const fixture = speechFixture();
  assert.equal(supportsBrowserSpeech(fixture.dependencies), true);
  assert.equal(supportsBrowserSpeech({ ...fixture.dependencies, speechSynthesis: null }), false);
  assert.equal(supportsBrowserSpeech({ ...fixture.dependencies, UtteranceCtor: null }), false);
  assert.equal(supportsBrowserSpeech({ ...fixture.dependencies, speechSynthesis: {} }), false);
});

test('speaks Spanish at the requested speed and prefers an es-ES voice', async () => {
  const fixture = speechFixture({ voices: [
    { name: 'English', lang: 'en-US' },
    { name: 'Latin American Spanish', lang: 'es-MX' },
    { name: 'Spain Spanish', lang: 'es-ES' }
  ] });
  const player = createBrowserSpeechPlayer(fixture.dependencies);

  const result = player.play({ text: 'Encienda las luces de cruce', speed: 0.9 });
  assert.equal(fixture.utterances.length, 1);
  assert.equal(fixture.spoken.length, 1);
  assert.equal(fixture.utterances[0].text, 'Encienda las luces de cruce');
  assert.equal(fixture.utterances[0].lang, 'es-ES');
  assert.equal(fixture.utterances[0].rate, 0.9);
  assert.equal(fixture.utterances[0].voice.name, 'Spain Spanish');

  fixture.utterances[0].emit('end');
  assert.deepEqual(await result, { scored: true });
});

test('falls back to another Spanish voice, then the browser language default', async () => {
  for (const [voices, expectedVoice] of [
    [[{ name: 'Mexican Spanish', lang: 'es-MX' }, { name: 'English', lang: 'en-GB' }], 'Mexican Spanish'],
    [[{ name: 'English', lang: 'en-GB' }], null]
  ]) {
    const fixture = speechFixture({ voices });
    const result = createBrowserSpeechPlayer(fixture.dependencies)
      .play({ text: 'Siga todo recto', speed: 1 });

    assert.equal(fixture.utterances[0].voice?.name ?? null, expectedVoice);
    assert.equal(fixture.utterances[0].lang, 'es-ES');
    fixture.utterances[0].emit('end');
    assert.deepEqual(await result, { scored: true });
  }
});

test('speech errors, backgrounding, and explicit cancellation remain unscored', async () => {
  for (const trigger of ['error', 'visibilitychange', 'cancel']) {
    const fixture = speechFixture();
    const player = createBrowserSpeechPlayer(fixture.dependencies);
    const result = player.play({ text: 'Accione el intermitente', speed: 0.75 });

    if (trigger === 'visibilitychange') {
      fixture.document.hidden = true;
      fixture.document.emit('visibilitychange');
    } else if (trigger === 'cancel') {
      player.cancel('replaced');
    } else {
      fixture.utterances[0].emit('error');
    }

    assert.deepEqual(await result, {
      scored: false,
      reason: trigger === 'cancel' ? 'replaced' : trigger
    });
    assert.equal(fixture.cancelCount(), 1);
    fixture.utterances[0].emit('end');
  }
});

test('unsupported, construction-failure, and speak-failure paths fail closed', async () => {
  const unsupported = createBrowserSpeechPlayer({ speechSynthesis: null, UtteranceCtor: null });
  assert.deepEqual(
    await unsupported.play({ text: 'Siga todo recto', speed: 1 }),
    { scored: false, reason: 'unsupported' }
  );

  const construction = speechFixture({ throwOnConstruct: true });
  assert.deepEqual(
    await createBrowserSpeechPlayer(construction.dependencies).play({ text: 'Siga todo recto', speed: 1 }),
    { scored: false, reason: 'error' }
  );

  const speaking = speechFixture({ throwOnSpeak: true });
  assert.deepEqual(
    await createBrowserSpeechPlayer(speaking.dependencies).play({ text: 'Siga todo recto', speed: 1 }),
    { scored: false, reason: 'error' }
  );
  assert.equal(speaking.cancelCount(), 1);
});

function speechFixture({ voices = [{ name: 'Spain Spanish', lang: 'es-ES' }], throwOnConstruct = false, throwOnSpeak = false } = {}) {
  const utterances = [];
  const spoken = [];
  const document = eventTarget({ hidden: false });
  let cancellations = 0;

  class FakeUtterance {
    constructor(text) {
      if (throwOnConstruct) throw new Error('construction failed');
      this.text = text;
      this.events = new Map();
      utterances.push(this);
    }

    addEventListener(type, listener) {
      this.events.set(type, listener);
    }

    removeEventListener(type) {
      this.events.delete(type);
    }

    emit(type) {
      this.events.get(type)?.();
    }
  }

  const speechSynthesis = {
    getVoices: () => voices,
    speak: utterance => {
      if (throwOnSpeak) throw new Error('speak failed');
      spoken.push(utterance);
    },
    cancel: () => { cancellations += 1; }
  };

  return {
    utterances,
    spoken,
    document,
    cancelCount: () => cancellations,
    dependencies: { speechSynthesis, UtteranceCtor: FakeUtterance, document }
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
