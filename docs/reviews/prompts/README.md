# Review implementation prompts

Session-ready prompts for implementing the findings in `2026-08-08-code-review.md` and
`2026-08-08-play-review.md`. Each file is a complete first message for a fresh agent
session — paste its contents verbatim, or tell an agent with repo access: "Read
`docs/reviews/prompts/<file>` in this repo and execute it."

## Run order and model routing

| # | Prompt file | Model tier | Branch | Depends on |
|---|---|---|---|---|
| 1 | `A-trivial-batch.md` | Nemotron Super (or any free coder) | `review-trivial` | — |
| 2 | `B-mechanical-batch.md` | Nemotron Ultra/Super | `review-mechanical` | A merged |
| 3 | `C-sonnet-compaction.md` | Claude Sonnet 5 | `attempts-compaction` | — (parallel OK) |
| 4 | `D-a11y-labels.md` | Nemotron Ultra first; escalate to Sonnet 5 if the diff disappoints | `a11y-labels` | B merged (shares i18n.js) |
| — | SW state memoization (code review P6) | Sonnet 5, later | — | Optional; prompt not yet written |
| — | Event delegation (code review P8) | Skip for now | — | Only alongside future feature work |

## Checkpoint policy (deviation from AGENTS.md, endorsed by Jeffrey)

Free-tier models can rate-limit out mid-session. To make handoffs safe, agents **commit
locally on their work branch after each item goes green** — one item, one commit. This is
the one sanctioned exception to "collaborators only propose diffs": work branches are
checkpoints, not history. Jeffrey still reviews every branch and is the only one who
merges to `main` or pushes. If a session dies mid-item, the next session (any model)
resumes: same branch, read `docs/reviews/PROGRESS.md`, continue from the first unchecked
item.

## Acceptance gate for every item, regardless of model

1. `npm test` fully green (612+ tests) and `git diff --check` clean.
2. All user-facing copy exists in **both** English and Spanish.
3. Jeffrey reads the diff before merging. A model that "finished" with a red suite has
   not finished.
