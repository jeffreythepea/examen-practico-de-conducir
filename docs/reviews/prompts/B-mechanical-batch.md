# Session B — mechanical batch (4 mid-size items)

You are implementing four well-specified items in the repo examen-practico-de-conducir
(vanilla-JS static PWA). The design work is done — implement exactly what is written
here plus the matching sections of `docs/reviews/2026-08-08-code-review.md` and
`docs/reviews/2026-08-08-play-review.md` (read only those sections). Do not redesign or
expand scope.

## Setup
```
git clone https://github.com/jeffreythepea/examen-practico-de-conducir.git
cd examen-practico-de-conducir && npm install && npm test
```
Suite must be green first. Then: `git checkout -b review-mechanical` (if the branch
exists, resume from the first unfinished item per `docs/reviews/PROGRESS.md`).

## Ground rules (binding — from AGENTS.md)
- `npm test` gates every item. EN + ES for all user-facing copy (`src/i18n.js`).
- No new dependencies. Match existing style: pure functions with injected dependencies,
  `Object.freeze` on returned records, exhaustive validation.
- **Checkpoint after each item:** one local commit per green item, update
  `docs/reviews/PROGRESS.md` in the same commit. Do NOT push.

## Items, in order

### B1. localStorage write-failure handling (code review P1)
`saveState` (`src/storage.js:67`) calls `storage.setItem` unguarded; a
QuotaExceededError thrown inside `completeTrial` (`src/app.js` ~line 1845) escapes the
click handler and strands the UI mid-answer. Add a `persistState()` helper inside
`bootstrap()` in `src/app.js` that wraps `saveState(window.localStorage, state)` in
try/catch. On failure: keep the in-memory state working, set a `persistError` flag, and
show a dismissible `role="alert"` notice on the setup screen — EN: "Progress could not
be saved to this device. Consider Export backup." ES: "El progreso no se pudo guardar en
este dispositivo. Considera Exportar copia." Replace every direct `saveState(...)` call
site in app.js (~10) with `persistState()`. Acceptance: a test with a storage stub whose
setItem throws — the trial still advances to reveal, and the notice renders on return to
setup; suite green.

### B2. Index the manifest and attempts (code review P5)
Hot-path linear scans to replace — behavior must not change (existing tests are the
oracle):
- Build `Map` indexes once at bootstrap: manifest by `commandId|speed`.
- `sessionStartEligibility` and `selectPlaybackVariant` (`src/app.js` ~lines 758/648):
  accept an optional prebuilt index parameter, defaulting to building one — keep
  signatures test-friendly, matching the codebase's dependency-injection style.
- `readinessForCatalog` (`src/readiness.js`): group attempts into
  `Map<commandId, attempts[]>` once, pass slices down; same for `masteryForAction`
  callers where straightforward.
- `groupByReadiness` (`src/practice-selection.js:33`): build a Map from
  `readinessRecords` instead of `.find` per command.
Acceptance: no full-manifest scan on setup render; all existing tests pass unmodified
(if a test must change, justify why in the summary).

### B3. End-session control (play review P2)
There is no way to leave a running session; the installed iPad app has no reload
affordance. Add a small "End session" control to the prompt screen (and mock-transition
screen) that, after a `window.confirm` (EN: "End this session? Progress on answered
commands is kept." / ES: "¿Terminar esta sesión? Se conserva el progreso de las órdenes
respondidas."), stops the timer, cancels audio, discards the active session via the
existing `discardSession` path, and returns to setup. Keep it visually secondary (match
existing non-primary button styling). Scored attempts already recorded must remain.
Acceptance: rendering + behavior test; confirm-declined leaves the session untouched;
suite green.

### B4. Stratified shuffle for mixed sessions (play review P4)
In `selectPracticeCommands` (`src/practice-selection.js`, shuffle at ~line 156): when
`phase === 'mixed'`, interleave phases within each priority group after shuffling
(alternate driving/precheck as availability allows — a stratified merge), so a mixed
session cannot front-load one phase by chance. Priority-group ordering must be
preserved; non-mixed phases unchanged. Use the injected `rng` only. Acceptance: seeded
test asserting no phase runs more than N consecutive commands when both phases are
available in a group (pick N=2 for strict alternation where counts allow); existing
selection tests still pass.

## Deliverables
Per-item commits with PROGRESS.md updates; final summary — per-item status, files
touched, invariants you verified, anything deliberately not done.
