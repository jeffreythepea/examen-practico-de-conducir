# Release B Readiness and Targeted Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add evidence-based command readiness, targeted and recommended practice, coverage-aware audio variation, and a local lesson-correction log without changing command content or scoring semantics.

**Architecture:** Put all new learning decisions in small pure modules, then integrate them into the existing controller and renderer. Persist only lesson annotations and the selected practice mode; readiness remains derived from attempts so it cannot become stale. Deliver the domain foundation first, review it, then add bilingual views and app integration.

**Tech Stack:** Static ES modules, vanilla HTML/CSS, versioned JSON local storage, Node.js `node:test`, existing immutable state and rendering conventions.

## Global Constraints

- Optimize for Jeffrey's practical-exam preparation, not engagement or user acquisition.
- Preserve all stable command, action, phrasing, surface, and provenance IDs.
- Commands and generated command audio remain Spanish.
- Every new interface string exists in English and Spanish.
- Readiness is evidence, not a percentage, score, streak, badge, or quota.
- A lesson flag annotates a command; it never changes accepted answers or catalog data.
- Action mastery stays action-level. Variant exposure affects playback selection only.
- Credentials never enter Git, runtime files, caches, or browser-delivered assets.
- Do not add dependencies.
- All new selection functions accept injected `now` and/or `rng` dependencies for deterministic tests.
- Tests gate every task; run `npm test` and `git diff --check` before review.

---

## File and Ownership Map

### Hermes Run 1 — domain foundation, one continuous run

- Create `src/readiness.js`: derive command readiness and evidence summaries.
- Create `tests/readiness.test.js`: readiness boundary and evidence tests.
- Create `src/practice-selection.js`: target filtering and recommended ordering.
- Create `tests/practice-selection.test.js`: phase, target, priority, and uniqueness tests.
- Create `src/variant-coverage.js`: choose the least-exposed recorded phrasing/voice pair.
- Create `tests/variant-coverage.test.js`: exposure counts and deterministic tie tests.
- Create `src/lesson-flags.js`: validate and update local lesson annotations.
- Create `tests/lesson-flags.test.js`: flag lifecycle and validation tests.

Hermes must not modify existing source files in Run 1. Codex reviews the additive
foundation before storage, controller, or UI integration. This keeps the current
app runnable: schema 3 cannot safely become the default until the controller and
active-session validators also understand `recommended` mode.

### Hermes Run 2 — pure view scaffolding after Run 1 review

- Create `src/readiness-view.js`: render readiness rows, filters, and lesson-flag editor markup from supplied view data.
- Create `tests/readiness-view.test.js`: semantic markup and escaping tests.
- Modify `src/i18n.js` and `tests/i18n.test.js`: bilingual Release B copy.
- Modify `styles.css`: readiness screen and lesson editor layout.

Hermes Run 2 must not modify `src/app.js`, session selection, persistence, catalog, or audio.

### Codex integration and release

- Modify `src/storage.js`, `src/training.js`, `src/active-session.js`, and their tests for schema 3 and the new mode contract.
- Modify `src/app.js` and app tests to connect setup, readiness, flags, session creation, and coverage-aware playback.
- Modify README, CHANGELOG, design/release audit, and run browser/iPad acceptance.

---

### Task 1: Derive Command Readiness

**Files:**
- Create: `src/readiness.js`
- Create: `tests/readiness.test.js`

**Interfaces:**
- Consumes: command records with `id`, `actionId`, and `phase`; scored attempts from `src/training.js`; lesson flags from Task 4.
- Produces:
  - `READINESS_STATES = Object.freeze(['ready', 'in-progress', 'needs-practice', 'not-tested'])`
  - `readinessForCommand(command, attempts, lessonFlags = [], now = Date.now())`
  - `readinessForCatalog(commands, attempts, lessonFlags = [], now = Date.now())`
- `readinessForCommand` returns a frozen record:

```js
{
  commandId: 'c-der',
  actionId: 'turn-right',
  phase: 'driving',
  state: 'needs-practice',
  recentOutcomes: ['incorrect', 'unaided'], // newest first, maximum five
  lastPracticedAt: 1_721_000_000_000,
  averageResponseMs: 1300,
  replayCount: 2,
  hintCount: 1,
  openLessonFlagCount: 1,
  nextDueAt: 1_721_086_400_000
}
```

State rules, evaluated against attempts whose `commandId` matches:

