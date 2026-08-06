# Hermes Handoff — Solo E1 Foundation Review

Use this prompt in the current shared checkout because the Solo E1 foundation
is deliberately uncommitted and therefore is not present in a clean Git
worktree. This is a bounded read-only independent review, not authorization to
repair or integrate the feature. Codex owns any follow-up edits.

## Prompt

You are reviewing the pure Solo E1 foundation in
`examen-practico-de-conducir`. Read `AGENTS.md`,
`docs/superpowers/specs/2026-08-06-examiner-modes-themed-drives-design.md`, and
`docs/superpowers/plans/2026-08-06-examiner-modes-foundation.md` completely.

Review only these implementation files and their direct tests:

- `src/examiners.js`
- `tests/examiners.test.js`
- `src/session-presets.js`
- `tests/session-presets.test.js`
- `src/solo-setup-view.js`
- `tests/solo-setup-view.test.js`
- the Solo E1 additions in `src/i18n.js` and `tests/i18n.test.js`

Verify exact five-voice mapping, deterministic local-date Today selection,
fixed/Mixed filtering, deep immutability, approved Learn/Practice/Mock
semantics, neutral bilingual copy, semantic radio markup, robust escaping, and
the absence of production integration. The visible character names must be
exactly Roger, Sara, Jorge, Matilde, and Eric, while the stable internal IDs,
ElevenLabs voice IDs, and provider-audio paths remain unchanged. Work
read-only: report any required repair rather than editing files.

Prohibited changes:

- `src/app.js`, `src/storage.js`, `src/active-session.js`, scoring, playback,
  production audio or manifest files, package/service-worker behavior, CSS,
  deployment, and catalog IDs/text.
- Do not add persistence or make the scaffold visible in the live app.
- Do not invent examiner accent, origin, temperament, or difficulty.
- Do not edit, stage, commit, push, or clean any file. Preserve the existing
  dirty worktree exactly.

Run:

```sh
node --test tests/examiners.test.js tests/session-presets.test.js tests/solo-setup-view.test.js tests/i18n.test.js
npm test
git diff --check
```

Return findings first, ordered by severity with file and line references.
Include focused and full test counts, `git diff --check`, and
`git status --short`. State explicitly that no file was modified and live
integration was not performed.
