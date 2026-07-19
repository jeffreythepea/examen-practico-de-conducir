export const FEEDBACK_CUES = Object.freeze(['correct', 'incorrect', 'spanish-hint']);

export const CUE_DEFINITIONS = deepFreeze({
  correct: [
    { frequency: 523.25, type: 'sine', start: 0, duration: 0.18, gain: 0.16 },
    { frequency: 659.25, type: 'sine', start: 0.11, duration: 0.28, gain: 0.14 }
  ],
  incorrect: [
    { frequency: 145, type: 'sawtooth', start: 0, duration: 0.34, gain: 0.09 },
    { frequency: 112, type: 'square', start: 0.08, duration: 0.30, gain: 0.035 }
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
export function createFeedbackCuePlayer({ contextFactory = defaultContextFactory } = {}) {
  let context = null;
  const activeOscillators = new Set();

  async function play(cue, { enabled = true, busy = false } = {}) {
    if (!enabled || busy || !FEEDBACK_CUES.includes(cue)) return false;

    try {
      context ??= contextFactory();
      if (!context || context.state === 'closed') return false;
      if (context.state === 'suspended') await context.resume();
      if (context.state !== undefined && context.state !== 'running') return false;

      const baseTime = context.currentTime;
      for (const tone of CUE_DEFINITIONS[cue]) scheduleTone(context, tone, baseTime, activeOscillators);
      return true;
    } catch {
      stop();
      return false;
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

  return Object.freeze({ play, stop });
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
