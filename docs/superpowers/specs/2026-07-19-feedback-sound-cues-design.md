# Feedback Sound Cues Design

**Date:** 2026-07-19
**Status:** Approved and implemented; listening review pending

## Goal

Add immediate, recognizable audio feedback to answer reveals and the optional
Spanish hint without competing with examiner-command playback or changing any
scoring, timing, or progression behavior.

## Selected Approach

Generate all three cues locally with the browser's Web Audio API. This avoids
downloaded sound assets, licensing questions, network access, and additional
repository binaries while allowing short game-show-like sounds.

Bundled audio files were rejected for this increment because they add asset and
licensing overhead. Reusing the examiner-command audio player was rejected
because feedback sounds must never change replay state or interfere with the
Spanish command-audio lifecycle.

## Cue Vocabulary

- **Correct answer:** a bright, brief, two-note rising chime. Unaided and
  assisted correct answers use the same cue; the visible result text continues
  to distinguish their scores.
- **Incorrect answer:** a restrained, brief low buzzer. It confirms an answered
  miss without becoming harsh or startling.
- **Show Spanish:** a playful three-note coin-like plink followed by a soft
  reveal shimmer. It communicates “buying assistance,” similar in function to a
  game-show vowel purchase without copying a recognizable show recording or
  melody.
- **Timeout:** no feedback cue. A timeout is not a user-selected answer and must
  not trigger the incorrect-answer buzzer.

Each cue lasts less than 600 milliseconds. Cues contain no speech, sampled
recordings, branded melodies, or generated audio files.

## Playback Architecture

Create a dedicated `feedback-audio` module that owns one lazily constructed
audio context and exports an explicit cue player. The module consumes only the
semantic cue name—`correct`, `incorrect`, or `spanish-hint`—and does not know
about commands, attempts, scores, or screens.

The application requests a cue only after the corresponding reducer transition
has succeeded:

1. A completed user response enters the reveal screen.
2. The application reads the resulting outcome.
3. `unaided` or `assisted` requests `correct`; a user-selected `incorrect`
   outcome requests `incorrect`; a timeout requests nothing.
4. A successful `SHOW_TEXT` transition requests `spanish-hint` once.

Rendering, same-screen rerenders, language changes, focus changes, and browser
back/forward behavior never trigger cues. This prevents duplicate sound from
UI updates.

## Setting and Accessibility

Add one persisted bilingual setup setting:

- English: `Feedback sounds` with values `On` and `Off`
- Spanish: `Sonidos de respuesta` with values `Activados` and `Desactivados`

The default is on. Turning it off suppresses every feedback cue but never mutes
examiner-command audio. The setting is included in validated backup/export data
and restored by import using the existing additive state model.

Browsers may suspend Web Audio until the first user gesture. Cue playback is
therefore best-effort: the module returns a non-throwing result when audio is
unavailable, blocked, suspended, or interrupted. Visual feedback remains the
authoritative accessible result. No cue is placed in an ARIA live region, and
no essential meaning is conveyed by sound alone.

## Error and Lifecycle Rules

- Cue failure never changes the reducer model, attempt record, timing, focus,
  current command, or navigation.
- A cue requested while examiner audio or replay is active is suppressed.
- Starting the next examiner command stops any remaining feedback oscillator.
- Each accepted response or hint transition can request at most one cue.
- Unsupported cue names fail closed without creating an oscillator.
- Tests inject an audio-context factory; repository tests never require a real
  speaker or browser audio device.

## Testing

- Unit-test cue schedules, duration bounds, unsupported names, muted behavior,
  and non-throwing context failures with a fake audio context.
- Reducer/application tests prove correct, incorrect, hint, and timeout trigger
  behavior without coupling sound to scoring.
- Storage tests cover the default, persistence, import validation, and backward
  compatibility when older backups lack the setting.
- Localization tests require complete English and Spanish setting copy.
- Full verification remains `npm test` and `git diff --check`, plus manual local
  listening at normal iPad volume to confirm that the cues are distinct and not
  startling.

## Scope Boundary

This increment adds only answer/hint feedback cues and their setting. It does
not add music, volume sliders, per-cue controls, haptics, voice effects,
downloaded samples, or changes to examiner-command audio.
