# Examiner Modes Foundation Implementation Plan

**Date:** 2026-08-06
**Design:** `docs/superpowers/specs/2026-08-06-examiner-modes-themed-drives-design.md`
**Scope:** Pure, reversible Solo E1 foundation only; no production controller,
storage, active-session, manifest, or CSS integration

## Recovery Rule

Work test-first and append a checkpoint to `.superpowers/sdd/progress.md` after
each task. If interrupted, run the focused tests named below, inspect the latest
checkpoint, and continue at the first unchecked task. Do not commit or push
without new explicit authorization.

## Task 1 — Examiner registry and deterministic choices

**Create:**
- `src/examiners.js`
- `tests/examiners.test.js`

**Behavior:**
- Export the five immutable examiner records and stable choice constants.
- Validate exact unique examiner and voice IDs.
- Resolve reverse voice lookup.
- Produce a local date key from injected date parts.
- Select Today's examiner deterministically.
- Resolve and filter candidates for Mixed, Today, or one fixed examiner.
- Preserve inputs and return frozen values.

**Gate:** `node --test tests/examiners.test.js`

## Task 2 — Experience preset domain

**Create:**
- `src/session-presets.js`
- `tests/session-presets.test.js`

**Behavior:**
- Export stable Learn, Practice, and Mock records.
- Map each to the approved existing settings and future policy fields.
- Apply a preset immutably over unrelated base settings.
- Reject unknown modes and malformed settings.
- Assert that Practice matches fresh-save semantics for the fields it owns.

**Gate:** `node --test tests/session-presets.test.js`

## Task 3 — Bilingual future UI scaffold

**Create:**
- `src/solo-setup-view.js`
- `tests/solo-setup-view.test.js`

**Modify:**
- `src/i18n.js`
- `tests/i18n.test.js`

**Behavior:**
- Render semantic mode and examiner radio groups from injected localization.
- Include Today, Mixed, and all five examiners.
- Expose stable future `data-action` and choice IDs.
- Escape dynamic strings and preserve accessible names.
- Do not import or call the renderer from `src/app.js`.

**Gate:** `node --test tests/solo-setup-view.test.js tests/i18n.test.js`

## Task 4 — Handoff packages and verification

**Create:**
- `docs/superpowers/plans/2026-08-06-hermes-solo-e1-domain-handoff.md`
- `docs/superpowers/plans/2026-08-06-hermes-solo-e2-theme-handoff.md`

The E1 prompt describes a hypothetical clean-room implementation/review package
for the pure modules. The E2 prompt is future work only and must prohibit live
controller changes until its integration design is approved.

**Final gates:**
- `node --test tests/examiners.test.js tests/session-presets.test.js tests/solo-setup-view.test.js tests/i18n.test.js`
- `npm test`
- `git diff --check`
- Confirm `src/app.js`, `src/storage.js`, `src/active-session.js`, production
  audio manifests, and service-worker/package behavior were not changed by this
  foundation task.