1. No scored attempt: `not-tested`.
2. Latest outcome incorrect or assisted: `needs-practice`.
3. At least three distinct UTC dates with unaided success and the two latest attempts both unaided: `ready`.
4. Otherwise: `in-progress`.

`now` is passed to the existing action schedule calculation only if needed; do not invent an overdue readiness state.

- [ ] **Step 1: Write failing state-boundary tests**

```js
test('readiness requires three UTC dates and the latest two attempts unaided', () => {
  const attempts = [
    attempt('unaided', Date.UTC(2026, 6, 1)),
    attempt('unaided', Date.UTC(2026, 6, 2)),
    attempt('unaided', Date.UTC(2026, 6, 3))
  ];
  assert.equal(readinessForCommand(COMMAND, attempts).state, 'ready');
});

test('a latest assisted result needs practice even after older success', () => {
  const attempts = [
    attempt('unaided', Date.UTC(2026, 6, 1)),
    attempt('unaided', Date.UTC(2026, 6, 2)),
    attempt('unaided', Date.UTC(2026, 6, 3)),
    attempt('assisted', Date.UTC(2026, 6, 4))
  ];
  assert.equal(readinessForCommand(COMMAND, attempts).state, 'needs-practice');
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `node --test tests/readiness.test.js`

Expected: FAIL because `src/readiness.js` does not exist.

- [ ] **Step 3: Implement the minimal pure derivation**

Use `masteryForAction(attempts, command.actionId)` only for `nextDueAt`; compute readiness and displayed evidence from command-matching attempts. Sort a copy by timestamp. Count `textShown` as hint use and sum `replays`. Count only flags with matching `commandId` and `status === 'open'`.

```js
export const READINESS_STATES = Object.freeze([
  'ready', 'in-progress', 'needs-practice', 'not-tested'
]);

export function readinessForCatalog(commands, attempts, lessonFlags = [], now = Date.now()) {
  return Object.freeze(commands.map(command =>
    readinessForCommand(command, attempts, lessonFlags, now)
  ));
}
```

- [ ] **Step 4: Add evidence, immutability, sorting, and cross-command isolation tests**

Test no attempts, one attempt, same-date repetitions, recent-outcome order, maximum-five truncation, response-time averaging, replay/hint totals, open versus resolved flags, unsorted input, and input non-mutation.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/readiness.test.js`

Expected: PASS.

---

### Task 2: Select Targeted and Recommended Sessions

**Files:**
- Create: `src/practice-selection.js`
- Create: `tests/practice-selection.test.js`

**Interfaces:**
- Consumes: `readinessForCatalog` from Task 1, command records, attempts, lesson flags, current setup phase and length.
- Produces:

```js
selectPracticeCommands(commands, {
  phase,                       // 'driving' | 'precheck' | 'mixed'
  length,                      // 'short' | 'medium' | 'all'
  target = { kind: 'recommended' },
  attempts = [],
  lessonFlags = [],
  now = Date.now(),
  rng = Math.random
})
```

Supported targets:

```js
{ kind: 'recommended' }
{ kind: 'needs-practice' }
{ kind: 'not-tested' }
{ kind: 'lesson-flags' }
{ kind: 'not-ready' }
{ kind: 'command', commandId: 'c-der' }
{ kind: 'free' }
```

Recommended order is:

1. `not-tested`
2. `needs-practice`
3. non-ready commands whose action schedule is due (`nextDueAt <= now`)
4. remaining `in-progress`
5. `ready`

Shuffle inside each priority group using injected `rng`. Never return a command twice. Always filter phase before target selection. A selected-command target returns that one command or throws if it is missing/outside the selected phase. `lesson-flags` uses open flags only. Lengths continue to use `SESSION_LENGTHS` (`5`, `10`, `15`). If a target contains fewer commands than requested, return all eligible commands without padding from another target.

- [ ] **Step 1: Write failing target and priority tests**

