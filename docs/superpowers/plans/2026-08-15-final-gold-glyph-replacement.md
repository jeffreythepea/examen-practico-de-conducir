# Final Gold-Glyph Replacement Plan

**Date:** 2026-08-15
**Status:** Shipped and verified on Jeffrey's iPad 2026-08-15. The audit
lives at `scripts/audit-gold-glyph.mjs` with its `--check` mode and a
catalog-backed sweep, and `npm run release:check` reports zero active
normal-path consumers. The checklist below was closed out in bulk at that
point, on the evidence of the shipped result rather than a line-by-line
re-verification.
**Goal:** Replace the last two active normal-path animated gold-car reveals
with approved manoeuvre clips, retain a clear static route whenever video
cannot play, and then remove the obsolete glyph implementation without
changing command semantics or stable IDs.

## Verified Baseline

A deterministic catalog pass on 2026-08-15 found exactly two active
scene/result pairs whose normal correct-answer reveal still reaches the
animated gold glyph:

| Command | Action | Surface | Scene/result pair | Family |
| --- | --- | --- | --- | --- |
| `c-incorp` | `join-traffic` | `join-traffic-v1` | `join-traffic-photo-v1` / `join-traffic` | Join traffic |
| `c-sentido` | `change-direction` | `u-turn-v1` | `u-turn-photo-v1` / `change-direction` | Regular-road U-turn |

The active junction, parking, stopping, overtaking, and four-branch
roundabout scene/result pairs already have clips in `TURN_CLIPS`. Retired
roundabout commands and non-route precheck/control questions are not active
normal-path glyph consumers.

## Locked Product Decisions

- `c-sentido` remains the regular-road U-turn question. It is distinct from
  `c-sentido-rotonda`; neither command, action, result, surface, nor phrasing
  ID is renamed or reused.
- `c-incorp` remains the join-traffic question on `join-traffic-v1`.
- The approved blue learner car and each existing scene still are the visual
  anchors. A clip must begin on a frame that matches its registered scene
  closely enough to avoid a visible reveal-to-video jump.
- A playable correct-answer clip is the only moving route demonstration.
- Road movement Off, reduced motion, deferred/session-end reveal, incorrect
  answers, timeouts, unavailable media, and video failure use the retained
  static correct route. They never revive the animated gold glyph.
- If a video fails after the continuous-drive transition has begun, the app
  completes the existing pre-video fallback transition and continues to the
  next question. It must not stall, replay the answer, or score twice.
- Removing the glyph means removing only the post-answer animated car system.
  Gold remains a valid interface color for focus, selection, and static route
  emphasis.
- Existing media tools and repository dependencies are used where available.
  If implementation requires a missing dependency, stop and ask Jeffrey
  before installing it.

## Approved Production Assets

Jeffrey approved both corrected prototypes on 2026-08-15; these IDs are now
frozen in the production registry.

| Result | Required motion | Proposed clip ID | Expected ending |
| --- | --- | --- | --- |
| Regular-road U-turn | Enter the broad left-side junction, reverse direction without entering the opposing lane, and settle travelling toward the foreground | `regular-u-turn-v1` | Moving toward foreground |
| Join traffic | Leave the right curb, merge into the correct right-hand travel lane, and continue away in that lane | `join-traffic-merge-v1` | Moving away in lane |

Both production clips require a matching first-frame WebP poster, H.264 video,
`yuv420p` pixel format, fast-start metadata, measured duration, and recorded
SHA-256 checksums.

## Task 0 — Check In a Deterministic Glyph Audit

**Expected files:**

- `scripts/audit-gold-glyph.mjs`
- `docs/reviews/2026-08-15-gold-glyph-backlog.md`
- `tests/gold-glyph-audit.test.js`
- `package.json`

- [x] Add an audit that loads active commands through the centralized catalog
  filter, generates each supported surface across a fixed seed sweep, and
  inspects every surface with `geometry.correctRoute`.
- [x] Group findings by command ID and scene/result pair; do not count each
  phrasing or seed as separate work.
- [x] Report a finding only when the normal playable correct-answer path has
  no registered clip and would therefore create running post-answer glyph
  motion.
