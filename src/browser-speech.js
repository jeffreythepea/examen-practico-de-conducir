export function supportsBrowserSpeech({ speechSynthesis, UtteranceCtor } = {}) {
  return Boolean(
    speechSynthesis
    && typeof speechSynthesis.speak === 'function'
    && typeof speechSynthesis.cancel === 'function'
    && typeof UtteranceCtor === 'function'
  );
}

// If the engine has not begun speaking within this window, treat the attempt
// as failed. WebKit silently queues utterances that lack user activation and
// never fires 'end' or 'error' for them; without this watchdog the play
// promise would hang forever and the trial could never offer Retry.
export const SPEECH_START_TIMEOUT_MS = 4_000;

export function createBrowserSpeechPlayer({
  speechSynthesis = globalThis.speechSynthesis,
  UtteranceCtor = globalThis.SpeechSynthesisUtterance,
  document = globalThis.document,
  startTimeoutMs = SPEECH_START_TIMEOUT_MS
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
      let startTimer = null;
      const finish = result => {
        if (settled) return;
        settled = true;
        if (startTimer !== null) clearTimeout(startTimer);
        utterance.removeEventListener?.('start', onStart);
        utterance.removeEventListener?.('end', onEnd);
        utterance.removeEventListener?.('error', onError);
        document?.removeEventListener?.('visibilitychange', onVisibilityChange);
        if (!result.scored) speechSynthesis.cancel();
        if (active?.finish === finish) active = null;
        resolve(result);
      };
      const onStart = () => {
        if (startTimer !== null) clearTimeout(startTimer);
        startTimer = null;
      };
      const onEnd = () => finish({ scored: true });
      const onError = () => finish({ scored: false, reason: 'error' });
      const onVisibilityChange = () => {
        if (document?.hidden) finish({ scored: false, reason: 'visibilitychange' });
      };

      active = { finish };
      utterance.addEventListener?.('start', onStart);
      utterance.addEventListener?.('end', onEnd);
      utterance.addEventListener?.('error', onError);
      document?.addEventListener?.('visibilitychange', onVisibilityChange);
      startTimer = setTimeout(() => finish({ scored: false, reason: 'timeout' }), startTimeoutMs);

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
