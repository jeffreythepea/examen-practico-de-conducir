# Changelog

## Simulated-exam continuity — in progress

- Expanded the working catalog to 38 commands and 79 Spanish phrasings with
  `Arranque el motor` / `Ponga el motor en marcha` and `Incorpórese a la
  circulación`, preserving stable command, action, phrasing, and provenance
  rules.
- Added the semantic start-engine response surface and the pure continuity
  planner, transition view, and resumable active-session foundation. Controller
  integration, the join-traffic surface, and physical-device acceptance remain
  pending.
- Prepared rollback-safe join-traffic and cleaned-roundabout visual candidates;
  they remain outside the production runtime until alignment and device review.
- Generated and integrity-checked the final 45 clips for the three continuity
  phrasings, completing the 1,185-recording corpus across five voices and three
  speeds.

## Examiner modes and themed drives — release candidate

- Added Learn, Practice, and simulated Mock modes while preserving the existing
  readiness and scoring rules. Learn applies a slower, written-Spanish-supported
  session; Practice retains the learner's advanced settings; Mock withholds
  correctness and explanations until the drive ends.
- Added five neutral examiner characters with fixed, rotating Today, and Mixed
  selection. Recorded variants remain coverage-aware, and a fixed examiner
  never silently substitutes another recorded voice.
- Added Adaptive practice plus six themed drives: First drive, City circuit,
  Roundabout circuit, Manoeuvres, Precheck inspection, and Full mock.
- Snapshotted the mode, resolved examiner, theme, policies, exact recordings,
  and progress in resumable schema-4 sessions. Completed Mock sessions survive
  reload for deferred, per-command review and miss-reason notes.
- Added a compact bilingual mode/theme/examiner identity strip to prompts,
  neutral Mock transitions, and results without covering response surfaces.

## Expanded road-motion experiment — in progress

- Extended the optional, default-on six-second camera push-in to realistic
  junction, roundabout, U-turn, overtaking, parking, and voluntary-stopping
  questions while retaining existing scoring and the explicit Timing setting.
- Calibrated each photograph independently and added a generated-scene sweep
  proving every selectable target remains fully visible at the animation
  endpoint; reduced-motion users and Road movement Off retain static exercises.

## Release B — readiness and targeted practice — complete

- Added evidence-based command states: Ready requires unaided successes on three distinct UTC dates and the two most recent attempts unaided; latest misses or text assistance remain Needs practice.
- Replaced the legacy previously-missed scheduler with Recommended practice and added targeted sessions for readiness states, open lesson notes, all non-ready commands, or one command.
- Prefer less-exposed recorded phrasing-and-voice combinations without splitting action-level mastery or changing scoring.
- Added local lesson notes that can be created from a reveal and edited, resolved, reopened, filtered, practiced, exported, and imported without modifying accepted answers or catalog provenance.
- Migrated browser storage to schema 3 while retaining schema-1/schema-2 migration and resumable-session compatibility.
- Added a bilingual Readiness screen while deliberately omitting a composite score, streaks, badges, quotas, and other engagement mechanics.
- Hardened Readiness interactions after independent review: empty focused-practice groups are disabled, completed sessions cannot reappear as resumable, repeated lesson-note controls retain distinct focus, unsaved note drafts survive locale changes, and notes can be filtered by open or resolved status.
- Passed physical iPad acceptance on 2026-07-22: the GitHub Pages offline update applied successfully, Readiness was accessible, targeted practice worked, and a lesson note saved and completed its resolve/reopen lifecycle.

## Offline iPad Release A — complete

- Completed the physical iPad acceptance matrix for installation, verified offline download, Airplane Mode practice with recorded media, resume, staged-update recovery, backup transfer, bilingual UI, touch, and sound; added an intentional two-column landscape layout for prompt and reveal screens.
- Added installable Home Screen metadata, landscape presentation, and dedicated iPad icons without claiming a native app.
- Added a deterministic runtime-only distribution containing hashed static assets and the complete 324-record Spanish audio corpus.
- Added resumable, integrity-verified offline downloads with active/staging cache isolation, exact byte progress, safe cancellation, and setup-only update application.
- Migrated local storage to schema 2 and added Resume/Discard for interrupted sessions; an interrupted command restarts from the same phrasing, voice, and speed without being scored.
- Added a constrained `serve:dist` preview and a GitHub Pages workflow that uploads only the verified `dist/` artifact.
- Documented Safari installation, Safari-to-Home-Screen backup transfer, storage-eviction limits, and the completed physical iPad acceptance matrix.

## Command and phrasing expansion — in progress

- Added 22 review-derived, instructor-plausible wording variants for 76 total Spanish phrasings without changing any command, action, response surface, or existing phrasing ID/text; recorded the deferred B list and its instructor questions outside scored practice.
- Generated and published the 132 review-derived clips through the resumable ElevenLabs workflow, reusing the prior 324 recordings and completing the integrity-checked 456-variant corpus.
- Expanded the production corpus to five voices (Roger, Sarah, George, Matilda, and Eric), reusing the 456 existing recordings; generated 684 additional clips for a complete 1,140-variant corpus.
- Removed remaining user-visible Toyota Yaris Hybrid 2019 wording (reveal heading, setup warning, and the coolant-reservoir precheck answer) in favor of generic-manual-car language; the reveal screen no longer cites a bare, now-unnamed manual page number. Stable command, action, phrasing, and internal `yaris-*` surface/diagram IDs are unchanged pending a later migration decision.
- Expanded the source-ledgered catalog from 30 to 36 commands, adding straight ahead, indicator, brake-fluid, washer-fluid, position-light, and dipped-headlight practice while keeping brake and washer fluid distinct.
- Added 18 supplementary source-labeled alternatives in the earlier expansion. A trial retains the exact randomly selected playable phrasing through audio, Show Spanish, reveal, and attempt provenance.
- Added action-matched surfaces for all six commands using the existing four-way junction, precisely anchored engine-bay components, native lighting-ring symbols, and the photographed indicator stalk.
- Generalized audio generation to all catalog phrasings with checksum-verified production reuse, durable per-clip recovery, restart reuse, and all-or-nothing publication.
- Added automatic browser `es-ES` speech when a static MP3 is missing or fails. Recorded audio remains preferred; a completed fallback is scored normally and retains exact phrasing/replay provenance, while total playback failure remains unscored.
- Published and integrity-checked the then-complete 324-clip corpus. Browser Spanish fallback remains available for online playback failures without requiring a runtime credential/backend; the later 76-phrasing expansion is now offline-complete with all 456 recordings.

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
- Removed the obsolete setup-source and provisional-vehicle notices, aligned the position-light target with its native symbol, separated crowded lighting-stalk labels, and contained road-answer markers within their targets.
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
