# Post-answer motion view handoff

## Checkpoint 1 — renderer contract tests

- Scope is limited to `src/post-answer-motion-view.js`,
  `tests/post-answer-motion-view.test.js`, and this handoff.
- Added tests for static and malformed fail-closed behavior, the four approved
  first-slice families, neutral SVG geometry, stable timing metadata,
  accessibility isolation, endpoint completion, and caller immutability.
- No existing file has been modified. No provider, commit, push, or staging
  operation is authorized.
- Exact recovery action: run
  `node --test tests/post-answer-motion-view.test.js`; the expected initial
  failure is `ERR_MODULE_NOT_FOUND` until the pure renderer is added.

Recorded result: the focused test failed with `ERR_MODULE_NOT_FOUND`, as
expected. No unrelated test or source file changed during the red step.

## Checkpoint 2 — pure decorative renderer

- Added `renderPostAnswerMotion(viewModel)` in the fenced source file.
- Running and complete views render one neutral SVG polyline and circle marker.
  The marker position is computed by distance along the route, not by indexing
  route points.
- Markup exposes only stable phase, family, moving, and timing metadata. The
  entire wrapper and SVG are accessibility-hidden, the SVG is not focusable,
  and there is no copy, live region, control, target, result, or correctness
  state.
- Static or malformed input returns an empty string without throwing.
- First focused run after implementation: 4 tests passed and 1 failed because
  the test's hand-calculated midpoint was wrong. The renderer correctly placed
  the marker at `(51.9756, 58.9541)` based on proportional segment length; the
  expected value was corrected without changing implementation behavior.
- Exact recovery action: rerun
  `node --test tests/post-answer-motion-view.test.js`, then run the relevant
  domain/view pair and repository checks.

## Checkpoint 3 — verification and recovery

### Bounded implementation

- Added only `src/post-answer-motion-view.js`,
  `tests/post-answer-motion-view.test.js`, and this handoff.
- Public API: `renderPostAnswerMotion(viewModel)`.
- Static and malformed input fail closed with `''`.
- Valid running or complete input renders one accessibility-hidden,
  non-focusable SVG polyline and a neutral circle marker positioned by distance
  along the supplied normalized route.
- Stable metadata is limited to phase, family, moving state, and timing CSS
  variables. No visible or accessible copy, target, result, correctness,
  scoring, button, or live-region markup is emitted.
- No existing file was edited, staged, committed, or pushed by this task.

### Verification

- `node --test tests/post-answer-motion.test.js tests/post-answer-motion-view.test.js`:
  16 passed, 0 failed.
- `git diff --check`: passed with no output.
- `npm test`: 556 tests total, 555 passed, 1 failed. The only failure is from
  concurrent integration outside this file fence:
  `tests/app-state.test.js` imports `createSavedPostAnswerMotion` from
  `src/app.js`, but that export has not yet been added. No post-answer view or
  domain test failed.

### Exact shared-checkout status

```text
 M .superpowers/sdd/progress.md
 M src/spatial-surfaces.js
 M tests/app-state.test.js
 M tests/spatial-surfaces.test.js
?? docs/superpowers/plans/2026-08-08-hermes-post-answer-motion-handoff.md
?? docs/superpowers/plans/2026-08-08-hermes-post-answer-routes-handoff.md
?? docs/superpowers/plans/2026-08-08-hermes-post-answer-view-handoff.md
?? docs/superpowers/plans/2026-08-08-solo-e3-correct-post-answer-movement.md
?? docs/superpowers/specs/2026-08-08-solo-e3-correct-post-answer-movement-design.md
?? src/post-answer-motion-view.js
?? src/post-answer-motion.js
?? tests/post-answer-motion-view.test.js
?? tests/post-answer-motion.test.js
?? tests/post-answer-route-fixtures.test.js
```

### Recovery instructions

1. Review only the three files owned by this task.
2. Rerun the 16-test focused command above.
3. Complete the concurrent `src/app.js` integration that owns the missing
   `createSavedPostAnswerMotion` export.
4. Rerun `npm test` and `git diff --check` before live wiring or review.
