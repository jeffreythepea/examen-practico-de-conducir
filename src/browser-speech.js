export function supportsBrowserSpeech({ speechSynthesis, UtteranceCtor } = {}) {
  return Boolean(
    speechSynthesis
    && typeof speechSynthesis.speak === 'function'
    && typeof speechSynthesis.cancel === 'function'
    && typeof UtteranceCtor === 'function'
  );
}

export function createBrowserSpeechPlayer({
  speechSynthesis = globalThis.speechSynthesis,
  UtteranceCtor = globalThis.SpeechSynthesisUtterance,
  document = globalThis.document
} = {}) {
  const dependencies = { speechSynthesis, UtteranceCtor };
  let active = null;

  function play({ text, speed }) {
    cancel('replaced');
    if (!supportsBrowserSpeech(dependencies)) {
      return Promise.resolve({ scored: false, reason: 'unsupported' });
    }

    let utterance;
    try {
      utterance = new UtteranceCtor(text);
      utterance.lang = 'es-ES';
      utterance.rate = speed;
      utterance.voice = selectSpanishVoice(safeVoices(speechSynthesis));
    } catch {
      return Promise.resolve({ scored: false, reason: 'error' });
    }

    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        utterance.removeEventListener?.('end', onEnd);
        utterance.removeEventListener?.('error', onError);
        document?.removeEventListener?.('visibilitychange', onVisibilityChange);
        if (!result.scored) speechSynthesis.cancel();
        if (active?.finish === finish) active = null;
        resolve(result);
      };
      const onEnd = () => finish({ scored: true });
      const onError = () => finish({ scored: false, reason: 'error' });
      const onVisibilityChange = () => {
        if (document?.hidden) finish({ scored: false, reason: 'visibilitychange' });
      };

      active = { finish };
      utterance.addEventListener?.('end', onEnd);
      utterance.addEventListener?.('error', onError);
      document?.addEventListener?.('visibilitychange', onVisibilityChange);

      try {
        speechSynthesis.speak(utterance);
      } catch {
        finish({ scored: false, reason: 'error' });
      }
    });
  }

  function cancel(reason = 'cancelled') {
    active?.finish({ scored: false, reason });
  }

  return Object.freeze({ play, cancel });
}

function safeVoices(speechSynthesis) {
  try {
    const voices = speechSynthesis.getVoices?.();
    return Array.isArray(voices) ? voices : [];
  } catch {
    return [];
  }
}

function selectSpanishVoice(voices) {
  return voices.find(voice => voice.lang?.toLowerCase() === 'es-es')
    ?? voices.find(voice => voice.lang?.toLowerCase().startsWith('es-'))
    ?? null;
}
