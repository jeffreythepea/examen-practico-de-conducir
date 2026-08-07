# Simulated Exam Continuity Implementation Plan

**Date:** 2026-08-07
**Design:**
`docs/superpowers/specs/2026-08-07-simulated-exam-continuity-design.md`
**Goal:** Give Full Mock a restart-safe precheck-to-driving narrative and brief
straight-driving cutscenes without changing existing scoring or claiming an
official exam sequence.

## Recovery and Ownership Rules

- Jeffrey approved the design decisions and the two-command content addition
  on 2026-08-07. Production tasks may proceed through their stated gates.
- Work test-first and append a checkpoint to `.superpowers/sdd/progress.md`
  after each independently green task.
- Preserve untracked `tmp/` and every unrelated user file. Never reset, clean,
  or discard the shared checkout.
- Delegates do not commit or push. Codex reviews every delegated diff before
  integration.
- A free-model rate limit is a pause. Preserve the same session, filesystem
  changes, focused test output, and handoff note; resume the bounded slice with
  another explicitly selected model rather than restarting it.
- Commands and generated command audio remain Spanish; UI copy remains
  bilingual; credentials never enter Git.
- Existing stable IDs and attempts are immutable compatibility boundaries.

## Task 1 — Pure route-plan foundation (Hermes)

**Create only:** `src/simulated-exam-route.js`,
`tests/simulated-exam-route.test.js`, and
`docs/superpowers/plans/2026-08-07-hermes-simulated-route-handoff.md`

- [x] Write failing tests for immutable, deterministic route construction.
- [x] Partition already-selected items into precheck, `c-arr`, `c-incorp`,
  ordinary driving, `c-final`, and `c-inmov` without changing relative order
  inside a group.
- [x] Emit stable command and transition step records in the reviewed order.
- [x] Insert one preparation bridge when `c-arr` is absent, the departure
  consequence after `c-incorp` when present, and short cruise transitions only
  where the design permits.
- [x] Handle absent terminal commands without fabricating commands.
- [x] Reject malformed items and duplicate indexes.
- [x] Return deeply frozen caller-independent data without mutating input.
- [x] Record exact green/red state after each test block in the handoff file.

**Gate:** `node --test tests/simulated-exam-route.test.js`

## Task 2 — Pure transition presentation (Claude Code)

**Create only:** `src/continuity-transition-view.js`,
`tests/continuity-transition-view.test.js`

**Modify only:** `styles.css` within a clearly delimited continuity-transition
section, and
`docs/superpowers/plans/2026-08-07-claude-continuity-view-handoff.md`

- [x] Write failing tests for every transition family and locale.
- [x] Render escaped semantic markup from a supplied view model.
- [x] Render no answer targets, route lines, correct/incorrect marks, timers,
  or command text.
- [x] Provide a bilingual visible Skip button with a 44px target.
- [x] Reuse audited road asset paths and existing camera-transform vocabulary.
- [x] Add static reduced-motion behavior and iPad-landscape constraints.
- [x] Avoid controller, persistence, timer, audio, or catalog logic.
- [x] Record exact green/red state after each test block in the handoff file.

**Gate:** `node --test tests/continuity-transition-view.test.js`

Tasks 1 and 2 may run concurrently only in isolated worktrees. In the shared
checkout they run sequentially so the handoff records and test discovery do
not collide.

## Task 3 — Codex review and contract repair

- [ ] Inspect each delegated diff line by line against the approved design.
- [ ] Verify no prohibited file changed and no generated/unrelated file
  entered either diff.
- [ ] Repair correctness, accessibility, escaping, immutability, or project
  convention defects before integration.
- [ ] Independently rerun both focused gates, `npm test`, and
  `git diff --check`.
- [ ] Record accepted public contracts and rollback points in the ledger.

## Task 4 — Active-session version 3 continuity snapshot

**Modify:** `src/active-session.js`, `src/storage.js`, and focused tests

