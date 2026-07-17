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

export function createAudioPlayer({ AudioCtor = Audio, document = globalThis.document } = {}) {
  let active = null;
  let lastStartedVariant = null;
  let replayCount = 0;

  function play(variant) {
    lastStartedVariant = null;
    replayCount = 0;
    return start(variant, false);
  }

  function replay() {
    if (!lastStartedVariant) return Promise.resolve({ scored: false, reason: 'no-audio' });
    return start(lastStartedVariant, true);
  }

  function cancel(reason = 'cancelled') {
    active?.finish({ scored: false, reason });
  }

  function start(variant, isReplay) {
    cancel('replaced');
    const audio = new AudioCtor(variant.path);
    return new Promise(resolve => {
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        audio.removeEventListener?.('ended', onEnded);
        audio.removeEventListener?.('error', onError);
        audio.removeEventListener?.('abort', onAbort);
        document?.removeEventListener?.('visibilitychange', onVisibilityChange);
        if (!result.scored) audio.pause?.();
        if (active?.finish === finish) active = null;
        resolve(result);
      };
      const onEnded = () => finish({ scored: true, replays: replayCount });
      const onError = () => finish({ scored: false, reason: 'error' });
      const onAbort = () => finish({ scored: false, reason: 'abort' });
      const onVisibilityChange = () => {
        if (document?.hidden) finish({ scored: false, reason: 'visibilitychange' });
      };

      active = { finish };
      audio.addEventListener?.('ended', onEnded);
      audio.addEventListener?.('error', onError);
      audio.addEventListener?.('abort', onAbort);
      document?.addEventListener?.('visibilitychange', onVisibilityChange);

      Promise.resolve(audio.play())
        .then(() => {
          if (settled) return;
          lastStartedVariant = Object.freeze({ ...variant });
          if (isReplay) replayCount += 1;
        })
        .catch(onError);
    });
  }

  return Object.freeze({ play, replay, cancel });
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
