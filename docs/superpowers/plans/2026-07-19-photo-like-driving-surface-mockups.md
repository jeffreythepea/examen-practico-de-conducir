# Photo-Like Driving Surface Mockups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce three review-only, photo-like driving-surface mockups—overtaking, a four-exit roundabout, and legal stopping—with deterministic code-native overlays and no production-game activation.

**Architecture:** Each scene uses one AI-generated raster base plate containing only the physical roadway, surroundings, and vehicles. A standalone HTML review page places target rings and reveal routes over those images with normalized CSS coordinates; production surface IDs, renderers, scoring, and assets remain untouched until a later approved implementation.

**Tech Stack:** Built-in image generation, static HTML/CSS, Node.js test runner, PNG assets

## Global Constraints

- Landscape iPad at 1024×768 is the baseline review viewport.
- The learner's test vehicle enters from the bottom and is visually distinct from other vehicles.
- Raster base plates contain no text, arrows, target rings, answer highlighting, result marks, or route traces.
- Overlays remain code-native and interactive review targets have a minimum rendered size of 44×44 CSS pixels.
- Overtaking choices must not overlap vehicles or resemble a collision path.
- Four exits are the normal roundabout layout; five exits remain a separate, occasional future variant.
- Commands and generated command audio remain Spanish; any new interface copy must exist in English and Spanish.
- No credential, provider key, brand mark, watermark, or exact test-route claim enters an asset or browser-delivered file.
- Stable production command, action, result, target, and surface IDs remain unchanged.
- Jeffrey reviews, commits, and pushes; this work leaves all changes uncommitted.

---

### Task 1: Review-Only Asset Contract

**Files:**
- Create: `tests/driving-mockups.test.js`
- Create: `docs/mockups/driving-surfaces/index.html`
- Create: `docs/mockups/driving-surfaces/mockups.css`

**Interfaces:**
- Consumes: the approved constraints in `docs/superpowers/specs/2026-07-19-photo-like-driving-surfaces-design.md`
- Produces: a static review page with `.scene-card[data-scene]`, `.scene-base`, `.target`, and `.route` hooks

