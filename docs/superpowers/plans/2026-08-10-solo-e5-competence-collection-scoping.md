# Scoping Solo E5 — Competence-Linked Collection

**Status:** Scoped and directed 2026-08-10, proceeding straight to implementation per
Jeffrey's "clear as much of the backlog as possible with as few checkpoints" direction.
Design calls below are mine, made against the roadmap's explicit gate rather than
Jeffrey's live input — flagged in the PR for review rather than blocked on beforehand.

**Source:** `docs/superpowers/specs/2026-08-06-solo-engagement-roadmap-design.md:168-181`.
Solo E4 (challenge cabinet) is complete, satisfying the roadmap's own build-order
condition for starting E5 ("only after challenge results feel worth commemorating").

**Goal:** "Give long-term shape without manipulative retention."

**Gate (binding):** accomplishments are reconstructible from evidence, survive backup,
never decay, and do not require scheduled use.

## Reading the gate

"Reconstructible from evidence" and "never decay" rule out a simple mutable "earned"
flag that could drift from what actually happened. Two different evidence shapes are
available:

1. **Already fully derivable from `state.attempts`, zero new storage**: which examiners
   the learner has actually heard. Every attempt already stores `voiceId`
   (`training.js`), so "examiner encountered" is a pure query — map `voiceId` through
   `examinerForVoiceId` (`examiners.js`) over the full attempt history. No write path,
   no staleness risk, trivially satisfies the gate.
2. **Needs a session-level completion fact attempts can't provide**: the five
   challenge-linked accomplishments (Audio-only pass, No-replay pass, Five-examiner
   pass, Precheck ready, Roundabout ready) and "completed themed drives." Same root
   problem Personal Best hit — attempts carry no `sessionId`, so "was *this* session a
   clean Audio-only run" can't be reconstructed after the fact from individual attempt
   rows alone.

For (2), reusing Personal Best's precedent (a small persisted log, written once at
session completion) is the pragmatic choice — but with one important difference:
**accomplishments must be write-once and never overwritten**, unlike `personalBests`
which legitimately improves over time. An accomplishment log entry is itself the
"evidence" (a timestamped record of one real completion event that happened); once
written it's permanent, satisfying "never decay" by construction rather than by
convention.

## Accomplishment set (5, matching the roadmap's named examples exactly)

| Accomplishment | Earned by |
|---|---|
| Audio-only pass | A clean `audio-only` challenge session |
| No-replay pass | A clean `one-listen` challenge session |
| Five-examiner pass | A clean `five-examiners` challenge session |
| Precheck ready | A clean `control-check` challenge session |
| Roundabout ready | A clean `perfect-roundabouts` challenge session |

Not included: `personal-best`, `brisk-examiner`, `confusion-pairs` — none of the
roadmap's five named accomplishments map to these, and inventing new accomplishment
names not in the roadmap is scope creep. `personal-best` records are handled
separately (see below, they already exist).

## Design decisions

1. **New persisted log**: `state.completions` — an array of frozen, append-only
   records `{ kind: 'challenge' | 'theme', id, achievedAt }`. Schema-additive like
   `personalBests`/`challengeId` before it (default `[]`, no `SCHEMA_VERSION` bump).
   Deduplicated by `(kind, id)` — first completion only, never rewritten.
2. **Write hook**: same point `settlePersonalBest` already uses (the reveal screen's
   Continue handler, when `model.screen === 'results'`) — record a `'challenge'`
   completion when the just-finished session's challenge passed its clean-rule
   evaluation, and record a `'theme'` completion whenever a themed session (any of the
   6 `SESSION_THEMES`, not just Adaptive) reaches results, regardless of accuracy —
   "completed" per the roadmap wording, not "passed."
3. **Accomplishments are a derived view over `state.completions`**, not the log itself
   — `accomplishmentStatus(completions)` maps the 5 fixed accomplishment IDs to
   earned/not + `achievedAt`, by looking up the matching `challenge` completion.
   Genuinely reconstructible: replay `state.completions` in order, nothing else needed.
4. **Examiner encounters**: pure derivation over `state.attempts`, per point 1 above —
   no completions-log entry, since attempts already carry everything needed.
5. **Personal bests**: already fully built (E4's `state.personalBests`). E5's job here
   is just to make them *visible* somewhere persistent — right now a personal best only
   ever shows once, in the results-screen notice at the moment it's set, then
   disappears. Surface the existing `state.personalBests` record in the new collection
   view; no new tracking.
6. **UI**: one new screen, "Collection" (reachable from setup, alongside Readiness),
   showing three sections: the 5 accomplishment badges (earned + date, or locked),
   completed themed drives (6 themes, completed + last date, or not yet), and personal
   bests (per theme key, with time). Roadmap wording suggests real visual treatment
   ("examiner stamps, route cards, or test-folder endorsements"); this pass ships a
   plain, correct list instead. Per Jeffrey (2026-08-10): demoted to low-priority
   deferred, not just "later" — he doesn't think the visual metaphor adds much. Revisit
   only if it comes up again on its own merits, not as an assumed next step.
7. **Backup/import**: `state.completions` rides through `exportState`/`importState`
   automatically once it's a validated top-level state field, same as every other
   field — no special-case code needed, just correct validation.

## Explicitly deferred (not this pass)

- **Visual "stamp/route card" styling — low priority, deferred indefinitely** (Jeffrey,
  2026-08-10): not just sequenced after the data model, but demoted — he doesn't think
  the visual metaphor helps much. The plain list stands as the shipped UI unless this
  gets revisited on its own merits later, not picked back up by default.
- Examiner-encounter *history* detail (which specific sessions, not just "have you
  heard this voice") — the roadmap only asks to "show completed themed drives and
  examiner encounters," which a simple heard/not-heard set satisfies.
