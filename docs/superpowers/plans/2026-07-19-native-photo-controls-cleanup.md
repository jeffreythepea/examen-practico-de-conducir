# Native Photo Controls Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan one task at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove redundant artwork from recognizable photographed controls, make the high-beam target precise, and make written-Spanish policy behavior unambiguous and regression-safe.

**Architecture:** Keep the existing immutable precheck-scene and reducer structures. Change only scene target metadata and bilingual interface copy, then protect the intended behavior with focused scene, reducer, and translation tests before browser QA.

**Tech Stack:** Browser-native JavaScript modules, HTML/CSS, Node.js built-in test runner, static local server.

## Global Constraints

- Engine-bay oil, coolant, battery, and washer-fluid targets retain explicit component icons.
- Instrument cluster, climate panel, driver door, lighting stalk, bonnet release, and tailgate use translucent native-symbol target rings only.
- Stable command, action, surface, result, and target IDs do not change.
- Commands and generated command audio remain Spanish.
- Every interface-copy change exists in both English and Spanish.
- No API key or credential enters Git or a browser-delivered file.
- Jeffrey reviews, commits, and pushes; this plan creates no commits.

---

### Task 1: Native-symbol photo targets

**Files:**
- Modify: `tests/precheck-scenes.test.js`
- Modify: `src/precheck-scenes.js`

**Interfaces:**
- Consumes: `PRECHECK_SCENES: Readonly<Record<string, Scene>>` and `renderPrecheckIcon(iconKey: string): string`.
- Produces: unchanged scene and target IDs; `iconKey: 'native-symbol'` on every non-engine photo target; high-beam target centered at the audited photo coordinates.

- [ ] **Step 1: Write failing tests for the icon boundary and high-beam anchor**

Replace assertions that require distinct cabin/exterior icons with explicit scene-level expectations:

```js
const nativeSymbolScenes = [
  'generic-instrument-cluster',
  'generic-driver-door',
  'generic-climate-panel',
  'generic-lighting-stalk',
  'generic-bonnet-release',
  'generic-tailgate-release'
];
for (const sceneId of nativeSymbolScenes) {
  assert.ok(
    Object.values(PRECHECK_SCENES[sceneId].targets)
      .every(target => target.iconKey === 'native-symbol'),
    `${sceneId} must expose the photographed controls without drawn overlay icons`
  );
}
assert.deepEqual(
  [
    PRECHECK_SCENES['generic-lighting-stalk'].targets['high-beam'].x,
    PRECHECK_SCENES['generic-lighting-stalk'].targets['high-beam'].y
  ],
  [29.1, 46.5]
);
assert.match(
  PRECHECK_SCENES['generic-lighting-stalk'].targets['high-beam'].anchorDescription,
  /centred.*native high-beam symbol/i
);
```

Retain the engine-bay test that verifies `oil`, `coolant`, `battery`, and `washer` icons render nonempty markup.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/precheck-scenes.test.js`

Expected: FAIL because instrument, climate, bonnet, and tailgate targets still use drawn icons and high-beam `y` is `51.5`.

- [ ] **Step 3: Apply the minimal scene metadata changes**

In `src/precheck-scenes.js`, set every target in the six listed non-engine scenes to:

```js
iconKey: 'native-symbol'
```

Set the high-beam target to:

```js
resultId: 'high-beams', x: 29.1, y: 46.5, width: 8, height: 15,
kind: 'stalk-movement', interaction: 'operate', iconKey: 'native-symbol',
anchorDescription: 'Centred on the native high-beam symbol on the stalk movement ring'
```

Do not change target IDs, results, target dimensions, label placements, or engine-bay icon keys.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/precheck-scenes.test.js`

Expected: all `tests/precheck-scenes.test.js` tests PASS.

- [ ] **Step 5: Record the checkpoint without committing**

Run: `git diff -- src/precheck-scenes.js tests/precheck-scenes.test.js`

Expected: only icon-key assertions/assignments, the high-beam `y` coordinate, and its anchor description differ.

### Task 2: Written-Spanish policy contract

**Files:**
- Modify: `tests/app-state.test.js`
- Modify: `tests/i18n.test.js`
- Modify: `src/i18n.js`

**Interfaces:**
- Consumes: `reduceScreen(model, event)`, `translate(locale, key)`, and existing `hintPolicy` values `available`, `shown`, `unavailable`.
- Produces: unchanged reducer/scoring behavior with explicit cross-question regression coverage and clearer bilingual setup labels.

- [ ] **Step 1: Write a failing cross-question reducer test**

Add a two-command reducer test using existing command fixtures and authentic target selection:

