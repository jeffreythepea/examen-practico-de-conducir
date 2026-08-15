# Four-Branch Roundabout Video Integration Plan

**Date:** 2026-08-15
**Status:** Implemented; physical iPad release review pending
**Goal:** Replace the active roundabout photographs and gold-car route animation
with one approved four-branch scene and four motion clips, while preserving the
existing regular-road `Cambio de sentido` question and every historical stable
ID.

## Locked Product Decisions

- The active roundabout has four physical branches total: the bottom entry
  branch plus three numbered exits.
- Active numbered questions are first, second, and third exit.
- Returning through the bottom branch is a separate roundabout
  `Cambio de sentido` question.
- The existing `c-sentido` question remains the regular-road U-turn question on
  `u-turn-v1`; it is not repurposed.
- `c-rot4` and `c-rot5` are retired from new sessions. Their command, action,
  and phrasing IDs remain reserved and are never reassigned.
- No active roundabout uses the old five-exit scene.
- Motion uses the approved blue learner car. It enters large in the foreground,
  shrinks nonlinearly with distance, and grows again when returning toward the
  foreground.
- Road movement Off, reduced motion, deferred/session-end reveal, clip failure,
  incorrect answers, and timeouts retain a clear static route fallback.

## Approved Prototype Asset Set

All files currently live under `tmp/roundabout-motion-prototype/` and must stay
out of production until Jeffrey approves the four clips together.

| Result | Prototype | Duration | Proposed production clip ID |
| --- | --- | ---: | --- |
| First exit/right | `first-exit-prototype.mp4` | 4 s | `roundabout-first-exit-v1` |
| Second exit/straight | `second-exit-prototype.mp4` | 5 s | `roundabout-second-exit-v1` |
| Third exit/left | `third-exit-prototype.mp4` | 6 s | `roundabout-third-exit-v1` |
| Roundabout Cambio de sentido | `cambio-sentido-prototype.mp4` | 6 s | `roundabout-change-direction-v1` |

The locked still is `canonical-four-branch-layout-final.png`. Proposed
production scene ID: `roundabout-four-photo-v3`. Keep the current
`roundabout-four-photo-v2` and `roundabout-five-photo-v1` IDs reserved for
compatibility; do not overwrite their files in place.

## Task 0 — Review and Freeze the Four Assets

- [ ] Jeffrey reviews all four clips for route, lane side, car scale, heading,
  timing, splitter clearance, and perspective.
- [ ] Apply only requested visual corrections to the prototype render scripts.
- [ ] Record SHA-256 checksums of the approved PNG and MP4 files.
- [ ] Re-encode production MP4s using the repository's existing H.264,
  `yuv420p`, and fast-start conventions.
- [ ] Extract a first-frame WebP poster for every clip; verify each poster is
  visually identical to the clip's opening frame.
- [ ] Convert the approved still to the production WebP scene without changing
  its 1536×1024 framing.

**Gate:** four visually approved clips, four posters, one scene still, valid
dimensions/durations, deterministic checksums, and no prototype/rejected asset
accidentally copied into `assets/driving/`.

## Task 1 — Add the New Scene and Four Clip Records

**Expected files:**

- `assets/driving/roundabout-four-photo-v3.webp`
- eight production clip/poster files under `assets/driving/`
- `src/driving-scenes.js`
- `src/turn-through.js`
- `tests/driving-scenes.test.js`
- `tests/turn-through.test.js`

- [ ] Register `roundabout-four-photo-v3` with bilingual alt text describing
  one entry branch, three numbered exits, and physical lane separators.
- [ ] Register scene/result clips for `roundabout-exit-1`,
  `roundabout-exit-2`, `roundabout-exit-3`, and
  `roundabout-change-direction`.
- [ ] Add `roundabout-v2` to the command-to-scene clip lookup without changing
  its stable surface ID.
- [ ] Use measured MP4 durations in the registry; do not hardcode one shared
  duration.
- [ ] Preserve the existing session-local clip-failure latch and static
  fallback behavior.
- [ ] Prove every registered asset and poster exists, is decodable, and has
  illustrative provenance.

**Gate:** focused scene/registry tests pass and all four results resolve to the
correct immutable clip record.

## Task 2 — Make the Four-Branch Surface Canonical

**Expected files:**

- `src/spatial-surfaces.js`
- `src/driving-scenes.js`
- `tests/spatial-surfaces.test.js`
- `tests/post-answer-route-fixtures.test.js`
- `tests/driving-scenes.test.js`

- [ ] Point new `roundabout-v2` generations at `roundabout-four-photo-v3`.
- [ ] Expose exactly four physical response targets: first, second, third, and
  return-through-entry.
- [ ] Calibrate the fourth target to the outbound half of the bottom branch;
  it must not overlap the inbound half or the separator.
- [ ] Keep legacy four-/five-exit generation code only where required to
  resolve an already-saved retired command; it must be unreachable from new
  session selection.
- [ ] Update bilingual target labels so the return target reads as a change of
  direction, not a numbered fourth exit.
