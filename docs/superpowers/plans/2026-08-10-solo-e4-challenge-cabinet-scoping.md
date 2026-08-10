# Scoping Solo E4 — Challenge Cabinet

**Status:** Scoped and directed 2026-08-10. Not yet approved to start
implementation.

**Source:** `docs/superpowers/specs/2026-08-06-solo-engagement-roadmap-design.md`,
Solo E4 — "Challenge cabinet." Solo E3 (sensory and physical consequence) is now
fully merged (G1–G4, see `docs/superpowers/plans/2026-08-09-solo-e3-completion-scoping.md`),
so E4 is next in the roadmap's recommended build order.

**Roadmap goal:** "Add replayable, self-selected tests of real skills."
Eight challenge types, all retaining ordinary readiness outcomes and abandonable
without penalty:

- Audio only: no written Spanish.
- One listen: replay disabled.
- Brisk examiner: reviewed hard-delivery recordings.
- Five examiners: a clean session with every voice.
- Perfect roundabouts: distinguish every exit without assistance.
- Control check: complete a precheck inspection without a miss.
- Personal best: improve a comparable clean session's response time.
- Confusion pairs: contrast commands the learner has actually confused.

---

## What already exists

The session-configuration plumbing a "challenge" would plug into is already
built and pluggable, in two orthogonal layers:

- **`src/session-presets.js`** — an experience config (hint policy, speed,
  timed, length, replay policy, reveal policy). `learn` / `practice` / `mock`
  already exist as presets; `mock` already sets `hintPolicy: 'unavailable'`
  and `replayPolicy: 'none'`.
- **`src/session-themes.js`** — a command-filter registry (`first-drive`,
  `city-circuit`, `roundabout-circuit`, `manoeuvres`, `precheck-inspection`,
  each a `criteria(command)` predicate over the catalog).

Both are validated registries feeding `src/storage.js` (`SESSION_PRESET_IDS`,
`THEME_IDS`, `EXAMINER_CHOICE_IDS`). A challenge looks like a third
preset-like config — settings + filter + pass/fail rule — layered on this same
machinery. No parallel system is needed for configuration itself.

Storage schema is at `SCHEMA_VERSION = 4` (`src/storage.js:8`) with a
forward-only migration chain. Anything that needs new per-attempt fields (see
confusion pairs, below) needs a new migration to version 5.

## Per-challenge status

| Challenge | Mechanism | Gap |
|---|---|---|
| **Audio only** | Exists — `hintPolicy: 'unavailable'` already used by Mock (`session-presets.js:48-54`) | None; force it in a new preset |
| **One listen** | Exists — `replayPolicy: 'none'` already used by Mock (`active-session.js:23,137`) | None; force it in a new preset |
| **Five examiners** | Partial — exactly 5 examiner records exist (`src/examiners.js:4-39`), `examinerChoice` setting supports `mixed`/`today`/manual | No scheduler that guarantees "each of the 5 voices used exactly once in one session" — new selection logic needed |
| **Perfect roundabouts** | Partial — roundabout geometry supports 4–5 exits with per-exit correctness (`src/spatial-surfaces.js:92-131`); generic `unaided`/`assisted`/`incorrect` outcome tracking exists | No "every exit represented in one session, all unaided" grouping — new session-composition + evaluation rule needed |
| **Control check** | Mostly exists — `precheck-inspection` theme already filters `phase === 'precheck'` (`session-themes.js:138-144`); generic `missReason` is recorded per attempt | Just needs a pass rule: precheck theme + zero misses in the session — no new tracking |
| **Personal best** | Exists — `responseMs` is stored per attempt and aggregated (`app.js:850-868`, `training.js:179-241`) | Needs a definition of "comparable clean session" and comparison logic; no schema change |
| **Brisk examiner** | Partial — `speed` is a real per-session/per-recording setting (0.75/0.9/1×) | No recordings are tagged "reviewed hard-delivery" — manifest only carries `speed`/`voiceId`/`path`. Resolved: use `speed: 1` as the stand-in (see Direction) |
| **Confusion pairs** | Does not exist | `missReason` only stores a self-reported *category* (hearing/meaning/mapping/etc.), never *which wrong answer was picked*. Needs new per-attempt tracking before this challenge is buildable at all — the only item requiring a schema migration |

(Full citations from the grounding pass available on request — trimmed here
for readability.)

## Direction (2026-08-10)

1. **Brisk examiner** — use `speed: 1` (fastest existing playback) as "brisk"
   for now. No content-curation pass needed; this is a code-only task. Real
   hard-delivery recordings can be revisited later if `speed: 1` doesn't read
   as brisk enough in practice.
2. **Confusion pairs** — track which wrong answer was actually selected going
   forward only (new per-attempt field, schema migration to v5). No attempt
   to backfill or infer pairs from existing `missReason` data — that signal is
   too weak to call a real pair. The challenge simply isn't available until
   enough post-migration data has accumulated for a given learner.
3. **Five examiners / Perfect roundabouts** — build one shared "guaranteed
   full coverage of set S in a session" mechanism, reused by both (voices for
   one, roundabout exits for the other) and available for future challenges
   with the same shape.
4. **Cross-cutting readiness semantics** — confirmed: challenge attempts write
   into the same readiness ledger as regular practice; a challenge is a
   pass/fail wrapper around a normal session. "Abandon without penalty" means
   no pass/fail verdict gets recorded on exit — any attempts already made
   still count normally toward readiness, same as any other session.

## Build order

Roughly increasing cost, per the direction above:

1. **Audio only**, **One listen** — trivial; both settings already exist,
   just need a new preset/challenge wrapper.
2. **Control check** — small; existing theme + a zero-miss pass rule.
3. **Personal best** — small–medium; existing data, needs a "comparable
   session" definition.
4. **Five examiners**, **Perfect roundabouts** — medium; shared "full
   coverage of set S" mechanism, then two thin challenge configs on top of it.
5. **Brisk examiner** — medium; code-only, no blocker now that `speed: 1` is
   the accepted stand-in.
6. **Confusion pairs** — largest; needs new attempt-level tracking, a schema
   migration to v5, and time to accumulate real data before the challenge is
   meaningful. Last in build order.