- [x] Record the two-row verified baseline above, required motion, proposed
  clip reuse, asset status, and Jeffrey review status in the checked-in
  backlog.
- [x] Give the audit a human-readable reporting mode and a `--check` mode that
  exits nonzero whenever any active normal-path glyph consumer remains.
- [x] Test that inactive commands remain resolvable but do not contaminate the
  active audit.
- [x] Run the focused audit tests and `npm test`.

**Gate:** the checked-in audit deterministically reports only `c-incorp` and
`c-sentido` on the current catalog, regardless of phrasing and across the
fixed seed sweep.

## Task 1 — Prototype and Review the Regular-Road U-Turn

**Expected working files before approval:**

- prototype render/source files under `tmp/`
- a contact sheet and browser-playable prototype MP4

- [x] Start from `u-turn-photo-v1` and its existing route geometry. Do not
  silently alter the question's legal answer or target contract to make the
  animation easier.
- [x] Preserve the road perspective, road markings, junction geometry, learner
  car identity, lighting, and framing from the still.
- [x] Show the complete manoeuvre: approach, controlled leftward movement into
  the clear junction, reversal, and departure in the correct lane toward the
  foreground.
- [x] Keep the vehicle clear of kerbs and the opposing lane; reject any take
  that looks like a roundabout manoeuvre, three-point turn, or turn into the
  side road.
- [x] Verify both deterministic U-turn templates remain semantically compatible
  with one scene/result clip.
- [x] Present the clip and contact sheet to Jeffrey for route, lane side,
  perspective, speed, heading, car scale, and continuity approval.
- [x] Apply requested corrections before any file enters `assets/driving/`.

**Gate:** Jeffrey approves one regular-road U-turn clip as the shared motion
for `u-turn-photo-v1` / `change-direction`.

## Task 2 — Prototype and Review Join Traffic

**Expected working files before approval:**

- prototype render/source files under `tmp/`
- a contact sheet and browser-playable prototype MP4

- [x] Start from `join-traffic-photo-v1`; the learner car begins parked at the
  right curb in the same position, scale, and heading as the still.
- [x] Show a safe departure from the curb, a smooth merge into the correct
  right-hand travel lane, and continued travel away from the camera.
- [x] Keep the car out of the opposing lane and prevent the final heading from
  reading as the beginning of a U-turn.
- [x] Preserve road perspective, parked-car details, lighting, and framing so
  the first clip frame does not jump from the answer scene.
- [x] Present the clip and contact sheet to Jeffrey for lane choice,
  clearance, perspective, speed, heading, car scale, and continuity approval.
- [x] Apply requested corrections before any file enters `assets/driving/`.

**Gate:** Jeffrey approves one join-traffic clip for
`join-traffic-photo-v1` / `join-traffic`.

## Task 3 — Freeze and Validate the Two Asset Sets

**Expected files:**

- `assets/driving/regular-u-turn-v1.mp4`
- `assets/driving/regular-u-turn-v1-poster.webp`
- `assets/driving/join-traffic-merge-v1.mp4`
- `assets/driving/join-traffic-merge-v1-poster.webp`
- `docs/reviews/2026-08-15-gold-glyph-replacement-assets.md`
- media/runtime-package tests

- [x] Confirm `ffmpeg` and `ffprobe` are already available; ask Jeffrey before
  installing either tool or any new package.
- [x] Re-encode both approved masters using the repository's H.264,
  `yuv420p`, silent-video, and fast-start conventions.
- [x] Extract first-frame WebP posters and compare them visually with both the
  source scene and decoded first video frame.
- [x] Measure duration, dimensions, codec, pixel format, stream count, and
  `moov`/`mdat` order rather than trusting filenames or render settings.
- [x] Record SHA-256 checksums, provenance, approval date, and measured media
  properties in the review document.
- [x] Prove the runtime package contains each MP4 and poster exactly once and
  that byte-range serving works for both videos.
- [x] Run focused asset tests and `npm test`.

**Gate:** two immutable production MP4s and two matching posters pass media,
package, provenance, and checksum checks.

## Task 4 — Register the Clips and Preserve Reveal Semantics

**Expected files:**

