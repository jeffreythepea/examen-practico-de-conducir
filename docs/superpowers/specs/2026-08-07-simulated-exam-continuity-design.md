# Simulated Exam Continuity Design

**Date:** 2026-08-07
**Status:** Approved with content additions
**Roadmap scope:** Solo continuity experiment after examiner modes and expanded
road motion
**Depends on:**
`2026-08-06-solo-engagement-roadmap-design.md` and
`2026-08-06-examiner-modes-themed-drives-live-integration-design.md`

## Purpose

Make Full Mock feel like one continuous simulated driving exam instead of a
series of disconnected quiz cards. The experience begins with prechecks,
bridges into starting and moving the vehicle, continues through driving
commands separated by brief straight-driving scenes, and ends by stopping and
securing the vehicle before results.

This is a disclosed simulation. It must not claim to reproduce the number,
order, route, scoring, or procedure of an official Asturias or DGT practical
test. Real lesson evidence may later replace its provisional sequence.

## Product Boundary

The first production slice applies only when both of these are true:

- experience mode is Mock;
- theme is Full mock.

Learn, Practice, Adaptive practice, and the other themed drives retain their
current construction, ordering, prompt, reveal, and persistence behavior.
Road movement On animates the transitions. Turning it Off retains the ordered
simulated route but renders
static, short transition frames. Reduced-motion preference removes camera
movement while preserving the same sequence and readable context.

The complete feature must remain easy to roll back by removing the continuity
planner and controller integration without rewriting attempts, readiness, or
the command catalog.

## Protected Invariants

- Existing command, phrasing, action, accepted-result, surface, examiner,
  voice, and audio IDs do not change.
- A transition is never a scored attempt and never affects readiness.
- A command is scored exactly once, including across reloads during a
  transition.
- Mock continues to withhold correctness and diagnostic information until the
  results screen.
- Command audio begins only after a transition finishes or is skipped.
- Audio failure remains unscored and does not advance the route.
- Every new interface string exists in English and Spanish.
- Every generated command recording remains Spanish.
- No provider credential enters Git or a browser-delivered file.
- Existing schema-4 saves and active-session-v2 snapshots remain readable.
- The bilingual AI-voice disclosure remains visible.

## Experience Sequence

### 1. Opening

The existing session identity identifies the selected examiner and Full mock
theme. A compact bilingual notice says that the route order is simulated. No
new recorded greeting is required for the first slice.

### 2. Precheck chapter

All selected precheck commands appear before driving commands. Their relative
order is deterministic for the snapshotted session but should vary between new
sessions through the existing injected session randomness. No driving
cutscene appears between individual prechecks.

The first slice does not claim that the selected count matches a real exam.

### 3. Start and departure chapter

A new scored language command for starting the engine belongs
between the last precheck and the departure scene. Its exact Spanish wording,
English meaning, generic-manual response surface, provenance status, and
recordings are governed by the approved content contract below.

Approved examiner wordings are:

- canonical: `Arranque el motor.`
- supplementary variation: `Ponga el motor en marcha.`

The command teaches the semantic action **start the engine** without claiming
a vehicle-specific ignition layout or an instructor-validated procedure.
`Arranque el motor` is supported by Jeffrey's reported examiner-language
experience on 2026-08-07; the earlier source comparison also records it as a
composite-list command that was absent from the Fermin guide. The catalog must
state that provenance rather than attribute it to the guide.

Until that content slice is implemented and recorded, the continuity feature may
use a silent, unscored **Preparing to drive** bridge. It must not display or
speak an invented Spanish command.

After the engine-start step, the approved new scored command
`Incorpórese a la circulación` tests joining the flow of traffic. Its English
meaning is **join the traffic flow** and its expected action is **pull away
safely and merge into circulation**. Its provenance is review-derived,
instructor-plausible wording approved by Jeffrey on 2026-08-07; it must not be
attributed to the Fermin guide. The departure scene then shows the consequence
of that accepted action.

### 4. Driving chapter

Driving commands other than test completion and immobilization form the main
route. Between them, the app shows a short straight-driving transition:

- target duration: 1.5 to 2.5 seconds;
- tap anywhere or activate a visible bilingual Skip button to continue;
- no answer target, timer, score, or feedback cue;
- selected examiner and route progress remain visible;
- the next Spanish command does not start until the scene has settled;
- transitions rotate deterministically among a small audited set so the same
  session resumes consistently.

The first slice reuses existing audited, photo-backed road scenes and the
current camera push-in system. It does not require video, WebGL, newly generated
road art, or a continuously simulated vehicle physics model.

### 5. Finish chapter

When present, `c-final` occurs after the other driving commands. `c-inmov`
follows it as the final scored vehicle action. This is a provisional narrative
order, not an official-test claim.

After immobilization, a short static or moving parked-vehicle frame leads to
the existing deferred Mock results. Results and readiness evidence remain
unchanged.

If either terminal command is absent from a selected session, the planner does
not fabricate it. It closes the route after the last available scored command.

## Pure Route Plan

A new pure domain module builds an immutable route from already-selected Mock
session items. It never selects audio, mutates the catalog, or creates an
attempt. Its output contains two kinds of stable step records:

```js
{ kind: 'command', itemIndex: 3, commandId: 'c-der', chapter: 'driving' }
{ kind: 'transition', id: 'cruise-3-4', sceneId: 'rural-straight', chapter: 'driving' }
```

The planner:

1. partitions selected items into precheck, ordinary driving, `c-final`, and
   `c-inmov` groups;
