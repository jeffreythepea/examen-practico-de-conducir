# Parking Gap Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the parking exercise a dedicated photo with an unmistakable parallel-parking gap while preserving the stopping scene and all stable learning IDs.

**Architecture:** Add one immutable entry to the existing driving-scene registry and route only `parking-v1` to it. Keep response logic code-native: the photograph supplies physical context while the existing target and reveal layers supply interaction and feedback.

**Tech Stack:** JavaScript ES modules, HTML/CSS overlays, Node test runner, built-in image generation.

## Global Constraints

- Tests gate every change.
- Commands and generated command audio always remain Spanish.
- Every piece of interface copy must exist in both English and Spanish.
- API keys and other credentials never enter Git or browser-delivered files.
- Command provenance and stable command/action/phrasing/target/result IDs are invariants.
- Jeffrey reviews, commits, and pushes all changes; do not commit or push.

---

### Task 1: Generate and register the parking scene

**Files:**
- Create: `assets/driving/parallel-parking-gap-photo-v1.png`
- Modify: `src/driving-scenes.js`
- Test: `tests/driving-scenes.test.js`

**Interfaces:**
- Produces: `drivingScene('parallel-parking-gap-photo-v1')`, with a local PNG, bilingual `alt`, and `ai-generated-illustrative` provenance.

- [ ] Add a failing registry test for `parallel-parking-gap-photo-v1` and its exact local asset path.
- [ ] Generate a 1536×1024 elevated rear-driving photo: blue learner car at bottom center; two parked cars along the right curb; a clear car-length gap centered near `(72%, 60%)`; a driveway near `(84%, 37%)`; and a pedestrian crossing near `(40%, 15%)`; no text, signs, UI, watermark, or painted response markings.
- [ ] Inspect the raster for subject count, road direction, gap clarity, and clean overlay space; copy the accepted PNG into `assets/driving/`.
- [ ] Register the new frozen scene with bilingual alt text.
- [ ] Run `node --test tests/driving-scenes.test.js`; expect all registry and PNG-integrity tests to pass.

### Task 2: Activate and align parking targets

**Files:**
- Modify: `src/manoeuvre-surfaces.js`
- Test: `tests/manoeuvre-surfaces.test.js`

**Interfaces:**
- Consumes: `parallel-parking-gap-photo-v1` from the driving-scene registry.
- Produces: parking models whose correct target is the photographed gap; stopping models continue to use `urban-roadside-photo-v1`.

- [ ] Add failing tests that require `parking-v1` to use the new scene while `stopping-v1` retains the old scene.
- [ ] Add a 64-seed anchor test requiring both stable parking targets (`open-bay`, `clear-curb-bay`) to remain within the visible gap and the driveway/crossing targets to remain on their photographed features.
- [ ] Route only the parking family to the new scene and set the two correct base anchors to the center of the visible gap; preserve all stable IDs and bounded jitter.
- [ ] Run `node --test tests/manoeuvre-surfaces.test.js`; expect all manoeuvre tests to pass.

### Task 3: Verify the integrated build

**Files:**
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Produces: a recoverable verification checkpoint and an uncommitted review build.

- [ ] Open the parking prompt and reveal at 1024×768; confirm the correct target is visibly inside the gap, wrong targets match their photographed or synthetic restrictions, touch areas remain usable, and browser warnings/errors are empty.
- [ ] Run `npm test`; expect the complete repository suite to pass.
- [ ] Run `npm run release:check`; expect tests and `git diff --check` to pass.
- [ ] Record the asset ID, target alignment, browser result, test count, and uncommitted status in `.superpowers/sdd/progress.md`.
