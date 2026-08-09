# Post-Answer Car Motion — Scoping (F4)

**Status:** Scoping complete. All four open questions resolved. Not yet approved for
implementation — still needs a go-ahead to start Task 1.

**Direction (2026-08-09):**
- Q1 sprite strategy: **one generic car glyph**, reused across all families/themes.
- Q2 trail behavior: **no trail, car only** — the route line does not draw in behind
  the car. Confirms F4 subsumes F2 rather than needing a separate line-vestige fix first.
- Q3 viewbox aspect ratio: **confirmed real, root-caused, fix identified** — see below.
- Q4 family coverage: **extend to `u-turn`, `overtake`, `join-traffic`** alongside the
  four already-wired families.

**Question being scoped:** how big a job is it to replace the current line-based
post-answer animation (F2's buggy vestige-line effect lives here too) with a car sprite
that visibly moves along the route, instead of an animated line trace?

---

## Current architecture (as of `main` @ `f4c4295`)

- **State/reducer** — `src/post-answer-motion.js`: `createPostAnswerMotion` /
  `reducePostAnswerMotion` / `postAnswerMotionView`. Pure, validated state machine:
  `static → running → complete`, driven by `family`, a `route` (array of `{x,y}` in
  0–100 stage units, ≥2 points), `startedAt`, and a per-family `durationMs`
  (`app.js:86`, `POST_ANSWER_MOTION_DURATIONS`). No DOM, no timers — `postAnswerMotionView(state, now)`
  is a pure function of wall-clock time, same pattern as `road-motion.js`.
- **Render** — `src/post-answer-motion-view.js`: `renderPostAnswerMotion(viewModel)` emits
  an SVG `<path>` (the route, drawn via `stroke-dasharray/dashoffset` CSS animation) plus
  a `<circle>` marker riding an `<animateMotion>` along that same path. Timing is passed
  as CSS custom properties (`--post-answer-motion-duration/elapsed/remaining`) so the
  browser's native animation stays in sync with server-computed progress — no rAF loop.
- **Wiring** — `src/app.js:100` `createSavedPostAnswerMotion` gates eligibility: reveal
  screen, correct answer, unaided/assisted outcome, road movement + reduced-motion
  settings, and family membership in `POST_ANSWER_MOTION_FAMILIES` (`junction`,
  `roundabout`, `parking`, `stopping` — note `u-turn`, `overtake`, `join-traffic` are
  **not** currently wired to any post-answer motion at all).
- **Route data** — already exists per surface, reusable as-is:
  - `src/manoeuvre-surfaces.js`: `parking-v1` / `stopping-v1` templates carry literal
    `correctRoute: [{x,y}, ...]` arrays (hand-authored waypoints in 0–100 stage space).
  - `src/spatial-surfaces.js`: `junction-v2` builds a 3-point route to the target;
    `roundabout-v2` builds `correctRoute` via `roundaboutRoute(...)` from the circle
    geometry, entry angle, and exit join point.
- **CSS** — `styles.css:580-634`. The static `[data-correct-route]` ghost (rendered
  separately, always-on when `state.reveal`) is dimmed to 25% opacity via
  `:has(.post-answer-motion)` whenever the animated overlay is present, so the two
  aren't meant to show at full strength simultaneously. `road-motion.js` (approach
  zoom-in) is a **separate, unrelated animation** — it scales/zooms the whole photo
  before the answer, gated the same way (`roadMovement` setting + `prefers-reduced-motion`).

## Key finding that shrinks the scope

SVG's native `<animateMotion>` supports `rotate="auto"`, which orients an element to
follow the path's tangent automatically — no manual heading/angle computation needed.
That means the existing `{x,y}` waypoint arrays likely need **no reshaping**: swapping
the `<circle>` marker for a car glyph (`<path>`/`<use>`) and adding `rotate="auto"` to
the existing `<animateMotion>` element in `post-answer-motion-view.js` should be enough
to get correctly-oriented motion, reusing every other part of the pipeline (state
machine, duration/elapsed timing, CSS custom properties, reduced-motion gate) untouched.

This also means **F4 absorbs F2** (no standalone F2 fix planned): a separate background
session root-caused half of F2 — the reveal screen renders both `[data-correct-route]`
(static, always-on when `state.reveal`) and `.post-answer-motion-route` (animated
draw-in) on the *same path* simultaneously, and `styles.css:620-623` only dims the
static line to `opacity: 0.25` via `:has()`, never hiding it — confirmed live in-browser,
not stale DOM (`render()` replaces `app.innerHTML` wholesale each time). The viewbox
check below (Q3) found the other half: the two paths aren't even drawn with the *same
geometry* in a non-square container. Since F4's direction is "car only, no trail" (Q2),
both causes disappear once F4 lands — no separate cleanup fix needed first.

## Open questions — all resolved 2026-08-09

1. **Sprite strategy** — **one generic top-down car glyph**, reused across all
   families/themes (not per-scene art matching the Yaris imagery in
   `src/yaris-surfaces.js` / `src/control-surfaces.js`). One asset, no per-photo art
   direction needed.
2. **Trail behavior** — **no trail.** The car moves with no persistent route line; the
   existing dimmed-ghost `[data-correct-route]` is dropped for these families rather
   than kept alongside the car.
