# Browser Spanish Speech Fallback Design

**Date:** 2026-07-20
**Status:** Approved for implementation planning

## Goal

Keep every otherwise supported command playable when a pre-generated MP3 is
missing or cannot play. Browser-generated Spanish speech is a resilience path,
not a new practice mode: a completed fallback playback receives the same score
as a completed recorded playback.

## Constraints

- Pre-generated ElevenLabs MP3s remain the preferred source.
- Command speech and written command text remain Spanish.
- The browser fallback uses no provider credential, backend, or runtime paid
  API.
- Every interface string introduced by this work exists in English and Spanish.
- Stable command, action, phrasing, surface, and attempt provenance remains
  intact.
- Failed, interrupted, or backgrounded speech does not start timing or score an
  attempt.

## Selected Approach

Add an automatic Web Speech synthesis fallback behind the existing audio-player
boundary. The app first attempts the selected static MP3. It invokes browser
speech in two cases:

1. no manifest recording exists for the selected command and speed; or
2. the selected MP3 fails to load or begin/complete playback.

The alternatives are rejected for this build. Excluding commands recreates the
current whole-session blockage, while runtime ElevenLabs requests would require
a backend or expose a credential in a browser-delivered application.

## Playback Selection

At trial creation, the app selects one stable Spanish phrasing for the command.
When playable manifest records exist at the selected speed, selection continues
to prefer and randomize among those recordings. When none exist, the app creates
an in-memory fallback playback descriptor for a catalog phrasing; it does not
write a fake record to `data/audio-manifest.json`.

The descriptor retains the command ID, phrasing ID, requested speed, and
`browser-speech` provenance. The exact selected phrasing is then used by initial
playback, replay, Show Spanish, reveal, and attempt logging. A failure of a
recorded MP3 falls back with that recording's exact phrasing rather than
selecting new wording.

## Browser Speech Player

A focused browser-speech component wraps `speechSynthesis` and
`SpeechSynthesisUtterance` behind the same scored/unscored result contract as
the static player.

- Set `utterance.lang` to `es-ES`.
- Prefer an available `es-ES` voice, then any `es-*` voice, then allow the
  browser to render the utterance from its `es-ES` language tag.
- Map the configured 0.75×, 0.9×, and 1× speeds to the utterance rate.
- Resolve as scored only after the utterance's successful `end` event.
- Treat synthesis errors, cancellation, hidden-document interruption, missing
  API support, and synchronous construction/speak failures as unscored.
- Cancel active synthesis before another command, recorded playback, or replay
  starts.

The composite audio player retains the last successfully started playback mode,
descriptor, and Spanish text so Replay repeats the same wording and source.

## Scoring and Timing

A successful browser-generated playback is equivalent to a successful recorded
playback. Timing begins only after successful completion under the app's current
audio lifecycle, and the learner can earn unaided or text-assisted credit as
usual. Provider provenance distinguishes `elevenlabs` from `browser-speech` in
attempt data without creating a separate mastery target.

If both the MP3 and browser speech fail, the existing audio error is shown and
the attempt remains unscored. The app does not silently expose written Spanish
as a substitute for failed sound.

## Interface and Disclosure

Fallback is automatic and has no setting. The existing bilingual AI-generated
voice disclosure remains visible and covers both pre-generated and browser
synthetic voices. No extra notice appears before the response because it would
add distraction without changing how the learner should answer. If both sources
fail, the existing bilingual audio-unavailable message remains the terminal
feedback.

## Availability and Session Setup

Session availability no longer requires every selected command to have a static
manifest recording. A command is playable when either:

- a matching MP3 exists; or
- browser speech synthesis is supported.

When browser speech is unsupported, the app preserves the existing fail-closed
static-audio availability check. This keeps unsupported browsers from starting
a session that cannot produce sound.

## Testing

Automated coverage will include:

- recorded audio remains preferred when available;
- a command with no manifest recording receives a stable fallback descriptor;
- recorded load/playback failure invokes browser speech with the exact selected
  text and speed;
- `es-ES`, other Spanish, and browser-default voice selection order;
- successful fallback completion returns the normal scored result;
- replay retains source, phrasing, text, and speed;
- synthesis error, cancellation, hidden-document interruption, unsupported API,
  and total recorded-plus-fallback failure remain unscored;
- setup permits an incomplete static corpus only when browser speech is
  supported;
- bilingual disclosure and error copy remain present; and
- existing manifest validation and integrity rules remain unchanged.

Final review uses Safari-compatible behavior at the landscape iPad baseline.
Because automated mocks cannot establish device voice quality or autoplay
policy, Jeffrey will perform one manual iPad playback and replay smoke after the
automated suite passes.

## Out of Scope

- Exposing a voice picker or fallback on/off setting.
- Calling ElevenLabs or OpenAI from the browser.
- Replacing completed MP3 recordings with browser speech by preference.
- Separate mastery scores for recorded and browser-generated voices.
- Changing the resumable static-corpus generation work; the remaining eight
  clips may still be generated and atomically published later.
