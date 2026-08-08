# Code review — examen-practico-de-conducir

Reviewed at commit `b8f212a` ("Add correct post-answer road movement", 2026-08-08).
Scope: code-only review of the runtime app (`src/`, `sw.js`, `index.html`, storage/offline layers, test suite health). Gameplay/UX not evaluated.

## Verdict

This is an unusually disciplined codebase for a personal project. The architecture (pure event-reducer state machine in `app.js`, exhaustive schema validation in `storage.js`/`active-session.js`, fail-closed offline integrity in `offline-cache.js`, dependency-free tests) is sound and consistently executed. **There are no correctness bugs that need urgent fixing.** The recommendations below are resilience hardening, scalability-over-time fixes, and small cleanups — ordered by value. Items P1–P4 are worth doing; P5–P8 are optional.

Test suite: 611/612 pass on a fresh clone with zero installed dependencies. The one failure (`tests/runtime-images.test.js`) is only the missing `sharp` devDependency — see P3.

## What's already strong (don't change these)

- The reducer pattern (`reduceScreen` + explicit event types) with side effects isolated in `bootstrap()`. Keep it.
- The paranoid validation style (`validateState`, `validateStoredActiveSession`). It's verbose but it's why corrupt saves recover cleanly. Keep it.
- Offline package staging: SHA-256 per asset, atomic activation, staged-then-apply updates. This is better than most production PWAs.
- HTML escaping is applied consistently to all user/data-derived strings; translation strings are static so their non-escaping is acceptable.
- Accessibility: focus management, `aria-pressed`, `role="status"`, skip link, reduced-motion handling.
- **Do not introduce a framework, bundler, or build step for the app itself.** The zero-dependency static design is a feature.

---

## P1 — Handle localStorage write failures in `saveState` (resilience)

**Problem.** `saveState` (`src/storage.js:67`) calls `storage.setItem` with no error handling. `setItem` throws `QuotaExceededError` when the ~5 MB localStorage quota is hit, and can throw in degraded Safari private-browsing states. The most dangerous call site is `completeTrial` (`src/app.js:1845`): `recordAttempt` has already produced the new state, and if `saveState` throws, the exception propagates out of the click handler — `render()` never runs, the timer is stopped, and the UI is left stranded on a stale prompt screen. Because `state.attempts` grows without bound (see P2), quota exhaustion is a *when*, not an *if*, for a daily user.

**Fix.**
1. In `src/app.js`, add a `persistState()` helper that wraps `saveState(window.localStorage, state)` in try/catch. On failure: keep the in-memory state (the session must continue working), set a `persistError` flag, and surface a dismissible bilingual notice on the setup screen ("Progress could not be saved to this device / El progreso no se pudo guardar en este dispositivo"), suggesting Export backup.
2. Replace every direct `saveState(window.localStorage, state)` call in `app.js` (~10 call sites) with `persistState()`.
3. Add the two i18n keys to `src/i18n.js` (EN + ES — AGENTS.md requires both).
4. Tests: extend `tests/app-controller.test.js` (or a new test file) with a storage stub whose `setItem` throws; assert the trial still advances to reveal and the notice appears on return to setup.

**Acceptance:** a throwing `setItem` never breaks the active session; the user is told persistence failed; all existing tests still pass.

## P2 — Bound the growth of `state.attempts` (scalability)

**Problem.** Every scored attempt appends to `state.attempts` forever. Costs compound in three places:
- `saveState` runs `structuredClone` + full validation + `JSON.stringify` of the entire attempts array on **every attempt** (`src/storage.js:67–71`, `validateAttempts` at 185).
- Readiness recomputation scans all attempts twice per command (`readinessForCommand` filter + `masteryForAction` filter — `src/readiness.js:12`, `src/training.js:171`), and runs on every setup/readiness render.
- localStorage quota (see P1).

At ~40 attempts/day, one year ≈ 15,000 attempts ≈ several MB of JSON validated and re-serialized on every answer.