3. **Viewbox aspect-ratio check** — **confirmed real, and it's worse than "a car glyph
   would stretch."** The container aspect ratio varies by family
   (`styles.css:444-465`): default `.surface-stage` is square (1:1), `.precheck` is
   4:3, and — critically — `.driving-photo-stage` (junction, roundabout, parking,
   stopping: every family post-answer-motion currently targets) is **3:2**. Two SVGs
   share the same `{x,y}` 0–100 data but scale it differently:
   - The main scene SVG (`manoeuvre-surfaces.js:262`, `spatial-surfaces.js:168`) sets
     `preserveAspectRatio="none"` whenever a photo `scene` is present, **stretching**
     the 100×100 space non-uniformly to fill the real 3:2 box. This is what draws
     `[data-correct-route]`.
   - The post-answer-motion SVG (`post-answer-motion-view.js:42`) has no
     `preserveAspectRatio` override, so it defaults to `xMidYMid meet` — it scales
     **uniformly** and pillarboxes (centers with empty space left/right) instead of
     stretching. `styles.css:455`'s `.surface-stage svg { width:100%; height:100%; }`
     is a bare descendant selector, so it sizes both SVGs identically; only the
     `preserveAspectRatio` attribute differs.
   - Net effect: for every currently-wired family, the same `{x,y}` point renders at
     **two different physical pixel positions** between the static route and the
     animated overlay. That's a second, independent contributor to F2's vestige-line
     report beyond the opacity issue above — the two paths aren't just duplicated at
     different opacity, they're genuinely misaligned in a non-square stage.
   - **Fix**, needed regardless of glyph vs. line: give the post-answer-motion SVG the
     same `preserveAspectRatio="none"` (or better, resolve both SVGs' scaling from one
     shared per-family aspect-ratio source instead of hardcoding the attribute twice).
     With matching scaling, `rotate="auto"` on `<animateMotion>` will also produce the
     correct on-screen heading — computed tangents in the stretched 100×100 space match
     what's actually stretched to the 3:2 box, since both dimensions get the *same*
     treatment as the path itself once the two SVGs agree.
4. **Family coverage** — **extend to `u-turn`, `overtake`, `join-traffic`** alongside
   the four already-wired families. They already carry `correctRoute` data in
   `manoeuvre-surfaces.js` (confirmed: `MANOEUVRE_FAMILY` mapping at
   `manoeuvre-surfaces.js:156-160` gives them `family: 'u-turn'` / `'overtake'` /
   `'join-traffic'`) — wiring them in is adding three entries to
   `POST_ANSWER_MOTION_FAMILIES` (`post-answer-motion.js:7`),
   `POST_ANSWER_MOTION_FAMILY_SET`, and `POST_ANSWER_MOTION_DURATIONS` (`app.js:85-90`),
   not new plumbing. Confirm reasonable per-family durations before wiring (existing
   four families each have a hand-picked `durationMs`; the new three need the same).

## Task shape (matching this repo's existing plan style) — awaiting go-ahead to start

### Task 1 — Fix viewbox scaling, then swap the marker for a car glyph
**Files:** `tests/post-answer-motion-view.test.js`, `src/post-answer-motion-view.js`, new
asset (SVG glyph, inline or referenced).
1. Add a test asserting the post-answer-motion SVG's `preserveAspectRatio` matches the
   main scene SVG's for the same family (both `none` for photo-backed families) — this
   is the Q3 fix and should land *before* the glyph swap so rotation math is verified
   against correct scaling from the start, not against the current pillarboxed bug.
2. Add tests asserting the rendered marker is a car glyph with `rotate="auto"` on its
   `<animateMotion>`, orientation baseline matches "pointing along +x" (SVG path tangent
   convention), and existing progress/timing assertions still hold.
3. Swap the `<circle>` marker for the glyph; verify against a couple of hand-checked
   waypoint sequences that rotation looks right at both shallow and sharp turns, now that
   both SVGs agree on scaling.

### Task 2 — Drop the static route ghost
**Files:** `styles.css`, possibly `src/manoeuvre-surfaces.js` / `src/spatial-surfaces.js`
(wherever `[data-correct-route]` is emitted).
1. Remove or hide `[data-correct-route]` whenever post-answer-motion is eligible, per
   the decided "car only, no trail" direction (Q2).
2. Re-verify F2's reported vestige-line repro (driving-phase session, road movement on,
   several junction/roundabout answers) no longer reproduces.

### Task 3 — Extend family coverage
**Files:** `src/post-answer-motion.js`, `src/app.js`.
1. Add `u-turn`, `overtake`, `join-traffic` to `POST_ANSWER_MOTION_FAMILIES`,
   `POST_ANSWER_MOTION_FAMILY_SET`, and `POST_ANSWER_MOTION_DURATIONS` with reviewed
   per-family durations.
2. Confirm each family's existing `correctRoute` renders sensibly with the car glyph —
   these routes were authored for a static/dimmed line, not necessarily tuned for a
   moving sprite's pacing.

### Task 4 — Verification
1. Run `npm test`.
2. Run `git diff --check`.
3. Serve the isolated worktree and visually check all seven families' post-answer
   motion at an iPad landscape viewport, with and without `prefers-reduced-motion`.
