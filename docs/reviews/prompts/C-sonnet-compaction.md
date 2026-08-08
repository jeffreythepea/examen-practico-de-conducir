# Session C — attempts compaction (Claude Sonnet 5)

You are implementing ONE well-scoped item in the repo examen-practico-de-conducir, a
vanilla-JS static PWA for practising Spanish driving-exam commands. The design work is
already done — implement exactly what's specified below (it matches item P2 in
`docs/reviews/2026-08-08-code-review.md`). Do not redesign, do not expand scope, do not
fix unrelated things you notice (list them at the end instead).

## Setup
```
git clone https://github.com/jeffreythepea/examen-practico-de-conducir.git
cd examen-practico-de-conducir && npm install && npm test
```
All tests must pass before you change anything. Work on a branch:
`git checkout -b attempts-compaction`

## Ground rules (from AGENTS.md — binding)
- `npm test` gates every change; finish with a green suite and `git diff --check` clean.
- Every piece of user-facing copy must exist in BOTH English and Spanish (src/i18n.js) —
  this item likely needs none.
- Stable command/action/phrasing IDs are invariants. No new dependencies.
- Match the existing code style: pure functions with injected dependencies (now, rng),
  Object.freeze on returned records, exhaustive validation with descriptive errors.
- Commit locally on the branch when green; update `docs/reviews/PROGRESS.md` in the same
  commit. Do not push.

## The task: bound the growth of state.attempts (compaction)
Problem: every scored attempt appends to state.attempts forever. saveState
(src/storage.js) re-validates, structuredClones, and JSON.stringifies the whole array on
every attempt; readiness (src/readiness.js, src/training.js) rescans all attempts per
command; localStorage quota (~5MB) is a when, not an if, for a daily user.

Implement:
1. New module src/attempt-compaction.js exporting compactAttempts(state, now) — a pure
   function returning a new state with older attempts compacted.
2. Policy: keep ALL attempts from the last 90 days. For attempts older than that, keep
   per command: the first unaided attempt of each distinct UTC date, and drop the rest —
   subject to the invariants below.
3. Call it once at load time in bootstrap() (src/app.js), after loadState and before any
   saveState, so compaction happens at most once per app launch.

INVARIANTS that must survive compaction (readiness depends on these — see
src/readiness.js:25-35 and src/training.js:199):
a. The set of distinct UTC dates with an unaided outcome, per command, preserved exactly
   (readiness "ready" requires >= 3 distinct unaided dates).
b. The most recent 10 attempts per command kept in full fidelity (readiness reads the
   last 2; the Readiness screen shows the last 5).
c. Attempts referenced by state.activeSession.attemptIds are NEVER dropped — the
   validator at src/storage.js:146-149 hard-fails otherwise.
d. actionProgress (spaced-repetition schedule) needs no change — but training.js:109-110
   falls back to recomputing the schedule from attempts when actionProgress lacks an
   entry; confirm compaction cannot change that fallback's result for any action that
   HAS recent attempts, and state in your summary why.
If preserving invariant (a) via kept attempts alone proves awkward, the alternative is a
per-command rollup record in state — that requires bumping SCHEMA_VERSION to 5 with a
migration following the existing MIGRATIONS pattern in src/storage.js:88 and validator
updates. Prefer the kept-attempts approach if it satisfies (a) cleanly; use the schema
bump only if needed.

Tests (node:test, same style as tests/storage.test.js):
- New tests/attempt-compaction.test.js with a property-style test: generate randomized
  attempt histories (seeded RNG, injected like existing tests), assert
  readinessForCommand returns IDENTICAL state for every command before and after
  compaction, and that mastery "ready" flags are unchanged.
- Explicit cases: active-session-referenced attempts retained; recent-10 retained;
  distinct-unaided-dates preserved across the 90-day boundary; idempotence
  (compact(compact(s)) structurally equal to compact(s)).
- If you bump the schema: migration test mirroring the existing v3->v4 tests, and
  confirm exportState/importState round-trips the new shape.

## Deliverables
1. The diff (git diff main...attempts-compaction), npm test fully green.
2. A short summary: what changed per file, how each invariant (a)-(d) is satisfied, and
   any follow-ups you deliberately did not do.
3. PROGRESS.md row updated.

Work economically: the files named above plus their tests are sufficient context — do
not crawl docs/ or read the audio/data manifests.
