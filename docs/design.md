# Examen Práctico de Conducir — Product Design

**Date:** 2026-07-17
**Status:** Approved design; Stage 2 implemented; Offline iPad Release A complete
**Origin:** Extraction and redesign of the practical-exam drill in Piso Asturiano

## Purpose

Examen Práctico de Conducir is a standalone training game for the Spanish
practical driving exam. Its job is narrow: play a Spanish examiner command and
train the learner to perform the corresponding action accurately and promptly.

The primary user already knows how to drive. The learning problem is converting
spoken Spanish into the correct physical response under realistic listening
conditions. The strongest readiness signal is repeated unaided correct action
for every validated command. Response time, hint dependence, lesson mistakes,
and instructor feedback are supporting signals.

The initial preparation window is approximately eight weeks. The app therefore
prioritizes useful practice over platform construction. It may later serve other
learners, but that must not complicate the first user's exam preparation.

## Product Boundary

The game belongs in a new GitHub repository:

- App name: **Examen Práctico de Conducir**
- Short UI title: **Examen Práctico**
- Repository: `examen-practico-de-conducir`

It has independent branding, storage, progress, deployment, releases, and
roadmap. It has no runtime dependency on Piso Asturiano. Relevant command data,
training logic, interaction surfaces, diagnostics, references, and tests will
be copied with provenance; no shared package or cross-repository dependency is
needed.

Piso Asturiano retains its existing embedded exam drill until a separate,
explicit decision removes or freezes it. The extraction must not disturb
apartment, match-3, SRS, or existing exam progress.

The DGT's formal term is *examen práctico de circulación*; the product uses the
more natural public name *Examen Práctico de Conducir*.

## Technical Approach

The first product is an iPad-first static web app that also works on Mac. It is
a multi-file application using plain HTML, CSS, JavaScript, JSON, SVG, and audio
assets, without a frontend framework or required build step.

The web version is both a useful product and a prototype for a possible Swift
implementation. Portability comes from clear domain boundaries and documented
semantics, not from forcing JavaScript and Swift to share a cross-platform
runtime.

Three layers remain separate:

1. **Command model** — underlying action, phase, Spanish phrasings, audio
   variants, valid responses, sources, validation status, and vehicle notes.
2. **Training engine** — selection, scheduling, scoring, timing, session
   settings, logging, and mastery.
3. **Interaction surfaces** — touch/pointer experiences such as junctions,
   roundabouts, steering, speed controls, dashboard controls, and vehicle
   locations.

The browser UI and audio player are replaceable clients of the command model
and training engine. Action IDs and progress semantics must remain stable
enough for a later Swift port and optional import.

## Core Training Loop

Session setup exposes manual controls:

- Content: **Driving / Prechecks / Mixed**, with Mixed as the fresh-save default
- Audio speed: initially **0.75x / 0.9x / 1x**
- Written Spanish: **available as hint / shown initially / unavailable**
- Timing: **off / on**
- Session length: **5 / 10 / 15 commands**, with 10 as the fresh-save default
- UI language: **English / Spanish**, defaulting to English

The command content and audio always remain Spanish. Interface chrome,
settings, instructions, and explanatory notes are localized. The answer reveal
shows the Spanish command; in the English UI it also shows the English meaning,
while the Spanish UI does not translate the command into another language.
Authentic labels on vehicle controls remain as they appear in the actual
vehicle.

Each trial follows this sequence:

1. Play a Spanish command.
2. Accept a physical response through the command's interaction surface.
3. Before responding, allow audio replay and, when enabled, written-Spanish
   reveal.
4. Show the Spanish command, meaning, expected action, and any vehicle-specific
   note.
5. Wait for an explicit Continue action.

Outcomes remain distinct:

- **Unaided success:** correct action from audio alone; full mastery credit.
- **Text-assisted success:** correct action after revealing written Spanish;
  half mastery credit.
- **Incorrect:** wrong action or timeout; no mastery credit.

Audio replay does not reduce correctness, but replay reliance is logged and
reported separately. Raw counts for all three outcomes remain available; the
weighted mastery score must never obscure them.

Repeated unaided successes across sessions are required for command readiness.
One correct response cannot establish mastery. The adaptive scheduler
prioritizes previously missed, unseen, and review-priority actions, while free
practice and manual difficulty selection remain available. The app does not
automatically force a difficulty progression.

Sequential exam mode—realistic prechecks followed by driving—is deferred until
practical lessons or an instructor establish credible counts and ordering.