- [x] Add an optional immutable route plan and next route-step index only for
  eligible Full Mock sessions.
- [x] Normalize version-2 sessions to continuity disabled with exact existing
  resume behavior.
- [x] Validate route command indexes against snapshotted session items.
- [x] Persist transition advancement without creating an attempt.
- [x] Reject malformed plans and preserve catalog-mismatch recovery.
- [x] Prove schema-4 backup import and existing active sessions still work.

**Gate:** `node --test tests/active-session.test.js tests/storage.test.js`

## Task 5 — Full Mock controller integration

**Modify:** `src/app.js`, `src/i18n.js`, and focused controller/UI tests

- [ ] Enable continuity only for Mock + Full mock.
- [ ] Construct and snapshot the route after the scored item session is fixed.
- [ ] Render prechecks first and follow the route-plan command order.
- [ ] Replace the 600ms neutral Mock frame with the appropriate transition.
- [ ] Start next-command audio only after automatic completion or Skip.
- [ ] Atomically persist scored command and pending transition state.
- [ ] Resume a pending transition without repeating the prior command.
- [ ] Preserve Mock withholding, audio-failure, results reconstruction, focus,
  language switching, and feedback-sound behavior.
- [ ] Keep a static transition when Road movement is Off or reduced motion is
  preferred.

**Gate:** focused app/controller/i18n tests plus `npm test`

## Task 6 — Browser and physical-device acceptance

- [ ] Verify English and Spanish Full Mock in iPad landscape.
- [ ] Verify transitions never obscure or replace scored answer surfaces.
- [ ] Verify automatic completion, Skip by touch and keyboard, and focus.
- [ ] Reload during a command, during a transition, and after the final answer.
- [ ] Verify Road movement Off and reduced-motion behavior.
- [ ] Verify ordinary Learn, Practice, and non-Full-Mock sessions remain
  unchanged.
- [ ] Stop for Jeffrey's physical iPad review before release.

## Task 7 — Start-engine and traffic-entry content slice

The wording contract is approved; Codex retains final response-surface review.

- [x] Add two new stable commands and three phrasings without modifying existing
  IDs or text.
- [x] Add the generic, procedure-neutral start-engine response surface and
  bilingual explanations.
- [ ] Add the joining-traffic response surface and bilingual explanation.
- [ ] Integrate both scored commands into the route-plan departure chapter.
- [ ] Generate the approved Spanish recordings through the existing env-var
  workflow; never fabricate manifest entries.
- [ ] Verify 45 new files: three phrasings × five examiners × three speeds.
- [ ] Keep the unscored preparation bridge as fallback only when the command is
  absent from an older active session.

**Gate:** catalog/surface/audio tests plus `npm run release:check`

## Task 7A — Four-exit roundabout artwork cleanup

- [x] Create a non-destructive 1536×1024 v2 PNG with the incomplete
  lower-right branch removed and every valid road/car feature preserved.
- [ ] Visually compare v1/v2 and verify the scene has four complete exits plus
  the bottom entry and no partial road.
- [ ] Produce the optimized WebP through the existing image workflow.
- [ ] Update only the four-exit scene asset reference and focused asset tests.
- [ ] Verify existing target coordinates and road-motion calibration remain
  correctly aligned on the rendered v2 image.
- [ ] Retain v1 as rollback evidence until Jeffrey accepts v2 on iPad.

**Gate:** driving/spatial/road-motion/runtime-image tests plus manual browser
review

## Task 8 — Release bookkeeping

- [ ] Update `docs/design.md`, README, and CHANGELOG without an official-test
  claim.
- [ ] Run `npm test`, `npm run release:check`, and `git diff --check`.
- [ ] Verify bilingual AI-voice disclosure and repository/runtime credential
  audits.
- [ ] Record asset count, package hash, migration boundary, iPad acceptance,
  and rollback procedure in `.superpowers/sdd/progress.md`.
- [ ] Jeffrey decides commit and push.
