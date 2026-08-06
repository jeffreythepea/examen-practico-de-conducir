# Examiner Modes and Themed Drives Live Integration Plan

**Date:** 2026-08-06
**Approved design:**
`docs/superpowers/specs/2026-08-06-examiner-modes-themed-drives-live-integration-design.md`
**Goal:** Integrate examiner identity, Learn/Practice/Mock presets, and themed
drives into the offline web app while preserving current evidence, audio,
accessibility, and recovery behavior.

## Recovery and Ownership Rules

- Work test-first and append a checkpoint to `.superpowers/sdd/progress.md`
  after every independently green task.
- The shared worktree contains protected expanded-motion, five-voice audio,
  E1, and E2 work. Never reset, clean, or discard it.
- Jeffrey reviews, commits, and pushes. Agents leave changes uncommitted.
- Hermes receives only bounded slices, explicit file fences, focused gates,
  and an exact recovery note. A free-model limit is a pause, not a reason to
  broaden scope or repeat completed work.
- Codex reviews every Hermes diff and independently runs its focused tests.
- Slices 1, 3, 4, and presentation-only portions of 5 and 9 may be delegated.
  Codex retains persistence/controller crossings in 2, 6, 7, 8, and 10.
- Do not add, regenerate, rename, or remove production audio in this release.

## Task 1 — Schema-4 settings and migration

**Modify:** `src/storage.js`, `tests/storage.test.js`

- [ ] Add `experienceMode`, `examinerChoice`, and nullable `themeId` to fresh
  settings with the approved Practice/Mixed/Adaptive defaults.
- [ ] Migrate schema 3 additively without changing attempts, progress, lesson
  flags, or an existing active-session item snapshot.
- [ ] Validate every stable preset, examiner-choice, and theme ID.
- [ ] Keep schema-3 backup import valid and reject malformed schema-4 values.
- [ ] Prove migration is immutable and idempotent.

**Gate:** `node --test tests/storage.test.js`

## Task 2 — Active-session v2 experience snapshot

**Modify:** `src/active-session.js`, `tests/active-session.test.js`

- [ ] Add the immutable `experience` record approved in the design.
- [ ] Normalize version-1 sessions to the compatibility Practice/Mixed policy
  while preserving their snapshotted command, phrasing, voice, and speed IDs.
- [ ] Validate Today/fixed examiner consistency, policies, themes, and item
  membership without silently falling back.
- [ ] Allow a completed Mock snapshot to remain valid until results dismissal.
- [ ] Preserve current ordinary-session clear-on-completion behavior.

**Gate:** `node --test tests/active-session.test.js`

## Task 3 — Theme eligibility before adaptive selection

**Modify:** `src/session-themes.js`, `src/training.js`, their focused tests

- [ ] Expose a pure frozen eligibility helper that filters without shuffling,
  truncating, duplicating, or mutating the catalog.
- [ ] Compose that eligible catalog before the existing Recommended/Free and
  targeted practice selection.
- [ ] Preserve readiness priority, phase filtering, lesson flags, and length
  within the eligible pool.
- [ ] Return an explicit empty result for impossible combinations so the UI can
  explain why Start is unavailable.

**Gate:** `node --test tests/session-themes.test.js tests/training.test.js`

## Task 4 — Examiner-filtered coverage-aware playback

**Modify:** `src/app.js`, `tests/app-state.test.js`, `tests/app-smoke.test.js`

- [ ] Resolve Today once from injected local date parts at session creation.
- [ ] Filter candidates for Today/fixed choices before the already-live
  `selectCoverageAwareVariant` call.
- [ ] Keep Mixed as an identity filter across all five voices.
- [ ] Keep browser-speech fallback and audio-failure attempts unscored.
- [ ] Snapshot the resolved examiner and exact selected variants for resume.

**Gate:** `node --test tests/examiners.test.js tests/app-state.test.js tests/app-smoke.test.js`

## Task 5 — Production setup and bilingual controls

**Modify:** `src/solo-setup-view.js`, `src/app.js`, `src/i18n.js`, `styles.css`,
and focused UI/i18n tests

