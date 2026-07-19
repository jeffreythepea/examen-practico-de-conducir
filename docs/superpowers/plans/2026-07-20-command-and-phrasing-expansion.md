# Command and Phrasing Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six source-labeled commands and a focused set of alternative phrasings with correct randomized playback, clear existing-photo response surfaces, and resumable incremental ElevenLabs generation.

**Architecture:** Extend the catalog without changing existing stable IDs. Select an audio-backed phrasing at trial start and retain it through hint, reveal, replay, and attempt logging. Reuse the junction, engine-bay, and lighting-stalk assets through isolated scene contracts. Extend the audio generator to reuse verified production variants and durably checkpoint each missing clip.

**Tech Stack:** Browser-native ES modules, Node.js 20+ test runner, JSON catalogs/manifests, static MP3 assets, ElevenLabs multilingual v2.

## Global Constraints

- Commands and generated command audio remain Spanish.
- All interface copy exists in English and Spanish.
- Credentials never enter Git, logs, manifests, or browser-delivered files.
- Existing command, action, phrasing, surface, and attempt IDs remain stable.
- Fermín is primary; composite-only material is explicitly supplementary.
- Tests gate each change; no production behavior is written before its failing test.
- Create small named checkpoint commits only after focused tests pass. Do not
  push or rewrite history without Jeffrey's separate authorization.

---

### Task 1: Source ledger and catalog inventory

**Files:**
- Modify: `references/fermin-atomic-command-inventory.md`
- Create: `references/2026-07-20-composite-command-selection.md`
- Test: `tests/catalog.test.js`

**Interfaces:**
- Consumes: the supplied Fermín PDF and composite JSON hashes in the approved design.
- Produces: six stable command records and source classifications used by later tasks.

- [ ] Write catalog tests expecting 36 unique commands, the six exact IDs, an 18/18 phase split, distinct brake/washer actions, and source metadata on all alternative phrasings.
- [ ] Run `node --test tests/catalog.test.js` and verify failure against the 30-command catalog.
- [ ] Add the six command records and the approved alternative phrasing records to `data/commands.json`.
- [ ] Update the Fermín inventory to resolve the brake-fluid conflict in favor of Spanish and add a concise composite-selection ledger with selected/rejected wording.
- [ ] Run `node --test tests/catalog.test.js` and verify pass.

### Task 2: Trial-stable phrasing selection

**Files:**
- Modify: `src/app.js`
- Test: `tests/app-state.test.js`
- Test: `tests/app-smoke.test.js`

**Interfaces:**
- Consumes: `command.phrasings[]` and audio-manifest records.
- Produces: `selectAudioVariant(manifest, { commandId, speed }, rng)` returning a voice/phrasing variant retained as `model.variant`; `currentPhrasing()` for prompt and reveal copy.

- [ ] Add failing tests that multiple playable phrasings are selectable, a retry retains the selected phrasing, and hint/reveal copy matches `model.variant.phrasingId` rather than `phrasings[0]`.
- [ ] Run the focused app tests and verify the canonical-only implementation fails.
- [ ] Select from all manifest candidates matching command and speed, retain the resulting variant, and resolve displayed phrasing from that retained ID.
- [ ] Update setup audio availability to accept any playable phrasing at the selected speed.
- [ ] Run the focused app tests and verify pass.

### Task 3: Straight-ahead junction command

**Files:**
- Modify: `src/spatial-surfaces.js`
- Test: `tests/spatial-surfaces.test.js`

**Interfaces:**
- Consumes: `c-recto` with action/result `continue-forward` and `junction-v2`.
- Produces: the existing three-way photographed junction with straight as the expected target.

- [ ] Add a failing generation/reveal test for `continue-forward` across a seed sweep.
- [ ] Run `node --test tests/spatial-surfaces.test.js` and verify rejection by the current action whitelist.
- [ ] Admit `continue-forward` as a junction action without changing target geometry or existing turn behavior.
- [ ] Run the focused spatial tests and verify pass.

### Task 4: Engine-bay fluid commands

**Files:**
- Modify: `src/precheck-scenes.js`
- Modify: `src/yaris-surfaces.js`
- Modify: `src/i18n.js`
- Test: `tests/precheck-scenes.test.js`
- Test: `tests/yaris-surfaces.test.js`
- Test: `tests/i18n.test.js`

