# Road Route and Target Alignment Implementation Plan

**Goal:** Add clear post-answer movement traces for parking and voluntary stopping, and calibrate roundabout targets/routes to the photographed road mouths.

**Architecture:** Keep surface generation deterministic and data-driven. Add reviewed route templates to parking/stopping scenarios, with their endpoint substituted from the generated correct target. Replace roundabout polar target placement with per-photo anchor coordinates plus tightly bounded seeded jitter, while retaining angular data for circular route construction.

**Tech stack:** Browser-native JavaScript modules, Node test runner, server-rendered HTML/SVG overlays.

---

## Task 1: Parking and voluntary-stop movement traces

**Files:**
- Modify: `tests/manoeuvre-surfaces.test.js`
- Modify: `src/manoeuvre-surfaces.js`

1. Add tests requiring every parking and stopping model to expose a correct route whose endpoint exactly matches its accepted target.
2. Assert parking routes begin ahead of the learner vehicle, bend right, and finish in the photographed curbside gap.
3. Assert stopping routes begin ahead of the learner vehicle and finish at the legal curb target below the driveway.
4. Assert prompt markup omits the route and revealed markup includes it.
5. Run the focused test and confirm the new assertions fail.
6. Add reviewed `correctRoute` arrays to both parking templates and both stopping templates.
7. Run the focused test and confirm it passes.

## Task 2: Photo-calibrated roundabout targets and routes

**Files:**
- Modify: `tests/spatial-surfaces.test.js`
- Modify: `src/spatial-surfaces.js`

1. Tighten tests to require every target across many seeds to remain within a small road-mouth region for its four- or five-exit photograph.
2. Add route assertions requiring the feedback route to finish exactly at the accepted target and enter through the corresponding photographed road mouth.
3. Preserve tests for seeded reproducibility, subtle variation, bottom entry, counterclockwise numbering, target sizing, and four/five-exit distribution.
4. Run the focused test and confirm the new assertions fail.
5. Define ordered per-photo target anchors and per-exit roundabout join points.
6. Apply small two-dimensional seeded jitter constrained to each road-mouth region.
7. Use the reviewed join point for the final route segment and the generated target as its endpoint.
8. Run the focused test and confirm it passes.

## Task 3: Verification

**Files:** No additional production files expected.

1. Run `npm test`.
2. Run `git diff --check`.
3. Serve the isolated worktree and visually inspect parking, stopping, four-exit roundabout, and five-exit roundabout feedback at an iPad landscape viewport.
4. Record any residual visual alignment issue before offering the isolated diff for integration.