- [ ] Integrate the semantic Learn/Practice/Mock and examiner radio cards.
- [ ] Add Adaptive practice and six theme choices.
- [ ] Move existing technical settings into an Advanced practice disclosure;
  Learn and Mock visibly explain fields they own.
- [ ] Preserve Readiness, offline download/install, Settings, language, and the
  bilingual AI-voice disclosure.
- [ ] Disable Start with a bilingual reason when the selected combination has
  no playable commands.
- [ ] Retain 44px touch targets, keyboard focus, non-color selection cues, and
  wide-landscape responsiveness.

**Gate:** `node --test tests/solo-setup-view.test.js tests/app-smoke.test.js tests/i18n.test.js`

## Task 6 — Learn and Practice live regression boundary

**Modify:** `src/app.js` and controller/UI tests

- [ ] Apply preset-owned fields only at session creation.
- [ ] Keep Learn and Practice on the existing immediate prompt → reveal →
  continue lifecycle with immediate atomic persistence.
- [ ] Learn shows Spanish and allows replay; Practice uses its visible advanced
  settings and allows replay.
- [ ] Preserve feedback cues, miss reasons, lesson notes, focus restoration,
  road motion, timing, readiness, and targeted sessions.

**Gate:** focused controller tests plus `npm test`

## Task 7 — Mock answer and transition lifecycle

**Modify:** `src/app.js`, `src/training.js` only if the attempt-update contract
requires it, and focused controller tests

- [ ] Enforce 1x, no written Spanish, timing on, and no replay.
- [ ] Persist each scored attempt and advance the active session atomically.
- [ ] Withhold correctness, meaning, expected action, diagnostics, and feedback
  sounds while the simulated drive is in progress.
- [ ] Transition through a neutral progress/examiner frame to the next command.
- [ ] Preserve unscored audio failure and exact unanswered-command resume.

**Gate:** `node --test tests/app-state.test.js tests/app-smoke.test.js tests/training.test.js`

## Task 8 — Completed-Mock recovery and deferred review

**Modify:** `src/app.js`, `src/active-session.js`, `src/training.js` if needed,
and focused persistence/result tests

- [ ] Retain the completed Mock snapshot until results are dismissed.
- [ ] Reconstruct results after reload from the snapshot's attempt IDs.
- [ ] Show the approved non-official Clean simulated drive / Needs practice
  rule and its explanation.
- [ ] Reveal exact command evidence only at completion.
- [ ] Allow deferred miss-reason updates without changing score.
- [ ] Clear the completed snapshot on results dismissal or a new session.

**Gate:** focused active-session/controller/training tests plus `npm test`

## Task 9 — Session identity and responsive presentation

**Modify:** `src/app.js`, `src/i18n.js`, `styles.css`, and focused UI tests

- [ ] Show localized mode, theme, and examiner identity during prompts and on
  results; represent Mixed as multiple examiners.
- [ ] Use only the approved neutral character descriptions and visual tokens.
- [ ] Verify no identity UI obstructs diagrams, controls, or road targets.
- [ ] Verify English, Spanish, keyboard, reduced-motion, and iPad landscape
  layouts.

**Gate:** focused rendering/accessibility tests and manual browser review

## Task 10 — Release and physical acceptance

- [ ] Run `npm test` and `npm run release:check`.
- [ ] Run `git diff --check`.
- [ ] Confirm 1,140 recorded variants remain complete and no credential or
  unreviewed asset entered the runtime.
- [ ] Verify old backup import, version-1 resume, new Mock resume, browser
  speech fallback, offline staged update, and bilingual AI-voice disclosure.
- [ ] Serve on the LAN and stop for Jeffrey's physical iPad landscape review.
- [ ] Record final counts, package hash, rollback boundary, and remaining
  deferred items in `.superpowers/sdd/progress.md`.

## First Delegation Boundary

After this plan is recorded, Task 1 may be sent to Hermes with writes limited
to `src/storage.js` and its focused tests. If the selected free model is rate
limited, preserve the Hermes session ID and any green filesystem changes,
record the exact failing/passing test state, and resume the same bounded task
with Nemotron Super or another explicitly selected model. Do not proceed to
Task 2 until Codex reviews Task 1.
