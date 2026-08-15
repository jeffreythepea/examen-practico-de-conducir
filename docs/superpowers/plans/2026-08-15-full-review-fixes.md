# Plan: fixes from the 2026-08-15 six-area review

**Status:** All five batches shipped 2026-08-15 (`fa4a838..467b827`), suite
794 -> 824 green, `npm run release:check` clean. Batch 1 was additionally
verified on the iPad, including the offline checks. The structural work in
Batch 5 stopped deliberately after the reveal decision, the trial-reset
fields and two module extractions; the rest of the app.js decomposition was
left undone by choice.

Source: full-project review of main @ 5f73f73 (six independent agents: security,
correctness, races, architecture, quality, tests). Already fixed on main:
"Play again" rename (f80d3db) and the mock silent-junction turn-through
withhold (f39a3c8). Suite at 794 green.

Work the batches in order. Each batch is one commit-sized unit (or a small
series); run `npm test` and `git diff --check` after each. Batch 1 is the only
release-blocking work. Every finding below was verified against source by a
reviewing agent; re-read the cited lines before editing, since line numbers
drift.

---

## Batch 1 — Offline update integrity (BLOCKS next release)

The flagship flow: two High-severity races that can recreate the
old-JS-under-new-hash device-verification trap.

1. **Render branches for transient offline statuses.**
   `renderOfflineCard` (src/app.js ~1681–1711) has no branch for
   `applying-update`, `cancelling`, or `download-paused`; they fall through to
   the "Online only" copy **with a live Download/Resume button**. During apply,
   a double-click's second tap lands on that button and starts a concurrent
   download that can silently un-apply the update. Add explicit bilingual
   messages (new i18n keys, both locales — parity test will enforce) and no
   action button (or a disabled one) for the two transient states; a truthful
   "download paused" line for the third. Add an exhaustive status→card test:
   every status the client can publish renders a sensible card (this test
   would have caught the bug).

2. **Serialize service-worker commands.** sw.js does not serialize
   DOWNLOAD_OFFLINE / APPLY_UPDATE / CONFIRM / CANCEL; concurrent handlers
   interleave `writeState` on the same meta record, and the shared
   `downloadController` slot (sw.js ~10, 61–77, 114–119) loses ownership —
   second download overwrites the first's controller; the catch at ~116 nulls
   it unconditionally. Chain state-mutating commands through a promise queue
   (`queue = queue.then(run)`); make DOWNLOAD_OFFLINE a no-op/attach when the
   same version is already downloading; null the controller only from its own
   completion path.

3. **Fix the stale `prior` spread.** `downloadPackage`
   (src/offline-cache.js ~146, 170–179) captures `prior = await readRawState()`
   at entry and spreads it into later `writeState` calls, resurrecting a stale
   `activeVersion`/`activeConfirmed` if activation ran in between. Re-read
   state before each write, or merge only download-owned fields.

4. **Make applyUpdate reload reliably** (src/offline-client.js ~158–175):
   - APPLY_UPDATE uses the default 5s reply timeout (~line 55); a 61 MB cache
     sweep on iPad can exceed it → client shows "failed", no reload, worker
     activated anyway. Pass a long/disabled timeout, as 4c4d42c did for
     DOWNLOAD_OFFLINE.
   - The `controllerchange` listener attaches **after** `send('SKIP_WAITING')`;
     if the worker claims clients in between, the reload never fires. Attach
     first, then send; race the wait against a short fallback timer that
     reloads anyway.
   - The button handler is `void offlineClient.applyUpdate()`; catch and
     surface failures instead of swallowing them.

5. **Generation-guard `register()`** (src/offline-client.js ~100–137).
   Its publishes ignore `operationGeneration`, so a slow startup
   CHECK_FOR_UPDATE resolving mid-download overwrites `status: 'downloading'`
   → progress events dropped (guard at ~81 requires status 'downloading'),
   Cancel replaced by Download, second concurrent 60 MB download possible.
   Snapshot the generation at entry and skip publishes if a command bumped it.

