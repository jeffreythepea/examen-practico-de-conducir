# Follow-up backlog — examen-practico-de-conducir

Findings from live manual testing after merging A/B/C (main @ `3980426`), plus one open
scoping question. None of these are regressions from that merge — all predate it.

**Status as of 2026-08-10: F1, F2, F4 resolved; F3 partially resolved (the two named
examples fixed; no further issues found in a re-triage, see F3).**

## F1 — `hatched-bay` target misaligned with its photo (parking scenario, medium) — RESOLVED 2026-08-10

Fixed by removing the synthetic `restricted-marking` overlay entirely on photo-backed
scenes (same treatment as the already-suppressed `crosswalk`/`driveway` overlays),
rather than repositioning it — the target's location (mid opposing-lane) already reads
as clearly wrong without an icon. See `src/manoeuvre-surfaces.js` (`featureDrawing`)
and the merged fix. The sibling scenario's `crosswalk-bay`/`no-parking-bay` targets were
checked and were already correctly suppressed/rendered — no change needed there.

Original report below, kept for context.

Command `c-est` (Realice un estacionamiento / park), surfaceId `parking-v1`, scenario
variant `marked-bays-clear-entry` (`src/manoeuvre-surfaces.js`,
`MANOEUVRE_SCENARIOS['parking-v1'][0]`) defines target
`{ id: 'hatched-bay', resultId: 'marked-restriction', kind: 'illegal-space', feature: 'restricted-marking', x: 40, y: 50 }`.

