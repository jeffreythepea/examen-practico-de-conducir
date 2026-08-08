# Solo E3 Correct Post-Answer Movement Implementation Plan

**Date:** 2026-08-08
**Status:** Complete; physical iPad acceptance passed 2026-08-08
**Design:**
`docs/superpowers/specs/2026-08-08-solo-e3-correct-post-answer-movement-design.md`
**Goal:** Add rollback-safe correct-only movement to representative immediate
reveal road surfaces without changing scoring, Mock withholding, persistence,
or the existing pre-answer approach.

## Recovery and Ownership Rules

- Tests gate every task. Run the focused gate before handoff and the complete
  suite before review.
- Append a concise checkpoint to `.superpowers/sdd/progress.md` after each
  independently green implementation task.
- Preserve all existing and untracked user files. Never reset, clean, or
  discard the shared checkout.
- Delegates do not commit or push. Codex reviews every delegated diff before
  integration. Jeffrey owns commit and push.
- A free-model rate limit is a pause, not a restart. The delegate preserves its
  files, focused test output, exact next action, and handoff note; another
  explicitly selected model may resume the same bounded slice.
- Do not send credentials, private files, Keychain contents, audio recovery
  data, or unrelated repository files to a delegate.
- Commands and generated command audio remain Spanish. Any new interface copy
  must be added in English and Spanish in the same task.
- Stable command, action, phrasing, surface, target, scene, examiner, voice,
  and audio IDs are compatibility boundaries.
- No task may add wrong-choice movement, crash imagery, ambience, vehicle
  sounds, scoring changes, or active-session schema changes.

## Task 0 — Baseline and file-map checkpoint (Codex)

**Read only:** current motion, surface, controller, packaging, and focused test
files.

- [x] Confirm the approved design status and record the baseline commit.
- [x] Run `npm test` and `git diff --check` without altering unrelated work.
- [ ] Record current behavior for one junction, roundabout, parking, and
  stopping reveal with Road movement On, Off, and reduced motion.
- [x] Confirm the complete 1,185-recording corpus and bilingual AI-voice
  disclosure remain release invariants but are not modified by this build.
- [ ] Record exact file fences for the delegated tasks below.

**Gate:** baseline suite green and checkpoint written.

## Task 1 — Pure post-answer motion contract (Hermes)

**Create only:**

- `src/post-answer-motion.js`
- `tests/post-answer-motion.test.js`
- `docs/superpowers/plans/2026-08-08-hermes-post-answer-motion-handoff.md`

**Do not modify:** app/controller, surfaces, styles, i18n, storage, catalog,
audio, assets, package files, or existing tests.

- [ ] Write failing tests for immutable static, running, and complete states.
- [ ] Whitelist only junction, roundabout, parking, and stopping families.
- [ ] Validate a nonempty finite route whose points remain in the 0–100 stage.
- [ ] Accept controller-owned `eligible`, `family`, `route`, `startedAt`, and
  duration inputs; do not inspect selected results or calculate correctness.
- [ ] Expose deterministic progress from injected time and idempotent
  completion.
- [ ] Return a frozen static state for disabled/ineligible requests.
- [ ] Prove inputs are not mutated and outputs are deeply frozen.
- [ ] Document exports, red/green test results, open questions, and exact
  status in the handoff file.

**Focused gate:** `node --test tests/post-answer-motion.test.js`

**Rate-limit recovery:** if the selected free model stops, leave the failing or
passing test state intact and end the handoff with the last completed assertion
and exact next assertion. Codex or another model resumes; no work is recreated.

## Task 2 — Route-fixture audit (Hermes, after Task 1 review)

**Create only:**

- `tests/post-answer-route-fixtures.test.js`
- `docs/superpowers/plans/2026-08-08-hermes-post-answer-routes-handoff.md`

**Read only:** `src/spatial-surfaces.js`, `src/manoeuvre-surfaces.js`, surface
geometry helpers, commands, and existing surface tests.

