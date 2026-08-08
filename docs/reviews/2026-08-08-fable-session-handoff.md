# Session handoff — 2026-08-08 (Fable 5 → Sonnet 5)

Untracked on purpose. Jeffrey decides whether this file gets committed.

## What this session finished

### Item C — attempts compaction (code review P2) — GREEN, committed, not pushed

Branch `attempts-compaction`, commit `95e1d07`. 620 tests green (612 baseline + 8
new), `git diff --check` clean. `docs/reviews/PROGRESS.md` row updated in the same
commit. No schema bump was needed — the kept-attempts approach satisfies all
invariants.

Files:
- `src/attempt-compaction.js` (new): `compactAttempts(state, now)` — pure. Keeps
  every attempt from the last 90 days; for older attempts keeps, per command, the
  first unaided attempt of each distinct UTC date plus the command's 10 most recent
  attempts (stable newest-first sort, mirroring readiness ordering); attempts in
  `activeSession.attemptIds` always survive. Returns the same state object when
  nothing drops.
- `src/app.js`: `bootstrap()` calls `compactAttempts(state, Date.now())` right after
  `loadState`, before any `saveState` (so the active-session reference check still
  sees pinned attempts).
- `tests/attempt-compaction.test.js` (new): seeded property test (12 mulberry32
  seeds, randomized 40–160-attempt histories, shared-action commands) asserting
  `readinessForCommand().state`, `recentOutcomes`, and `masteryForAction().ready`
  identical before/after; explicit tests for pinned attempts, recent-10, distinct
  unaided dates across the 90-day boundary, idempotence, no-op identity, storage
  export/import round-trip, and validation errors.

How the invariants hold:
- (a) First unaided attempt of each distinct (command, UTC date) is kept, so
  per-command unaided-date sets are exact. A command's attempts all share its
  actionId, so per-action date sets (mastery) are unions of per-command sets —
  also exact.
- (b) Recent-10 per command kept via the same stable newest-first ordering
  readiness uses; readiness reads last 2, the screen last 5.
- (c) `activeSession.attemptIds` are unconditionally kept; the storage validator
  passes post-compaction (export/import round-trip test).
- (d) The `training.js:109-110` fallback (`scheduleForAttempts`) depends only on
  the trailing run of consecutive unaided attempts and the last timestamp — the
  reset at the most recent non-unaided attempt erases earlier history. For any
  action with recent attempts: if the trailing run R ≤ 5, the run and its breaking
  attempt sit within the action's 6 most recent attempts, each of which is within
  its own command's recent-10 (a command's attempts are a subset of its action's),
  so the fallback result is bit-identical. If R ≥ 6, the counted run can differ but
  both counts are ≥ 5 and `UNAIDED_INTERVAL_DAYS` caps at index 4, so `nextDueAt`
  is unchanged; only the uncapped `consecutiveUnaided` integer can differ, which is
  behaviorally inert (future lookups stay capped; assisted/incorrect resets to 0).

Deliberate non-changes (flag to reviewer): readiness's `averageResponseMs`,
`replayCount`, and `hintCount` are lifetime aggregates, so their displayed values
can shrink once old attempts drop — inherent to P2's design. No compaction on
save (load-time only, once per launch). No rollup record, no SCHEMA_VERSION bump.

## Delegation to free models (Jeffrey's mid-session request)

Goal: preserve Claude usage for supervision; send bounded prompts (A now; B after A
merges; D after B) to free OpenRouter models via Hermes, with fallback rotation.

- `scripts/hermes-dispatch.sh` (new, untracked, syntax-checked): dispatches a
  prompt file via one-shot `hermes -z` with `-m <model> --provider openrouter`,
  rotates through a model list on failure, tries to carry the Hermes session id
  forward so the next model resumes instead of restarting
  (`--pass-session-id` / `--resume`). `--list-free` prints the current `:free`
  catalog from OpenRouter's public models endpoint — use it to verify model ids;
  the two Nemotron ids baked in as defaults are best-effort guesses.
- BLOCKER: `OPENROUTER_API_KEY` is empty in this MacBook's `~/.hermes/.env`, so
  OpenRouter dispatch cannot run from here. Options: run the script on the Mac
  mini (canonical Hermes backend, per `~/memory/facts.md`), or Jeffrey sets the
  key locally. Keys must never enter the repo (AGENTS.md).
- Fallback executor available NOW: local Ollama (v0.32.5 running) with
  `gpt-oss:20b` via `--provider local-ollama` — sanctioned for prompt A by the
  "any free coder" note in `docs/reviews/prompts/README.md`.
- The `hermes -z` smoke test against local `gemma4:12b` was started but killed
  after ~2 min without output (slow local startup) — the one-shot plumbing is
  syntax-checked but NOT verified end-to-end. Verify with a small `-z` run before
  trusting the script. Native alternative: `hermes fallback add` (left untouched —
  it's global config).

## Next session (Sonnet) — suggested order

1. Jeffrey reviews `git diff main...attempts-compaction`; merge if good.
2. Unblock OpenRouter (mini or local key), verify `scripts/hermes-dispatch.sh
   --list-free`, correct the default model ids, dispatch
   `docs/reviews/prompts/A-trivial-batch.md`.
3. After A merges: dispatch B. After B: dispatch D (Nemotron Ultra first).
4. Supervise per the acceptance gate in `docs/reviews/prompts/README.md`.

Untracked files left in the working tree for review: this handoff and
`scripts/hermes-dispatch.sh`. Working tree is otherwise clean on branch
`attempts-compaction`.