All parking-family scenarios share one photo, `assets/driving/parallel-parking-gap-photo-v1.webp`
(`src/app.js`: `...(contract.family === 'parking' ? { sceneId: 'parallel-parking-gap-photo-v1' } : {})`).
Confirmed live in-browser (2026-08-08): at x:40%,y:50% the target renders an X (via
`featureDrawing`'s `restricted-marking` branch, `src/manoeuvre-surfaces.js` ~line 412) on
plain open road — no hatched/restricted marking is actually visible there, and depending
on the photo's layout it can land on what looks like the opposite/oncoming lane. A
learner has no visual cue for why that square is the wrong choice.

The sibling scenario `curb-bays-clear-space` (same array, second entry) shares the same
photo and has its own targets (`crosswalk-bay`, `no-parking-bay`) — re-check those too,
not just `hatched-bay`.

**Fix options:** reposition the target coordinates to land on something the photo
actually depicts, or give each scenario variant its own dedicated photo. Check
`tests/*.test.js` for coordinate assertions before changing numbers. Verify visually in
a browser, not just via tests — this is fundamentally a visual-alignment issue.

## F2 — Post-answer road-motion animation leaves vestige lines (visual bug, medium) — RESOLVED 2026-08-09

Root cause found while scoping F4 (see below): the post-answer motion overlay used the
SVG default `preserveAspectRatio` ("meet", pillarboxed) while the main scene SVG
stretches with `preserveAspectRatio="none"`. The same `{x,y}` route data was landing at
different pixel positions between the two SVGs — exactly the kind of mismatch that
produces stray/leftover line artifacts. Fixed as part of `285430f` "F4: replace
post-answer line animation with a car glyph, extend coverage", which also removed the
drawn route line entirely (see F4). Verified in this session: `renderPostAnswerMotion`
and the scene SVG both carry `preserveAspectRatio="none"`, and the static
`data-correct-route` line only ever renders when the animated marker isn't present
(mutually exclusive, not layered).

Original report below, kept for context.

Some animated route/direction lines shown after answering a driving command show extra
lines or leftovers of the prior, un-animated line rather than a single clean animated
path. Predates 2026-08-08's work.

Relevant files: `src/road-motion.js` (motion state/reducer), `src/post-answer-motion.js`
/ `src/post-answer-motion-view.js` (post-answer-specific motion), `src/manoeuvre-surfaces.js`
/ `src/spatial-surfaces.js` (surface rendering — draws the `correctRoute` paths, e.g.
`MANOEUVRE_SCENARIOS['parking-v1'][0].correctRoute`). Relevant history: `b8f212a` "Add
correct post-answer road movement", `e050e61` "Add simulated exam continuity", `3ccc0c3`
"Add examiner modes, themed drives, and expanded motion", `db41db8` "Design expanded
road motion", and the (already-implemented) plan at
`docs/superpowers/plans/2026-07-20-road-route-alignment.md`.

Investigate whether: (a) the "before" static line isn't removed/hidden when the
animated line is added, so both render at once; (b) a CSS transition between two `d`
path values produces visible in-between artifacts; or (c) stale DOM nodes from a
previous render survive a re-render (check whether road-motion does direct DOM
manipulation outside `app.js`'s normal `render()`/`app.innerHTML` replacement cycle).

Reproduce: driving-phase session, Road movement: On, answer several junction/roundabout
commands, watch closely after each answer.

**Open question (see F4):** whether to clean up this line-based animation, or replace it
entirely with actual car motion. Decide direction before investing implementation time
in a cleanup that a redesign would throw away.

## F3 — Off-placement targets on roundabouts and precheck controls (medium, needs triage) — PARTIALLY RESOLVED

Jeffrey manually fixed the two originally-named examples in `e628e37` "Fix F3: realign
precheck targets on engine-oil and headlight-ring" (2026-08-09), using a manual
coordinate calibrator against direct pixel comparison. Notably, that commit's message
records that "an earlier automated pass (F3 session) misidentified which printed symbol
was which and landed both targets worse than the pre-existing coordinates" — i.e. a
prior AI attempt at this exact item made it worse, not better.

Re-triaged in this session (2026-08-10): sampled the 4-exit roundabout, 5-exit
roundabout, and the headlight-ring precheck (the exact surface Jeffrey's fix targeted)
live in-browser. Found no obvious remaining misalignment in that sample — consistent
with Jeffrey's fix already covering the reported case. Did not attempt further
coordinate changes beyond that sample, given the documented risk of automated
misidentification above; if more specific instances turn up (ideally with a screenshot,
the way F1 was originally reported), those should go through the same manual
pixel-comparison approach Jeffrey used, not a blind automated pass.

Original report below, kept for context.

Some clickable targets — roundabout exits and precheck controls (e.g. headlight/light
stalks in the Yaris dashboard precheck) — are positioned slightly off from where the
actual control/exit visually is. Longstanding, predates 2026-08-08's work.

Relevant files: roundabout targets in `src/manoeuvre-surfaces.js` and
`src/driving-scenes.js` (photo assets like `roundabout-five-photo-v1`), rendered via
`src/spatial-surfaces.js` (`--target-x`/`--target-y`/`--target-width`/`--target-height`
CSS custom properties, ~line 334); precheck controls in `src/yaris-surfaces.js` and
`src/control-surfaces.js`.

**Approach:** for each affected surface, load it in a browser and compare each target's
rendered `--target-x`/`--target-y` (inspect via
`document.querySelectorAll('[data-target]')`) against where the real control/exit
appears in the photo/illustration. Triage into a punch list first (which targets, by how
much) before changing coordinates — "a little off" across many targets is probably many
small independent fixes, not one root cause. Check `tests/*.test.js` for coordinate
assertions before changing values.

## F4 — Scope replacing post-answer line animation with actual car motion (needs scoping) — RESOLVED 2026-08-09

Decided and implemented same day, in `285430f` "F4: replace post-answer line animation
with a car glyph, extend coverage": a small car glyph now animates along the route
(`animateMotion`, `rotate="auto"`) while moving, and holds a computed final heading when
stopped. Direction taken: "car only, no trail" — the drawn route line is dropped
entirely rather than kept alongside the glyph. Also extended post-answer motion to
u-turn/overtake/join-traffic, which had `correctRoute` data but no motion wiring before.
Fixing this also resolved F2 (see above) as a side effect of the same viewbox fix.

Original scoping question below, kept for context.

Not a bug — an open question raised 2026-08-09: how big a job would it be to replace the
current line-based post-answer animation (see F2) with actual visible movement of the
learner's car sprite along the route, instead of an animated line trace?

To scope: read `src/road-motion.js`, `src/post-answer-motion.js`,
`src/post-answer-motion-view.js`, and how `correctRoute` arrays are currently consumed
per surface (`src/manoeuvre-surfaces.js`, `src/spatial-surfaces.js`). Questions to
answer: what a car-sprite asset would need per surface/theme (rotation to follow the
route heading? a single generic sprite vs. per-scene art?); how much of the existing
route-path data is reusable as-is vs. needs reshaping for sprite motion (e.g. heading
angles between waypoints, not just point coordinates); timing/duration model changes;
CSS vs. requestAnimationFrame-driven motion; interaction with `prefers-reduced-motion`
(existing `movingRoadEnabled` check in `src/app.js` already gates road motion on this —
extend or reuse). Produce a scoped implementation plan (matching the style of
`docs/superpowers/plans/2026-07-20-road-route-alignment.md`) before starting
implementation.