- [ ] **Step 1: Write the failing review-page contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('driving mockup page exposes three review-only scenes and no production script', async () => {
  const html = await readFile('docs/mockups/driving-surfaces/index.html', 'utf8');
  assert.deepEqual(
    [...html.matchAll(/class="scene-card" data-scene="([^"]+)"/g)].map(match => match[1]),
    ['overtaking', 'roundabout-four-exit', 'legal-stopping']
  );
  assert.equal((html.match(/class="scene-base"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /src="(?:\.\.\/)+src\/|src="\/src\//);
});

test('every review target declares an accessible label and a 44px minimum', async () => {
  const [html, css] = await Promise.all([
    readFile('docs/mockups/driving-surfaces/index.html', 'utf8'),
    readFile('docs/mockups/driving-surfaces/mockups.css', 'utf8')
  ]);
  const targets = [...html.matchAll(/<button class="target[^>]+>/g)].map(match => match[0]);
  assert.ok(targets.length >= 7);
  targets.forEach(target => assert.match(target, /aria-label="[^"]+"/));
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/driving-mockups.test.js`

Expected: FAIL because `docs/mockups/driving-surfaces/index.html` does not exist.

- [ ] **Step 3: Create the minimal semantic page and stylesheet**

Create an English/Spanish review header, three `.scene-card` figures in the exact test order, and a prompt/reveal toggle that uses only local checkbox state and CSS. Each card must reference its versioned image path, provide bilingual alt text, contain only code-native target buttons, and include a visible “Review mockup — not active in the game / Maqueta para revisión — no activa en el juego” notice. Define `.target { min-width: 44px; min-height: 44px; }` and keep every overlay absolutely positioned within `.scene-frame`.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/driving-mockups.test.js`

Expected: PASS.

- [ ] **Step 5: Record an uncommitted checkpoint**

Run: `git status --short`

Expected: the new review-page and test files appear as untracked changes; do not commit.

### Task 2: Overtaking Base Plate and Overlay

**Files:**
- Create: `docs/mockups/driving-surfaces/overtaking-v1.png`
- Modify: `docs/mockups/driving-surfaces/index.html`
- Modify: `docs/mockups/driving-surfaces/mockups.css`
- Modify: `tests/driving-mockups.test.js`

**Interfaces:**
- Consumes: `.scene-frame`, `.target`, and `.route` from Task 1
- Produces: `overtaking-v1.png` plus `data-scene="overtaking"` prompt and reveal states

- [ ] **Step 1: Extend the test with overtaking safety assertions**

```js
test('overtaking review separates learner, lead, follow, and pass geometry', async () => {
  const html = await readFile('docs/mockups/driving-surfaces/index.html', 'utf8');
  const card = html.match(/<figure class="scene-card" data-scene="overtaking">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.match(card, /overtaking-v1\.png/);
  assert.match(card, /data-role="learner-vehicle"/);
  assert.match(card, /data-target="safe-follow"/);
  assert.match(card, /data-target="passing-lane"/);
  assert.match(card, /data-correct-route/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/driving-mockups.test.js`

Expected: FAIL because the overtaking scene lacks its final asset and geometry hooks.

- [ ] **Step 3: Generate and inspect the raster base plate**

Use the built-in image-generation tool with this normalized prompt:

```text
Use case: scientific-educational
Asset type: landscape tablet-game roadway base plate
Primary request: create a clear photo-realistic training scene for a safe overtaking decision on a generic two-way Spanish rural road
Scene/backdrop: restrained daylight, dry asphalt, right-hand traffic, solid road edges, dashed center line, ordinary European roadside
Subject: slightly elevated driver-relative view; the learner/test vehicle is fully visible at the bottom in the right lane and visually distinct; one lead car is clearly ahead in the same lane with a generous visible gap; the opposing lane is clear
Composition/framing: fixed wide view, road runs bottom to top, leave unobstructed asphalt behind and beside the lead car for later HTML target overlays
Constraints: realistic lane geometry and vehicle scale; no collision implication; no text, arrows, route traces, circles, highlights, labels, UI, logos, brands, license numbers, or watermark
Avoid: cinematic motion blur, dramatic lighting, dense traffic, confusing lane count, vehicles touching or overlapping
```

Inspect the output at full size. Copy only the accepted image into `docs/mockups/driving-surfaces/overtaking-v1.png`; do not overwrite it with a later variant without explicit review.

- [ ] **Step 4: Add deterministic prompt/reveal overlays**

Place a learner-vehicle identity outline at the bottom, a safe-follow target entirely behind the lead vehicle, and a passing-lane target in the opposing lane alongside but not touching the lead vehicle. Draw the reveal route in CSS/SVG from the learner lane into the opposing lane, beyond the lead vehicle, and back into the original lane. Keep the route absent in prompt mode.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/driving-mockups.test.js`

Expected: PASS.

- [ ] **Step 6: Review at the baseline viewport**

Serve the repository, open `http://127.0.0.1:4173/docs/mockups/driving-surfaces/`, set the viewport to 1024×768, and capture prompt and reveal screenshots. Reject the asset if the alternative resembles collision, any ring overlaps a vehicle, or the learner vehicle is ambiguous.

### Task 3: Four-Exit Roundabout Base Plate and Overlay

**Files:**
- Create: `docs/mockups/driving-surfaces/roundabout-four-exit-v1.png`
- Modify: `docs/mockups/driving-surfaces/index.html`
- Modify: `docs/mockups/driving-surfaces/mockups.css`
- Modify: `tests/driving-mockups.test.js`

**Interfaces:**
- Consumes: the Task 1 review page contract
- Produces: `roundabout-four-exit-v1.png` plus four auditable exit targets with bottom entry

- [ ] **Step 1: Extend the test with roundabout structure assertions**

```js
test('roundabout review uses a bottom entry and exactly four exits', async () => {
  const html = await readFile('docs/mockups/driving-surfaces/index.html', 'utf8');
  const card = html.match(/<figure class="scene-card" data-scene="roundabout-four-exit">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.match(card, /roundabout-four-exit-v1\.png/);
  assert.match(card, /data-entry="bottom"/);
  assert.equal((card.match(/data-exit="[1-4]"/g) ?? []).length, 4);
  assert.doesNotMatch(card, /data-exit="5"/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/driving-mockups.test.js`

Expected: FAIL until final exit hooks are present.

- [ ] **Step 3: Generate and inspect the raster base plate**

Use the built-in image-generation tool with this normalized prompt:

```text
Use case: scientific-educational
Asset type: landscape tablet-game roadway base plate
Primary request: create a clear photo-realistic training view of a compact four-exit Spanish suburban roundabout
Scene/backdrop: daylight, dry asphalt, right-hand traffic, modest curbs and landscaping, recognizable yield line and splitter islands
Subject: slightly elevated driver-relative view with the learner/test vehicle fully visible at the bottom approach; exactly four selectable exits in addition to the bottom entry, with clear lane continuity around one central island
Composition/framing: symmetrical enough to audit but naturally photographic; all exit mouths remain visible and separated for later HTML targets
Constraints: exactly four selectable exits plus the bottom entry road; no extra driveway that resembles an exit; no text, arrows, route traces, circles, highlights, labels, UI, logos, brands, license numbers, or watermark
Avoid: aerial map view, five exits, multi-lane complexity, traffic obscuring exits, cinematic styling
```

Inspect and copy the accepted image to `docs/mockups/driving-surfaces/roundabout-four-exit-v1.png`.

- [ ] **Step 4: Add four code-native exit targets and one reveal route**

Number exits counterclockwise from the bottom entry in data attributes only; do not bake numbers into the image. Position four non-overlapping targets at the exit mouths and demonstrate one reveal route without implying that the most distant exit is always correct.

- [ ] **Step 5: Run the focused test and perform 1024×768 visual review**

Run: `node --test tests/driving-mockups.test.js`

Expected: PASS; visual review shows exactly four readable exits and an unobscured bottom learner vehicle.

### Task 4: Legal-Stopping Base Plate and Overlay

**Files:**
- Create: `docs/mockups/driving-surfaces/legal-stopping-v1.png`
- Modify: `docs/mockups/driving-surfaces/index.html`
- Modify: `docs/mockups/driving-surfaces/mockups.css`
- Modify: `tests/driving-mockups.test.js`

**Interfaces:**
- Consumes: the Task 1 review page contract
- Produces: `legal-stopping-v1.png` with one legal and two contextually illegal targets

- [ ] **Step 1: Extend the test with stopping-context assertions**

```js
test('legal-stopping review exposes contextual choices without answer text in the image', async () => {
  const html = await readFile('docs/mockups/driving-surfaces/index.html', 'utf8');
  const card = html.match(/<figure class="scene-card" data-scene="legal-stopping">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.match(card, /legal-stopping-v1\.png/);
  assert.equal((card.match(/data-legality="legal"/g) ?? []).length, 1);
  assert.equal((card.match(/data-legality="illegal"/g) ?? []).length, 2);
  assert.match(card, /data-context="crossing"/);
  assert.match(card, /data-context="driveway"/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/driving-mockups.test.js`

Expected: FAIL until the three contextual choices are wired.

- [ ] **Step 3: Generate and inspect the raster base plate**

Use the built-in image-generation tool with this normalized prompt:

```text
Use case: scientific-educational
Asset type: landscape tablet-game roadway base plate
Primary request: create a clear photo-realistic Spanish urban roadside scene for choosing a legal stopping location
Scene/backdrop: daylight, dry two-way neighborhood street, right-hand traffic, ordinary curb and sidewalk
Subject: slightly elevated driver-relative view with the learner/test vehicle fully visible at the bottom; three clearly separated candidate curb areas ahead—one unobstructed legal-length curb segment, one driveway entrance, and one pedestrian crossing approach
Composition/framing: road runs bottom to top; each contextual feature is recognizable without explanatory text and has open space for a later HTML target ring
Constraints: legal and illegal context must come from physical road features rather than visual answer highlighting; no text, arrows, route traces, circles, labels, UI, logos, brands, license numbers, or watermark
Avoid: ambiguous curb geometry, parked vehicles hiding candidates, signs with illegible generated text, cinematic styling
```

Inspect and copy the accepted image to `docs/mockups/driving-surfaces/legal-stopping-v1.png`.

- [ ] **Step 4: Add three code-native location targets and reveal treatment**

Place one target on the clear curb, one at the driveway, and one at the crossing approach. In reveal mode, mark the legal target and the selected target using shape plus symbol, not color alone; keep labels outside the photographed feature.

- [ ] **Step 5: Run the focused test and perform 1024×768 visual review**

Run: `node --test tests/driving-mockups.test.js`

Expected: PASS; visual review confirms all three choices are understandable from physical context.

### Task 5: Provenance, Isolation, and Final Review

**Files:**
- Create: `docs/mockups/driving-surfaces/README.md`
- Modify: `tests/driving-mockups.test.js`

**Interfaces:**
- Consumes: all three accepted PNGs and the static review page
- Produces: a reproducible prompt/provenance record and evidence that mockups are isolated from production

- [ ] **Step 1: Add asset and isolation assertions**

```js
test('all mockup assets are PNGs and production sources do not reference them', async () => {
  const paths = [
    'overtaking-v1.png',
    'roundabout-four-exit-v1.png',
    'legal-stopping-v1.png'
  ];
  for (const filename of paths) {
    const bytes = await readFile(`docs/mockups/driving-surfaces/${filename}`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
  const production = await Promise.all([
    readFile('src/manoeuvre-surfaces.js', 'utf8'),
    readFile('src/spatial-surfaces.js', 'utf8'),
    readFile('src/app.js', 'utf8')
  ]);
  production.forEach(source => assert.doesNotMatch(source, /docs\/mockups\/driving-surfaces/));
});
```

- [ ] **Step 2: Run the focused test to verify provenance work is incomplete**

Run: `node --test tests/driving-mockups.test.js`

Expected: asset assertions pass; README documentation is not yet reviewed.

- [ ] **Step 3: Document prompts and provenance**

Record the exact final prompts from Tasks 2–4, state that the built-in image-generation workflow created the imagery, state that the assets are illustrative rather than a real Asturias route or examination vehicle, and link back to the approved design and this implementation plan.

- [ ] **Step 4: Run complete verification**

Run:

```bash
node --test tests/driving-mockups.test.js
npm test
git diff --check
```

Expected: focused tests and full suite PASS; `git diff --check` is silent; the release-audit credential test reports no secret value; the existing bilingual AI-voice disclosure remains visible in the app.

- [ ] **Step 5: Present the review point without committing**

Provide the local review-page URL, show the three images inline, list the saved asset and prompt-record paths, and explicitly state that none of the mockups is active in the game. Leave all changes uncommitted for Jeffrey.