```js
test('available Spanish hint is trial-local and resets for the next command', () => {
  let model = promptModel();
  model = reduceScreen(model, { type: 'SHOW_SPANISH' });
  assert.equal(model.textShown, true);

  const firstTarget = model.activeSurfaceModel.targets.find(
    target => target.resultId === model.activeSurfaceModel.expectedResult
  );
  model = reduceScreen(model, {
    type: 'SURFACE_EVENT',
    surfaceEvent: { type: 'select-target', targetId: firstTarget.id },
    completedAt: 1_500
  });
  assert.equal(model.outcome, 'assisted');

  model = reduceScreen(model, { type: 'CONTINUE' });
  assert.equal(model.textShown, false);
  model = reduceScreen(model, { type: 'AUDIO_COMPLETED', completedAt: 2_000, seed: 2 });
  assert.equal(model.screen, 'prompt');
  assert.equal(model.textShown, false);
});
```

The existing `promptModel()` fixture already starts the immutable two-command
`session` (`c-der`, then `c-izq`), so no new command fixture is required.

- [ ] **Step 2: Write failing bilingual-copy assertions**

Add to `tests/i18n.test.js`:

```js
test('written-Spanish policy labels state when text appears and how it scores', () => {
  assert.equal(translate('en', 'hint.available'), 'Hidden until you tap Show Spanish');
  assert.equal(translate('es', 'hint.available'), 'Oculto hasta pulsar Mostrar español');
  assert.equal(translate('en', 'hint.shown'), 'Shown automatically (answers count as assisted)');
  assert.equal(translate('es', 'hint.shown'), 'Visible automáticamente (las respuestas cuentan como asistidas)');
  assert.equal(translate('en', 'hint.unavailable'), 'Never shown');
  assert.equal(translate('es', 'hint.unavailable'), 'Nunca visible');
});
```

- [ ] **Step 3: Run focused tests and verify the copy test fails**

Run: `node --test tests/app-state.test.js tests/i18n.test.js`

Expected: app-state reset assertions PASS against the existing reducer; copy assertions FAIL with the current shorter labels.

- [ ] **Step 4: Implement only the bilingual label changes**

In both dictionaries in `src/i18n.js`, replace the three `hint.*` values with the exact strings asserted above. Do not change `reduceScreen`, `resetTrial`, `classifyOutcome`, or storage values.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `node --test tests/app-state.test.js tests/i18n.test.js`

Expected: all focused tests PASS.

- [ ] **Step 6: Record the checkpoint without committing**

Run: `git diff -- src/i18n.js tests/app-state.test.js tests/i18n.test.js`

Expected: bilingual copy and regression tests only; reducer behavior is unchanged.

### Task 3: Full verification and landscape-iPad review

**Files:**
- Verify: all changed production, test, spec, and plan files
- Update if necessary: `.superpowers/sdd/progress.md`
- Create if necessary: `.superpowers/sdd/native-photo-controls-final-review.md`

**Interfaces:**
- Consumes: completed Tasks 1 and 2 and the existing static server.
- Produces: test and browser evidence for Jeffrey's build review; no commit or push.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: every test and release audit PASS with zero failures.

- [ ] **Step 2: Run repository hygiene checks**

Run: `git diff --check`

Expected: no output and exit status 0.

Run: `node --test tests/release-audit.test.js`

Expected: every release audit passes, including the repository's credential-shape scan.

- [ ] **Step 3: Verify required disclosure and bilingual policy copy**

Run: `rg -n "audio.disclosure|hint.available|hint.shown|hint.unavailable" src/i18n.js src/app.js tests`

Expected: AI-voice disclosure and all three hint policies are present in English and Spanish.

- [ ] **Step 4: Review every photo scene in a 1024×768 browser viewport**

Use precheck sessions to inspect prompt and reveal states for engine bay, instrument cluster, driver door, climate panel, lighting stalk, bonnet release, and tailgate. Confirm:

```text
engine bay: explicit component icons remain precisely placed
other six scenes: translucent rings only, no drawn icons
lighting stalk: high-beam ring is centered on its native symbol
reveal labels: no collisions
hint available: button visible, Spanish hidden until requested, next question hidden again
hint shown: Spanish automatic and result assisted
hint unavailable: no button and no Spanish prompt text
console: no errors
```

- [ ] **Step 5: Save concise review evidence without committing**

Record test counts, browser viewport, inspected scenes, hint-policy outcomes, console status, and any retained caveats in `.superpowers/sdd/native-photo-controls-final-review.md`. Update `.superpowers/sdd/progress.md` with the recovery point.

- [ ] **Step 6: Hand the build to Jeffrey for review**

Report the changed behavior, automated verification, browser QA, and direct local URL. Do not commit or push.
