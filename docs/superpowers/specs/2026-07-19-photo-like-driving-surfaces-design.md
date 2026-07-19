# Photo-Like Driving Surfaces Design

**Date:** 2026-07-19
**Status:** Approved; selected plates promoted through the later production plan

## Goal

Replace the abstract appearance of driving-item diagrams with recognizable,
photo-like roadway scenes without weakening the deterministic geometry,
touch-target safety, seeded variation, or scoring behavior already in the game.
The scene must test comprehension of the Spanish command, not interpretation of
ambiguous artwork.

## Selected Approach

Use clean raster base plates for roadway, surroundings, and vehicles, then draw
all interactive targets, selected states, correct routes, result markers, and
labels in browser-native code.

This hybrid approach is preferred over fully generated composite screens,
because baked-in targets and routes would be difficult to reposition or audit.
It is preferred over a reusable 3D scene system because the first useful
increment can be built and reviewed with substantially less engineering.

## Visual Contract

- Landscape iPad at 1024×768 remains the baseline review viewport.
- The learner's test vehicle enters from the bottom and is visually distinct
  from other vehicles.
- The road, curbs, lane markings, signs, and relevant physical context should be
  recognizable at a glance, with restrained photographic realism rather than a
  dramatic or cinematic style.
- Raster base plates contain no text, arrows, target rings, answer highlighting,
  result marks, or route traces.
- Interactive overlays remain code-native, meet the existing 44 CSS-pixel
  minimum, and never cover a vehicle or obscure the road feature being tested.
- Correct and incorrect targets remain distinguishable without color alone on
  reveal.
- Seeded variation may adjust scenery, road texture, vehicle color, and modest
  geometry details, but must not change the action's meaning or make one answer
  uniquely obvious.
- Stable command, action, result, target, and surface IDs remain unchanged.

## Pilot Mockups

### 1. Overtaking

Use a straight two-way Spanish road viewed from a slightly elevated,
driver-relative perspective. The learner vehicle is centered at the bottom in
its lane. A lead vehicle is clearly ahead with a normal following gap. The
opposing lane is visible and contains no immediate hazard; any distant vehicle
is small enough not to imply that the pass is already unsafe.

The correct passing target sits in the opposing lane alongside but not touching
the lead vehicle. The non-passing target sits behind the lead vehicle at a safe
following distance. Neither target may overlap either vehicle. On reveal, the
correct route moves out, passes with longitudinal clearance, and returns to the
original lane. The alternative must never resemble a collision path.

### 2. Roundabout

Use a compact urban or suburban roundabout with clear splitter islands, yield
line, central island, curbs, and lane continuity. The learner entry remains at
the bottom. Four exits are the normal base plate; a separate five-exit plate is
used only for the less-common variant. Exit numbering continues to follow
counterclockwise circulation from the learner's entry, and five-exit layouts do
not imply that exit five is the answer.

### 3. Legal Stopping or Parking

Use a recognizable urban roadside scene containing a small number of visually
clear candidate locations. Legal and illegal locations are distinguished by
real road context—driveways, crossings, curb markings, signs, visibility, and
space—not by unexplained abstract blocks. The mockup will use a legal-stopping
prompt first because it exercises the strongest need for scene clarity; the
same art direction can later support parking.

## Asset and Overlay Architecture

- Store reviewed raster base plates under a dedicated driving-illustration
  asset directory with descriptive, versioned filenames.
- Add a scene-art registry that maps an existing template name and bounded
  variant to one base plate plus audited normalized anchors.
- Keep semantic geometry in the existing surface model. The renderer chooses a
  base plate and places the current HTML/SVG targets and reveal route over it.
- Vehicle positions used by scoring remain explicit geometry, not locations
  inferred from pixels at runtime.
- Mockup images begin as exploratory assets. Jeffrey approved the direction;
  selected plates were subsequently promoted through the gameplay-feedback
  production design and implementation plan, with tests preserving the hybrid
  raster-plus-code-native contract.

## Generation and Provenance

- Generate pilot base plates with the built-in image-generation workflow.
- Prompts require generic European/Spanish roadway conventions, no brands,
  readable road geometry, no embedded text, no watermark, and no UI overlays.
- Save the final selected mockups in the repository for review, together with
  their prompts and an explicit AI-generated provenance note.
- Generated imagery is illustrative training material, not evidence of a
  specific Asturias test route or exact examination vehicle.

## Testing and Review

- Review each base plate at 1024×768 before adding overlays.
- Review prompt and reveal mockups for unambiguous vehicle identity, target
  separation, road-feature visibility, label collision, and route clearance.
- Automated tests preserve stable IDs, deterministic variant selection,
  serialized model safety, 44-pixel targets, and non-overlapping target boxes.
- Full release checks continue to require `npm test`, `git diff --check`, the
  bilingual AI-voice disclosure, and the credential audit.

## Scope Boundary

This design produces three visual mockups and an implementation plan. It does
not activate new roadway imagery in the game. Production conversion begins only
after Jeffrey reviews the mockups and approves the implementation plan.
