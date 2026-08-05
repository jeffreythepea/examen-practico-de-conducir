# Moving Junction Road Design

**Date:** 2026-08-04
**Status:** Approved

## Purpose

Add a bounded forward-motion experiment to the live web game using the existing
realistic four-way-junction photograph. The exercise should feel more like
approaching a real junction while preserving the game's current language
comprehension, scoring, accessibility, offline, and recovery behavior.

This is the first production movement experiment. It is intentionally smaller
than a driving simulation and must be easy to disable.

## Scope

The first release applies only to realistic four-way-junction questions whose
accepted action is left, straight, or right.

The release does not animate:

- roundabouts;
- overtaking;
- parking or voluntary stopping;
- U-turns;
- vehicle prechecks or controls; or
- any experimental SwiftUI surface.

No command ID, action ID, phrasing ID, Spanish wording, English translation,
surface ID, accepted result, scoring rule, readiness record, or lesson-flag
behavior changes.

## Setup

Add a bilingual setup preference:

| Locale | Label | Values |
| --- | --- | --- |
| English | Road movement | On / Off |
| Spanish | Movimiento de la carretera | Activado / Desactivado |

The default is On. The preference is stored with the existing setup
preferences and applies when a new session begins. Changing it does not mutate
an active command.

Road movement is also disabled whenever the browser reports
`prefers-reduced-motion: reduce`. In that case the static junction is used even
if the saved preference is On.

## Visual Treatment

Use the approved **camera push-in** treatment:

- Keep the learner vehicle fixed near the bottom-center entry point.
- Animate the complete existing four-way-junction photograph toward the
  learner vehicle with a CSS transform.
- Use one smooth CSS ease-in/ease-out curve lasting six seconds. Rerenders
  resume that same global curve rather than restarting the easing.
- Stop the approach just before the learner vehicle would enter the junction.
- Do not add canvas rendering, video, a physics engine, or new image assets.

The photograph, road targets, and reveal-route overlay remain inside one
transformed scene coordinate system. Targets and feedback therefore move with
the road rather than being recalculated independently in viewport coordinates.

When movement is disabled, the current static photograph, target positions,
and reveal presentation remain unchanged.

## Interaction Sequence

### Initial playback

1. The command screen renders at the start of the approach.
2. Initial Spanish audio playback and the road approach begin together.
3. The left, straight, and right targets are visible but unavailable during
   initial playback.
4. Successful completion of initial playback unlocks the targets.
5. The road continues approaching until the learner answers or the six-second
   approach reaches its waiting position.

If the recording is longer than the approach, the road holds at the waiting
position and the targets unlock when playback completes.

### Answering

The learner may answer as soon as the targets unlock, including while the road
is still moving. On selection:

- road motion freezes immediately;
- the existing accepted-result evaluation runs;
- the existing correct or incorrect feedback sound runs;
- the existing reveal route, markers, explanation, scoring, readiness, and
  lesson-note behavior run without modification.

### Waiting

If no answer is selected before the approach completes, the road freezes just
before the junction and waits indefinitely when Timing is Off.

When the learner explicitly enables the existing Timing setting, its existing
countdown and timeout behavior begins when the targets unlock. Road movement
does not introduce a second timer or a separate automatic failure.

### Replay

Replay repeats the Spanish audio without resetting, restarting, pausing, or
otherwise changing the road position. If the road has already reached its
waiting position, it remains there during replay.

## Motion States

Implement the behavior through a small motion controller with four externally
observable states:

1. **Static** — movement preference is Off, reduced motion is requested, or
   motion initialization has failed. Targets follow existing static behavior.
2. **Approaching, locked** — initial playback and the approach have begun, but
   targets are not selectable.
3. **Approaching, interactive** — initial playback completed successfully;
   targets are selectable while the approach continues.
4. **Waiting** — the approach reached its endpoint and is frozen; targets are
   selectable after successful initial playback.

Answer evaluation terminates motion from either interactive state. Replay does
not cause a state transition.

The motion controller owns animation state and timing only. The junction
surface continues to own target definitions, accepted results, and reveal
content. The app controller coordinates audio events, answer selection, and
the motion controller through explicit calls rather than embedding animation
logic in command data.

## Failure and Recovery

- If movement initialization fails, render the static junction and continue the
  exercise.
- If initial audio fails under the existing recorded-audio and speech-fallback
  policy, stop or reset motion and preserve the current unscored audio-failure
  behavior. The learner must not be stranded in a moving, locked scene.
- Replay failure uses the existing replay error behavior and does not alter the
  road position.
- A missing or invalid saved movement preference resolves to the default On,
  subject to reduced-motion override.
- No provider credential or runtime network request is added.

## Accessibility

- Targets retain their current semantic buttons and accessible names.
- Locked targets use real disabled behavior and cannot be activated by touch,
  keyboard, or assistive technology.
- Unlocking targets does not move focus unexpectedly.
- Reduced-motion users receive the complete static exercise with identical
  scoring and content.
- The learner never needs to perceive animation to answer correctly.
- All new interface copy exists in English and Spanish.

## Offline and Performance Requirements

- Reuse the already packaged realistic junction image.
- Add no runtime dependency and no network-loaded asset.
- Keep animation on transform-only CSS where practical.
- Preserve service-worker completeness and offline installation.
- Avoid continuously running animation work after the answer or waiting
  position has been reached.

## Verification

### Automated tests

Add or extend tests for:

- all legal motion-state transitions;
- simultaneous initial playback and approach start;
- targets remaining unavailable until initial playback completes;
- unlocking after recorded audio and browser speech fallback;
- replay leaving road progress unchanged;
- freezing at the waiting position;
- freezing immediately on answer selection;
- Timing Off waiting indefinitely;
- Timing On preserving the existing countdown behavior;
- setup preference defaults, persistence, and bilingual copy;
- static behavior when movement is Off;
- static behavior under `prefers-reduced-motion`;
- safe static fallback after motion initialization failure;
- unscored recovery after initial audio failure;
- target alignment through the shared transformed coordinate system;
- unchanged accepted results, scoring, readiness, and reveal behavior; and
- no regressions to other static road surfaces.

The pre-release gates remain:

```text
npm test
git diff --check
```

### Manual review

Review on iPad in landscape and portrait:

- recorded audio;
- browser speech fallback;
- target alignment early, midway, and at the waiting position;
- answering during movement;
- answering after movement stops;
- replay during movement and after waiting;
- Timing On and Off;
- Road movement On and Off;
- reduced-motion mode;
- offline installed use; and
- correct and incorrect reveal transitions.

## Rollback

The learner can immediately return to the current static experience by setting
Road movement to Off.

At code level, the motion controller and junction-only integration are isolated
from command data and evaluation. Removing that integration restores the
existing static surface without catalog migration or progress-data changes.

## Deferred Work

The following require separate design and implementation cycles:

- moving roundabouts;
- moving overtaking, parking, stopping, or U-turn scenes;
- lane steering or continuous player control;
- collision, speed, or vehicle physics;
- parallax or newly segmented artwork;
- sound effects tied to vehicle movement; and
- extending the experiment to SwiftUI.
