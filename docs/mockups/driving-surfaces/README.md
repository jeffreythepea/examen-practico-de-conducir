# Photo-Like Driving Surface Mockups

These three review-only raster plates were created with the built-in image-generation workflow
on 2026-07-19. They are illustrative training
material, not a real Asturias test route, a documented examination vehicle, or
an assertion about one driving school's car. Following review, selected plates
were copied into `assets/driving/` and activated through the production scene
registry; this directory remains the design record and is not loaded directly.

The HTML page keeps targets, routes, result marks, and labels code-native so
their geometry can be audited and changed without regenerating the underlying
image. Open `index.html` through the repository's local server to compare the
prompt and reveal treatments.

## Assets and Final Prompts

### `overtaking-v1.png`

```text
Use case: scientific-educational
Asset type: landscape tablet-game roadway base plate
Primary request: Create a clear photorealistic training scene for a safe overtaking decision on a generic two-way Spanish rural road.
Scene/backdrop: restrained neutral daylight, dry asphalt, right-hand traffic, solid white road edges, dashed white center line, ordinary green European roadside, no dramatic scenery.
Subject: slightly elevated driver-relative view looking forward. A small blue learner/test hatchback is fully visible at the bottom in the right-hand lane, travelling away from the viewer. One silver lead hatchback is clearly ahead in the same right-hand lane with a generous visible gap. The left opposing lane is empty and clearly readable.
Composition/framing: landscape 3:2, road runs vertically bottom to top. Preserve unobstructed asphalt behind the lead car for a safe-follow target, and preserve unobstructed asphalt in the opposing lane alongside and ahead of the lead car for a passing target and route overlay. Vehicles must be small enough to leave generous space around them.
Style/medium: realistic educational road photography, crisp and literal, not cinematic.
Constraints: realistic lane geometry and vehicle scale; no collision implication; no oncoming vehicles; no text, arrows, route traces, circles, highlights, labels, interface elements, logos, brand marks, readable license numbers, or watermark.
Avoid: motion blur, dramatic lighting, dense traffic, extra lanes, intersections, curves, vehicles touching or overlapping, top-down map view.
```

### `roundabout-four-exit-v1.png`

The final plate used a simple five-arm geometry reference: one bottom learner
entry plus four selectable exits. The reference was rendered with this prompt,
then one generated roof letter was removed in a precision edit.

```text
Use case: sketch-to-render
Asset type: landscape tablet-game roadway base plate
Input image: Image 1 is a strict geometry and composition reference, not an edit target. Preserve its exact five-arm topology and approximate arm directions.
Primary request: Convert the simple guide into a photorealistic Spanish suburban roundabout training scene.
Scene/backdrop: neutral daylight, dry asphalt, modest curbs, small splitter islands, low grass and sparse trees, no buildings or driveways near the junction.
Subject: slightly elevated driver-relative view. Replace the blue rectangle with a realistic small blue learner/test hatchback entering from the bottom. The central ring is the roundabout road around one low landscaped circular island.
Mandatory topology: retain exactly the five road mouths shown in the guide—one bottom learner entry plus four selectable outgoing roads at right, top, left, and lower-left. Keep the lower-left exit clearly separate from the bottom entry. Do not add or remove any road arm.
Composition/framing: landscape 3:2, all four outgoing exit mouths fully visible with clear asphalt for later HTML target rings.
Style/medium: crisp photorealistic road-engineering visualization, literal and educational, restrained natural lighting.
Constraints: preserve the reference topology exactly; right-hand traffic markings; no text, numbers, arrows, route traces, circles, answer highlights, labels, interface elements, logos, brand marks, readable license numbers, or watermark.
Avoid: conventional four-arm cross intersection, merging roads, extra road arms, multi-lane complexity, traffic, visual clutter, cinematic styling.
```

Final precision edit:

```text
Use case: precise-object-edit
Asset type: landscape tablet-game roadway base plate
Primary request: Remove only the blue-and-white square L marking from the roof of the blue car. Reconstruct the roof as uninterrupted matching blue automotive paint with the same reflections and lighting.
Input image: Image 1 is the edit target.
Invariants: Preserve every road, curb, the exact five-arm topology, central island, car position and shape, grass, trees, camera, framing, and lighting exactly. Do not add, remove, merge, or move any road arm.
Constraints: no text, letters, numbers, arrows, route traces, target circles, labels, UI, logos, readable license numbers, or watermark.
```

### `legal-stopping-v1.png`

```text
Use case: scientific-educational
Asset type: landscape tablet-game roadway base plate
Primary request: Create a clear photorealistic Spanish urban roadside training scene for choosing a legal stopping location.
Scene/backdrop: neutral daylight, dry two-way residential street, right-hand traffic, ordinary gray curb and sidewalk, modest low buildings and greenery set back from the road.
Subject: slightly elevated driver-relative view looking forward. A small blue learner/test hatchback is fully visible at the bottom in the right-hand lane. Along the RIGHT curb ahead are exactly three clearly separated candidate areas, in this order from nearer to farther: (1) a long unobstructed clear curb segment with enough room to stop legally, (2) a clearly recognizable driveway/garage entrance crossing the sidewalk and curb, and (3) a clearly recognizable zebra pedestrian crossing across the roadway. Keep all three areas fully visible and unobstructed.
Composition/framing: landscape 3:2, road runs bottom to top, each candidate area occupies a different vertical band and has generous visible asphalt for later HTML target rings. No parked vehicles hide the curb, driveway, or crossing.
Style/medium: realistic educational road photography, crisp, literal, restrained, not cinematic.
Constraints: legality must be communicated only by the real physical road context; no answer highlighting; no text, arrows, route traces, circles, labels, interface elements, logos, brands, readable license numbers, or watermark.
Avoid: ambiguous curb geometry, extra driveways, extra crossings, signs with generated writing, dense traffic, pedestrians, cinematic lighting, motion blur, top-down map view.
```

### Production five-exit companion

The approved direction was extended for production with
`assets/driving/roundabout-five-photo-v1.png`. It uses the same illustrative
style and contains exactly one bottom learner entry plus five outgoing roads.
Targets, exit order, and routes remain browser-native overlays. The asset was
generated with the built-in image-generation workflow from the approved
four-exit plate as a style and composition reference; it is not an actual exam
route.

## Design References

- [Approved design](../../superpowers/specs/2026-07-19-photo-like-driving-surfaces-design.md)
- [Mockup implementation plan](../../superpowers/plans/2026-07-19-photo-like-driving-surface-mockups.md)
- [Production activation design](../../superpowers/specs/2026-07-19-gameplay-feedback-production-design.md)
- [Production activation plan](../../superpowers/plans/2026-07-19-gameplay-feedback-production.md)
