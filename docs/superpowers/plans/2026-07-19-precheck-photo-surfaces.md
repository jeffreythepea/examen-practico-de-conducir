# Photo-Backed Precheck Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan one task at a time. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every abstract precheck schematic with a precisely anchored photo-and-icon response surface, correct the overtaking diagram, and replace the provisional automatic immobilization interaction with a generic manual-car procedure.

**Architecture:** A focused `precheck-scenes` manifest maps stable command and target IDs to packaged photo assets, visible icon keys, normalized anchors, and review descriptions. The existing Yaris-named compatibility renderer consumes this manifest without changing scoring or progress IDs. The existing control-surface module keeps `secure-yaris-v1` as a stable external ID while replacing its active family and controls with a generic manual immobilization state model.

**Tech Stack:** Browser-native ES modules, static PNG assets, HTML/CSS, Node.js built-in test runner, existing immutable `SurfaceModel` generators and reducers.

## Global Constraints

- Every correct and incorrect tappable target has a clear visible icon before the learner answers.
- Text answer labels remain hidden before the answer and appear after reveal.
- The center of an icon target must fall inside the photographed physical feature the examiner would expect the learner to point to or operate.
- Target discs use a 48% opaque light background; icons remain fully opaque.
- Touch areas remain at least 44 CSS pixels at the landscape iPad baseline.
- Commands and generated command audio remain Spanish.
- Every new visible string exists in English and Spanish.
- Stable command, action, phrasing, accepted-result, surface, and target IDs remain compatible with stored progress.
- Static assets are repository-owned and require no network connection during play.
- AI-generated images are explicitly illustrative and never presented as the actual test vehicle.
- API keys and provider credentials never enter Git or browser-delivered files.
- Checkpoints are committed and pushed after Tasks 1, 2, 4, and 6.

## File Structure

- Create `src/precheck-scenes.js` — immutable scene/command manifest, icon markup, photo paths, and audited anchors.
- Create `tests/precheck-scenes.test.js` — manifest completeness, asset existence, anchor, icon, and stable-contract tests.
- Create `assets/precheck/*.png` — seven generic photo backgrounds.
- Modify `src/yaris-surfaces.js` — compatibility generator/reducer and photo-backed renderer.
- Modify `tests/yaris-surfaces.test.js` — prompt/reveal/icon and model integration coverage.
- Modify `src/control-surfaces.js` and `tests/control-surfaces.test.js` — generic manual immobilization model.
- Modify `src/manoeuvre-surfaces.js` and `tests/manoeuvre-surfaces.test.js` — overtaking learner/lead-car clarity.
- Modify `src/i18n.js` and `tests/i18n.test.js` — illustrative notice, scene names, icon labels, and manual immobilization copy.
- Modify `data/commands.json`, `tests/catalog.test.js`, and `references/fermin-atomic-command-inventory.md` — generic battery and manual-vehicle reference copy while preserving command-source provenance.
- Modify `styles.css` and `tests/app-smoke.test.js` — photo stage, translucent icon targets, and iPad touch behavior.
- Modify `README.md`, `CHANGELOG.md`, `docs/design.md`, and `tests/release-audit.test.js` — release scope and audits.

---

### Task 1: Shared Photo Infrastructure and Engine-Bay Scene

**Files:**
- Create: `assets/precheck/generic-engine-bay.png`
- Create: `src/precheck-scenes.js`
- Create: `tests/precheck-scenes.test.js`
- Modify: `src/yaris-surfaces.js`
- Modify: `tests/yaris-surfaces.test.js`
- Modify: `data/commands.json`
- Modify: `tests/catalog.test.js`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.js`
- Modify: `styles.css`
- Modify: `tests/app-smoke.test.js`

**Interfaces:**
- Produces: immutable `PRECHECK_SCENES`, `PRECHECK_COMMAND_SCENES`, `precheckSceneForCommand(commandId)`, `renderPrecheckIcon(iconKey)`, and `generic-engine-bay` for the three engine commands beneath stable external surface IDs.
- `precheckSceneForCommand` returns `{ id, asset, altKey, targets, provenance, reference }` or throws `Unsupported precheck command: <id>`.
- Each target contains `id`, `resultId`, `x`, `y`, `width`, `height`, `kind`, `interaction`, `iconKey`, `labelKey`, `labelPlacement`, and `anchorDescription` plus operate-state fields when applicable.

- [ ] **Step 1: Write failing manifest, renderer, anchor, and copy tests**

Assert the exact audited anchors and meanings:

```js
assert.deepEqual(
  Object.fromEntries(Object.entries(scene.targets).map(([id, t]) => [id, [t.x, t.y, t.iconKey]])),
  {
    'engine-oil': [73.2, 73, 'oil'],
    coolant: [13.5, 37.5, 'coolant'],
    'battery-under-rear-right-seat': [74, 44.5, 'battery'],
    'washer-fluid': [14.7, 61.5, 'washer']
  }
);
assert.match(scene.targets['engine-oil'].anchorDescription, /dipstick handle/i);
assert.match(scene.targets.coolant.anchorDescription, /reservoir cap/i);
assert.match(scene.targets['battery-under-rear-right-seat'].anchorDescription, /centre.*battery/i);
```

Change catalog tests to require generic conventional under-bonnet battery copy and reject `rear-right seat` for the active battery command.
Extend renderer expectations so prompt markup contains `precheck-photo`, one visible `precheck-icon` per button, no `yaris-hotspot-label`, and the localized illustrative notice; reveal markup contains localized labels. Assert unknown command and icon keys throw named errors.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/catalog.test.js tests/i18n.test.js`

