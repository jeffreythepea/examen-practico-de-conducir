# Changelog

## v0.1.0 — Standalone daily-practice baseline

- Extracted the practical-driving command drill into an independent static app with preserved command, action, phrasing, and provenance IDs.
- Added English and Spanish interface localization while keeping commands and generated audio in Spanish.
- Added distinct unaided, text-assisted, and incorrect scoring with durable raw counts, mastery scheduling, response timing, and replay/hint dependence.
- Added 180 integrity-checked ElevenLabs assets across two contrasting voices and three provider-native speeds, with a bilingual AI-generated-voice disclosure.
- Preserved driving, precheck, and mixed content filters plus weak/due and free-practice ordering.
- Added miss-reason diagnostics, session summaries, local versioned storage, and atomic JSON backup/import.
- Documented command-source and provisional Toyota Yaris Hybrid 2019 limitations.

### Known limitations

- Stage 1 response surfaces are simplified training targets, not a driving simulator; meaningful junction, roundabout, vehicle-control, and location gestures are deferred to Stage 2.
- The command set derives from the Autoescuela Fermín 2020 guide and is not an exhaustive examiner transcript.
- Vehicle procedures remain a provisional 2019 Toyota Yaris Hybrid manual baseline pending instructor confirmation.
- There is no sequential exam simulation, automatic difficulty progression, browser speech fallback, backend sync, or cross-device synchronization.
