export const FEEDBACK_CUES = Object.freeze(['correct', 'incorrect', 'spanish-hint']);

export const CUE_DEFINITIONS = deepFreeze({
  correct: [
    { frequency: 523.25, type: 'sine', start: 0, duration: 0.18, gain: 0.16 },
    { frequency: 659.25, type: 'sine', start: 0.11, duration: 0.28, gain: 0.14 }
  ],
  // An uneven, stumbling "sputter" rather than a flat buzzer: four short, irregularly
  // spaced pops of falling, jittery pitch, alternating harsh waveforms.
  incorrect: [
    { frequency: 96, type: 'sawtooth', start: 0, duration: 0.07, gain: 0.10 },
    { frequency: 68, type: 'square', start: 0.10, duration: 0.05, gain: 0.07 },
    { frequency: 82, type: 'sawtooth', start: 0.18, duration: 0.07, gain: 0.09 },
    { frequency: 52, type: 'square', start: 0.28, duration: 0.09, gain: 0.06 }
  ],
  'spanish-hint': [
    { frequency: 880, type: 'sine', start: 0, duration: 0.10, gain: 0.11 },
    { frequency: 1108.73, type: 'sine', start: 0.08, duration: 0.11, gain: 0.10 },
    { frequency: 1318.51, type: 'sine', start: 0.16, duration: 0.12, gain: 0.09 },
    { frequency: 1760, type: 'triangle', start: 0.23, duration: 0.24, gain: 0.035 }
  ]
});

/**
 * Creates an independent, best-effort feedback player. Cue failures never
 * escape to the command-audio or scoring lifecycle.
 *
 * @param {{ contextFactory?: () => AudioContext }} options
 */
export function createFeedbackCuePlayer({
  contextFactory = defaultContextFactory,
  fetchImpl = (...args) => globalThis.fetch(...args)
} = {}) {
  let context = null;
  const activeOscillators = new Set();
  // Decoded once and reused: these are a few hundred milliseconds each, and
  // decoding on the tap would put the sound behind the answer it confirms.
  const samples = new Map();

  async function play(cue, { enabled = true, busy = false } = {}) {
    if (!enabled || busy || !FEEDBACK_CUES.includes(cue)) return false;

    const running = await ensureRunningContext();
    if (!running) return false;
    try {
      const baseTime = running.currentTime;
      for (const tone of CUE_DEFINITIONS[cue]) scheduleTone(running, tone, baseTime, activeOscillators);
      return true;
    } catch {
      stop();
      discardContext();
      return false;
    }
  }

  // iPadOS routes a context created while the shared <audio> element owns the
  // media session into a no-output state that still reports 'running', so no
  // state check can recover it. The context must instead be born inside the
  // app's first user gesture, before any <audio> playback exists; callers
  // invoke this from that gesture's handler.
  function prewarm() {
    try {
      context ??= contextFactory();
      if (!context || context.state === undefined) return;
      if (context.state !== 'running' && context.state !== 'closed') {
        Promise.resolve(context.resume()).catch(() => {});
      }
    } catch {
      discardContext();
    }
  }

  // Two attempts per cue: revive the existing context, then once more with a
  // fresh context created inside the same task — a tap-driven cue whose
  // interrupted context cannot be revived still sounds on that same tap.
  async function ensureRunningContext() {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        context ??= contextFactory();
        if (!context) return null;
        if (context.state === undefined) return context;
        // iPadOS WebKit parks the context in a non-standard 'interrupted'
        // state after other audio (the command mp3) takes the session; resume
        // from any non-running state, not just 'suspended'.
        if (context.state !== 'running' && context.state !== 'closed') {
          await context.resume();
        }
        if (context.state === 'running') return context;
        // A dead context would silently eat every future cue; drop it so the
        // next attempt can create a fresh one.
        discardContext();
      } catch {
        discardContext();
      }
    }
    return null;
  }

  // WebKit caps live AudioContexts per page. Dropping an interrupted context
  // without close() leaks one from that budget each time; enough of them and
  // every later context is born unusable — cues fall permanently silent
  // mid-session while command audio (an <audio> element) keeps playing.
  function discardContext() {
    const dying = context;
    context = null;
    if (!dying) return;
    try {
      Promise.resolve(dying.close?.()).catch(() => {});
    } catch {
      // close() is best-effort; the context is already unreferenced.
    }
  }

  function stop() {
    for (const oscillator of activeOscillators) {
      try {
        oscillator.stop();
      } catch {
        // A Web Audio oscillator may already have reached its scheduled stop.
      }
    }
    activeOscillators.clear();
  }

  // A recorded action sound — a buckle, a relay, a latch — played through the
  // same context as the cues. It must NOT be an <audio> element: iPadOS hands
  // the media session to whichever element plays last, and a fresh one here
  // would take it from the command audio and park this context in the silent
  // 'interrupted' state that no state check can detect.
  async function playSample(path, { enabled = true, busy = false, gain = 0.5 } = {}) {
    if (!enabled || busy || typeof path !== 'string' || path.length === 0) return false;
    const running = await ensureRunningContext();
    if (!running || typeof running.decodeAudioData !== 'function') return false;
    try {
      let buffer = samples.get(path);
      if (!buffer) {
        const response = await fetchImpl(path);
        if (!response?.ok) return false;
        buffer = await running.decodeAudioData(await response.arrayBuffer());
        samples.set(path, buffer);
      }
      const source = running.createBufferSource();
      const level = running.createGain();
      source.buffer = buffer;
      level.gain.setValueAtTime(gain, running.currentTime);
      source.connect(level).connect(running.destination);
      source.start();
      return true;
    } catch {
      // A missing or undecodable file must never break the answer it follows.
      return false;
    }
  }

  return Object.freeze({ play, playSample, prewarm, stop });
}

function scheduleTone(context, tone, baseTime, activeOscillators) {
  const startTime = baseTime + tone.start;
  const stopTime = startTime + tone.duration;
  const attackTime = startTime + Math.min(0.02, tone.duration / 3);
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = tone.type;
  oscillator.frequency.setValueAtTime(tone.frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(tone.gain, attackTime);
  gain.gain.linearRampToValueAtTime(0.0001, stopTime);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.addEventListener?.('ended', () => activeOscillators.delete(oscillator), { once: true });
  activeOscillators.add(oscillator);
  oscillator.start(startTime);
  oscillator.stop(stopTime);
}

function defaultContextFactory() {
  const ContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (typeof ContextCtor !== 'function') throw new Error('Web Audio is unavailable');
  return new ContextCtor();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
