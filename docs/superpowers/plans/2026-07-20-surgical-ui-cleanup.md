# Surgical UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove obsolete setup notices and correct three already-reviewed visual alignment issues without changing gameplay or accepted road geometry.

**Architecture:** Keep the cleanup declarative. Setup notices are removed at the render boundary and their now-unused translations are deleted; precheck alignment remains scene metadata; roundabout feedback keeps its meaningful full correct/wrong markers while clipping marker overflow to the target boundary so no detached fragment appears.

**Tech Stack:** Static HTML/CSS, JavaScript ES modules, Node test runner.

## Global Constraints

- Preserve Spanish command content, stable IDs, scoring, and accepted route geometry.
- Keep all remaining interface copy bilingual.
- Do not add dependencies or credentials.
- Use test-first changes and finish with `npm run release:check`.

---

### Task 1: Remove obsolete setup notices

**Files:**
- Modify: `tests/app-smoke.test.js`
- Modify: `tests/i18n.test.js`
- Modify: `src/app.js`
- Modify: `src/i18n.js`

- [ ] Add assertions that setup no longer renders `warning.source` or `warning.vehicle` and the dictionaries no longer expose those obsolete keys.
- [ ] Run `node --test tests/app-smoke.test.js tests/i18n.test.js` and confirm failure.
- [ ] Remove the `notice-group` setup markup and both locale entries.
- [ ] Rerun the focused tests and confirm success.

### Task 2: Align lighting targets and labels

**Files:**
- Modify: `tests/precheck-scenes.test.js`
- Modify: `src/precheck-scenes.js`

- [ ] Add exact coordinate expectations for the position-light target and non-overlapping indicator/front-fog/rear-fog labels.
- [ ] Run `node --test tests/precheck-scenes.test.js` and confirm failure.
- [ ] Move the position-light target left while preserving separation from dipped headlights; spread the three indicator-stalk label placements vertically and horizontally.
- [ ] Rerun the focused test and confirm success.

### Task 3: Contain roundabout feedback markers

**Files:**
- Modify: `tests/spatial-surfaces.test.js`
- Modify: `styles.css`

- [ ] Add a style assertion that road targets contain status-marker overflow while still rendering full correct and selected-wrong markers in markup.
- [ ] Run `node --test tests/spatial-surfaces.test.js` and confirm failure.
- [ ] Add road-target-specific marker containment without changing route paths or marker semantics.
- [ ] Rerun the focused test and confirm success.

### Task 4: Release and publish

**Files:**
- Modify: `CHANGELOG.md`

- [ ] Record the surgical setup and visual cleanup.
- [ ] Run `npm run release:check`; expect all tests, the runtime package build, and `git diff --check` to pass.
- [ ] Verify setup and the affected surfaces in the browser.
- [ ] Commit, push `main`, wait for the Pages workflow, and verify the public URL.