- `src/turn-through.js`
- `src/app.js` only if the existing generic behavior needs correction
- `tests/turn-through.test.js`
- `tests/app-state.test.js`
- `tests/manoeuvre-surfaces.test.js`

- [x] Register `u-turn-photo-v1` / `change-direction` and
  `join-traffic-photo-v1` / `join-traffic` in `TURN_CLIPS`, using measured
  durations and any justified stationary hold.
- [x] Add `u-turn-v1` and `join-traffic-v1` to the command-to-scene clip lookup
  without changing either stable surface ID.
- [x] Prove the route planner's pre-generation lookup agrees with generated
  scene/result pairs for both commands across the audit seed sweep.
- [x] Prove a playable correct reveal shows no static route and no glyph,
  retains the bilingual result-reading beat, enters the matching clip, and
  advances according to measured clip duration.
- [x] Prove Road movement Off, reduced motion, unavailable media, deferred
  reveal, incorrect answers, and timeouts show the appropriate static feedback
  and do not auto-advance as though a clip played.
- [x] Force each MP4 to fail after transition start and prove the pre-video
  fallback transition completes into the next question, with no glyph,
  duplicate scoring, or stalled overlay.
- [x] Preserve the session-local clip-failure latch and reset it only when a
  genuinely new session starts.
- [x] Run focused reveal/continuity tests and `npm test`.

**Gate:** the audit's reporting mode finds zero active normal-path glyph
consumers, while every non-playable state retains understandable static
feedback.

## Task 5 — Remove the Obsolete Animated Gold-Glyph System

This task begins only after Task 4 is accepted and the checked-in audit reports
zero.

**Expected files:**

- `src/app.js`
- `src/post-answer-motion.js` (remove)
- `src/post-answer-motion-view.js` (remove)
- `src/spatial-surfaces.js`
- `src/manoeuvre-surfaces.js`
- `src/turn-through.js`
- `styles.css`
- post-answer motion, surface, app-state, and release tests

- [x] Replace glyph-specific controller state with the smallest static-route
  fallback contract needed by all current and historical surfaces.
- [x] Remove post-answer motion creation, reducer events, render dispatch,
  animation timers, duration tables, and view-model wiring.
- [x] Remove `post-answer-motion.js`, `post-answer-motion-view.js`, their
  direct tests, and the delimited `post-answer-motion` CSS block.
- [x] Keep `[data-correct-route]` styling and `--gold`; both have valid uses
  outside the retired animated glyph.
- [x] Simplify spatial and manoeuvre renderers so a playable clip suppresses
  the static route and every other eligible reveal retains it.
- [x] Update the audit so reintroducing an active route-based command without
  either a clip or static fallback fails loudly instead of reviving motion.
- [x] Prove already-saved retired `c-rot4` and `c-rot5` sessions remain
  readable and reveal a static route, never an animated glyph.
- [x] Search source, CSS, tests, and documentation for obsolete glyph symbols
  and comments; leave no dead runtime import or animation selector.
- [x] Run focused cleanup tests and `npm test`.

**Gate:** no production code can render the animated post-answer car, all
active correct routes use video when playable and static routes otherwise,
and historical saved questions remain understandable.

## Task 6 — Manual Device and Release Review

- [x] Review regular U-turn and join traffic in both English and Spanish with
  Road movement On.
- [x] Review Road movement Off and iPadOS reduced-motion behavior for both.
- [x] Force each video to fail in Safari; confirm the pre-video transition
  completes and the next question appears without a glyph or stall.
- [x] Confirm reveal-to-poster, poster-to-video, and video-to-cruise continuity
  have no visible framing flash or duplicate learner car.
- [x] Confirm direct HTTP byte ranges and offline/service-worker playback for
  both new files on the release target.
- [x] Run `npm run release:check` and `git diff --check`.
- [x] Verify the bilingual AI-voice disclosure remains visible.
- [x] Verify no provider credential exists in repository or browser-delivered
  files.
- [x] Verify stable command/action/phrasing IDs and provenance remain intact.
- [x] Jeffrey reviews the complete diff before any commit or push.

**Final gate:** the deterministic audit reports zero active gold-glyph paths,
the two new clips pass device review and forced-failure testing, all fallbacks
remain static and understandable, and the release checks are green.