```js
test('recommended orders unseen before needs-practice before in-progress before ready', () => {
  const selected = selectPracticeCommands(COMMANDS, {
    phase: 'mixed', length: 'all', attempts: ATTEMPTS, now: NOW, rng: () => 0
  });
  assert.deepEqual(selected.map(command => command.id), [
    'unseen', 'missed', 'due', 'learning', 'ready'
  ]);
});

test('lesson flag target includes only commands with open flags', () => {
  const selected = selectPracticeCommands(COMMANDS, {
    phase: 'mixed', length: 'all', target: { kind: 'lesson-flags' },
    lessonFlags: [openFlag('c-der'), resolvedFlag('c-izq')]
  });
  assert.deepEqual(selected.map(command => command.id), ['c-der']);
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `node --test tests/practice-selection.test.js`

Expected: FAIL because `src/practice-selection.js` does not exist.

- [ ] **Step 3: Implement phase filtering, target filtering, and ranked groups**

Build each group from Task 1 readiness records, map records back to commands by stable ID, use a local Fisher-Yates helper, concatenate groups, and slice to `SESSION_LENGTHS[length]`.

- [ ] **Step 4: Add validation and edge-case tests**

Cover every target kind, empty target pools, unknown phase/length/target/command, deterministic ties, phase exclusion, resolved flags, duplicate flags, uniqueness, length limits, and input non-mutation.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/readiness.test.js tests/practice-selection.test.js`

Expected: PASS.

---

### Task 3: Prefer Less-Exposed Recorded Variants

**Files:**
- Create: `src/variant-coverage.js`
- Create: `tests/variant-coverage.test.js`

**Interfaces:**
- Consumes: already speed-filtered recorded audio candidates and scored attempts.
- Produces:

```js
selectCoverageAwareVariant(candidates, attempts = [], rng = Math.random)
```

Exposure identity is exactly `commandId + phrasingId + voiceId`; speed does not create a separate mastery or exposure target. Count attempts only when all three IDs match. Select uniformly among candidates tied for the lowest count with injected `rng`. Return a frozen copy. Reject an empty candidate list. Do not compare browser-speech fallback to packaged voices; the caller invokes this function only when recorded candidates exist.

- [ ] **Step 1: Write failing least-exposure tests**

```js
test('prefers an unexposed phrasing and voice pair', () => {
  const result = selectCoverageAwareVariant(CANDIDATES, [
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 0.75 }),
    attempt({ phrasingId: 'p1', voiceId: 'v1', speed: 1 })
  ], () => 0);
  assert.deepEqual([result.phrasingId, result.voiceId], ['p2', 'v2']);
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `node --test tests/variant-coverage.test.js`

Expected: FAIL because `src/variant-coverage.js` does not exist.

- [ ] **Step 3: Implement exposure counting and deterministic tie selection**

```js
const key = value => `${value.commandId}\u0000${value.phrasingId}\u0000${value.voiceId}`;
```

Count attempts with a `Map`, find the minimum candidate count, select from the tied candidates with `Math.floor(rng() * tied.length)` clamped to the final index, and freeze the returned copy.

- [ ] **Step 4: Add tests for speed aggregation, command isolation, ties, empty input, immutability, and non-mutation**

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/variant-coverage.test.js`

Expected: PASS.

---

### Task 4: Implement the Pure Lesson-Correction Log

**Files:**
- Create: `src/lesson-flags.js`
- Create: `tests/lesson-flags.test.js`

**Interfaces:**
- Produces:

```js
LESSON_FLAG_CATEGORIES = Object.freeze([
  'wording', 'audio', 'visual', 'accepted-action', 'vehicle-control', 'other'
]);
LESSON_FLAG_STATUSES = Object.freeze(['open', 'resolved']);

validateLessonFlag(value)
createLessonFlag(flags, { commandId, category, note }, { now = Date.now, randomUUID, cryptoRef })
updateLessonFlag(flags, id, changes, { now = Date.now })
```

A valid flag has:

```js
{
  id: 'uuid',
  commandId: 'c-der',
  category: 'wording',
  note: 'Instructor used a shorter phrase.',
  createdAt: 1_721_000_000_000,
  updatedAt: 1_721_000_000_000,
  status: 'open'
}
```

Trim notes; require 1–280 Unicode code points. `updatedAt >= createdAt`. Update may change only `category`, `note`, or `status`; identity, command, and creation time remain stable. Every operation returns new frozen arrays and records without mutating input. Generate IDs with the same cryptographic policy as `createAttemptId`.

- [ ] **Step 1: Write failing lesson-flag lifecycle tests**

```js
test('creates, resolves, reopens, and edits a lesson flag immutably', () => {
  const created = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: '  Ask instructor.  '
  }, { now: () => 100, randomUUID: () => 'flag-1' });
  assert.equal(created[0].note, 'Ask instructor.');
  const resolved = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  assert.equal(resolved[0].status, 'resolved');
  assert.equal(created[0].status, 'open');
});
```

