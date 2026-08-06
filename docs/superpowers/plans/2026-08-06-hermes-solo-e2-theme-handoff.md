# Hermes Handoff — Solo E2 Pure Theme Foundation

Codex accepted the independent Solo E1 review on 2026-08-06, and Jeffrey has
approved continuing with bounded outsourced work. Run this prompt in the
current shared checkout: the approved specifications and E1 foundation are
deliberately uncommitted and are therefore absent from a clean Git worktree.
Preserve the existing dirty baseline and touch exactly the two authorized new
files.

## Prompt

You are implementing only the pure theme registry and selection layer for
Solo E2 in `examen-practico-de-conducir`. Read `AGENTS.md`,
`docs/superpowers/specs/2026-08-06-examiner-modes-themed-drives-design.md`,
`docs/superpowers/specs/2026-08-06-solo-engagement-roadmap-design.md`, and the
catalog model/tests before editing.

Create only:

- `src/session-themes.js`
- `tests/session-themes.test.js`

Implement immutable records for these exact stable IDs:

- `first-drive`
- `city-circuit`
- `roundabout-circuit`
- `manoeuvres`
- `precheck-inspection`
- `full-mock`

Each theme may contain stable selection criteria and localization keys, but it
must never copy Spanish command text, English meanings, accepted results, or
surface content. `full-mock` must carry an explicit simulated flag. Provide a
pure selector that:

- accepts the catalog, a theme ID, session length, and injected RNG;
- filters only by stable command metadata or IDs documented in tests;
- selects deterministically for a deterministic injected RNG;
- never duplicates commands or mutates caller-owned values;
- caps naturally when an eligible pool is smaller than the requested length;
- returns deeply frozen records;
- rejects unknown themes, malformed catalogs, unsupported lengths, and bad
  RNG output with descriptive errors.

Start with failing tests. Include boundary tests for every theme, deterministic
selection, no duplicates, small pools, immutability, malformed inputs, and the
simulated `full-mock` flag.

Prohibited changes:

- Do not modify `src/app.js`, `src/storage.js`, `src/active-session.js`,
  `src/training.js`, playback, scoring, readiness, production audio/manifests,
  service worker/package/deployment files, styles, or catalog text/IDs.
- Do not add UI or i18n yet; return a proposed bilingual key inventory in the
  handoff instead.
- Do not implement withheld reveals, pass thresholds, examiner snapshots,
  persistence, resume, openings/closings, or live controller integration.
- Do not edit, stage, commit, push, clean, restore, or delete any existing
  file. The only permitted writes are the two new files listed above.

Run the focused new tests, then `npm test` and `git diff --check`. Return an
implementation summary, exact files changed, domain decisions, RED/GREEN
evidence, test counts, diff check, status, proposed i18n key inventory, and any
questions Codex must resolve before integration.
