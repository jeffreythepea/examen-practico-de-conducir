# Review-Derived Phrasing Variants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 22 approved wording-only variants, preserve all command/action/surface invariants, record the deferred B list, and leave a verified resumable 132-clip ElevenLabs generation backlog.

**Architecture:** Append records to existing command-level phrasing arrays and keep response semantics exclusively on each command. Make recorded-corpus completeness dynamic, verify the current manifest as a strict valid subset before generation, and let post-generation completeness assertions activate when all 456 assets exist.

**Tech Stack:** JSON catalog, Node.js test runner, plain JavaScript audio/runtime tooling, Markdown product records.

## Global Constraints

- Never modify existing command or phrasing IDs or their Spanish or English text.
- Each variant changes wording only and maps to its command's exact `acceptedResult` and `surfaceId`.
- Copy every supplied Spanish command verbatim.
- Use the next `<command-id>-supplementary-N` ID.
- Add the exact provenance note `review-derived 2026-07-20, instructor-plausible`.
- Do not fabricate audio-manifest entries or MP3 assets.
- Credentials never enter Git; provider calls use only `ELEVENLABS_API_KEY`.
- Leave the complete task uncommitted for Jeffrey's review.

---

### Task 1: Specify and test the expanded catalog

**Files:**
- Modify: `tests/catalog.test.js`
- Modify: `data/commands.json`

**Interfaces:**
- Consumes: existing `command.phrasings[]`, `command.acceptedResult`, and `command.surfaceId`.
- Produces: 76 total phrasings with 22 exact new records and no phrasing-level response override.

- [ ] Add a failing test with a table of all 22 expected command IDs, next phrasing IDs, exact Spanish/English text, and the exact provenance note.
- [ ] Add failing assertions for 76 total phrasings, unchanged 36-command count, and absence of phrasing-level `acceptedResult` or `surfaceId` overrides.
- [ ] Run `node --test tests/catalog.test.js` and confirm failure because the 22 records are absent.
- [ ] Append the exact new records to `data/commands.json` without modifying existing records.
- [ ] Run `node --test tests/catalog.test.js` and confirm all catalog tests pass.

---

### Task 2: Record the deferred B list and exclusion rule

**Files:**
- Create: `references/phrasing-variant-backlog.md`
- Modify: `docs/design.md`
- Modify: `tests/release-audit.test.js`

**Interfaces:**
- Consumes: the reviewer-supplied B list and instructor questions.
- Produces: a discoverable non-runtime backlog that is explicitly excluded from the catalog and audio plan.

- [ ] Add a failing release-audit test requiring every B-list phrase, its instructor question, the response-changing exclusion rule, the `¿Cómo se abre el capó?` example, and a design-doc link.
- [ ] Run `node --test tests/release-audit.test.js` and confirm the backlog audit fails.
- [ ] Create `references/phrasing-variant-backlog.md` with the B list verbatim and state that none of it is playable or scheduled for audio.
- [ ] Link the backlog from the Command and Action Model in `docs/design.md`.
- [ ] Run `node --test tests/release-audit.test.js` and confirm the backlog audit passes.

---

### Task 3: Make the 132-clip generation backlog explicit

**Files:**
- Modify: `scripts/runtime-package.mjs`
- Modify: `tests/generate-audio.test.js`
- Modify: `tests/runtime-package.test.js`
- Modify: `tests/release-audit.test.js`

**Interfaces:**
- Consumes: 76 catalog phrasings, the existing 324-record manifest, two voices, and `AUDIO_SPEEDS` `[0.75, 0.9, 1]`.
- Produces: a 456-variant generation plan, a computed 132-variant missing set, dynamic runtime completeness, and conditional post-generation completeness gates.

- [ ] Add failing generation tests that load the production catalog and manifest, assert 456 planned IDs, 324 reusable IDs, and exactly 132 missing IDs.
- [ ] Add failing runtime tests requiring corpus completeness to derive from the catalog instead of the hard-coded 324 value.
- [ ] Change the current release audit from complete-corpus equality to integrity-valid published-subset validation, then add a separately named complete-expanded-corpus test that skips with the missing count until all 456 assets exist.
- [ ] Run `node --test tests/generate-audio.test.js tests/runtime-package.test.js tests/release-audit.test.js` and confirm failures identify the 324 hard-code and old completeness assumption.
- [ ] Remove the fixed `required.length === 324` condition from `isRecordedCorpusComplete` and make runtime test counts derive from the current manifest.
- [ ] Verify the complete-corpus test remains explicitly skipped with `132 recorded variants pending`, not silently weakened.
- [ ] Run the focused three-file suite and confirm it passes with the documented skip.

---

### Task 4: Update active product and generation documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/design.md`
- Modify: `docs/superpowers/plans/2026-07-20-command-and-phrasing-expansion.md`
- Modify: `CHANGELOG.md`
- Modify: `tests/release-audit.test.js`

**Interfaces:**
- Consumes: the verified catalog and generation-backlog counts.
- Produces: accurate 76-phrasing catalog, 324 published/132 pending audio status, and the exact resumable generation command.

- [ ] Extend release-audit assertions for 76 catalog phrasings, 456 target variants, 324 reusable assets, 132 pending assets, no fabricated manifest entries, and the existing environment-variable generation command.
- [ ] Run the release audit and confirm it fails against the old 54/324 complete-corpus wording.
- [ ] Update `README.md`, `docs/design.md`, and `CHANGELOG.md` without claiming the expanded recorded corpus is complete.
- [ ] Extend the existing audio-generation plan with the 132-clip run, reuse/recovery behavior, and post-generation validation step.
- [ ] Run the release audit and confirm it passes.

---

### Task 5: Integrated pre-generation verification

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: a green uncommitted pre-generation diff and a precise post-generation gate.

- [ ] Run `npm test` and record totals, failures, and named skips.
- [ ] Run `git diff --check` and confirm no whitespace errors.
- [ ] Inspect `git diff` to confirm existing IDs/text are untouched, the 22 Spanish strings are verbatim, no B-list phrase entered the catalog, and no audio manifest or MP3 changed.
- [ ] Verify the bilingual AI-voice disclosure remains in `src/i18n.js` and no credential-shaped value appears in the diff.
- [ ] Report the exact tests that activate only after Jeffrey generates the 132 missing clips, then stop without committing.