## Command and Action Model

Mastery belongs to an underlying action, not to one sentence or recording. A
single action such as `turn-right` can have multiple validated Spanish
phrasings and multiple audio variants without multiplying mastery targets. The
current catalog contains 36 actions and 54 source-labeled phrasings.

Each action definition includes:

- Stable language-neutral action ID
- Phase: driving or precheck
- Interaction-surface ID and accepted result
- One or more Spanish phrasing records
- Source and source location
- Wording status: verbatim or source-derived
- Validation status: guide-only, manual-supported, instructor-validated, or
  another explicit status
- Optional vehicle-specific procedure and uncertainty note

Each phrasing includes a stable ID, exact Spanish text, source relationship,
and validation status. New paraphrases require native-speaker or instructor
validation before entering scored mastery sessions. Unverified wording may be
auditioned but must not be silently mixed into scored practice.

Each audio variant includes:

- Action ID and phrasing ID
- Voice ID
- Generated speed
- Provider and model provenance
- Asset path and integrity metadata

Existing command IDs must be preserved or mapped explicitly so a later one-time
progress importer remains possible.

## Physical-Response System

Every command uses the most direct honest action available. Arbitrary emoji
selection is removed where meaningful manipulation or spatial response is
possible.

### Driving surfaces

Stage 2 uses action-matched static responses at the landscape-iPad baseline:

- **Junction and roundabout:** tap the intended outgoing road, with the vehicle
  entering from the bottom. Photo-backed four-way junctions expose left,
  straight, and right choices; roundabouts use four- and five-exit geometry.
- **U-turn and overtaking:** tap the completed direction or overtaking path.
- **Steering:** centre a large on-screen wheel.
- **Secure vehicle:** follow RGC Article 92 by completing a generic manual
  immobilization state in any control order: stop the engine, apply the hand
  parking brake, and select first gear uphill or reverse downhill. The stable
  external surface ID remains unchanged for progress compatibility.
- **Stopping and parking:** tap a legal roadside or parking target. Parking
  uses a dedicated visible gap between two parked cars; voluntary stopping
  uses a clear curb. These scenarios remain provisional hypotheses to correct
  during practical lessons.

Exactly three context-dependent commands remain honest semantic exceptions:
adapt speed, involuntary stopping, and finish exam. They retain simplified
responses because a pedal, control, or road placement would imply a falsely
specific action without a road situation. This is explicit product scope, not a
renderer fallback.

Road simulation and deeper phrasing/voice mastery reporting remain deferred
until real practice shows that static spatial responses are the limiting
factor. The current phrasing expansion deliberately varies playback while
continuing to score the underlying action.

### Precheck surfaces

- Use seven photo-backed, icon-first illustrative scenes rather than abstract
  schematics. They cover the instrument cluster, lighting stalk, climate panel,
  driver-door controls, bonnet release, tailgate release, and engine bay.
- Place each response ring on a precise physical anchor: the relevant native
  symbol, switch, gauge, cap, battery body, or oil dipstick handle. Where the
  photographed control already has a clear symbol, the translucent ring does
  not repeat or obscure it.
- Manipulate stalks, climate controls, window switches, bonnet/hatch releases,
  and dashboard indicators directly. Use recognizable icons for every other
  correct and incorrect option so the task measures language comprehension.
- Use a conventional under-bonnet 12 V battery for the generic training scene.
  Preserve the historical stable target ID even though the superseded hybrid
  manual placed its battery elsewhere.
- Mark all imagery as illustrative and require confirmation of trim-dependent
  controls, equipment, locations, and procedures in the actual test car.

The shared action vocabulary is intentionally small: tap a road or physical
location, centre the wheel, or press a control. Pointer input on Mac mirrors
touch input on iPad. Grading uses the resulting state, not the exact gesture
path.

Multi-step interactions allow correction before submission. Simple directional
responses submit immediately so response-time measurement remains meaningful.
The UI must distinguish listening/meaning errors from answer-target or gesture
errors in diagnostics.

A simple moving-car view is a later bounded experiment. It is expanded only if
it improves unaided transfer or response time beyond the corresponding static
surface. Increased entertainment alone is insufficient.

## Audio Strategy

The first release prefers pre-generated synthetic audio assets. Paid-provider
API keys exist only in a local generation tool and never ship to the browser.
Static runtime audio therefore needs no backend, has predictable latency and
cost, and can be cached with the application.

