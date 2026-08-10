# Review implementation progress

One row per item. Agents: update your row in the same commit as the item's checkpoint.
Status values: `todo` / `in-progress` / `green` (tests pass, awaiting Jeffrey's review) /
`merged` / `blocked (reason)`.

| Item | Prompt | Branch | Model used | Status | Notes |
|---|---|---|---|---|---|
| A1 sharp-less test skip (code P3) | A | review-trivial (merged) | nemotron-3-super-120b-a12b | merged | |
| A2 dead code removal (code P4) | A | review-trivial (merged) | nemotron-3-super-120b-a12b | merged | |
| A3 results framing sentence (play P3) | A | review-trivial (merged) | nemotron-3-super-120b-a12b + Sonnet 5 (missing test added) | merged | |
| A4 ES duplicate meaning (play P5) | A | review-trivial (merged) | nemotron-3-super-120b-a12b + Sonnet 5 (missing test added) | merged | |
| A5 ms → seconds formatting (play P6) | A | review-trivial (merged) | Sonnet 5 (nemotron dispatch left one call site unfixed — 11 failing tests) | merged | |
| A6 CSP meta tag (code P7) | A | review-trivial (merged) | Sonnet 5 | merged | CSP broke inline positioning styles for spatial targets, found via manual smoke test and fixed same day (`b605d7c`) |
| B1 saveState guard (code P1) | B | review-mechanical (merged) | Sonnet 5 | merged | |
| B2 manifest/attempt indexes (code P5) | B | review-mechanical (merged) | Sonnet 5 | merged | |
| B3 end-session control (play P2) | B | review-mechanical (merged) | Sonnet 5 | merged | |
| B4 stratified mixed shuffle (play P4) | B | review-mechanical (merged) | Sonnet 5 | merged | |
| C attempts compaction (code P2) | C | attempts-compaction (merged) | Claude Fable 5 | merged | Kept-attempts approach, no schema bump |
| D spatial a11y labels (play P1) | D | a11y-labels | Sonnet 5 | green | Junction/roundabout labeled by position (`Left road`/`First exit`...); u-turn/overtake/join-traffic/parking/stopping labeled by visible feature, reusing existing `explanationKey` strings for decoys. New comprehensive tests assert every target's label is non-empty, distinct, present in both locales, and never contains "correct" — across all templates/seeds, not just one sampled case. |
| — SW state memoization (code P6) | not written | — | — | deferred | Sonnet, after the above |
| — event delegation (code P8) | not written | — | — | deferred | Only with future feature work |
| — Follow-up backlog (visual/content bugs, motion redesign scoping) | not written | — | — | deferred | See `docs/reviews/2026-08-09-followup-backlog.md` |
