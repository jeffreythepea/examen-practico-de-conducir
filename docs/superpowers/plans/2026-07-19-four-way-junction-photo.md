# Four-Way Junction Photo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abstract left/right T-junction with a photo-backed four-way intersection offering left, straight, and right actions.

**Architecture:** Add one immutable scene to the driving registry and give `junction-v2` three code-native targets over the photo. Existing left/right results remain scoreable; `continue-forward` is a distractor only.

**Tech Stack:** JavaScript ES modules, HTML/CSS/SVG overlays, Node test runner, built-in image generation.

## Global Constraints

- Tests gate every change.
- Commands and generated command audio always remain Spanish.
- Every piece of interface copy must exist in both English and Spanish.
- API keys and other credentials never enter Git or browser-delivered files.
- Command provenance and stable command/action/phrasing IDs are invariants.
- Jeffrey reviews, commits, and pushes all changes; do not commit or push.

---

### Task 1: Generate and register the intersection plate

**Files:**
- Create: `assets/driving/four-way-intersection-photo-v1.png`
- Modify: `src/driving-scenes.js`
- Test: `tests/driving-scenes.test.js`

- [ ] Add a failing registry expectation for `four-way-intersection-photo-v1`.
- [ ] Generate and inspect a 1536×1024 elevated rear-driving view with a bottom approach and unmistakable left, straight, and right outgoing roads; exclude arrows, text, UI, signs, and route markings.
- [ ] Register the accepted PNG with bilingual alt text and `ai-generated-illustrative` provenance.
- [ ] Run `node --test tests/driving-scenes.test.js`; expect both registry tests to pass.

### Task 2: Add the three-action junction model

**Files:**
- Modify: `src/spatial-surfaces.js`
- Test: `tests/spatial-surfaces.test.js`

- [ ] Add failing tests requiring `junction-v2` to use the new scene and expose `turn-left`, `continue-forward`, and `turn-right` targets on the three photographed road mouths.
- [ ] Preserve accepted left/right validation while generating a stable `straight` / `continue-forward` distractor.
- [ ] Suppress the old synthetic road drawing when the junction photo is present; preserve the code-native reveal route and target buttons.
- [ ] Sweep 64 seeds for photographed-mouth alignment, non-overlap, and touch size.
- [ ] Run `node --test tests/spatial-surfaces.test.js`; expect the focused suite to pass.

### Task 3: Verify the integrated build

**Files:**
- Modify: `.superpowers/sdd/progress.md`

- [ ] Review both left and right prompts and reveals at 1024×768; verify all targets sit on asphalt and the browser reports no warnings/errors.
- [ ] Run `npm test`, `npm run release:check`, and `git diff --check`; expect all gates to pass.
- [ ] Record both new scene IDs, test count, browser result, and uncommitted status in the recovery ledger.
