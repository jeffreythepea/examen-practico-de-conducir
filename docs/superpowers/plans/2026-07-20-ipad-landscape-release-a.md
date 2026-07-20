# Intentional iPad Landscape and Release A Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use iPad landscape width intentionally with one reversible responsive gameplay layout, then record Release A completion only after Jeffrey approves the physical result.

**Architecture:** Add shared prompt/reveal layout wrappers in `src/app.js` and activate their two-column presentation only inside the existing landscape breakpoint in `styles.css`. Preserve all surface renderers, data, state, interaction, portrait layout, and target geometry. Keep release bookkeeping as a separate post-acceptance task.

**Tech Stack:** Static HTML templates, CSS media queries, Node.js test runner, existing deterministic runtime builder.

## Global Constraints

- Tests gate every change; run `npm test` before review.
- Commands and generated audio remain Spanish.
- No interface copy is added, so the English and Spanish dictionaries remain unchanged.
- Stable command, action, phrasing, surface, and target IDs remain unchanged.
- No provider credential enters Git or browser-delivered files.
- The bilingual AI-voice disclosure remains visible.
- Do not commit or push implementation changes before Jeffrey reviews them.
- Keep landscape implementation and Release A bookkeeping separable for rollback.

---

### Task 1: Add a shared landscape gameplay structure

**Files:**
- Modify: `src/app.js`
- Test: `tests/app-smoke.test.js`

**Interfaces:**
- Consumes: existing `renderSurfaceModel(model, response, locale, options)` output.
- Produces: `.gameplay-layout`, `.gameplay-copy`, `.gameplay-surface`, `.gameplay-feedback`, `.prompt-layout`, and `.reveal-layout` markup hooks.

- [ ] **Step 1: Write the failing structural test**

Add a test that reads `src/app.js` and requires:

```js
test('prompt and reveal expose one shared responsive gameplay layout', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /class="gameplay-layout prompt-layout"/);
  assert.match(source, /class="gameplay-copy"/);
  assert.match(source, /class="gameplay-layout reveal-layout"/);
  assert.match(source, /class="gameplay-surface"/);
  assert.match(source, /class="gameplay-feedback"/);
});
```

- [ ] **Step 2: Run the structural test and verify RED**

Run:

```sh
node --test tests/app-smoke.test.js
```

Expected: the new test fails because the shared wrappers do not exist.

- [ ] **Step 3: Add the prompt wrapper**

Keep prompt progress above the grid. Inside
`<div class="gameplay-layout prompt-layout">`, place the existing prompt title,
instruction, audio-ready status, actions, optional Spanish hint, and surface
error in `<div class="gameplay-copy">`. Put only the successful
`renderSurfaceModel(...)` result in `<div class="gameplay-surface">`.

- [ ] **Step 4: Add the reveal wrapper**

Keep progress and outcome above the grid. Inside
`<div class="gameplay-layout reveal-layout">`, put the existing revealed
surface in `<div class="gameplay-surface">` and put the answer details,
optional diagnosis, and Continue button in `<div class="gameplay-feedback">`.

- [ ] **Step 5: Run the structural test and verify GREEN**

Run:

```sh
node --test tests/app-smoke.test.js
```

Expected: all app smoke tests pass.

---

### Task 2: Activate the intentional landscape layout

**Files:**
- Modify: `styles.css`
- Test: `tests/app-smoke.test.js`

**Interfaces:**
- Consumes: Task 1 layout classes.
- Produces: landscape-only wider shell and two-column prompt/reveal grids.

- [ ] **Step 1: Write the failing CSS contract test**

Extend the Task 1 test or add a focused test requiring the existing
`@media (orientation: landscape) and (min-width: 900px)` block to contain:

```css
#app { width: min(100%, 1180px); }
.gameplay-layout { display: grid; }
.prompt-layout { grid-template-columns: minmax(250px, 0.75fr) minmax(0, 1.25fr); }
.reveal-layout { grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr); }
.gameplay-surface .surface-stage { width: min(100%, 60vh); }
```

