// The sound a correct answer makes. Where the car itself would make a noise —
// a buckle, a relay, a latch — that noise confirms the action, and the
// abstract "correct" chime stands aside for it. Where the action is silent in
// the real world (pointing at the dipstick, driving straight on), the chime is
// the confirmation. Exactly one of the two plays, never both and never
// neither: the same rule the reveal follows when a clip replaces its glyph.
//
// Sounds are keyed by accepted result rather than by command, so one recording
// serves every command that performs the same physical action.

export const ACTION_SOUNDS = Object.freeze({
  seatbelt: 'audio/effects/seatbelt.mp3',
  indicator: 'audio/effects/indicator.mp3',
  'engine-start': 'audio/effects/engine-start.mp3',
  handbrake: 'audio/effects/handbrake.mp3',
  'brake-stop': 'audio/effects/brake-stop.mp3',
  accelerate: 'audio/effects/accelerate.mp3',
  'switch-click': 'audio/effects/switch-click.mp3',
  'door-lock': 'audio/effects/door-lock.mp3',
  'latch-release': 'audio/effects/latch-release.mp3'
});

const SOUND_BY_RESULT = Object.freeze({
  'fasten-seatbelt': 'seatbelt',
  'start-engine': 'engine-start',

  // Signalling is the audible half of every turn, exit and lane change.
  'turn-left': 'indicator',
  'turn-right': 'indicator',
  'change-direction': 'indicator',
  'roundabout-exit-1': 'indicator',
  'roundabout-exit-2': 'indicator',
  'roundabout-exit-3': 'indicator',
  'roundabout-change-direction': 'indicator',
  'join-traffic': 'indicator',
  'operate-indicator': 'indicator',

  overtake: 'accelerate',
  'adapt-speed': 'accelerate',

  'voluntary-stop': 'brake-stop',
  'involuntary-stop': 'brake-stop',

  // Both manoeuvres end with the car held still.
  park: 'handbrake',
  'secure-vehicle': 'handbrake',

  // The rear-window commands are the child-safety lock on the driver's door —
  // a lock engaging, not the glass moving. It gets its own clunk rather than
  // the dashboard's control click, so the door controls and the dashboard
  // controls do not sound identical.
  'lock-rear-windows': 'door-lock',
  'unlock-rear-windows': 'door-lock',

  'position-lights': 'switch-click',
  'dipped-headlights': 'switch-click',
  'high-beams': 'switch-click',
  'front-fog-lights': 'switch-click',
  'rear-fog-light': 'switch-click',
  'front-demist': 'switch-click',
  'rear-demist': 'switch-click',

  'open-bonnet-check-levels': 'latch-release',
  'open-boot': 'latch-release'
});

/**
 * The sound id for a correct answer, or null when the action makes no noise
 * and the chime should confirm it instead.
 *
 * @param {string|null|undefined} acceptedResult
 * @returns {string|null}
 */
export function actionSoundFor(acceptedResult) {
  const sound = SOUND_BY_RESULT[acceptedResult];
  return sound && Object.hasOwn(ACTION_SOUNDS, sound) ? sound : null;
}

export function actionSoundPath(soundId) {
  return ACTION_SOUNDS[soundId] ?? null;
}

// Results deliberately left to the chime, so a reviewer can tell "no sound
// was chosen" from "a sound was forgotten". Pointing at a component is silent,
// and so is carrying straight on or acknowledging the end of the test.
export const SILENT_RESULTS = Object.freeze([
  'continue-forward',
  'steering-straight',
  'exam-finish',
  'locate-battery',
  // Asked where the horn is, the learner points at the wheel pad; the examiner
  // did not ask to hear it.
  'locate-horn',
  'locate-oil-check',
  'locate-coolant-check',
  'locate-brake-fluid',
  'locate-washer-fluid',
  'locate-fuel-level',
  'locate-engine-temperature'
]);
