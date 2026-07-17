# Examen Práctico de Conducir — Product Design

**Date:** 2026-07-17
**Status:** Approved design; Stage 1 implemented for release review
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

- Content: **Driving / Prechecks / Mixed**
- Audio speed: initially **0.75x / 0.9x / 1x**
- Written Spanish: **available as hint / shown initially / unavailable**
- Timing: **off / on**
- Session length: **short / medium / all due**
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
One correct response cannot establish mastery. The scheduler prioritizes weak
and due actions, while free practice and manual difficulty selection remain
available. The app does not automatically force a difficulty progression.

Sequential exam mode—realistic prechecks followed by driving—is deferred until
practical lessons or an instructor establish credible counts and ordering.

## Command and Action Model

Mastery belongs to an underlying action, not to one sentence or recording. A
single action such as `turn-right` may eventually have multiple validated
Spanish phrasings and multiple audio variants without multiplying mastery
targets.

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

- **Junction:** drag or swipe the car left, right, or straight; use a distinct
  U-shaped response for change of direction.
- **Roundabout:** trace the car from entry to the requested exit rather than
  tapping a numbered icon.
- **Steering:** rotate an on-screen wheel to turn or centre it.
- **Speed:** manipulate accelerator/brake controls or a speed control toward
  the commanded result.
- **Stopping and parking:** place the car in an appropriate roadside target and
  represent the distinct final states for *parada*, *detención*, and
  *estacionamiento*.
- **Other manoeuvres:** use the simplest spatial action that represents the
  command without claiming simulator realism.

### Precheck surfaces

- Use recognizable driver-view and vehicle diagrams.
- Manipulate stalks, climate controls, window switches, bonnet/hatch releases,
  and dashboard indicators directly.
- Tap actual vehicle regions for reservoirs, battery, and location checks.
- Mark trim-dependent or instructor-unverified controls visibly and preserve
  their evidence status.

The shared action vocabulary is intentionally small: drag, rotate, press,
swipe, or tap a physical location. Pointer input on Mac mirrors touch input on
iPad. Grading uses the resulting state, not the exact gesture path.

Multi-step interactions allow correction before submission. Simple directional
responses submit immediately so response-time measurement remains meaningful.
The UI must distinguish listening/meaning errors from answer-target or gesture
errors in diagnostics.

A simple moving-car view is a later bounded experiment. It is expanded only if
it improves unaided transfer or response time beyond the corresponding static
surface. Increased entertainment alone is insufficient.

## Audio Strategy

The first release uses pre-generated synthetic audio assets. Paid-provider API
keys exist only in a local generation tool and never ship to the browser.
Runtime audio therefore needs no backend, has predictable latency and cost, and
can be cached with the static application.

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
browser time-stretching. The small corpus makes additional files and generation
cost acceptable. Later difficulty settings may choose canonical versus varied
phrasing and one versus multiple voices.

If an audio asset fails, the attempt is not scored and the app offers retry.
The initial release has no browser-speech fallback because it would reintroduce
the quality problem this product is meant to fix. Any later fallback requires a
separate, explicit design decision and visible labeling. A public release must
include any provider-required AI-voice disclosure.

## State and Data Flow

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

- Missing or failed audio: do not start timing or score; offer retry.
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

- Add validated alternative phrasings.
- Add multiple voices.
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

Manual iPad Safari checks cover landscape and portrait layouts, touch targets,
system gesture conflicts, audio startup, interruption recovery, and caching of
downloaded assets. Mac checks cover pointer equivalents and keyboard access
where supplied.

Product acceptance is repeated unaided correct response to every validated
command, accompanied by falling response time and low hint dependence. Fewer
mistakes during practical lessons and instructor feedback provide external
validation.

## Explicit Non-Goals for the Initial Release

- Full driving simulation
- Live TTS generation
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
