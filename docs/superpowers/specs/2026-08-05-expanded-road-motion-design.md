# Expanded Road Motion Design

**Date:** 2026-08-05

## Objective

Extend the accepted moving-junction interaction to every currently appropriate
photo-backed road exercise while keeping language comprehension—not animation—
as the task being tested.

The release covers:

- four-way junctions;
- four- and five-exit roundabouts;
- U-turns;
- overtaking;
- parking; and
- voluntary stopping.

The release does not animate vehicle prechecks, dashboard or cabin controls,
manual immobilization, steering controls, or semantic text-option questions.
Those exclusions are deliberate for this release and can be reconsidered only
through a later design.

## User Experience

The existing bilingual **Road movement / Movimiento de la carretera** setting
controls every included road exercise. It remains default-on and no additional
setting is added.

For every included exercise:

1. The retained Spanish audio and road approach begin together.
2. Response targets remain locked until initial audio finishes successfully.
3. Targets unlock immediately when audio finishes, even if approach motion is
   still running.
4. The approach continues to its six-second endpoint unless the learner answers.
5. An answer freezes the scene at its current position and displays the existing
   correct route, target markers, result label, and any restriction explanation.
6. If the learner has not answered when approach motion ends, the scene waits
   indefinitely unless the existing optional response timer expires.
7. Replay repeats audio but never restarts or advances road motion.

This timing is intentionally identical to the accepted moving-junction build.
The learner never has to wait for animation after understanding the command.

There is no post-selection manoeuvre animation in this release.

## Family-Tuned Motion

All included exercises use the same lifecycle and six-second duration. Each
photo family has a declarative endpoint scale and transform origin so its
decision area remains clear.

| Profile | Surface or scene | End scale | Transform origin |
| --- | --- | ---: | --- |
| Junction | `junction-v2` / four-way junction | 1.34 | 50% 82% |
| Four-exit roundabout | `roundabout-v2` / four-exit photo | 1.22 | 50% 80% |
| Five-exit roundabout | `roundabout-v2` / five-exit photo | 1.22 | 50% 80% |
| U-turn | `u-turn-v1` | 1.24 | 50% 84% |
| Overtaking | `overtake-v1` | 1.18 | 54% 86% |
| Parking | `parking-v1` | 1.18 | 65% 84% |
| Voluntary stopping | `stopping-v1` | 1.18 | 66% 84% |

These values are the implementation baseline. Browser and physical-iPad visual
acceptance may make small scale reductions or origin shifts when necessary to
keep a target on the intended road feature and inside the viewport. Such tuning
must not alter duration, lifecycle, target identity, accepted result, route
geometry, or scoring.

## Architecture

### Generic motion domain

Generalize the current `src/junction-motion.js` module into
`src/road-motion.js`.

The module owns only immutable trial-local motion state and time-derived views.
It has no DOM, CSS, audio, persistence, catalog, or surface-renderer dependency.
It retains the proven phases:

- `static`;
- `approaching-locked`;
- `approaching-interactive`; and
- `waiting`.

It retains the proven events:

- initial audio completed;
- approach animation ended;
- answer accepted; and
- motion failed.

The generic view receives a motion profile and derives progress, eased scale,
elapsed time, remaining time, lock state, and running state. The same standard
CSS `ease-in-out` curve and six-second timeline remain authoritative.

### Calibration registry

Add a declarative road-motion profile registry keyed by stable surface identity
and, where one surface has multiple photographs, scene identity.

The registry:

- returns one frozen, validated profile for each included scene;
- returns no profile for excluded surfaces;
- rejects duplicate profile identities and invalid scales, origins, or
  durations in tests; and
- contains presentation calibration only, never command wording, response
  meaning, route geometry, or scoring data.

The application determines motion eligibility from the retained surface model,
not from translated copy or command wording.

### Controller integration

Rename the trial-local controller field and events from junction-specific to
road-generic names. The app begins motion only when all of these are true:

- Road movement is On;
- the browser does not request reduced motion;
- the retained surface model resolves to a valid motion profile; and
- initial recorded or browser-speech playback reports that it actually started.

The existing one-shot audio-start lifecycle observer remains unchanged.
Playback completion unlocks the prompt. Answer, timeout, animation end,
visibility interruption, and audio failure follow the existing reducer-owned
paths.

Live motion state remains outside persisted active-session data. Resuming an
unfinished session begins its current trial from the start, as it does now.
Storage schema version 3 and the existing `roadMovement` setting are unchanged.