6. **Distinguish "staged complete" from "download in flight".**
   `stagedVersion` is written at download start (offline-cache.js ~170), so a
   reload mid-update-download shows an Apply button for a package that isn't
   there (offline-client.js ~120–130). Write a `stagedComplete` flag only
   after the manifest is stored; map incomplete staging to
   downloading/paused in the client. Also clear the client's stale
   `stagedVersion` when starting a resume, so progress for a moved package
   version isn't rejected (~79–84).

7. **Graceful offline check-for-updates.** A manual "Check for updates" with
   no network publishes `status: 'failed'` (offline-client.js ~152–155) — the
   card claims "The offline download failed" for a healthy installed package.
   On check failure, restore the prior ready/update-available status and show
   a distinct bilingual "couldn't check — you appear to be offline" message.
   `register()` already has the graceful pattern and a pinned test
   (tests/offline-client.test.js:249); mirror both for the manual path.

   New tests for the batch: register-vs-command interleaving, double
   DOWNLOAD_OFFLINE, APPLY_UPDATE reply slower than the timeout, failing
   manual check, exhaustive status→card sweep.

   Device verification: force-quit, confirm the offline card hash matches
   the deployed offline-package.json, then exercise apply-update with a
   deliberate double-tap.

## Batch 2 — Test-integrity sentinels (before any surface/clip work)

1. **Anti-vacuity guard for the gold-glyph audit.**
   `auditGoldGlyphConsumers` (scripts/audit-gold-glyph.mjs ~22–28) silently
   skips surfaces whose `geometry.correctRoute` isn't an array and passes on
   zero findings; 5f73f73 deleted the old test's non-empty-arms assertions.
   Export sweep stats (route-backed surfaces visited, clips matched) and
   assert both > 0 in tests/gold-glyph-audit.test.js. ~10 lines.

2. **Intro ceiling includes the hold.** tests/turn-through.test.js:211 bounds
   only `clip.durationMs <= 10_000`, but the intro validator throws at
   render when `durationMs + holdMs > 10_000`
   (src/continuity-transition-view.js:172; turn-through.js:192). Worst case
   today is 7,333 + 2,500 = 9,833 ms — 167 ms of headroom before a live
   transition crashes mid-drive. One-line assertion on the sum for every
   registered clip; do this BEFORE the ≥3-response overtake/u-turn clip batch.

3. **Collapse the family registries.** The same families are enumerated in
   TURN_THROUGH_FAMILIES (turn-through.js:4), CLIP_SURFACE_SCENES
   (turn-through.js:75), TURN_CLIP_REVEAL_FAMILIES (app.js:115) and
   REVEAL_DWELL_MS_BY_FAMILY (app.js:120). A family added without a dwell
   entry yields `undefined + 1200 = NaN` → `setTimeout(fn, NaN)` fires
   immediately → the reveal flashes away (on-device-only symptom); a family
   added without the app.js entry double-demonstrates (glyph AND clip). Make
   the dwell map the single source, derive the reveal-family set from its
   keys, add a test that all remaining tables agree.

4. **Test the installed-hash display.** de1944c landed testless; the hash is
   the device-verification lifeline. One regex assertion in
   tests/app-smoke.test.js (~line 316 area) that the ready-state card renders
   `offline.activeVersion` (8-char slice).

## Batch 3 — Session-flow correctness

1. **Tap guard on all four results exits.** a7eba0a guards `setup` and
   `retry` (app.js ~2407–2418) but not `open-readiness`/`open-collection`
   (~2405, rendered ~1964); an in-flight tap on those loses the results
   screen irrecoverably. Apply `tapArrivedWithTheScreen()` uniformly in
   bindResultsEvents.

2. **Freeze timers while hidden.** The visibilitychange guard
   (app.js ~1276–1282) predates the auto-advance work and only covers
   prompt/loading-audio. Hide during a clip-backed reveal and the chain
   reveal-timer → CONTINUE → transition-timer → next command can run
   unattended and persist phantom TIMEOUT misses into attempt history. Extend
   the guard to reveal/mock-transition/null-event (freeze in place), or gate
   each advance callback on `document.hidden` and reschedule on return. Add a
   simulated-hidden test.