Before full generation, conduct a voice audition with five representative
commands: direction, roundabout, manoeuvre, speed, and precheck. Compare several
Spain-Spanish voices from ElevenLabs and OpenAI for:

- Naturalness
- Intelligibility
- Neutral examiner-like delivery
- Quality at slower speeds
- Consistency across the command types

Select the best provider. Retain two contrasting voices initially only if both
meet the quality threshold. ElevenLabs is the current leading candidate because
it explicitly supports Spain Spanish and native speed settings; OpenAI remains
a comparison candidate despite documentation noting that its built-in voices
are optimized for English.

The Stage 1 audition selected the ElevenLabs Roger and Sarah voices using
`eleven_multilingual_v2`. Both passed the listening threshold and are randomized
per trial. The setup screen visibly identifies the recordings as AI-generated
in English and Spanish.

Generate provider-native 0.75x, 0.9x, and 1x assets rather than relying on
browser time-stretching. The expanded 54-phrasing, two-voice corpus contains
324 variants. At trial start the app randomly selects any playable variant for
the command and speed, then retains its phrasing and voice through replay,
written hint, reveal, and attempt logging. Later difficulty settings may expose
canonical-versus-varied and one-versus-multiple-voice controls.

Generation checksum-verifies existing production and recovery assets before
reuse. Every new clip and manifest record is written atomically to a durable,
non-shipped recovery directory. The published audio tree and manifest are
replaced only after the complete staged corpus passes integrity validation; an
interrupted or quota-limited run leaves the prior production corpus untouched.

Recorded MP3 playback remains preferred. If a matching recording is missing or
fails, the app automatically invokes browser Spanish speech with `lang="es-ES"`,
the exact retained phrasing, and the selected speed. A completed fallback is
scored normally and preserves replay, hint, reveal, and attempt provenance. If
both recorded MP3 and browser speech fail, are cancelled, or are interrupted by
backgrounding, the attempt remains unscored and the app offers retry. Browser
fallback requires no runtime credential or backend. A public release continues
to show the bilingual AI-voice disclosure.

## State and Data Flow

### Offline Release A architecture

**Release status:** Offline iPad Release A is complete. On 2026-07-20 Jeffrey
confirmed the full physical-iPad matrix, including installation, complete-package
download, Airplane Mode practice with recorded media, resume, staged-update
recovery, backup transfer, bilingual UI, touch targets, and feedback sounds. He
also confirmed no Safari Web Inspector warnings or errors, then approved the
intentional two-column landscape prompt and reveal layout.

The public build is a deterministic runtime allowlist rather than a copy of the repository. It includes the shell, bilingual interface modules, command and audio manifests, optimized gameplay images, icons, recovery page, service worker, and all 324 recorded MP3s. Every packaged asset has an exact byte count and SHA-256 digest in `offline-package.json`; tests, plans, references, source images, recovery checkpoints, and credentials are excluded.

Offline storage uses an **active / staging / pointer** architecture. The service worker serves only the integrity-verified active cache. A new package downloads into a distinct staging cache, resumes missing files after interruption, and cannot replace the active pointer until every required file verifies. The prior active package remains available until the replacement is confirmed. A staged update is applied only from setup, never during a practice session. A navigation failure without a valid active package returns the small bilingual recovery page instead of pretending the full game is ready.

Browser storage schema 2 adds an optional active-session value containing only stable command, phrasing, voice, speed, settings, and completed-attempt IDs. It never serializes audio objects, timers, generated surface state, or DOM references. After a scored response, the attempt and next unscored index are saved together. On relaunch, the interrupted command restarts with its exact immutable audio variant and remains unscored; completed attempts are not repeated. A catalog mismatch clears only the resumable session and preserves completed history.

The installed web app is local-first but is not a native iPad app, and iPadOS can evict website caches under storage pressure. **Ready offline** therefore means that the current package is complete and verified at that moment. Browser Spanish speech remains a playback fallback for online use and is not the offline guarantee.

The app is local-first. A separate, versioned storage schema records:

- UI and session settings
- Per-action mastery and scheduling state
- Unaided, text-assisted, and incorrect counts
- Response-time history
- Hint and replay dependence
- Attempt log with action, phrasing, voice, speed, surface, selected result,
  outcome, timing, and diagnostic reason

Trial data flows from the selected action and audio variant through the
interaction surface to a normalized action result. The training engine compares
that result with the accepted result, classifies assistance, logs the attempt,
updates mastery when appropriate, and renders feedback.