- [ ] Prove every clip-backed correct reveal suppresses the gold glyph and
  static route only when its clip will actually play.

**Gate:** generated active roundabouts always use the new scene and expose the
four agreed physical outcomes with calibrated, non-overlapping targets.

## Task 3 — Add a Distinct Roundabout Cambio de Sentido Command

**Expected files:**

- `data/commands.json`
- `data/audio-manifest.json`
- generated catalog/audio outputs
- catalog, audio, session-theme, and release-audit tests

- [ ] Keep `c-sentido` / `change-direction` / `u-turn-v1` unchanged.
- [ ] Add a new stable command ID such as `c-sentido-rotonda`, with a unique
  action/result ID `roundabout-change-direction`, surface `roundabout-v2`, and
  unique phrasing IDs.
- [ ] Use Spanish examiner instructions equivalent to the existing Cambio de
  sentido language; add English meanings for every phrase.
- [ ] Reuse already-approved Spanish audio bytes by checksum where wording,
  voice, and speed are identical, while retaining distinct stable phrasing and
  audio-variant records for the new command.
- [ ] Include the new action in the Roundabout circuit theme and normal driving
  selection.
- [ ] Prove attempts, mastery, replay, persistence, and active-session restore
  distinguish road U-turn from roundabout Cambio de sentido.

**Gate:** both questions can occur independently, carry distinct stable IDs,
resolve to different surfaces, and retain exact Spanish audio provenance.

## Task 4 — Retire Fourth- and Fifth-Exit Questions Safely

**Expected files:**

- `data/commands.json`
- catalog/session/theme selection modules
- persistence normalization if required
- catalog, active-session, theme, readiness, and release-audit tests

- [ ] Mark `c-rot4` and `c-rot5` inactive for all newly constructed sessions.
  Do not rename, reuse, or reinterpret either ID.
- [ ] Centralize the active-command filter so free practice, themes,
  recommendations, targeted practice, accomplishments, and release counts all
  exclude retired records.
- [ ] Continue resolving historical attempts and any already-persisted active
  session containing a retired ID; retired commands may be completed or safely
  normalized out, but must never become a different question.
- [ ] Remove the five-exit scene from active distribution and from claims in
  bilingual UI/release documentation.
- [ ] Update Roundabout circuit copy from “both layouts” to the new single
  four-branch model in English and Spanish.

**Gate:** no new session contains fourth- or fifth-exit wording, no active
roundabout has five exits, and historical stable-ID data remains readable.

## Task 5 — Integrate Reveal and Continuity Behavior

- [ ] Exercise correct unaided and assisted answers for all four roundabout
  outcomes with Road movement On.
- [ ] Confirm each reveal retains its reading beat, then transitions into the
  matching clip and auto-advances from the clip's measured duration.
- [ ] Confirm wrong answers, timeouts, Mock/session-end reveal, Road movement
  Off, reduced motion, and a forced video-load failure retain non-animated
  feedback and never auto-advance as though a clip played.
- [ ] Confirm the scene still, clip first frame, and cruise transition have no
  visible framing jump.
- [ ] Verify byte-range serving, offline packaging, and iPadOS Safari playback
  for all new MP4s/posters.

**Gate:** exactly one correct-answer presentation is visible in every state:
video when playable, otherwise the static route fallback.

## Task 6 — Audit and Replace Every Remaining Normal-Path Gold Glyph

This begins only after the roundabout change is integrated and accepted.

- [ ] Add a deterministic audit that walks every active driving command,
  regenerates its surface, and reports commands whose normal correct-answer
  path still reaches animated post-answer glyph motion because no scene/result
  clip is registered.
- [ ] Group the report by reusable scene/result pair rather than phrasing, so
  one approved clip can cover every command variant with the same visual
  action.
- [ ] Record a checked-in backlog with command ID, action ID, surface ID,
  scene/result pair, required motion, estimated clip reuse, and review status.
- [ ] Produce clips in lowest-cost batches: shared junction/manoeuvre scenes
  first, unique scenes last. Review one representative clip from each new
  visual family before generating its siblings.
- [ ] Register approved clips through `TURN_CLIPS`; do not couple scoring or
  command semantics to video availability.
- [ ] Keep a static route—not an animated gold glyph—as the accessible fallback
  for reduced motion, Road movement Off, or video failure.
- [ ] Once the audit reports zero active normal-path glyph questions, remove
  the obsolete animated gold-car implementation and its CSS/assets in a
  separate, test-gated cleanup.

**Gate:** the checked-in audit reports zero active commands using the animated
gold glyph during the normal playable reveal path, while all fallback states
remain understandable without motion.

## Final Release Gate

- [ ] `npm test`
- [ ] `git diff --check`
- [ ] Bilingual AI-voice disclosure remains visible.
- [ ] No credential or provider secret exists in repository or browser files.
- [ ] Stable command/action/phrasing IDs and provenance are preserved.
- [ ] Manual English and Spanish review on a physical iPad or the accepted
  simulator target, including all four roundabout clips and one forced-failure
  fallback.
- [ ] Jeffrey reviews all changes before any commit or push.
