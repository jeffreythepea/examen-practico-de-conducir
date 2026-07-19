# Photo-Backed Precheck Final Review

Date: 2026-07-19

## Scope and recovery state

The photo-backed clarity build retains all stable command, action, phrasing,
surface, result, and target IDs. Recovery checkpoints already pushed to `main`:

- `6a66538` — photo-backed engine prechecks
- `3f8348b` — photo-backed cabin prechecks
- `f31cbe6` — exterior controls, overtaking, and manual immobilization

The remaining documentation, label-spacing correction, evidence, and release
audit form the final checkpoint.

## 1024×768 visual matrix

Evidence directory: `.superpowers/sdd/evidence/precheck-photo-surfaces/`

- 56 command images cover all 14 precheck commands in English and Spanish,
  before response and after a correct reveal.
- `manual-uphill.png` and `manual-downhill.png` cover both Article 92 slope
  variants.
- `overtaking.png` covers the separated learner vehicle, lead vehicle, safe
  following target, and opposing-lane passing target.
- `engine-oil-prompt-en.png` is the initial engine-scene audit capture.

## Exact placement audit

| Scene | Audited physical anchors | Result |
|---|---|---|
| Engine bay | Oil dipstick handle; coolant reservoir cap; centre of conventional battery; blue washer-fluid cap | Pass |
| Instrument cluster | Separate temperature gauge; fuel gauge and pump symbol; central speedometer | Pass |
| Driver door | Crossed-window lock switch; door lock pair; rear-right window rocker | Pass after reducing rings and separating reveal labels |
| Climate panel | Front-demist button; rear-demist button; fan-speed dial | Pass |
| Lighting stalk | High-beam movement ring; front-fog ring; rear-fog ring | Pass after removing redundant overlay icons and separating Spanish reveal labels into three columns |
| Bonnet release | Bonnet lever; fuel-door release; dashboard-brightness control | Pass |
| Tailgate | Exterior release handle; rear camera; rear-wiper base | Pass |

Every correct and incorrect option is visually recognizable. When a photographed
control has a clear native symbol, only the translucent response ring is used so
the symbol remains visible. The measured minimum response target is 44×52.39 CSS
pixels at 1024×768.

## Interaction and release checks

- Correct and wrong engine targets were tapped through the rendered interaction;
  each produced the expected non-color-only reveal state and localized label.
- English and Spanish AI-generated-voice disclosures were both visible.
- Spanish audio completed and Replay completed without a console error.
- Fresh QA tab console: zero errors across all 14 precheck pages and the app smoke.
- Overtaking learner and lead vehicles do not overlap; the safe-following choice
  no longer implies a collision.
- Uphill requires first gear; downhill requires reverse. Selector P does not
  appear in the active interaction.

## Remaining real-vehicle uncertainties

All photographs are illustrative generic images. The driving school must still
confirm the actual test vehicle and transmission, physical control locations,
instrument layout, fitted fog-light controls, battery location, release methods,
and the examiner's expected securing procedure. The generic manual procedure is
grounded in RGC Article 92: stop the engine, apply the parking brake, select first
gear uphill, or select reverse downhill.