**Interfaces:**
- Consumes: `c-pre-frenos` / `locate-brake-fluid` and `c-pre-lavaparabrisas` / `locate-washer-fluid`.
- Produces: two non-overlapping `locate` contracts on `generic-engine-bay` with bilingual labels and precise anchors.

- [ ] Add failing tests for command-to-scene routing, brake reservoir cap placement, washer cap placement, non-overlap, and bilingual labels.
- [ ] Run the three focused suites and verify failure for missing contracts/labels.
- [ ] Add a brake-fluid target near the firewall reservoir, expose the existing washer target as a command contract, and add localized labels/answers.
- [ ] Run the focused suites and verify pass.

### Task 5: Lighting and indicator commands

**Files:**
- Modify: `src/precheck-scenes.js`
- Modify: `src/yaris-surfaces.js`
- Modify: `src/i18n.js`
- Test: `tests/precheck-scenes.test.js`
- Test: `tests/yaris-surfaces.test.js`
- Test: `tests/i18n.test.js`

**Interfaces:**
- Consumes: position-light, dipped-headlight, and indicator action/result IDs.
- Produces: two scene definitions reusing `generic-lighting-stalk.png`: an isolated headlight-ring scene and an isolated indicator scene.

- [ ] Add failing tests for separate scene routing, native-symbol-only targets, non-overlapping iPad-sized hit regions, and bilingual labels.
- [ ] Run the focused suites and verify the scenes/contracts are missing.
- [ ] Add the two scene definitions and three Yaris command contracts while leaving the existing fog/high-beam scene unchanged.
- [ ] Run the focused suites and verify pass.

### Task 6: Resumable incremental audio generation

**Files:**
- Modify: `scripts/generate-audio.mjs`
- Modify: `tests/generate-audio.test.js`
- Modify: `tests/audio.test.js`
- Create at runtime: `.superpowers/sdd/audio-expansion-recovery.json`

**Interfaces:**
- Consumes: all catalog phrasings, existing manifest records/files, chosen voices, and `AUDIO_SPEEDS`.
- Produces: a complete generation plan partitioned into reusable and missing variants; a durable per-variant recovery ledger; a validated combined manifest.

- [ ] Replace the fixed-30/canonical-only test fixture with arbitrary command/phrasing coverage and add failing tests for reuse, integrity rejection, durable progress, and restart after a simulated provider stop.
- [ ] Run `node --test tests/generate-audio.test.js tests/audio.test.js` and verify the new expectations fail.
- [ ] Generalize planning to every phrasing and implement incremental reuse only when the existing manifest integrity and file checksum match.
- [ ] Persist newly generated records after each atomic file write; on restart, validate and reuse that recovery record before requesting the provider again.
- [ ] Publish the combined audio tree/manifest only after complete validation; leave production untouched on an incomplete run.
- [ ] Run the focused audio suites and verify pass.

### Task 7: Generate missing audio and audit the corpus

**Files:**
- Modify: `data/audio-manifest.json`
- Create: missing files under `audio/<command>/<phrasing>/<voice>/<speed>.mp3`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: the saved Keychain key and two existing ElevenLabs voice IDs.
- Produces: complete two-voice, three-speed assets for every catalog phrasing or a precise resumable missing list if free credits stop.

- [ ] Run the generator with the saved Keychain key and both existing voice IDs under the approved narrow command authorization.
- [ ] If generation stops, preserve the recovery ledger, record the provider error and remaining variant count, and continue Task 8 without weakening release gates.
- [ ] If generation completes, run the manifest integrity and orphan-asset tests.

### Task 8: Integrated release and iPad-landscape review

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/design.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: completed Tasks 1-7.
- Produces: a review-ready uncommitted build or an explicitly audio-blocked build with all other work complete.

- [ ] Update command counts, source hierarchy, phrasing behavior, audio recovery, and deferred modes in project documentation.
- [ ] Run `npm test`, then `npm run release:check`, and read the complete output.
- [ ] Run `git diff --check`, inspect `git status --short`, and scan the diff for credentials or accidental source-file paths.
- [ ] Serve locally and review every new surface plus at least one alternative phrasing at 1024×768; verify 44-pixel targets, no overlap, correct hint/reveal text, and no browser warnings/errors.
- [ ] Write a final recovery/review checkpoint with exact passing counts, any remaining audio variants, and the next command Jeffrey should run.