### Renderer structure

Both spatial and manoeuvre photo renderers use the same structure:

```text
stage
├── clipped road-motion viewport
│   └── transformed road-motion scene
│       ├── photograph
│       ├── SVG route, sign, or restriction overlay
│       └── response targets
└── result and restriction labels
```

The photograph, route overlay, signs, restriction markings, targets, and target
status markers therefore share one transform. Result and restriction labels
remain outside the clipped viewport, preventing the reveal-label clipping defect
found during moving-junction review.

Static surfaces retain their current markup. A renderer receives a road-motion
view only for an included and enabled exercise.

CSS uses generic `road-motion-*` classes and variables for elapsed time, current
scale, endpoint scale, and transform origin. It contains a
`prefers-reduced-motion: reduce` override that disables animation and transform.

## Invariants

This release must not change:

- command, action, phrasing, surface, target, or result IDs;
- Spanish or English command wording;
- accepted results or response normalization;
- target or route geometry;
- scoring, readiness, practice selection, or lesson-flag behavior;
- audio selection, replay counting, or fallback scoring;
- optional response-timer semantics;
- storage schema or backup compatibility;
- offline packaging behavior;
- bilingual interface coverage; or
- the visible bilingual AI-generated-voice disclosure.

No provider credential, API key, network TTS request, new runtime dependency, or
new visual asset is introduced.

## Error and Fallback Behavior

- Road movement Off produces the existing static exercise.
- `prefers-reduced-motion: reduce` produces the existing static exercise.
- A missing or invalid profile produces the existing static exercise.
- A motion-render or animation-initialization failure falls back to the existing
  static, unscored audio-retry path.
- An initial audio failure or interruption remains unscored and returns a static
  retry.
- A surface-generation failure retains the existing bounded retry behavior.
- A replay failure retains the current unscored retry behavior without changing
  motion progress.
- No timer starts and no target unlocks while initial audio remains incomplete.

Static fallback is always preferable to a partially transformed or
misregistered scene.

## Testing

Implementation follows test-driven development.

### Domain and profile tests

- every legal generic motion-state transition;
- exact six-second progress and standard eased scale calculations;
- freezing at partial and complete progress;
- one valid profile for every included scene;
- no profile for every excluded surface family;
- registry immutability and invalid-profile rejection; and
- retained accepted junction calibration.

### Controller tests

- audio start creates locked road motion for each included family;
- successful audio completion unlocks the retained surface;
- answers and timeouts freeze without changing scoring;
- replay leaves progress unchanged;
- timing starts only after audio completion;
- reduced motion, Road movement Off, missing profile, and failures stay static;
- resume and locale changes retain existing behavior; and
- non-road surfaces never enter motion state.

### Renderer and CSS tests

- photograph, route/sign overlay, targets, and status markers share one
  transform scene;
- result and restriction labels remain outside the clipped viewport;
- static markup remains unchanged when no motion view is supplied;
- six-second negative-delay resume behavior remains deterministic;
- each profile exposes its exact scale and transform origin through CSS
  variables; and
- reduced-motion CSS disables animation and transform.

### Release and manual acceptance

Before review:

- run `npm test`;
- run `npm run release:check`;
- run `git diff --check`;
- verify the deterministic offline runtime package and complete audio corpus;
- verify the bilingual AI-voice disclosure; and
- audit the diff and runtime for credentials.

Browser acceptance at an iPad-landscape viewport covers:

- junction;
- four-exit roundabout;
- five-exit roundabout;
- U-turn;
- overtaking;
- parking;
- voluntary stopping;
- Road movement Off;
- reduced-motion mode;
- replay and answer freeze;
- English and Spanish interface copy;
- reveal labels and restriction explanations; and
- absence of horizontal or vertical overflow.

Physical-iPad acceptance samples every included family and confirms:

- the decision target remains visible and tappable;
- motion stops at a sensible visual decision point;
- overlays remain registered to the photograph;
- audio and interaction timing feel natural; and
- the static setting remains available as an immediate rollback.

## Rollback

The Road movement setting is the immediate user-facing rollback: Off retains all
current exercises without animation.

At code level, motion remains isolated behind the profile lookup and generic
render option. Removing a profile makes only that scene static. Reverting the
expanded profiles and manoeuvre renderer wrapper leaves the already accepted
junction behavior recoverable from commit `7d85fa9`.
