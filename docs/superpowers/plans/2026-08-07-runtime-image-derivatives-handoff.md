# Runtime Image Derivatives Handoff

## Scope completed

- Preserved both source PNGs unchanged.
- Added `assets/driving/join-traffic-photo-v1.webp` using the existing Sharp
  convention: WebP quality 82, effort 6.
- Added `assets/driving/roundabout-four-photo-v2.webp` with the same settings.
- No runtime source, catalog, style, audio, package, or existing test file was
  edited.

## Asset verification

| Asset | PNG | WebP | Runtime/source ratio | Dimensions |
| --- | ---: | ---: | ---: | --- |
| `join-traffic-photo-v1` | 3,125,292 bytes | 259,450 bytes | 8.30% | 1536×1024 |
| `roundabout-four-photo-v2` | 3,123,598 bytes | 243,388 bytes | 7.79% | 1536×1024 |

Both derivatives retain the exact source dimensions and exceed the existing
40% shrink requirement. `tests/runtime-images.test.js` derives its cases from
the live scene registries, so no fixture expectation was added before these
assets are activated.

## Existing v1 references identified, not edited

- The four-exit selection still points to `roundabout-four-photo-v1` in
  `src/spatial-surfaces.js` inside `ROUNDABOUT_SCENES[4].sceneId`.
- That ID resolves to the v1 WebP in `src/driving-scenes.js`.
- Its motion calibration remains keyed by the v1 ID in `src/road-motion.js`.

Codex should update those coordinated references and focused tests when the v2
scene is activated; this bounded asset-maintenance slice deliberately did not.

## Verification

- `node --test tests/runtime-images.test.js`: 1 passed, 0 failed.
- `git diff --check`: passed with no output.
- No commit or push was made.
