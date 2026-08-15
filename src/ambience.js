export const AMBIENCE_CLIPS = Object.freeze({
  engine: 'audio/ambience/engine.mp3',
  city: 'audio/ambience/city.mp3',
  rural: 'audio/ambience/rural.mp3'
});

// Held well under command-audio/speech volume; ambience is a background texture,
// never a competing signal.
const VOLUME = 0.12;

/**
 * A minimal, best-effort looping ambience player. One clip plays at a time;
 * starting a different clip stops the previous one first. Playback failures
 * (autoplay restrictions, missing Audio support) never throw.
 *
 * @param {{ AudioCtor?: typeof Audio }} options
 */
export function createAmbiencePlayer({ AudioCtor = globalThis.Audio } = {}) {
  let element = null;
  let currentClip = null;

  function start(clipId) {
    if (!Object.hasOwn(AMBIENCE_CLIPS, clipId)) throw new Error(`Unknown ambience clip: ${clipId}`);
    if (currentClip === clipId && element) {
      resume();
      return;
    }
    stop();
    if (typeof AudioCtor !== 'function') return;
    try {
      element = new AudioCtor(AMBIENCE_CLIPS[clipId]);
      element.loop = true;
      element.volume = VOLUME;
      currentClip = clipId;
      resume();
    } catch {
      element = null;
      currentClip = null;
    }
  }

  function resume() {
    try {
      void element?.play?.()?.catch?.(() => {});
    } catch {
      // Autoplay can be blocked; ambience is decorative, so this fails silently.
    }
  }

  function stop() {
    try {
      element?.pause?.();
    } catch {
      // Pausing an already-stopped element is harmless if it throws.
    }
    element = null;
    currentClip = null;
  }

  function isPlaying() {
    return element !== null;
  }

  function activeClip() {
    return currentClip;
  }

  return Object.freeze({ start, stop, isPlaying, activeClip });
}

// The cabin, not the street: the learner is inside the car for the whole
// session, and every driving clip in the app is muted, so this engine bed is
// the only thing under the drive. The street textures stay registered for
// scenes that might want them, but nothing picks them today.
export function pickAmbienceClip() {
  return 'engine';
}
