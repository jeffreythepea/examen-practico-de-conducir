# Claude Code Prompt — Pure Continuity Transition Presentation

Work in the `examen-practico-de-conducir` repository under Codex/Sol review.
Read `AGENTS.md`, then read these files completely:

- `docs/superpowers/specs/2026-08-07-simulated-exam-continuity-design.md`
- `docs/superpowers/plans/2026-08-07-simulated-exam-continuity.md`
- `src/spatial-surfaces.js`
- `src/road-motion.js`
- `src/i18n.js`
- `styles.css`

Implement only Task 2, a pure continuity-transition presentation scaffold. It
must not be wired into the live app.

## File fence

You may create only:

- `src/continuity-transition-view.js`
- `tests/continuity-transition-view.test.js`
- `docs/superpowers/plans/2026-08-07-claude-continuity-view-handoff.md`

You may modify only `styles.css`, and only inside one clearly marked
continuity-transition section. Do not reformat or move existing rules.

Do not touch `src/app.js`, `src/active-session.js`, `src/storage.js`,
`src/i18n.js`, route-planning files, catalog or audio files, assets, package
files, service-worker files, other tests, design/spec documents, README,
CHANGELOG, or `.superpowers/sdd/progress.md`.

## Required behavior

Use test-driven development. Export a pure renderer that accepts a validated
transition view model plus locale and returns escaped semantic HTML. Support
the approved departure, urban-cruise, rural-cruise, arrival, and parked scene
families using only audited existing asset paths.

The markup must:

1. show compact localized transition/progress text supplied by the caller;
2. provide a real `button` with `data-action="skip-continuity-transition"`;
3. keep the decorative scene optionally tappable without making it the only
   control;
4. include no answer target, route line, status marker, correct/incorrect
   state, timer, command text, or scoring behavior;
5. escape all caller-provided text and reject unknown scene families/locales;
6. expose stable data attributes for family, scene ID, and motion enabled;
7. use existing camera-transform concepts without importing controller state;
8. remain static when motion is disabled;
9. use semantic status/focus behavior without repeated live-region chatter;
10. remain caller-independent and mutate nothing.

CSS must provide a 44px Skip target, visible keyboard focus, a fixed lower-edge
learner perspective, iPad-landscape containment, and a static
`prefers-reduced-motion` fallback. Do not add dependencies or new assets.

Because the live i18n dictionaries are outside your file fence, use a tiny
explicit EN/ES presentation dictionary inside the new module for scaffold-only
copy. Codex will decide whether to move those strings into `src/i18n.js` during
integration.

## Rate-limit recovery

The delegated model may stop at any time. Work in these restartable
checkpoints and update the handoff file after each one:

1. failing validation/escaping tests;
2. green renderer foundation;
3. failing accessibility/scene/CSS tests;
4. complete green scaffold;
5. full verification.

At every checkpoint record changed files, test command/output, remaining work,
and exact next action. If interrupted, preserve the same session and filesystem
state. Do not restart, broaden scope, commit, or push.

## Verification and handoff

Run:

```sh
node --test tests/continuity-transition-view.test.js
npm test
git diff --check
git status --short
```

Report implementation summary, public API, markup/data-action choices,
accessibility/escaping decisions, focused and full test counts, diff-check
result, exact status, and issues for Codex review. Do not commit or push.