3. **Stale timers across sessions (Low).** endSession (~2662) doesn't cancel
   pending transition/null-event timers, and step ids (`transition-0-…`)
   reset per session, so a stale timer can clip the next session's first
   transition. Capture `activeSession.id` in the timer closures or clear
   pending ids in endSession/startSession.

## Batch 4 — Hardening and hygiene (any time, small)

1. `.gitignore`: bare `.DS_Store` and `tmp/` wholesale (936 MB of prototypes
   is one careless `git add -A` from a commit). Decide the fate of
   docs/superpowers/plans/2026-08-14-cruise-clips-review-fixes.md (commit or
   delete — currently untracked).
2. Release-audit forbidden patterns (tests/release-audit.test.js ~82–90):
   add `AIza[0-9A-Za-z_-]{33}` and `(GEMINI|GOOGLE|OPENROUTER)_API_KEY=` —
   Veo/Gemini is now the primary provider and the audit has a blind spot.
3. Validate the CHECK_FOR_UPDATE manifest: call `assertPackageManifest`
   inside `fetchPackageManifest` in sw.js (~46–59) so both consumers share
   the download path's trust boundary; add a malformed-manifest test.
4. Deduplicate the launch-video path: app.js ~1461 hardcodes
   `urban-roadside-drive-v2.mp4/-poster.webp`, duplicating URBAN_DRIVE_VIDEO
   (continuity-transition-view.js:8). Export and import; a v3 footage bump
   otherwise splits the assets.
5. Schema-too-new safety (Low): storage.js ~58–70 resets to defaults and the
   next persist overwrites newer-schema state. Stash the unreadable payload
   under a side key before overwriting.
6. CANCEL_DOWNLOAD reply race (cosmetic; folds into Batch 1's queue).

## Batch 5 — Structural (needs a quiet stretch, mechanical-move commits)

1. **Single reveal decision.** The glyph-XOR-auto-advance choice is computed
   at three sites (app.js ~1295 turnClipWillPlayForReveal, ~2283
   scheduleRevealAutoAdvance re-assembling the same inputs inline, ~1863
   mockTransitionIntro with a hand-rolled clipsEnabled). They agree only
   because they run in one synchronous pass. Compute once per reveal render
   ({ willPlay, autoAdvanceMs }) and thread it to render + scheduler + intro.

2. **Shared trial-reset fields.** The 14-field reset blob is inlined in four
   reducer branches (SCENE_STARTED/AUDIO_STARTED ~579, AUDIO_COMPLETED ~640,
   AUDIO_FAILED ~666, AUDIO_INTERRUPTED ~688); a missed field leaks state
   between questions. Extract a TRIAL_RESET_FIELDS constant, keep deliberate
   per-branch exceptions explicit.

3. **Begin decomposing app.js** (2,997 lines): extract the pure reducer and
   reveal-policy helpers into modules; convert the highest-value of the 184
   source-regex assertions in tests/app-smoke.test.js into behavioral tests
   as they move. Do NOT mix with behavior changes.

## Known non-issues (do not "fix")

- 9 prechecks in a 30-length session — accepted (21 driving commands).
- The 600 ms results guard being a timestamp, not pointer-events — deliberate
  (animation throttling strands pointer-events).
- Multi-tab progress display loss (offline-client ~79) — noted, near-invisible
  in single-standalone-iPad use; only revisit if a second window matters.
- Manifest hashes are integrity, not authenticity — inherent to unsigned PWA.
- No auth layer — correctly absent.

## Verification per batch / before release

- `npm test` and `git diff --check` after every batch.
- `npm run release:check` before any deploy (chains test, gold-glyph --check,
  dist build, whitespace).
- Batch 1 additionally needs the on-device pass described above.
