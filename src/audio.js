import { createBrowserSpeechPlayer, supportsBrowserSpeech } from './browser-speech.js';

export const AUDIO_SPEEDS = Object.freeze([0.75, 0.9, 1]);

const VARIANT_FIELDS = Object.freeze([
  'id', 'commandId', 'phrasingId', 'voiceId', 'provider', 'model', 'path'
]);

export function validateAudioManifest(manifest, commands) {
  if (!Array.isArray(manifest)) throw new Error('Audio manifest must be an array');
  if (!Array.isArray(commands)) throw new Error('Commands must be an array');

  const commandPhrasings = new Map(commands.map(command => [
    command.id,
    new Set(command.phrasings?.map(phrasing => phrasing.id))
  ]));
  const variantIds = new Set();
  const selections = new Set();

  for (const variant of manifest) {
    const id = variant?.id || '<unknown>';
    for (const field of VARIANT_FIELDS) requireField(variant?.[field], id, field);
    if (!AUDIO_SPEEDS.includes(variant.speed)) throw new Error(`${id}: invalid speed`);
    if (hasDirectoryTraversal(variant.path)) throw new Error(`${id}: path must not traverse directories`);
    if (!isRelativeAssetPath(variant.path)) throw new Error(`${id}: path must be relative`);
    if (variantIds.has(variant.id)) throw new Error(`${id}: duplicate id`);
    variantIds.add(variant.id);
    if (!commandPhrasings.has(variant.commandId)) throw new Error(`${id}: unknown commandId`);
    if (!commandPhrasings.get(variant.commandId).has(variant.phrasingId)) {
      throw new Error(`${id}: unknown phrasingId`);
    }
    const selection = selectionKey(variant);
    if (selections.has(selection)) throw new Error(`${id}: duplicate audio selection`);
    selections.add(selection);
  }
}

export function findAudioVariant(manifest, selection) {
  const variant = manifest.find(candidate => selectionKey(candidate) === selectionKey(selection));
  if (!variant) throw new Error(`Audio unavailable for ${selection.commandId}`);
  return Object.freeze({ ...variant });
}

export function createAudioPlayer(options = {}) {
  const {
    AudioCtor = globalThis.Audio,
    document = globalThis.document,
    speechSynthesis = globalThis.speechSynthesis,
    UtteranceCtor = globalThis.SpeechSynthesisUtterance
  } = options;
  const fallbackPlayer = options.fallbackPlayer ?? createBrowserSpeechPlayer({
    speechSynthesis,
    UtteranceCtor,
    document
  });
  const fallbackAvailable = options.fallbackSupported
    ?? (options.fallbackPlayer
      ? true
      : supportsBrowserSpeech({ speechSynthesis, UtteranceCtor }));
  let active = null;
  let lastPlayback = null;
  let replayCount = 0;

  function play(variant, speechRequest) {
    lastPlayback = null;
    replayCount = 0;
    return start(variant, speechRequest, false);
  }

  function replay() {
    if (!lastPlayback) return Promise.resolve({ scored: false, reason: 'no-audio' });
    return start(lastPlayback.variant, lastPlayback.speechRequest, true, lastPlayback.mode);
  }

  function cancel(reason = 'cancelled') {
    active?.cancel(reason);
  }

  function start(variant, speechRequest, isReplay, retainedMode = null) {
    cancel('replaced');
    return new Promise(resolve => {
      let settled = false;
      const finish = (result, mode = null) => {
        if (settled) return;
        settled = true;
        if (active?.finish === finish) active = null;
        if (result.scored) {
          lastPlayback = Object.freeze({
            variant: Object.freeze({ ...variant }),
            speechRequest: Object.freeze({ ...speechRequest }),
            mode
          });
          if (isReplay) replayCount += 1;
          resolve({ scored: true, replays: replayCount });
        } else {
          if (!isReplay) lastPlayback = null;
          resolve(result);
        }
      };

      const startSpeech = originalReason => {
        if (!fallbackAvailable || !speechRequest?.text) {
          finish({ scored: false, reason: originalReason });
          return;
        }
        active = {
          finish,
          cancel: reason => {
            fallbackPlayer.cancel(reason);
            finish({ scored: false, reason });
          }
        };
        Promise.resolve(fallbackPlayer.play(speechRequest))
          .then(result => finish(result, 'speech'))
          .catch(() => finish({ scored: false, reason: 'error' }));
      };

      if (retainedMode === 'speech' || variant.provider === 'browser-speech' || !variant.path) {
        startSpeech('unsupported');
        return;
      }

      let audio;
      try {
        audio = new AudioCtor(variant.path);
      } catch {
        startSpeech('error');
        return;
      }

      let mediaSettled = false;
      const cleanMedia = ({ pause = false } = {}) => {
        if (mediaSettled) return false;
        mediaSettled = true;
        audio.removeEventListener?.('ended', onEnded);
        audio.removeEventListener?.('error', onError);
        audio.removeEventListener?.('abort', onAbort);
        document?.removeEventListener?.('visibilitychange', onVisibilityChange);
        if (pause) audio.pause?.();
        return true;
      };
      const onEnded = () => {
        if (!cleanMedia()) return;
        finish({ scored: true }, 'recorded');
      };
      const onError = () => {
        if (!cleanMedia({ pause: true })) return;
        startSpeech('error');
      };
      const onAbort = () => {
        if (!cleanMedia({ pause: true })) return;
        startSpeech('abort');
      };
      const onVisibilityChange = () => {
        if (!document?.hidden || !cleanMedia({ pause: true })) return;
        finish({ scored: false, reason: 'visibilitychange' });
      };

      active = {
        finish,
        cancel: reason => {
          cleanMedia({ pause: true });
          finish({ scored: false, reason });
        }
      };
      audio.addEventListener?.('ended', onEnded);
      audio.addEventListener?.('error', onError);
      audio.addEventListener?.('abort', onAbort);
      document?.addEventListener?.('visibilitychange', onVisibilityChange);

      Promise.resolve(audio.play())
        .then(() => {})
        .catch(onError);
    });
  }

  return Object.freeze({
    play,
    replay,
    cancel,
    supportsFallback: () => fallbackAvailable
  });
}

function requireField(value, variantId, field) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${variantId}: missing ${field}`);
  }
}

function selectionKey({ commandId, phrasingId, voiceId, speed }) {
  return JSON.stringify([commandId, phrasingId, voiceId, speed]);
}

function isRelativeAssetPath(path) {
  if (typeof path !== 'string' || path.startsWith('/') || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path)) {
    return false;
  }
  const normalized = path.startsWith('./') ? path.slice(2) : path;
  return !hasDirectoryTraversal(normalized);
}

function hasDirectoryTraversal(path) {
  if (typeof path !== 'string') return false;
  const normalized = path.startsWith('./') ? path.slice(2) : path;
  return normalized.split('/').some(segment => segment === '..' || segment === '.');
}