- [ ] Build test fixtures across junction directions, four- and five-exit
  roundabouts, parking templates, stopping templates, and seed sweeps.
- [ ] Assert the expected route starts at the reviewed learner entry and ends
  inside the accepted target.
- [ ] Assert every point is finite and inside the stage.
- [ ] Assert roundabouts retain their generated exit count, circle, lane join,
  and exact accepted target.
- [ ] Assert parking/stopping routes use only the accepted legal target.
- [ ] Do not change production geometry to make a test pass; report any
  mismatch for Codex judgment.

**Focused gate:** the new fixture test may initially fail and must state exactly
which production routes still need exposure or repair. This task is an audit,
not production integration.

## Task 3 — Codex review of delegated contracts

- [ ] Inspect every delegated line and verify the file fences.
- [ ] Reject duplicated scoring logic, mutable output, non-finite geometry,
  hidden production edits, or widened family scope.
- [ ] Repair the pure contract only within Task 1's fence.
- [ ] Convert Task 2 findings into explicit expected production edits rather
  than weakening assertions.
- [ ] Run both focused suites, `npm test`, and `git diff --check`.
- [ ] Append accepted exports, failing geometry cases, and rollback point to
  the ledger.

## Task 4 — Shared retained route geometry (Codex)

**Modify:**

- `src/spatial-surfaces.js`
- `src/manoeuvre-surfaces.js`
- `tests/spatial-surfaces.test.js`
- `tests/manoeuvre-surfaces.test.js`
- `tests/post-answer-route-fixtures.test.js`

- [ ] Refactor junction correct-route construction into retained immutable
  points on the generated model.
- [ ] Refactor roundabout correct-route construction to use one retained route
  derived from `routeCircle`, the correct `exitJoin`, and accepted target.
- [ ] Preserve existing rendered path shape and all stable IDs.
- [ ] Confirm parking and stopping retain their existing reviewed template
  routes and exact accepted endpoints.
- [ ] Make static reveal and future animation consume the same retained route.
- [ ] Sweep representative seeds and prove all routes remain in stage.
- [ ] Do not add animation, CSS, or controller logic in this task.

**Focused gate:** spatial, manoeuvre, and route-fixture tests.

**Rollback point:** generation and reveal output remain visually identical; the
only production change is retained shared geometry.

## Task 5 — Consequence presentation scaffold (Hermes-friendly after Task 4)

This task may be delegated only after Codex freezes the renderer input
contract.

**Create only:**

- `src/post-answer-motion-view.js`
- `tests/post-answer-motion-view.test.js`
- `docs/superpowers/plans/2026-08-08-hermes-post-answer-view-handoff.md`

**Do not modify:** existing surfaces, app/controller, styles, i18n, storage,
catalog, audio, or assets.

- [ ] Render escaped, assistive-technology-hidden SVG route and marker markup
  from a supplied view model.
- [ ] Render no target button, correctness text, score, timer, Continue button,
  or live region.
- [ ] Expose stable data attributes and CSS variables for progress, family,
  duration, and route identity.
- [ ] Return no animated markup for a static view.
- [ ] Keep the marker code-native and visually neutral; do not introduce an
  image, emoji, font, or dependency.
- [ ] Prove malformed routes and unsupported families fail closed.

**Focused gate:** `node --test tests/post-answer-motion-view.test.js`

## Task 6 — Surface renderer and reduced-motion CSS (Codex)

**Modify:** surface renderers, `styles.css`, and their focused tests. Import the
accepted view scaffold if Task 5 is delegated.

- [x] Render the consequence inside the same calibrated photo/route scene only
  for a running or complete eligible view.
- [x] Keep target buttons disabled and existing result labels/markers static.
- [x] Progressively draw the accepted route and move the marker along the same
  geometry without rebuilding the model per frame.
- [x] Keep Continue outside and independent of the animation.
- [x] Add a clearly delimited post-answer-motion CSS section.
- [x] Under `prefers-reduced-motion: reduce`, suppress all new animation and
  transforms while retaining the static reveal.