**Fix — compaction with explicit invariants.** Add a `compactAttempts(state, now)` function (new module `src/attempt-compaction.js`), run once at load time in `bootstrap()` before first save. The invariants that MUST survive compaction, because readiness depends on them (`src/readiness.js:25–35`, `src/training.js:199`):
1. The **set of distinct UTC dates with an unaided outcome, per command** (readiness requires ≥ 3 distinct dates). Preserve this either by never dropping the first unaided attempt of each UTC date per command, or by adding a per-command rollup record `{ commandId, unaidedDates: [...] }` to state (requires a schema-version bump to 5 with a migration in `MIGRATIONS`, following the existing pattern in `src/storage.js:88`).
2. The **most recent N attempts per command** in full fidelity (N = 10 is safe; readiness looks at the last 2, the Readiness screen shows the last 5).
3. The **`actionProgress` schedule** already summarizes spaced-repetition state — it is not derived from attempts at runtime except as a fallback (`src/training.js:109–110`), so compaction is safe for scheduling.
4. Attempts referenced by `activeSession.attemptIds` must never be dropped (the validator at `src/storage.js:146–149` hard-fails otherwise).

Suggested policy: keep everything from the last 90 days; older than that, keep the per-command "first unaided attempt per UTC date" plus the rollup. Also update `exportState`/`importState` docs/tests so backups round-trip the rollup.

**This is the one item that needs design judgment — implement it in its own session with the full test suite, and add property tests asserting `readinessForCommand` gives identical states before and after compaction for generated histories.**

**Acceptance:** readiness states identical pre/post compaction on randomized histories; stored size bounded; schema migration covered by a test mirroring the existing migration tests in `tests/storage.test.js`.

## P3 — Make the test suite green on a fresh clone (DX)

**Problem.** `npm test` fails 1/612 on a clean checkout because `tests/runtime-images.test.js:5` does a top-level `import sharp from 'sharp'` and `sharp` is an uninstalled devDependency. Everything else runs dependency-free — a genuinely nice property this one file breaks.

**Fix.** In `tests/runtime-images.test.js`, replace the static import with a dynamic `await import('sharp')` inside a try/catch; if it fails, `test.skip('sharp not installed — run npm install to enable image derivative checks')`. Keep the test fully active when sharp is present so `release:check` (which runs after `npm install` in CI) still gates on it. Verify `.github/workflows/pages.yml` installs devDependencies (it must, for this gate to stay meaningful).

**Acceptance:** `node --test tests/*.test.js` passes 612/612 on a clone with no `node_modules` (1 skipped); CI still enforces the image check.

## P4 — Dead and test-only code in `app.js` (cleanup)

- `hasAudio` (`src/app.js:1978–1983`) is defined and never called. Delete it.
- `selectAudioVariant` (`src/app.js:637`) is exported but used only by `tests/app-state.test.js`; runtime playback goes through `selectPlaybackVariant`. Either delete it and rewrite those assertions against `selectPlaybackVariant`, or leave it with a one-line comment marking it test-only. Deleting is preferred; `findAudioVariant` in `src/audio.js` covers the exact-selection lookup already.

**Acceptance:** `npm test` green; no unused exports remain in `app.js`.

## P5 — Index the audio manifest and attempts instead of rescanning (perf hygiene, optional)

Linear scans that run on hot paths:
- `sessionStartEligibility` (`src/app.js:758`) filters the full 1,185-entry manifest once per command (~45k iterations) on **every setup render**, i.e. every settings change.
- `selectPlaybackVariant` (`src/app.js:648`) does the same per command at session start.
- `readinessForCatalog` re-filters all attempts twice per command (see P2).
- `groupByReadiness` (`src/practice-selection.js:33`) does `records.find` per command (O(n²), n=38 — harmless but free to fix).

