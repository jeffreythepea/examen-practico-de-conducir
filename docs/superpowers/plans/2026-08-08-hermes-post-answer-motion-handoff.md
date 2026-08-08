# Post-answer motion foundation handoff

Date: 2026-08-08

## Scope and file fence

This bounded slice implements only the pure post-answer motion state contract from
Task 1 of `2026-08-08-solo-e3-correct-post-answer-movement.md`.

Files created by this slice:

- `src/post-answer-motion.js`
- `tests/post-answer-motion.test.js`
- `docs/superpowers/plans/2026-08-08-hermes-post-answer-motion-handoff.md`

No app/controller, surface, style, localization, storage, catalog, audio, asset,
package, or existing-test file was changed by this slice. No commit or push was
made.

## TDD record

RED was confirmed first with:

```text
node --test tests/post-answer-motion.test.js
```

The expected failure was `ERR_MODULE_NOT_FOUND` for
`src/post-answer-motion.js`.

After the implementation, the same focused command reported:

```text
tests 11
pass 11
fail 0
```

## Exported contract

`src/post-answer-motion.js` exports:

- `POST_ANSWER_MOTION_PHASES`
- `POST_ANSWER_MOTION_FAMILIES`
- `createPostAnswerMotion(request)`
- `reducePostAnswerMotion(state, event)`
- `postAnswerMotionView(state, now)`

The first-slice families are exactly `junction`, `roundabout`, `parking`, and
`stopping`. An eligible controller request supplies the reviewed family, route,
start time, and duration. The module validates and clones the route, then owns a
small immutable `static` / `running` / `complete` lifecycle. View progress is
derived deterministically from the injected `now` value and clamped to the
inclusive 0–1 range. Completion and failure transitions are idempotent.

Disabled or ineligible requests return a static reveal contract. A runtime
failure also falls back to that static contract, with no retry or scoring state.

## Deliberate ownership boundary

The module does not calculate or verify correctness. Fields such as `correct`,
`selectedResult`, and `expectedResult` are not retained or inspected. The app
controller remains responsible for deciding whether a correct answer is eligible
for post-answer movement and for supplying the matching route.

## Validation and immutability

- Eligible routes require at least two finite `{x, y}` points within the 0–100
  stage coordinate system.
- Start time must be finite.
- Duration must be finite, greater than zero, and no more than 10 seconds.
- Family names outside the four reviewed families fail closed.
- Returned states, views, route arrays, and route points are frozen.
- Route data is cloned so later caller mutation cannot affect motion state.

## Verification and workspace state

Focused tests pass and the new source/test diff has no whitespace errors.

At handoff, this slice's files are untracked:

```text
?? docs/superpowers/plans/2026-08-08-hermes-post-answer-motion-handoff.md
?? src/post-answer-motion.js
?? tests/post-answer-motion.test.js
```

The shared working tree also contains separate approved plan, route-fixture, and
progress work owned by the supervising agent or another delegated slice. Those
files were present during this slice and were not edited here.

## Recovery checkpoint

If interrupted before review, resume in the repository root and run:

```text
node --test tests/post-answer-motion.test.js
git diff --check -- src/post-answer-motion.js tests/post-answer-motion.test.js
git status --short -- src/post-answer-motion.js tests/post-answer-motion.test.js docs/superpowers/plans/2026-08-08-hermes-post-answer-motion-handoff.md
```

Expected result: 11 focused tests pass, no whitespace errors are printed, and the
three fenced files remain untracked. Then return this handoff to the supervising
agent without committing or pushing.