Expected: FAIL because the manifest module, engine scene, PNG, illustrative strings, and generic battery copy are absent.

- [ ] **Step 3: Promote the approved engine photo and implement the manifest boundary**

Copy the approved generated source to `assets/precheck/generic-engine-bay.png`. Inspect at original resolution and confirm these photographed loci before recording them: yellow dipstick handle at lower-right, coolant cap upper-left, battery body upper-right, and blue washer cap lower-left. Do not place the oil target on the filler cap.

Create and deeply freeze the two manifest objects. Implement exact throwing lookups and icon markup for `oil`, `coolant`, `battery`, and `washer`; establish the full supported icon-key registry for later tasks.

- [ ] **Step 4: Add the engine scene, command mapping, and photo renderer**

Define all four targets with 12% × 18% touch boxes, precise anchors from Step 1, clear label placements, and nonempty descriptions. Map all three commands to `generic-engine-bay`. Retain the legacy battery target ID for progress compatibility but set its `kind` and description to conventional under-bonnet battery.

Make `generateYarisSurface` select `precheckSceneForCommand(command.id)`, retain `geometry.diagramId`, and add `geometry.sceneId` and `geometry.photoAsset`. Render a localized illustrative notice, packaged `<img class="precheck-photo">`, and icon-bearing hotspots. Keep the existing reducer and reveal-state semantics.

- [ ] **Step 5: Update copy and shared photo/icon styles**

Change the battery answer to `The conventional 12 V battery is shown under the bonnet in this generic training image; confirm the actual test vehicle.` and the equivalent Spanish. Set active vehicle validation/reference metadata to a generic illustrative baseline without deleting the original Fermin command-source provenance.

Add the bilingual illustrative notice and scene alt text. Set the photo stage to `aspect-ratio:3/2`, the photo to cover the stage, and target backgrounds to `rgba(255,253,248,.48)` while icons remain fully opaque. Preserve reveal markers and 44-pixel sizing.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/catalog.test.js tests/i18n.test.js tests/app-smoke.test.js && npm test && git diff --check`

Expected: all tests PASS and diff check is clean.

- [ ] **Step 7: Commit and push checkpoint 1**

```bash
git add assets/precheck/generic-engine-bay.png src/precheck-scenes.js src/yaris-surfaces.js src/i18n.js styles.css data/commands.json tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js tests/catalog.test.js
git commit -m "Add photo-backed engine prechecks"
git push origin main
```

### Task 2: Instrument, Door, and Climate Photo Scenes

**Files:**
- Create: `assets/precheck/generic-instrument-cluster.png`
- Create: `assets/precheck/generic-driver-door.png`
- Create: `assets/precheck/generic-climate-panel.png`
- Modify: `src/precheck-scenes.js`
- Modify: `tests/precheck-scenes.test.js`
- Modify: `src/i18n.js`

**Interfaces:**
- Consumes: shared scene manifest and renderer.
- Produces: photo-backed mappings for six commands: fuel, temperature, window lock/unlock, and front/rear demist.

- [ ] **Step 1: Write failing scene coverage tests**

Assert that the six command IDs resolve to the expected three assets; every scene has at least three clear targets; `fuel`/`temperature`, `window-lock`/`door-lock`, and `front-demist`/`rear-demist` use distinct icon keys; every target has a nonempty `anchorDescription`; every PNG exists and is nonzero.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js`

Expected: FAIL naming the three missing scene assets/mappings.

- [ ] **Step 3: Generate and inspect three assets**

Use the built-in image-generation tool once per asset with these subject constraints:

- Instrument cluster: generic small European manual hatchback, driver-eye view, fuel and coolant-temperature gauges physically separate, no readable text, brand marks, warning errors, or automatic gear indicator.
- Driver door: close driver-eye view of four power-window switches, a distinct window-lock switch, door-lock button, and mirror control; no brand marks or duplicated switches.
- Climate panel: close centered view with separate recognizable front-windscreen and rear-window demist buttons plus neighboring fan/temperature controls; no readable generated labels.

