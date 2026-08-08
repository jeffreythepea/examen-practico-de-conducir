# Solo E3 Correct Post-Answer Movement Design

**Date:** 2026-08-08
**Status:** Implemented and accepted on physical iPad
**Roadmap scope:** First bounded Solo E3 sensory-and-physical-consequence slice
**Depends on:**
`2026-08-06-solo-engagement-roadmap-design.md`,
`2026-08-05-expanded-road-motion-design.md`, and
`2026-08-07-simulated-exam-continuity-design.md`

## Purpose

Make a correct road choice feel like an action the learner completed rather
than a static answer reveal. After the app has scored and saved a correct
answer, the existing photographed surface briefly follows the accepted route
to its endpoint.

This first slice is deliberately narrower than the full Solo E3 roadmap. It
covers representative junction, roundabout, parking, and voluntary-pull-over
surfaces. It does not add wrong-choice consequences, crashes, vehicle sounds,
ambience, physics, new road art, or new scoring rules.

## Product Boundary

The movement is presentational feedback attached to the existing reveal. It is
not a new answer screen, transition, attempt, timer, or readiness signal.

It may run only when all of the following are true:

- `recordAttempt` has returned a scored attempt and that state has been saved;
- the attempt outcome is correct, either unaided or text-assisted;
- the active surface is one of the reviewed first-slice families;
- the experience uses immediate reveal;
- Road movement is On;
- the browser does not request reduced motion.

An incorrect answer, timeout, audio failure, unscored surface state, Road
movement Off, reduced-motion preference, or unsupported family keeps the
existing static reveal. Nothing waits for or retries decorative movement.

### Mock-test exclusion

Mock withholds correctness until the drive ends. A consequence that appears
only after correct answers would reveal correctness, so this slice must not run
during live Mock commands or neutral Mock transitions. A later design may add
movement inside deferred per-command review or may define a non-revealing
chosen-action consequence. Neither is part of this work.

## Protected Invariants

- Existing scoring, attempts, readiness, response timing, feedback cues, miss
  reasons, session summaries, and Mock pass logic do not change.
- Existing command, action, accepted-result, phrasing, surface, target, scene,
  examiner, voice, and audio IDs do not change.
- The attempt is recorded and local state is saved before movement starts.
- Correct movement never creates, edits, repeats, or delays an attempt.
- Continue remains available throughout the animation; leaving the reveal
  cancels it naturally.
- Existing correct-route geometry remains the source of truth. The animation
  cannot alter targets or accepted results.
- Reload after a scored answer follows existing next-command recovery. The
  decorative animation is not serialized or resumed.
- Reduced-motion and Road movement Off retain the complete static reveal,
  including accepted route, correct marker, labels, and explanation.
- No new provider call, credential, network request, or runtime dependency is
  introduced. All markup, styles, and geometry ship in the offline package.
- If interface copy is added later, it must exist in English and Spanish. The
  preferred first slice adds no copy.
- The bilingual AI-voice disclosure remains visible.

## Representative Families

### Junction

Supported surface: `junction-v2` on
`four-way-intersection-photo-v1`.

After a correct left, straight, or right choice, the gold route draws from the
bottom entry through the junction to the accepted road mouth. A compact
code-native learner-position marker follows the same route and settles inside
the accepted target. The marker is decorative and hidden from assistive
technology.

### Roundabout

Supported surface: `roundabout-v2` on the four- and five-exit photographs.

The route follows the already calibrated entry, circular lane, lane join, and
accepted exit mouth. Duration may be slightly longer than the junction so the
exit number remains visually legible. The animation must use the exact
generated model, including its selected four- or five-exit layout; it cannot
recalculate an ordinal from display order.

### Parking and pull-over

Supported surfaces:

- `parking-v1` on `parallel-parking-gap-photo-v1`;
- `stopping-v1` on `urban-roadside-photo-v1`.

The gold route draws from the learner vehicle toward the reviewed legal target,
and the learner-position marker follows it. The route ends fully inside the
correct space or clear curb area. It must not imply steering technique,
reversing order, observation sequence, or a legal rule beyond the already
reviewed accepted target. These two scenes retain their provisional
lesson-validation note.

## Visual Contract

The first slice reuses the current route overlays rather than generating new
photographs or modifying embedded cars. The animated layer consists of:

1. the existing gold route, progressively revealed from entry to endpoint;
2. a small, restrained code-native learner-position marker moving along that
   route;
3. the existing correct target marker and result label, which remain static.

The moving marker is a feedback token, not a second photorealistic car. It
starts over the route entry, remains within the scene, and fades or settles at
the endpoint. It must not cover the answer label or make the embedded learner
vehicle harder to interpret. If visual review shows that the marker creates a
confusing duplicate vehicle, the accepted rollback within this slice is to
animate only the route draw; new photo editing is out of scope.

Recommended initial durations are:

- junction: 1.1 to 1.4 seconds;
- roundabout: 1.4 to 1.8 seconds;
- parking and pull-over: 1.2 to 1.6 seconds.

Duration is presentational and cannot affect Continue, scoring, response time,
or the next active-session index.

## Motion Contract

A new pure module owns a small immutable post-answer state. Suggested public
shape:

```js
{
  phase: 'static' | 'running' | 'complete',
  family: 'junction' | 'roundabout' | 'parking' | 'stopping' | null,
  startedAt: number | null,
  durationMs: number,
  route: readonly [{ x: number, y: number }]
}
```

The exact exported names may follow project conventions, but the contract must:

- accept only deeply frozen, JSON-safe route points derived from the retained
  surface model;
- whitelist the four first-slice families;
- reject malformed, empty, non-finite, or out-of-stage routes;
- expose deterministic progress for an injected time;
- settle idempotently at completion;
- return `static` for disabled or ineligible cases;
- never inspect or calculate correctness itself.

Correctness and scored status remain controller-owned inputs. This prevents a
presentation module from becoming a second scoring engine.

## Geometry Contract

The surface model must expose one immutable `correctRoute` point sequence for
each supported generated scenario. Junction and roundabout renderers currently
construct part of this route only during reveal; implementation should move
that calculation into pure generation or a shared pure helper, then render and
animate the same retained points.

For every reviewed seed:

- the first point begins at the photographed learner entry;
- the final point lies inside the accepted target;
- all intermediate points stay inside the 0–100 stage;
- roundabout routes use the retained `routeCircle`, `exitJoins`, and target;
- parking and stopping use their existing reviewed template route;
- route derivation never reads a selected wrong target.

The route line, moving marker, and correct result must therefore agree by
construction.

## Controller Lifecycle

The existing `completeTrial` boundary already records an attempt, advances the
active session, and calls `saveState` before rendering the reveal. Integration
must preserve that ordering:

1. reduce the learner response to the existing reveal outcome;
2. call `recordAttempt` exactly once;
3. advance and save active-session state exactly as today;
4. only after a successful save, dispatch a presentation-only
   post-answer-start event when the saved attempt is correct and eligible;
5. render the disabled reveal surface with the motion view;
6. settle on animation completion, or simply abandon it on Continue,
   navigation, visibility change, or rendering failure.

The initial reducer transition to reveal may contain a static post-answer
state, but it must not start the animation before step 4. This ordering is a
testable safety boundary.

No active-session or storage schema migration is required. Locale rerenders
use the retained `startedAt` so they do not restart a running consequence.

## Accessibility and Failure Behavior

- `prefers-reduced-motion: reduce` disables route drawing and marker movement,
  even when the saved Road movement setting is On.
- Road movement Off behaves the same way.
- The reveal heading remains the single outcome announcement. Decorative
  movement adds no live-region updates.
- The marker and route are `aria-hidden`; the existing localized expected
  action and result label provide the meaning.
- Continue retains its current focus and minimum touch target and is never
  disabled by motion.
- Animation cancellation or DOM API failure leaves the existing static reveal
  rather than an error, retry, or unscored state.
- No flashing, rapid oscillation, camera shake, crash, or collision is used.

## Offline and Performance

The feature uses existing packaged photographs, code-native SVG/CSS, and one
small imported module. It adds no audio, video, image, font, library, backend,
or network request. The deterministic runtime allowlist and service-worker
package must include the new module automatically through the reviewed build
path, and release tests must verify this.

The implementation should animate only transform, route stroke progress, and
marker position. It must avoid rebuilding the surface model per frame. iPad
landscape review must show stable targets, labels, and Continue control with no
horizontal overflow or dropped interaction.

## Explicit Non-Goals

- Any movement after an incorrect answer or timeout
- Crash, collision, wrong-lane, curb-strike, or punitive animation
- Live correct-only movement during Mock
- U-turn, overtaking, joining traffic, or vehicle-control consequences
- New road or vehicle imagery
- Full driving simulation, steering physics, or continuously moving roads
- Ambience, indicator sounds, engine sounds, or other vehicle cues
- New scoring, bonuses, achievements, readiness rules, or persistence fields
- Changing the existing six-second pre-answer approach

## Rollback Boundary

This slice must remain removable without catalog, attempt, storage, audio, or
asset migration. Its expected boundary is:

- one pure post-answer-motion module and focused tests;
- route-geometry exposure in the spatial/manoeuvre models;
- renderer options and a clearly delimited CSS section;
- a small controller hook that starts motion only after saved scoring;
- runtime-package and release documentation updates.

Rollback removes those hooks and the new module/styles. Existing static
correct-route reveals, photographs, targets, approach motion, scoring, and
active-session recovery remain intact. Each implementation task must preserve a
green checkpoint at which that rollback can be performed mechanically.

## Acceptance Gate

- A correct unaided or assisted junction, roundabout, parking, or stopping
  answer animates only after the attempt is saved.
- Incorrect, timeout, unsupported, Road movement Off, reduced-motion, and live
  Mock cases remain static.
- Continue works immediately during movement and no attempt is duplicated.
- Route, marker, accepted target, and explanation agree across reviewed seed
  sweeps.
- The feature works without a network after the verified package is installed.
- English and Spanish reveal layouts remain unchanged unless bilingual copy is
  explicitly approved.
- Focused tests, `npm test`, `npm run release:check`, and `git diff --check`
  pass.
- Jeffrey accepts representative junction, roundabout, parking, and pull-over
  examples on physical iPad before release.