English/Spanish UI strings live outside the command catalog. Switching UI
language never changes action IDs, Spanish learning content, schedules, or
progress.

Versioned JSON export/import provides backup and a possible future bridge to
Swift. Invalid imports must leave current data untouched. Compatible imports
retain unknown additive fields when exported again; imports from an unsupported
future major schema are rejected without mutation. Automatic Piso Asturiano
migration is not part of the initial release; stable IDs make a later importer
possible.

## Error Handling

- Missing or failed recorded audio: automatically try browser Spanish speech;
  score only after either source completes successfully.
- Failure or interruption of both recorded and browser speech: do not start
  timing or score; offer retry.
- Interrupted audio or app backgrounding: cancel the active timed trial and
  restart it without recording an outcome.
- Unrecognized or incomplete gesture: request correction rather than scoring a
  wrong answer.
- Invalid imported data: reject atomically and preserve the active save.
- Missing localized UI string: fail tests; in runtime, fall back to English
  while logging the missing key.
- Unsupported command or surface: exclude it from selectable sessions and show
  a diagnostic in development rather than substituting an unrelated control.

## Delivery Stages

### Stage 1: Extraction and audio

- Create the new repository and static app shell.
- Migrate command data, provenance, schedules, diagnostics, references, and
  relevant tests.
- Remove Piso Asturiano dependencies and branding.
- Add English/Spanish UI localization, defaulting to English.
- Audition TTS providers and add the chosen pre-generated assets.
- Preserve driving, precheck, and mixed filters.
- Implement unaided, text-assisted, and incorrect outcomes.

**Exit criterion:** the standalone is materially better for daily practice than
the embedded drill, even before new physical surfaces are complete.

### Stage 2: Meaningful physical controls

Replace arbitrary responses in this order, using each family for several
sessions before expanding:

1. Junctions and roundabouts
2. Steering, speed, stopping, and parking
3. Precheck controls and vehicle locations
4. Remaining commands where a direct response is defensible

**Exit criterion:** answer-target errors decline and responses feel materially
closer to the commanded actions.

### Stage 3: Variation

- Add validated alternative phrasings. **Implemented for the current focused set.**
- Add multiple voices. **Implemented with Roger and Sarah.**
- Add selectable canonical and varied difficulty.
- Report action mastery separately from phrasing and voice exposure.

**Exit criterion:** high unaided accuracy persists across wording and speaker
changes.

### Stage 4: Optional realism

Prototype one moving-car exercise for junctions or roundabouts and compare it
with the static surface.

**Exit criterion:** expand only with evidence of improved unaided transfer or
response time.

## Testing and Acceptance

Automated tests cover:

- Command/action integrity, stable IDs, and provenance
- Phrasing and audio-manifest references
- Scoring and scheduling semantics
- Phase filters and selection
- English and Spanish UI completeness
- Missing-audio behavior
- Touch/pointer result normalization
- Save migration, atomic import, export, and restore

Manual iPad Safari checks cover the landscape baseline, touch targets, system
gesture conflicts, audio startup, interruption recovery, and caching of
downloaded assets. Mac checks cover pointer equivalents and keyboard access
where supplied. Browser automation cannot reliably observe the export download
or complete the confirm-plus-file-picker import flow, so release review includes
a manual export/import smoke in addition to automated backup tests.

Product acceptance is repeated unaided correct response to every validated
command, accompanied by falling response time and low hint dependence. Fewer
mistakes during practical lessons and instructor feedback provide external
validation.

## Explicit Non-Goals for the Initial Release

- Full driving simulation
- Paid or credentialed runtime TTS generation
- Accounts, cloud sync, or multi-user administration
- Automatic difficulty progression
- Community-authored command content
- Instructor portal
- Sequential exam simulation
- Removing the existing Piso Asturiano drill

## Current Source References

- DGT, *Examen práctico en vías abiertas*:
  https://www.dgt.es/nuestros-servicios/permisos-de-conducir/obtener-un-nuevo-permiso-de-conducir/examen-practico/
- OpenAI, *Text to speech*:
  https://developers.openai.com/api/docs/guides/text-to-speech
- ElevenLabs, *Text to Speech*:
  https://elevenlabs.io/docs/speech-synthesis/voice-settings
- ElevenLabs, *Speed control*:
  https://elevenlabs.io/docs/eleven-agents/customization/voice/speed-control
- ElevenLabs API pricing:
  https://elevenlabs.io/pricing/api
