# Photo-Backed Precheck Visual Clarity Design

**Date:** 2026-07-19

**Status:** Approved visual direction; written specification awaiting final review

## Goal

Make every precheck response visually self-explanatory so that the game measures
comprehension of the Spanish command rather than the learner's ability to decode
abstract schematic shapes.

The release remains a generic, illustrative training aid until the driving
school confirms the actual manual-transmission test vehicle. It must not imply
that its layouts are exact representations of that vehicle.

## Assessment Contract

- Every correct and incorrect tappable target has a clear visible icon before
  the learner answers.
- Text answer labels remain hidden before the answer and appear after reveal.
- The background establishes a recognizable physical context: engine bay,
  instrument cluster, driver's door, climate panel, lighting stalk, bonnet
  release, or tailgate release.
- Correct and wrong targets are equally legible. Distractors may be plausible,
  but never anonymous shapes.
- A response surface fails review if a learner who understands the Spanish
  cannot identify the depicted choices.
- The precheck prompt includes bilingual copy explaining that the exercise
  tests understanding of the command and that the vehicle image is
  illustrative.

## Visual Direction

Use realistic AI-generated or otherwise licensed generic vehicle photographs
as static, repository-owned backgrounds. Place simple icon-first targets over
the photographed component or control. Prefer familiar emoji from the earlier
Piso Asturiano implementation when they are unambiguous; use a simple inline
automotive pictogram when an emoji is too general.

Target discs have a translucent light background at 48% opacity,
a visible border, and a fully opaque icon. The photograph remains visible
through the target. Touch areas remain at least 44 CSS pixels at the landscape
iPad baseline.

AI-generated images must be inspected and rejected when they contain impossible
vehicle geometry, duplicated components, unreadable controls, brand marks, or
hybrid-only high-voltage equipment. No generated text may be relied on.

## Placement Precision

The center of an icon target must fall inside the photographed physical feature
the examiner would expect the learner to point to or operate. Nearby placement
is not sufficient.

- Oil-level location targets the dipstick handle, not the filler cap or the
  general engine cover. The approved simple oil symbol is `🛢️` unless a clearer
  universally recognizable asset is validated.
- Coolant targets the coolant-reservoir cap.
- Battery targets the center of the conventional under-bonnet 12 V battery.
- Washer-fluid distractor targets the washer-reservoir cap and uses a windscreen
  plus spray icon.
- Fuel and temperature targets sit on their exact indicator or gauge regions.
- Window lock targets the window-lock switch, not the group of window controls.
- Front and rear demist targets sit on their respective buttons.
- High-beam and fog-light targets sit on the exact stalk motion, ring, or switch
  position shown by the photograph.
- Bonnet opening targets the interior bonnet-release lever.
- Boot opening targets the exterior tailgate release.

Each target definition records an `anchorDescription` for review and a stable
normalized position. Moving an asset requires re-auditing every anchor on it.

## Precheck Scene Inventory

| Scene | Commands | Required visible choices |
| --- | --- | --- |
| Generic engine bay | oil, coolant, battery | oil dipstick `🛢️`; coolant cap `🌡️` + `💧`; battery center `🔋`; washer cap windscreen + spray distractor |
| Instrument cluster | fuel level, engine temperature | fuel-pump and thermometer indicators plus other clear dashboard regions |
| Driver's door | lock and unlock rear-window controls | four window switches, window-lock control, and a distinct door-lock or mirror-control distractor |
| Climate panel | front and rear demist | recognizable front-windscreen and rear-window demist symbols plus clear neighboring controls |
| Lighting stalk | high beam, front fog, rear fog | distinct high-beam and fog-light symbols placed on the relevant stalk motion/rings; equipment variation remains provisional |
| Bonnet release | open bonnet and identify checks | open-bonnet/engine icon on the interior release plus distinct neighboring controls |
| Tailgate | open boot | boot/luggage icon on the actual exterior release plus distinct non-release regions |

The conventional under-bonnet battery intentionally replaces the provisional
Yaris Hybrid under-seat exception for this generic training version. Vehicle
reference copy must stop claiming that the pictured battery is beneath the rear
seat. The current legacy surface, command, action, phrasing, and target IDs stay
stable so existing progress remains compatible. The command-source provenance
also remains stable. Vehicle-reference copy changes from the Yaris Hybrid
under-seat exception to an explicit generic-conventional baseline, while
historical attempts remain untouched. The command contract explicitly selects
the applicable scene asset beneath those stable IDs.

## Interaction and Reveal

The training engine, timing, scoring, mastery, backup format, command IDs,
action IDs, phrasing IDs, and accepted results do not change.

Before answer:

- show the Spanish audio interaction and optional Spanish hint as today;
- show the photograph and all clear icons;
- hide answer labels and correct/wrong treatment;
- expose bilingual localized accessible names.

After answer:

- mark the selected and correct targets without color alone;
- show bilingual target labels;
- retain command meaning, expected action, source provenance, and provisional
  vehicle notice;
- never imply that an AI-generated image is the actual test vehicle.

If a required photo is absent, corrupt, or unmapped, automated release checks
fail. The app must not silently fall back to the old abstract schematic.

## Overtaking Correction

Road, junction, and roundabout surfaces remain out of scope except for the
reported overtaking defect. The overtaking scene receives:

- a distinct learner/test-vehicle icon at the bottom entry point;
- a separate vehicle ahead;
- an overtaking path into the passing lane; and
- a safe-following distractor positioned behind the lead vehicle with visible
  separation, never overlapping it.

## Accessibility and Localization

- Every new visible string exists in English and Spanish.
- Icons supplement rather than replace localized accessible names.
- Touch targets meet the existing 44-pixel minimum.
- Correct and wrong states use shape and text as well as color.
- The bilingual AI-voice disclosure remains visible.
- The illustrative-vehicle notice appears in both locales.

## Asset and Code Boundaries

- Static photographs live under a dedicated browser-delivered asset directory.
- A focused scene manifest maps stable diagram/target IDs to an asset,
  `iconKey`, normalized coordinates, and `anchorDescription`.
- Renderers consume the manifest and existing immutable surface models; scoring
  remains outside rendering.
- Icons are code-native emoji or inline SVG so they stay sharp on iPad and do
  not require additional network assets.
- No provider credential or image-generation metadata enters browser-delivered
  files.

## Verification

Implementation follows test-first increments:

1. Asset and manifest validation: every precheck command maps to an existing
   image, clear icon, stable target, and nonempty anchor description.
2. Renderer behavior: icons are visible before answer; labels are hidden until
   reveal; selection and correctness remain distinguishable without color.
3. Placement contract: targets remain inside bounds, touch-sized, and
   non-overlapping; audited normalized anchors are asserted.
4. Content audit: generic battery copy, bilingual illustrative notice, stable
   IDs, provenance, AI-voice disclosure, and credential exclusions remain
   correct.
5. Visual QA at 1024×768 landscape for every scene in both prompt and reveal
   states, including an explicit check that the icon is centered over the named
   physical feature.
6. Focused overtaking regression followed by the complete `npm test` suite and
   `git diff --check`.

## Checkpoints

Commit and push recoverable checkpoints after:

1. this specification and implementation plan;
2. engine-bay photo surface and shared photo/icon infrastructure;
3. dashboard, door, climate, lighting, bonnet, and tailgate scenes;
4. overtaking correction and final visual/release verification.

Jeffrey reviews the final working tree. Checkpoint commits are authorized for
this rate-limit-sensitive build.
