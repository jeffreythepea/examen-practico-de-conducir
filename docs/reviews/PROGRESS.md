# Review implementation progress

One row per item. Agents: update your row in the same commit as the item's checkpoint.
Status values: `todo` / `in-progress` / `green` (tests pass, awaiting Jeffrey's review) /
`merged` / `blocked (reason)`.

| Item | Prompt | Branch | Model used | Status | Notes |
|---|---|---|---|---|---|
| A1 sharp-less test skip (code P3) | A | review-trivial | — | todo | |
| A2 dead code removal (code P4) | A | review-trivial | — | todo | |
| A3 results framing sentence (play P3) | A | review-trivial | — | todo | |
| A4 ES duplicate meaning (play P5) | A | review-trivial | — | todo | |
| A5 ms → seconds formatting (play P6) | A | review-trivial | — | todo | |
| A6 CSP meta tag (code P7) | A | review-trivial | — | todo | Jeffrey: manual Safari/Chromium smoke after merge |
| B1 saveState guard (code P1) | B | review-mechanical | — | todo | |
| B2 manifest/attempt indexes (code P5) | B | review-mechanical | — | todo | |
| B3 end-session control (play P2) | B | review-mechanical | — | todo | |
| B4 stratified mixed shuffle (play P4) | B | review-mechanical | — | todo | |
| C attempts compaction (code P2) | C | attempts-compaction | — | todo | Sonnet 5 only |
| D spatial a11y labels (play P1) | D | a11y-labels | — | todo | After B merged; Ultra first, Sonnet fallback |
| — SW state memoization (code P6) | not written | — | — | deferred | Sonnet, after the above |
| — event delegation (code P8) | not written | — | — | deferred | Only with future feature work |
