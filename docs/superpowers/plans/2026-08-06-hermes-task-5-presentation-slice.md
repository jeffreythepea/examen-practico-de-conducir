# Hermes Handoff — Task 5 Presentation Slice

Work in the existing shared checkout. Read `AGENTS.md`, the approved live
integration design, and Task 5 of the live-integration plan before editing.
The worktree is intentionally dirty with protected production audio, motion,
domain foundations, and Tasks 1–4. Never reset, clean, stash, restore, commit,
or push.

## Scope

Extend only the pure setup presentation foundation. Codex retains all live
controller, persistence, Start-eligibility, and session-construction wiring.

Allowed writes:

- `src/solo-setup-view.js`
- `tests/solo-setup-view.test.js`
- `src/i18n.js`
- `tests/i18n.test.js`
- `styles.css`

Do not modify any other file. In particular, do not touch `src/app.js`,
storage, active-session, training, audio/manifests, data, service worker,
package files, deployment, or the approved design/plan/ledger.

## Requirements

1. Extend `renderSoloSetupView` with a third semantic radio-card group for
   drive theme. It must accept `selectedThemeId`, where `null` is Adaptive
   practice and the remaining stable choices come from `SESSION_THEMES`.
2. Adaptive practice is a real radio choice with a stable DOM value such as
   `adaptive`, but the renderer's domain input/output remains `null`; use
   `data-action="select-theme"` and a stable `data-theme` value.
3. Render all six theme records from the registry, using their existing
   `titleKey`, `descriptionKey`, and simulated flag. Do not duplicate the
   registry or change theme IDs/criteria.
4. Add complete English and Spanish theme copy plus the smallest required
   setup copy for:
   - the theme heading;
   - Adaptive practice title and explanation;
   - Advanced practice disclosure title/explanation;
   - preset-owned Learn and Mock setting explanation;
   - disabled Start reasons for no matching commands and unavailable examiner
     recordings.
5. Add production-ready responsive card styles for `.solo-setup-preview`,
   `.solo-choice-group`, `.solo-choice-grid`, and `.solo-choice`. Preserve
   44px touch targets, visible `:focus-visible`, non-color selected cues,
   portrait stacking, and a compact wide-landscape layout. Do not style or
   alter gameplay surfaces.
6. All interpolated strings remain HTML-escaped. Preserve the existing neutral
   examiner copy, Spanish visible names, and semantic radio/label association.
7. Update focused tests test-first. Replace the obsolete assertion that the
   production app must never import the scaffold with a narrower assertion
   that this pure renderer contains no controller/persistence behavior.

## Gates and Recovery

Run:

```sh
node --test tests/solo-setup-view.test.js tests/i18n.test.js
git diff --check
```

Stop after the focused gate. Do not run a broad formatter. Return a concise
handoff with files changed, exact test counts, and any decisions Codex must
review. If the free model is rate-limited, preserve every filesystem change,
report the session ID and exact last passing/failing test, and stop; do not
restart, widen scope, or undo partial work.