- [ ] If duplicate-car visual review is confusing, remove the moving marker and
  retain route drawing without expanding scope into image editing.

**Focused gate:** spatial, manoeuvre, view, CSS, and accessibility assertions.

## Task 7 — Post-save controller integration (Codex only)

**Modify:** `src/app.js` and focused app/controller tests. Modify `src/i18n.js`
only if Jeffrey separately approves new copy; none is planned.

- [x] Add a static post-answer state to ordinary trial reset.
- [x] Preserve the existing response reducer and `recordAttempt` call exactly.
- [x] After `recordAttempt`, active-session advancement, and `saveState`
  succeed, start movement only for a correct eligible immediate-reveal attempt.
- [x] Exclude incorrect, timeout, audio failure, unsupported, Road movement
  Off, reduced-motion, and `revealPolicy === 'session-end'` cases.
- [x] Preserve `startedAt` across locale or same-screen rerenders.
- [ ] Settle on animation completion without saving or creating an attempt.
- [x] Let Continue, navigation, visibility change, and teardown abandon motion
  without side effects.
- [ ] Prove one learner response still records exactly one attempt and advances
  active-session state exactly once.
- [x] Prove Mock transitions and deferred results remain unchanged.

**Focused gate:** app controller, smoke, state, active-session, Mock, and motion
tests, followed by `npm test`.

**Rollback point:** remove the post-save start event/import/state/render option;
all static reveals and scoring remain available.

## Task 8 — Offline packaging and automated regression (Codex)

- [x] Verify the new imported modules enter the deterministic runtime package.
- [x] Verify no new asset, network request, dependency, credential, or storage
  field exists.
- [ ] Exercise English and Spanish immediate reveals without adding copy.
- [x] Exercise Road movement On/Off and mocked reduced-motion preference.
- [ ] Verify existing six-second pre-answer approach still freezes at answer
  time and does not restart under post-answer movement.
- [x] Verify release audit still finds the bilingual AI-voice disclosure and
  complete 1,185-recording corpus.
- [x] Run `npm test`, `npm run release:check`, and `git diff --check`.

## Task 9 — Browser and physical-iPad acceptance (Jeffrey + Codex)

- [x] Review one correct left/right/straight junction response.
- [x] Review representative early and late exits on both roundabout layouts.
- [x] Review parking and voluntary pull-over.
- [x] Confirm incorrect and timeout reveals do not animate.
- [x] Confirm Road movement Off and iPad reduced-motion settings stay static.
- [x] Tap Continue immediately during each animation and confirm no delay,
  duplicate attempt, or broken next command.
- [x] Confirm live Mock still withholds correctness and adds no consequence.
- [x] Confirm installed offline operation in Airplane Mode.
- [x] Stop for Jeffrey's acceptance before release bookkeeping or push.

## Task 10 — Release bookkeeping and rollback record (Codex)

- [x] Update active design, README, and CHANGELOG without claiming full Solo E3
  or wrong-choice consequences.
- [x] Record exact supported families, reduced-motion behavior, package count,
  hash, iPad result, and rollback instructions in the ledger.
- [x] Retain the previous static behavior as the explicit rollback baseline.
- [x] Run the final complete release gate and credential audit.
- [ ] Jeffrey decides commit and push.

## Recommended Delegation Sequence

1. Codex completes Task 0 and freezes the file fence.
2. Hermes performs Task 1. If rate-limited, another selected model resumes the
   same files and handoff rather than starting over.
3. Hermes performs the read-only-production audit in Task 2; Codex interprets
   failures.
4. Codex reviews both and performs the geometry refactor in Task 4.
5. After the route/view input contract is frozen, Hermes may scaffold Task 5.
6. Codex retains renderer integration, visual judgment, controller lifecycle,
   persistence ordering, offline release review, and physical-iPad acceptance.

This split delegates pure state, exhaustive fixtures, and isolated markup while
keeping scoring, post-save ordering, accessibility judgment, and visual
integration with Codex.