Reject and regenerate any asset in which the exact required control is absent or ambiguous. Save selected assets at the declared paths.

- [ ] **Step 4: Record audited anchors and icons**

Inspect each selected PNG at original resolution. Convert the center pixel of each exact gauge/control to normalized percentages `(pixel / image dimension) * 100`, round to one decimal, and record the photographed component in `anchorDescription`. Do not place icons merely near a control bank.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js && npm test && git diff --check`

Expected: PASS and clean diff.

- [ ] **Step 6: Commit and push checkpoint 2**

```bash
git add assets/precheck/generic-instrument-cluster.png assets/precheck/generic-driver-door.png assets/precheck/generic-climate-panel.png src/precheck-scenes.js src/i18n.js tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js
git commit -m "Add photo-backed cabin prechecks"
git push origin main
```

### Task 3: Lighting, Bonnet, and Tailgate Photo Scenes

**Files:**
- Create: `assets/precheck/generic-lighting-stalk.png`
- Create: `assets/precheck/generic-bonnet-release.png`
- Create: `assets/precheck/generic-tailgate-release.png`
- Modify: `src/precheck-scenes.js`
- Modify: `tests/precheck-scenes.test.js`
- Modify: `src/i18n.js`

**Interfaces:**
- Produces: photo-backed mappings for high beam, front/rear fog, bonnet release, and boot opening.

- [ ] **Step 1: Write failing scene coverage tests**

Require exact command-to-scene mappings, three distinct lighting icon targets, a bonnet target anchored to the release lever, a boot target anchored to the exterior tailgate release, at least two clear distractors in each release scene, nonempty descriptions, and existing assets.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js`

Expected: FAIL naming the missing scenes and assets.

- [ ] **Step 3: Generate and inspect three assets**

Generate:

- a close driver-eye photo of a generic left lighting stalk with visually separate high-beam movement and front/rear fog rings;
- a generic driver footwell/knee-panel photo with a clearly visible bonnet-release lever plus distinct fuel-door and dashboard-light controls;
- a close exterior tailgate photo with a clearly visible release handle plus rear wiper and camera regions.

Reject any image with unreadable, duplicated, impossible, or absent controls. Save the selected PNGs at the declared paths.

- [ ] **Step 4: Record exact anchors and localized icon labels**

Use the same pixel-to-normalized calculation from Task 2. For the stalk, anchor icons on the applicable movement/ring rather than on the whole stalk. For bonnet and tailgate, anchor the correct icon on the physical release.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/precheck-scenes.test.js tests/yaris-surfaces.test.js tests/i18n.test.js && npm test && git diff --check`

Expected: PASS and clean diff.

### Task 4: Manual Immobilization and Overtaking Corrections

**Files:**
- Modify: `src/control-surfaces.js`
- Modify: `tests/control-surfaces.test.js`
- Modify: `src/manoeuvre-surfaces.js`
- Modify: `tests/manoeuvre-surfaces.test.js`
- Modify: `src/i18n.js`
- Modify: `tests/i18n.test.js`
- Modify: `styles.css`

**Interfaces:**
- Keeps external surface ID `secure-yaris-v1` and accepted result `secure-vehicle`.
- Replaces internal family with `secure-manual`, targets `engine-stop`, `parking-brake`, and `manual-gear`, and meta fields `slope: 'uphill'|'downhill'`, `requiredGear: 'first'|'reverse'`, `legalReference: 'RGC Article 92'`.
- Overtaking templates retain target IDs and results but add `learnerVehicle`, `leadVehicle`, and a separated safe-following target.

- [ ] **Step 1: Write failing manual immobilization tests**

Assert both deterministic slope variants, uphill → first, downhill → reverse, completion only when all three states are correct, order independence, absence of `selector-park`/`P`/automatic-hybrid text, and BOE Article 92 provenance.

Example completion assertion:

```js
let state = {};
for (const event of [
  { type: 'activate', targetId: 'parking-brake' },
  { type: 'activate', targetId: 'engine-stop' },
  { type: 'select-gear', targetId: 'manual-gear', gear: model.meta.requiredGear }
]) state = reduceControlResponse(model, state, event);
assert.equal(state.complete, true);
assert.equal(state.selectedResult, 'secure-vehicle');
```

- [ ] **Step 2: Write failing overtaking tests**

Require the learner car at bottom, lead car ahead, safe-follow target entirely behind the lead car with a positive gap, no overlap, and a passing target/path in the opposing lane.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test tests/control-surfaces.test.js tests/manoeuvre-surfaces.test.js tests/i18n.test.js`

Expected: FAIL on old selector `P`, enforced Yaris sequence, missing learner car, and overlapping follow target.

