# Photo Target Alignment and Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every selectable target with the physical feature shown in its active photo, remove redundant physical-feature drawings, and make Mixed / 10 commands the fresh-save defaults.

**Architecture:** Keep the reviewed raster plates as scenery and the existing stable target/result IDs as the scoring contract. Encode audited normalized anchors in the current surface templates, but render code-native markings only when the photograph does not already contain the feature. Defaults remain storage settings so existing saves and backups are not silently rewritten.

**Tech Stack:** Static ES modules, HTML/CSS, Node.js built-in test runner, browser-client live verification.

## Global Constraints

- Commands and generated command audio remain Spanish.
- Interface copy remains bilingual.
- Stable command, action, phrasing, surface, target, and result IDs remain unchanged.
- Every selectable target remains at least 44 CSS pixels and non-overlapping across seeded jitter.
- Existing saves and imported backups retain their explicit settings.
- No credentials, new dependencies, commit, or push.

---

### Task 1: Fresh Setup Defaults

**Files:**
- Modify: `src/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `defaultState(): object`
- Produces: fresh `settings.phase === 'mixed'` and `settings.length === 'medium'`

- [ ] **Step 1: Change the default-state test to require Mixed and medium.**
- [ ] **Step 2: Run `node --test tests/storage.test.js` and confirm failure on the old Driving default.**
- [ ] **Step 3: Change only `defaultState().settings.phase` from `driving` to `mixed`; keep `length: 'medium'`.**
- [ ] **Step 4: Run `node --test tests/storage.test.js` and confirm the storage suite passes.**

### Task 2: Photo-Aligned Manoeuvre Targets

**Files:**
- Modify: `src/manoeuvre-surfaces.js`
- Test: `tests/manoeuvre-surfaces.test.js`

**Interfaces:**
- Consumes: `generateManoeuvreSurface(command, seed)` and `renderManoeuvreSurface(model, locale, state)`
- Produces: targets located on visible asphalt, curb, driveway, crossing, or a necessary code-native restriction marking

- [ ] **Step 1: Add seed-sweep assertions for overtaking, parking, and stopping target anchor bands matching the raster plates.**
- [ ] **Step 2: Add renderer assertions that photo-backed crosswalk and driveway targets do not draw redundant SVG feature icons, while absent no-parking/no-stopping and restricted markings remain visible.**
- [ ] **Step 3: Run `node --test tests/manoeuvre-surfaces.test.js` and confirm failures against the stale abstract-scene anchors and overlays.**
- [ ] **Step 4: Move both overtaking choices onto their perspective lanes and synchronize embedded-car geometry.**
- [ ] **Step 5: Move both parking and both stopping templates onto the actual curb, garage entrance, and crossing; place necessary synthetic restriction choices away from the learner car.**
- [ ] **Step 6: Make photo-backed feature rendering omit crosswalk and driveway drawings while retaining only features absent from the raster.**
- [ ] **Step 7: Run the focused suite and its 100-seed non-overlap sweep until green.**

### Task 3: Roundabout Target Audit

**Files:**
- Modify if needed: `src/spatial-surfaces.js`
- Test: `tests/spatial-surfaces.test.js`

**Interfaces:**
- Consumes: seeded four-/five-exit roundabout geometry
- Produces: one target centered within each photographed exit mouth, with the learner entry fixed at bottom

- [ ] **Step 1: Compare the declared exit centers with both production raster plates.**
- [ ] **Step 2: Add exact bounded anchor assertions for each exit count and run `node --test tests/spatial-surfaces.test.js` to establish RED if correction is required.**
- [ ] **Step 3: Adjust only normalized exit-angle/anchor constants required to match the visible mouths.**
- [ ] **Step 4: Run the spatial suite and confirm seeded variation, target non-overlap, and exit distribution remain green.**

### Task 4: Integrated Browser and Release Verification

**Files:**
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: complete uncommitted working tree
- Produces: reproducible recovery checkpoint and review-ready local build

- [ ] **Step 1: Render each photo-backed template at landscape review size and visually inspect every target against the physical scene.**
- [ ] **Step 2: Confirm all target rectangles are at least 44×44 CSS pixels and browser warning/error logs are empty.**
- [ ] **Step 3: Verify English and Spanish setup show Mixed and 10 commands for a fresh default state without altering existing-save compatibility.**
- [ ] **Step 4: Run `npm test`, `npm run release:check`, and `git diff --check`; require all gates green.**
- [ ] **Step 5: Record exact evidence in `.superpowers/sdd/progress.md` and hand the uncommitted build to Jeffrey for review.**