The test must also confirm `.gameplay-layout` has no global `display: grid`
outside that media block, preserving the stacked portrait layout.

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```sh
node --test tests/app-smoke.test.js
```

Expected: the landscape CSS assertions fail.

- [ ] **Step 3: Implement the minimal landscape media-query rules**

Inside the existing landscape breakpoint:

```css
#app {
  width: min(100%, 1180px);
  padding-block: 1rem;
}

.gameplay-layout {
  display: grid;
  align-items: start;
  gap: clamp(1.25rem, 3vw, 2.5rem);
}

.prompt-layout {
  grid-template-columns: minmax(250px, 0.75fr) minmax(0, 1.25fr);
}

.reveal-layout {
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
}

.gameplay-surface .surface-stage {
  width: min(100%, 60vh);
  margin-top: 0;
}
```

Add only the smallest spacing adjustments needed to keep the existing result
labels and diagnosis usable. Do not add per-surface-family layout rules.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```sh
node --test tests/app-smoke.test.js tests/spatial-surfaces.test.js tests/precheck-scenes.test.js
```

Expected: all focused tests pass.

- [ ] **Step 5: Run the complete automated gate**

Run:

```sh
npm run release:check
```

Expected: all repository tests pass, the complete 324-recorded-clip runtime
build succeeds, credential/disclosure checks pass, and `git diff --check` is
clean.

---

### Task 3: Browser and physical iPad acceptance checkpoint

**Files:**
- No production-file changes unless verification identifies a scoped defect.

**Interfaces:**
- Consumes: verified Task 2 build.
- Produces: explicit accept/revise decision before release bookkeeping.

- [ ] **Step 1: Inspect representative landscape screens**

Use a 1194×834 viewport to inspect setup, prompt, correct reveal, and incorrect
reveal. Confirm normal side margins, no horizontal clipping, readable response
surfaces, visible Continue, usable diagnosis controls, and no console errors.

- [ ] **Step 2: Serve the candidate on the trusted LAN**

Run:

```sh
PORT=4174 npm run serve:lan
```

Give Jeffrey the Mac LAN URL and leave the server running for physical review.

- [ ] **Step 3: Stop for Jeffrey's acceptance**

Do not commit, push, deploy, or update Release A status. If Jeffrey rejects the
layout, revise the same small change set or discard it to restore `6b258ed`.

---

### Task 4: Record Release A completion after physical approval

**Files:**
- Modify: `.superpowers/sdd/offline-ipad-release-a-review.md`
- Modify: `docs/design.md`
- Modify: `CHANGELOG.md`
- Test: `tests/release-audit.test.js`

**Interfaces:**
- Consumes: Jeffrey's explicit physical-layout approval and previously reported
  completion of the full offline-iPad matrix.
- Produces: current documentation that identifies Release A as complete without
  rewriting historical records.

- [ ] **Step 1: Write a failing release-status audit**

Require the active review document and `docs/design.md` to identify Offline
iPad Release A as complete and require the review matrix to record passed
installation, package download, Airplane Mode, 15-command Mixed session,
recorded media, resume, update recovery, backup transfer, bilingual UI, touch,
and sound checks.

- [ ] **Step 2: Run the release audit and verify RED**

Run:

```sh
node --test tests/release-audit.test.js
```

Expected: status assertions fail because current documents still say physical
iPad acceptance is pending.

- [ ] **Step 3: Update current release records**

Mark every physical matrix row passed, replace pending public-deployment text
with the live Pages URL, record Jeffrey's successful physical acceptance, and
add a current changelog bullet. Leave historical implementation ledgers and
past changelog claims unchanged.

- [ ] **Step 4: Run final verification**

Run:

```sh
npm run release:check
```

Expected: every test and runtime build passes and `git diff --check` is clean.

- [ ] **Step 5: Hand the reversible diff to Jeffrey**

Report exact files, test count, runtime hash, browser result, and rollback
boundary. Do not commit or push; Jeffrey reviews and performs repository writes.
