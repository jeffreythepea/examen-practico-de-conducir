# Gameplay Feedback Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix manual immobilization completion, activate approved photographic road scenes, and offer 5/10/15-command sessions with a default of 10.

**Architecture:** Existing immutable surface models gain stable scene IDs resolved by a dedicated local registry. Renderers place photographic base images below existing code-native targets and reveal overlays; reducer and scheduler changes remain independent and testable.

**Tech Stack:** ES modules, static PNG assets, HTML/SVG/CSS overlays, Node.js test runner, Web browser at 1024×768

## Global Constraints

- Preserve command, action, phrasing, surface, result, and target IDs.
- Commands and generated audio remain Spanish; all interface copy remains bilingual.
- Photo assets contain no credentials, text, UI, answer marks, brands, or route claims.
- Every response target remains at least 44×44 CSS pixels.
- Jeffrey reviews, commits, and pushes; leave all work uncommitted.

---

### Task 1: Manual Immobilization Completion and Car Direction

**Files:** Modify `tests/control-surfaces.test.js`, `tests/app-state.test.js`, `src/control-surfaces.js`, and `styles.css`.

- [ ] Add failing tests proving a fully configured wrong gear yields a terminal incorrect response, partial input remains unscored, and slope markup contains a recognizable directional car SVG.
- [ ] Run `node --test tests/control-surfaces.test.js tests/app-state.test.js` and verify RED.
- [ ] Implement terminal wrong-gear state and the code-native car silhouette.
- [ ] Rerun the focused tests and verify GREEN.
- [ ] Record the checkpoint in `.superpowers/sdd/progress.md`.

### Task 2: Reviewed Scene Registry and Assets

**Files:** Create `src/driving-scenes.js`, `tests/driving-scenes.test.js`, and `assets/driving/*.png`; update the mockup provenance README.

- [ ] Add failing tests for exact scene IDs, local paths, bilingual alt text, AI-generated provenance, frozen data, and nonempty PNG files.
- [ ] Run `node --test tests/driving-scenes.test.js` and verify RED.
- [ ] Copy the three approved plates into `assets/driving/` and generate/inspect the matching five-exit roundabout plate.
- [ ] Implement the frozen registry and rerun the focused test.
- [ ] Record the checkpoint.

### Task 3: Production Manoeuvre Photo Rendering

**Files:** Modify `tests/manoeuvre-surfaces.test.js`, `src/manoeuvre-surfaces.js`, and `styles.css`.

- [ ] Add failing tests requiring stable scene IDs and photo markup for overtaking, parking, and stopping while U-turn remains code-drawn.
- [ ] Verify RED, implement base-image rendering beneath existing overlays, and verify GREEN.
- [ ] Confirm overtaking targets do not overlap either photographed car and parking/stopping targets align with recognizable context.
- [ ] Record the checkpoint.

### Task 4: Production Roundabout Photo Rendering

**Files:** Modify `tests/spatial-surfaces.test.js`, `src/spatial-surfaces.js`, and `styles.css`.

- [ ] Add failing tests requiring the four- or five-exit photo scene ID to follow `geometry.exitCount`, while junction remains code-drawn.
- [ ] Verify RED, implement photo base rendering with existing route/target overlays, and verify GREEN.
- [ ] Preserve the existing predominantly-four-exit seeded distribution and occasional five-exit map.
- [ ] Record the checkpoint.

### Task 5: Concrete Session Lengths

**Files:** Modify `tests/training.test.js`, `tests/storage.test.js`, `tests/i18n.test.js`, `src/training.js`, `src/storage.js`, `src/i18n.js`, and `src/app.js`.

- [ ] Add failing tests for 5/10/15 limits, fresh default `medium`, and exact bilingual numeric labels.
- [ ] Verify RED, map `short`/`medium`/`all` to 5/10/15, and verify GREEN.
- [ ] Preserve valid version-1 backups and cap sessions to the available command pool.
- [ ] Record the checkpoint.

### Task 6: Integrated Browser and Release Verification

**Files:** Modify `.superpowers/sdd/progress.md`.

- [ ] Run `npm test`, `git diff --check`, and `node --test tests/release-audit.test.js`.
- [ ] At 1024×768 review prompt/reveal states for manual securing, overtaking, four/five-exit roundabouts, parking, and stopping in both locales where copy changes.
- [ ] Confirm the AI-voice disclosure, credential audit, and empty browser error/warning logs.
- [ ] Record exact totals and present the uncommitted review build.