**Fix.** At bootstrap, build `manifestByCommandSpeed = Map<"commandId|speed", variant[]>` and pass it (or a lookup closure) into these functions; in `readinessForCatalog`, group attempts into `Map<commandId, attempts[]>` once and pass slices down; in `groupByReadiness`, build a `Map` from `readinessRecords` first. Keep the pure-function signatures test-friendly (accept an optional prebuilt index, defaulting to building one — matching the codebase's dependency-injection style).

**Acceptance:** no behavior change (existing tests are the oracle); setup render does no full-manifest scans.

## P6 — Service-worker per-fetch state reads (perf, optional)

`matchActiveRequest` (`src/offline-cache.js:258`) opens the meta cache and parses state on **every** GET request the SW intercepts, and `readOfflineState` (line 239) verifies presence of all ~1,200 cached assets (`cache.match` × N) on every `GET_OFFLINE_STATE`. On an older iPad this adds latency to every asset load and makes state queries expensive.

**Fix.** Memoize the parsed meta state in a SW-global variable, invalidated by `writeState` (both run in the SW context) and re-read on SW startup. For `readOfflineState`, keep the full presence sweep only for the explicit post-download/registration verification path, and let routine state queries trust the memoized state. Preserve the fail-closed behavior: the full sweep must still run at least once per SW lifetime before reporting "ready".

**Acceptance:** offline tests in `tests/offline-cache.test.js` pass; "Ready offline" is still only reported after a verified sweep.

## P7 — Add a Content-Security-Policy meta tag (hardening, optional)

`index.html` has no CSP. The app is fully self-contained (module script, same-origin CSS/audio/images, no inline handlers — verified in `src/app.js` which uses `addEventListener` exclusively), so a strict policy is nearly free:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'">
```

Add `worker-src 'self'` if needed by the tested browsers. Then verify manually in Safari (iPad + macOS) and Chromium: playback, browser-speech fallback, offline download, backup export (`blob:` URL — if the export anchor breaks, extend with `data: blob:` in the narrowest directive that fixes it, likely none is needed since anchor downloads aren't CSP-fetched). Also extend `tests/pwa-manifest.test.js` or `tests/release-audit.test.js` to assert the meta tag exists.

## P8 — Event delegation instead of rebind-per-render (only if development continues, optional)

`render()` (`src/app.js:942`) rebuilds the whole screen via `innerHTML` and re-attaches every listener via the seven `bind*Events` functions, which is why the ~120 lines of focus snapshot/restore machinery (`captureFocusSnapshot`, `restoreOrDeferFocus`, `deferredFocusSnapshot`) exist. This all works and is well-tested — do **not** rewrite it for its own sake. But if the app keeps growing, a contained refactor to a single delegated `click`/`change`/`input` listener on `#app` (dispatching on `data-action`/`data-setting`/`data-control-event`) would delete most `bind*` functions, make listener wiring impossible to forget on new screens, and reduce the re-render surface. The existing DOM tests simulate real clicks, so they remain the oracle. Medium effort, medium payoff — schedule it only alongside other feature work.

## Repo-weight note (not a code issue)

The repo carries ~1,185 MP3s (necessary — Pages serves them) plus `.superpowers/sdd/evidence/*.png` screenshots and full-size PNG sources next to their WebP derivatives. The evidence screenshots and possibly the PNG sources are not runtime assets (the build allowlists `dist/`), so they only cost clone size. If cloning gets annoying, prune evidence into a separate branch or archive; do not adopt Git LFS (it complicates GitHub Pages for no runtime benefit).

---

## Instructions for the implementing model

- Read `AGENTS.md` first and obey it: tests gate every change (`npm test`), all UI copy in EN **and** ES, no credentials anywhere, stable command/action/phrasing IDs are invariants, and Jeffrey commits/pushes — you only propose diffs.
- Run `npm install` once (needed only for the sharp image test), then `npm test` before and after every item.
- Implement in order P1 → P4 as separate, small diffs. P2 is the only item requiring design care — do it in its own session and add the property tests described.
- Match the existing code style exactly: pure functions with injected dependencies, `Object.freeze` on returned records, exhaustive validation with descriptive error strings, no new dependencies.