- [ ] **Step 2: Run and confirm the missing-module failure**

Run: `node --test tests/lesson-flags.test.js`

Expected: FAIL because `src/lesson-flags.js` does not exist.

- [ ] **Step 3: Implement flag validation and lifecycle helpers**

Reuse the attempt-ID entropy approach locally or extract a narrowly named shared helper only if that does not enlarge the authorized file set. Count Unicode code points with `[...note].length`.

- [ ] **Step 4: Add invalid-input tests**

Cover every category/status, whitespace-only and 281-code-point notes, invalid dates, missing IDs, duplicate IDs, unknown update fields, unresolved IDs, unsafe UUID fallback, input mutation, and returned freezing.

- [ ] **Step 5: Run the complete Hermes Run 1 focused suite**

Run:

```bash
node --test \
  tests/readiness.test.js \
  tests/practice-selection.test.js \
  tests/variant-coverage.test.js \
  tests/lesson-flags.test.js
```

Expected: PASS.

- [ ] **Step 6: Run repository gates and stop for Codex review**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: all tests pass; diff check emits no output; status lists only the Run 1 authorized files. Do not commit or push.

---

### Task 5: Add the Pure Readiness View Scaffold

**Files:**
- Create: `src/readiness-view.js`
- Create: `tests/readiness-view.test.js`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.js`
- Modify: `styles.css`

**Interfaces:**
- Consumes a locale, translator function, commands, readiness records, lesson flags, and filter state. It does not read storage or attach event handlers.
- Produces `renderReadinessView({ locale, t, commands, readiness, lessonFlags, filters })`, returning markup whose controls use `data-action` attributes for Codex integration.
- Required actions: `close-readiness`, `set-readiness-phase`, `set-readiness-state`, `start-readiness-practice`, `start-command-practice`, `open-lesson-flag`, `save-lesson-flag`, `resolve-lesson-flag`, `reopen-lesson-flag`.

- [ ] **Step 1: Write failing semantic-markup and escaping tests**

Assert Driving and Prechecks group headings, all four states, evidence fields, flag indicator, filters, one-command practice action, lesson editor fields, and HTML escaping of notes and command copy.

- [ ] **Step 2: Implement pure escaped markup**

Use the repository's existing escape and bilingual-copy conventions. If an escape helper is not exported, define a local helper rather than modifying `src/app.js`.

- [ ] **Step 3: Add all bilingual strings and i18n parity tests**

Include screen title, state labels, evidence labels, filters, targeted-practice actions, flag categories/statuses, editor actions, validation/error copy, empty states, and setup navigation.

- [ ] **Step 4: Add landscape-first CSS with portrait fallback**

Keep 44px touch targets, visible focus, semantic table/list reading order, and no horizontal scrolling at current iPad breakpoints.

- [ ] **Step 5: Run focused and full gates, then stop for Codex review**

Run:

```bash
node --test tests/readiness-view.test.js tests/i18n.test.js
npm test
git diff --check
```

Expected: PASS and no diff-check output. Do not commit or push.

---

### Task 6: Integrate Release B into Sessions and the App

**Files:**
- Modify: `src/storage.js`
- Modify: `tests/storage.test.js`
- Modify: `src/training.js`
- Modify: `tests/training.test.js`
- Modify: `src/active-session.js`
- Modify: `tests/active-session.test.js`
- Modify: `src/app.js`
- Modify: `tests/app-state.test.js`
- Modify: `tests/app-controller.test.js`
- Modify: `tests/app-smoke.test.js`

**Interfaces:**
- Consume Tasks 1–5.
- Setup modes become `recommended` and `free`; targeted sessions use an explicit target object and do not become persisted modes.
- Active sessions persist the effective target plus stable selected command/audio identities so resume remains deterministic.

- [ ] **Step 1: Write failing schema-3 migration and round-trip tests**

Schema 3 defaults add:

```js
settings: { /* existing values */, mode: 'recommended' },
lessonFlags: []
```

Migration `2 -> 3` is:

```js
state => ({
  ...state,
  schemaVersion: 3,
  settings: {
    ...state.settings,
    mode: state.settings?.mode === 'free' ? 'free' : 'recommended'
  },
  lessonFlags: []
})
```

Schema 1 must still migrate sequentially through schema 2. Validate
`settings.mode` against `recommended | free`, validate an array of unique
lesson-flag IDs through Task 4, preserve compatible unknown additive fields,
and keep replacement atomic. Explicit `free` remains `free`; absent or legacy
`weakest-first` becomes `recommended`.

- [ ] **Step 2: Implement schema 3 and run storage tests**

Run: `node --test tests/storage.test.js`

Expected: PASS, including schema-1-to-3, schema-2-to-3, flags, unknown fields,
future schema rejection, and active-session round trips.

- [ ] **Step 3: Write failing mode and active-session migration tests**

Replace `weakest-first` runtime expectations with `recommended`; retain validation of old saved data only in storage migration tests. Add target validation to active sessions without changing version-1 sessions that have no target.

- [ ] **Step 4: Route normal session selection through `selectPracticeCommands`**

The existing `createSession` public interface should delegate recommended selection to Task 2 or accept selected commands from the controller; do not maintain two competing schedulers.

- [ ] **Step 5: Route recorded playback through `selectCoverageAwareVariant`**

Extend `selectPlaybackVariant` to accept attempts. Filter candidates by command and selected speed first. If recorded candidates exist, use Task 3; otherwise preserve the existing browser-speech fallback and unscored failure behavior.

- [ ] **Step 6: Add Readiness navigation and targeted session controller actions**

Add a setup-screen Readiness button. Render Task 5's view. Implement filter and practice actions. Starting a targeted session must reuse current phase/speed/hint/timing/length settings, except a one-command target naturally returns one item.

- [ ] **Step 7: Add reveal-screen lesson flag action and editor lifecycle**

Open an editor for the current stable command ID; save through Task 4; persist immediately; allow later edit/resolve/reopen on Readiness. Do not modify the command catalog or accepted result.

- [ ] **Step 8: Test controller behavior**

Cover recommended default, free practice, each target, empty targets, coverage selection, flags on reveal, edit/resolve/reopen, backup round-trip, setup return, session resume, focus restoration, bilingual rendering, and no regression to audio error handling.

- [ ] **Step 9: Run focused and full gates**

Run:

```bash
node --test \
  tests/training.test.js \
  tests/storage.test.js \
  tests/active-session.test.js \
  tests/app-state.test.js \
  tests/app-controller.test.js \
  tests/app-smoke.test.js
