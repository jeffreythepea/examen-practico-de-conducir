# Post-Answer Route-Fixture Audit Handoff

**Date:** 2026-08-08  
**Plan task:** Task 2 of
`docs/superpowers/plans/2026-08-08-solo-e3-correct-post-answer-movement.md`  
**Status:** Audit complete; two intentional production-exposure failures remain

## Scope and file fence

Created only:

- `tests/post-answer-route-fixtures.test.js`
- `docs/superpowers/plans/2026-08-08-hermes-post-answer-routes-handoff.md`

Production geometry, renderers, catalog data, existing tests, styles, controller,
storage, audio, assets, and package files were read but not modified. No commit or
push was made.

## Fixture coverage

The new audit uses the real catalog commands and generated production models.
It covers:

- all three junction results (`turn-left`, `continue-forward`, `turn-right`)
  over six boundary/representative uint32 seeds;
- every ordinal on forced four- and five-exit roundabouts over the same seed
  sweep;
- both reviewed parking templates over seeds 0–63;
- both reviewed voluntary-stopping templates over seeds 0–63.

For exposed routes, the fixture asserts:

- an immutable route and immutable point records;
- at least two finite points, all within the normalized 0–100 stage;
- the reviewed learner entry;
- an endpoint inside and exactly centered on the accepted target;
- no parking/stopping endpoint inside a rejected target;
- retention of both reviewed parking and stopping templates.

The roundabout fixture additionally verifies, before testing route exposure:

- the forced generated exit count and audited scene ID;
- one finite lane join per exit;
- the accepted join remains on the retained route circle;
- the accepted target matches the requested ordinal;
- once exposed, the route contains the bottom circle entry and exact accepted
  lane join.

## Focused test result

Command:

```text
node --test tests/post-answer-route-fixtures.test.js
```

Result: **4 tests total — 2 passed, 2 failed intentionally.**

Passed:

- parking fixtures retain reviewed legal routes across both templates and seed
  variation;
- stopping fixtures retain reviewed clear-curb routes across both templates and
  seed variation.

Failed with exact production exposure gaps:

1. `junction-v2 does not retain geometry.correctRoute`
2. `4-exit roundabout-v2 does not retain geometry.correctRoute`
3. `5-exit roundabout-v2 does not retain geometry.correctRoute`

These failures are the planned Task 4 seam, not geometry repairs requested from
this audit. `src/spatial-surfaces.js` still constructs junction and roundabout
paths privately in the reveal renderer. Parking and stopping already retain
deeply frozen `geometry.correctRoute` arrays produced from the reviewed template
route and the generated accepted target.

## Production findings

- Junction reveal currently derives `M 50 100`, a center-junction point, and
  the accepted target only during render. The generated model exposes no route
  for a presentation module to consume.
- Both roundabout plates retain all source geometry needed for a shared route:
  `exitCount`, `routeCircle`, `exitJoins`, angles, scene ID, and exact jittered
  targets. Their reveal-only SVG arc is nevertheless private renderer output.
- No tested parking or stopping route required repair. Every swept route begins
  at `{ x: 50, y: 74 }`, stays within stage, and ends at only the accepted legal
  target.
- The fixtures deliberately do not parse rendered HTML as the animation
  contract. Task 4 should expose route points on the immutable generated model,
  then make the existing static reveal and future animation consume that same
  retained source.

## Exact next action

Proceed with Task 4's spatial-only production refactor:

1. retain junction `geometry.correctRoute` points during generation;
2. retain roundabout route points derived from the existing `routeCircle`,
   accepted `exitJoin`, and exact accepted target;
3. preserve the current SVG arc appearance when rendering the retained
   roundabout route;
4. do not change stable IDs, target jitter, accepted results, scene selection,
   parking/stopping geometry, scoring, or animation behavior;
5. rerun this fixture plus the spatial and manoeuvre surface suites.

The audit becomes fully green only after those exposure gaps are resolved; its
assertions should not be weakened or skipped.