2. preserves each group's selected relative order;
3. emits the groups in the reviewed narrative order;
4. inserts only approved transition types;
5. returns stable deterministic IDs and deeply frozen caller-independent
   records;
6. rejects duplicate item indexes or unknown phase data rather than silently
   repairing a malformed session.

The planner may expose the future engine-start slot without inventing a command
item. Production integration decides whether that slot is the approved scored
command or the temporary unscored preparation bridge.

## Transition Presentation

The presentation module receives a transition view model and returns escaped
markup. It does not own timers, audio, persistence, command ordering, or screen
state.

Initial reusable scene families are:

- **departure:** pull away from rest into a straight road;
- **urban cruise:** brief forward motion on the audited urban street;
- **rural cruise:** brief forward motion on the audited rural/overtaking road;
- **arrival:** settle at the roadside before the terminal actions;
- **parked:** motionless or minimal closing frame before results.

The scene can use the existing calibrated transform vocabulary. Targets,
correct-route lines, status marks, and answer labels are never rendered in a
cutscene. The learner car remains visually anchored near the lower edge.

Accessibility requirements:

- transition text is announced once as a status, not continuously during
  animation;
- Skip is a real button with a 44px minimum target and visible focus;
- tapping the decorative scene is an additional shortcut, not the only
  control;
- reduced motion uses a static image and short dissolve;
- no essential meaning depends on motion, color, or sound;
- English and Spanish layouts fit iPad landscape without horizontal scrolling.

## Controller and Persistence

Codex retains this integration because it crosses scoring and recovery
boundaries.

Active-session version 3 adds one optional continuity snapshot for eligible
Full Mock sessions. It stores the immutable route plan plus the next route-step
index. It does not serialize timers, DOM state, image objects, or animation
progress.

After a scored response, one save must atomically contain:

- the new attempt;
- the advanced command `nextIndex`;
- the route-step index pointing to the pending transition or next command.

Completing or skipping a transition advances only the route-step index. On
reload during a transition, the transition restarts from its beginning; it
does not repeat the preceding scored command. On reload during a command, the
existing exact unanswered-command recovery remains unchanged.

Version-2 sessions normalize to continuity disabled and resume exactly as they
do now. A catalog or route-plan mismatch clears only resumability and preserves
attempt history and lesson flags.

## Approved New-Command Content Contract

The two new commands are separate catalog changes, not cutscene details.
Implementation must preserve these approved boundaries:

1. `c-arr` uses canonical `Arranque el motor` and supplementary
   `Ponga el motor en marcha`, both mapping to the same `start-engine` action
   and accepted result.
2. `c-incorp` uses canonical `Incorpórese a la circulación`, mapping to one
   `join-traffic` action and accepted result.
3. Both use explicitly review-derived/composite provenance and do not claim
   Fermin-guide support.
4. The first engine-start surface tests the semantic action, not an unverified
   clutch/neutral/ignition sequence.
5. The joining-traffic surface shows the learner car pulling from the roadside
   into the correct lane without teaching a full traffic-gap simulation.

The recommended first version tests language comprehension rather than an
unverified mechanical sequence. The existing generator produces one clip per
approved phrasing, examiner, and speed. The two start-engine phrasings plus one
joining-traffic phrasing require 45 clips; the complete catalog becomes 38
commands, 79 phrasings, and 1,185 recorded variants across five examiners and
three speeds.

## Roundabout Artwork Cleanup

The accepted four-exit photograph contains one incomplete lower-right road
branch inherited from the five-exit composition. It is not a selectable exit
and reads as a stump. Replace it with continuous grass and roadside terrain
while preserving the bottom entry, blue learner car, four complete exits,
central island, camera perspective, target coordinates, and motion
calibration. Keep the original v1 asset as the rollback source and introduce a
versioned v2 asset. The five-exit photograph has five complete exits and does
not require the same repair.

## Delegation Boundaries

### Hermes: pure route foundation

Hermes may create only the new route-planning module, its focused tests, and a
handoff note. It must not touch the catalog, app controller, persistence, UI,
audio, styles, packaging, or existing tests outside its fence.

### Claude Code: transition presentation

Claude may create only a pure transition-view renderer, its focused tests, and
scoped CSS additions. It may reuse existing asset paths but must not add or
generate visual assets. It must not touch app state, persistence, catalog,
audio, service worker, or release scripts.

### Codex: integration and review

Codex reviews both diffs, owns version-3 persistence and live controller
integration, validates bilingual copy, runs browser/iPad checks, and performs
all release gates.

Every delegated slice is resumable: tests are written first, each green
subtask is recorded in its handoff file, model/rate-limit interruption is a
pause rather than permission to restart or broaden scope, and no delegate
commits or pushes.

## Explicitly Deferred

- Claiming an authentic DGT or Asturias sequence.
- A scored pull-away or traffic-entry command without reviewed wording.
- Vehicle-specific start procedure or control placement.
- Continuous physics, steering, traffic, collision, or full driving
  simulation.
- Newly generated video or road imagery.
- Spoken examiner greetings, commentary, or closing dialogue.
- Social, multiplayer, public profile, streak, badge, or leaderboard behavior.

## Approved Decisions

Jeffrey approved these decisions on 2026-08-07:

1. Full Mock plus Road movement as the initial continuity boundary.
2. Prechecks first; ordinary driving; `c-final`; then `c-inmov` as the
   disclosed provisional narrative order.
3. Short automatic transitions with a visible Skip control.
4. A silent unscored preparation bridge until the approved engine-start and
   joining-traffic commands are implemented and recorded.
5. Reusing audited road photography and existing camera motion for the first
   slice.