npm test
git diff --check
```

Expected: PASS and no diff-check output.

---

### Task 7: Update Product Documentation and Release Audits

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `docs/superpowers/specs/2026-07-20-offline-readiness-native-roadmap-design.md`
- Modify: `tests/release-audit.test.js`

- [ ] **Step 1: Update stale baseline counts**

Replace the roadmap's old 54-phrasing/324-clip baseline with the generated catalog and audio-manifest counts computed at implementation time. Do not hand-copy a count without an audit test.

- [ ] **Step 2: Document Release B behavior**

Document readiness rules, targeted practice, coverage semantics, local-only lesson flags, backup behavior, and the deliberate absence of a composite score or engagement mechanics.

- [ ] **Step 3: Update CHANGELOG and release audit**

Add Release B under the in-progress release. Assert bilingual disclosure, no credential strings, current counts, required settings migration, and discoverability of readiness/flag documentation.

- [ ] **Step 4: Run release gates**

Run:

```bash
npm run release:check
```

Expected: tests pass, the runtime package builds, and diff check is clean.

---

### Task 8: Browser and iPad Acceptance

**Files:**
- Create: `.superpowers/sdd/release-b-final-review.md`
- Create: `.superpowers/sdd/evidence/release-b/` screenshots or concise test notes

- [ ] **Step 1: Run a clean local production artifact**

Run: `PORT=4199 npm run serve:dist`

Verify setup, Readiness, every target, flags, backup/import, and resumed sessions in English and Spanish.

- [ ] **Step 2: Verify iPad landscape and portrait fallback**

On iPad landscape, confirm no unnecessary horizontal scroll, readable evidence rows, 44px controls, stable focus, audio playback, and offline operation. Rotate to portrait and confirm the fallback remains usable.

- [ ] **Step 3: Verify readiness examples manually**

Use imported test history to confirm all four states, three-distinct-date readiness, a latest assisted/incorrect demotion, recent outcomes, response time, replay/hint totals, and flags independent of state.

- [ ] **Step 4: Record evidence and stop for Jeffrey's release review**

Record exact commit candidate, automated output, tested URLs/device, and any deferred visual polish. Do not commit or publish until Jeffrey approves.
