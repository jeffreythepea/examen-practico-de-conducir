# Hermes Prompt — Pure Simulated Route Foundation

Work in the `examen-practico-de-conducir` repository under Codex/Sol review.
Read `AGENTS.md`, then read these files completely:

- `docs/superpowers/specs/2026-08-07-simulated-exam-continuity-design.md`
- `docs/superpowers/plans/2026-08-07-simulated-exam-continuity.md`
- `src/active-session.js`
- `src/session-themes.js`
- `data/commands.json`

Implement only Task 1, the pure route-plan foundation.

## File fence

You may create only:

- `src/simulated-exam-route.js`
- `tests/simulated-exam-route.test.js`
- `docs/superpowers/plans/2026-08-07-hermes-simulated-route-handoff.md`

Do not modify any existing file. In particular, do not touch `src/app.js`,
`src/active-session.js`, `src/storage.js`, `src/i18n.js`, `styles.css`, catalog
or audio files, package files, service-worker files, other tests, design/spec
documents, README, CHANGELOG, or `.superpowers/sdd/progress.md`.

## Required behavior

Use test-driven development. Build a pure immutable planner for already
selected session items. It must:

1. partition items into precheck, `c-arr`, `c-incorp`, ordinary driving,
   `c-final`, and `c-inmov`;
2. preserve relative order within each partition;
3. emit those partitions in that narrative order;
4. emit frozen command steps with original item indexes and command IDs;
5. insert stable frozen transition steps for a preparation bridge when
   `c-arr` is absent, the departure consequence after `c-incorp` when present,
   cruise between ordinary driving commands, arrival before terminal actions
   when applicable, and parked closure when applicable;
6. expose no attempt, scoring, timing, audio, persistence, DOM, or translation
   behavior;
7. fabricate no command when a group is absent;
8. reject malformed phases, missing/blank IDs, invalid inputs, and duplicate
   item indexes rather than silently repairing them;
9. use injected deterministic randomness only for choosing among approved
   transition scene IDs, never for command ordering;
10. return deeply frozen caller-independent records and never mutate input.

Use names and return shapes that are explicit and small. Do not infer behavior
from localized command text. Use stable IDs and phases only.

## Rate-limit recovery

The selected free OpenRouter model may stop at any time. Work in these
restartable checkpoints and update the handoff file after each one:

1. failing validation/partition tests;
2. green validation/partition implementation;
3. failing transition/determinism/immutability tests;
4. complete green implementation;
5. full verification.

At every checkpoint record changed files, test command/output, remaining work,
and the exact next action. If rate-limited, stop cleanly and preserve the same
session and filesystem state. Do not restart from scratch, broaden scope,
switch tasks, commit, or push.

## Verification and handoff

Run:

```sh
node --test tests/simulated-exam-route.test.js
npm test
git diff --check
git status --short
```

Report implementation summary, public API, ordering/transition decisions,
focused and full test counts, diff-check result, exact status, and issues for
Codex review. Do not commit or push.
