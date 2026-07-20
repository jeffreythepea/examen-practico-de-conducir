# Changelog

## Offline iPad Release A — in progress

- Added installable Home Screen metadata, landscape presentation, and dedicated iPad icons without claiming a native app.
- Added a deterministic runtime-only distribution containing hashed static assets and the complete 324-record Spanish audio corpus.
- Added resumable, integrity-verified offline downloads with active/staging cache isolation, exact byte progress, safe cancellation, and setup-only update application.
- Migrated local storage to schema 2 and added Resume/Discard for interrupted sessions; an interrupted command restarts from the same phrasing, voice, and speed without being scored.
- Added a constrained `serve:dist` preview and a GitHub Pages workflow that uploads only the verified `dist/` artifact.
- Documented Safari installation, Safari-to-Home-Screen backup transfer, storage-eviction limits, and the physical iPad acceptance matrix still required before Release A is declared complete.

## Command and phrasing expansion — in progress

- Removed remaining user-visible Toyota Yaris Hybrid 2019 wording (reveal heading, setup warning, and the coolant-reservoir precheck answer) in favor of generic-manual-car language; the reveal screen no longer cites a bare, now-unnamed manual page number. Stable command, action, phrasing, and internal `yaris-*` surface/diagram IDs are unchanged pending a later migration decision.
- Expanded the source-ledgered catalog from 30 to 36 commands, adding straight ahead, indicator, brake-fluid, washer-fluid, position-light, and dipped-headlight practice while keeping brake and washer fluid distinct.
- Added 18 supplementary source-labeled alternatives for 54 total Spanish phrasings. A trial now retains the exact randomly selected playable phrasing through audio, Show Spanish, reveal, and attempt provenance.
- Added action-matched surfaces for all six commands using the existing four-way junction, precisely anchored engine-bay components, native lighting-ring symbols, and the photographed indicator stalk.
- Generalized audio generation to all catalog phrasings with checksum-verified production reuse, durable per-clip recovery, restart reuse, and all-or-nothing publication.
- Added automatic browser `es-ES` speech when a static MP3 is missing or fails. Recorded audio remains preferred; a completed fallback is scored normally and retains exact phrasing/replay provenance, while total playback failure remains unscored.
- Published and integrity-checked the complete 324-clip corpus. Browser Spanish fallback remains available for online playback failures without weakening the recorded offline guarantee or requiring a runtime credential/backend.

## Stage 2 action surfaces — implemented for release review

- Replaced eligible arbitrary choices with seeded, action-matched junction, roundabout, manoeuvre, steering, vehicle-securing, and Yaris precheck response surfaces while preserving stable command, action, phrasing, target, and provenance IDs.
- Replaced abstract vehicle schematics with seven photo-backed, icon-first precheck scenes whose targets are precisely anchored to recognizable caps, handles, gauges, switches, rings, and levers.
- Used illustrative generic vehicle images, including a conventional under-bonnet battery baseline, while retaining stable diagram and hotspot IDs and requiring confirmation in the actual test car.
- Replaced the provisional automatic interaction with a generic manual immobilization exercise grounded in RGC Article 92: engine stopped, hand parking brake applied, first gear uphill or reverse downhill.
- Added a terminal incorrect reveal for a fully configured wrong immobilization gear, eliminating a state with no route to Continue, and replaced the ambiguous slope marker with a directional car.
- Activated photo-backed overtaking, parking, voluntary-stopping, and four- or five-exit roundabout scenes while retaining auditable code-native targets, routes, and reveal marks.
- Replaced the abstract T-junction with a photo-backed four-way intersection whose three choices test left, straight, and right, and gave parking a dedicated photo with one unambiguous gap between parked cars.
- Added optional game-show feedback sounds and a distinct written-Spanish-hint cue, with feedback sounds independently configurable.
- Made session length explicit and selectable as 5, 10, or 15 commands; fresh saves default to Mixed practice with 10 commands.
- Realigned every photo-backed manoeuvre and roundabout target to visible asphalt, curb, driveway, crossing, restriction, or exit geometry, and removed redundant crosswalk/driveway drawings from photographic scenes.
- Retained exactly three honest semantic exceptions: speed adaptation, involuntary stopping, and exam finish. Parking and voluntary-stopping scenarios remain provisional pending practical-lesson evidence.
- Recorded landscape-iPad and same-Wi-Fi hardened `serve:lan` guidance, actual-test-vehicle uncertainty, and the browser-automation limitation for backup export/import smoke.
- Kept road simulation and deeper phrasing/voice mastery reporting deferred for evidence from real practice sessions.

## v0.1.0 — Standalone daily-practice baseline

- Extracted the practical-driving command drill into an independent static app with preserved command, action, phrasing, and provenance IDs.
- Added English and Spanish interface localization while keeping commands and generated audio in Spanish.
- Added distinct unaided, text-assisted, and incorrect scoring with durable raw counts, mastery scheduling, response timing, and replay/hint dependence.
- Added 180 integrity-checked ElevenLabs assets across two contrasting voices and three provider-native speeds, with a bilingual AI-generated-voice disclosure.
- Preserved driving, precheck, and mixed content filters plus previously-missed and free-practice ordering.
- Added miss-reason diagnostics, session summaries, local versioned storage, and atomic JSON backup/import.
- Documented command-source and provisional Toyota Yaris Hybrid 2019 limitations.

### Known limitations

- Stage 1 response surfaces are simplified training targets, not a driving simulator; meaningful junction, roundabout, vehicle-control, and location gestures are deferred to Stage 2.
- The command set derives from the Autoescuela Fermín 2020 guide and is not an exhaustive examiner transcript.
- Vehicle procedures remain a provisional 2019 Toyota Yaris Hybrid manual baseline pending instructor confirmation.
- There is no sequential exam simulation, automatic difficulty progression, browser speech fallback, backend sync, or cross-device synchronization.