- [ ] **Step 4: Implement the manual final-state reducer and renderer**

Generate slope from the seeded RNG. Render an ignition/engine-stop control, hand parking brake, H-pattern selector with first and reverse choices, and a visible uphill/downhill context. Store booleans `engineStopped`, `parkingBrakeApplied`, and `selectedGear`; compute completion from final state rather than event order. Add bilingual Article 92 reveal and school-confirmation notice.

- [ ] **Step 5: Correct overtaking geometry and drawing**

Move the follow target below the lead vehicle by at least 8 normalized units, draw a distinct blue learner vehicle at the bottom, keep the lead vehicle neutral gray, and retain the left-lane passing route. Do not change roundabout or other road templates.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/control-surfaces.test.js tests/manoeuvre-surfaces.test.js tests/i18n.test.js && npm test && git diff --check`

Expected: PASS; repository search for `selector-park|selector-P|automatic-hybrid reference` returns no active UI or control implementation matches.

- [ ] **Step 7: Commit and push checkpoint 3**

```bash
git add src/control-surfaces.js src/manoeuvre-surfaces.js src/i18n.js styles.css tests/control-surfaces.test.js tests/manoeuvre-surfaces.test.js tests/i18n.test.js
git commit -m "Clarify overtaking and manual immobilization"
git push origin main
```

### Task 5: Documentation, Catalog, and Release Audits

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `data/commands.json`
- Modify: `references/fermin-atomic-command-inventory.md`
- Modify: `tests/release-audit.test.js`
- Modify: `tests/catalog.test.js`

**Interfaces:**
- Documents photo provenance, illustrative limits, generic battery baseline, stable IDs, manual immobilization rule, and actual-vehicle confirmation requirement.

- [ ] **Step 1: Write failing release-audit expectations**

Require README/design/changelog to mention photo-backed icon-first prechecks, precise physical anchors, illustrative generic images, the conventional under-bonnet battery, Article 92 manual immobilization, and actual-vehicle confirmation. Reject active claims that the battery is only under the rear seat or that immobilization uses selector `P`.

- [ ] **Step 2: Run audit tests and verify RED**

Run: `node --test tests/release-audit.test.js tests/catalog.test.js`

Expected: FAIL on the Stage 2 schematic and automatic-hybrid text.

- [ ] **Step 3: Update documentation and catalog metadata**

Replace active schematic descriptions with the approved assessment contract and scene inventory. Retain historical notes only when clearly labeled as superseded. Cite BOE Article 92 for manual immobilization and state that school confirmation remains required.

- [ ] **Step 4: Run audit and full tests**

Run: `node --test tests/release-audit.test.js tests/catalog.test.js && npm test && git diff --check`

Expected: PASS and clean diff.

### Task 6: Landscape-iPad Visual Matrix and Final Recovery Checkpoint

**Files:**
- Create: `.superpowers/sdd/evidence/precheck-photo-surfaces/*.png`
- Create: `.superpowers/sdd/precheck-photo-final-review.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Produces visual evidence for seven precheck scenes, overtaking, and both manual-immobilization slope variants.

- [ ] **Step 1: Run every precheck command at 1024×768**

Capture prompt and reveal for all 14 precheck commands in both locales where copy differs. For each target, record whether its center lies on the exact named cap, handle, gauge, switch, ring, or lever. Reject and reposition any icon that is merely nearby.

- [ ] **Step 2: Run overtaking and immobilization visual checks**

Confirm learner/lead cars and safe gap are visually distinct. Confirm uphill requires first and downhill requires reverse; selector `P` never appears.

- [ ] **Step 3: Run interaction and console checks**

Tap correct and wrong icons, replay audio, reveal labels, switch EN/ES, and confirm no console errors, missing assets, focus loss, or targets smaller than 44 pixels.

- [ ] **Step 4: Run final release gates**

Run:

```bash
npm test
git diff --check
node --test tests/release-audit.test.js
```

Expected: all tests PASS, diff check clean, and no credential matches. Visually verify the bilingual AI-voice disclosure and illustrative-vehicle notice.

- [ ] **Step 5: Write the final review ledger**

Record test count, evidence paths, exact icon-placement audit results, remaining actual-vehicle uncertainties, manual-procedure source, and any scene rejected/regenerated during production.

- [ ] **Step 6: Commit and push final checkpoint**

```bash
git add README.md CHANGELOG.md docs/design.md data/commands.json references/fermin-atomic-command-inventory.md src tests styles.css assets/precheck .superpowers/sdd/progress.md .superpowers/sdd/precheck-photo-final-review.md .superpowers/sdd/evidence/precheck-photo-surfaces
git commit -m "Add clear photo-backed driving prechecks"
git push origin main
```
