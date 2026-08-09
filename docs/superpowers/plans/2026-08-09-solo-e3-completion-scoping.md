# Finishing Solo E3 — Scoping

**Status:** Scoped and directed 2026-08-09. Not yet approved to start implementation.

**Source:** `docs/superpowers/specs/2026-08-06-solo-engagement-roadmap-design.md`,
Solo E3 — "Sensory and physical consequence." First bullet (movement after a correct
choice) is done, most recently upgraded by F4 (car glyph, all seven manoeuvre/spatial
families). This scopes the remaining three bullets as **four independent work items**
(vehicle cues and start/seatbelt are split per direction below).

---

## G1 — Wrong-choice consequence: bump + sputter

**Direction (2026-08-09):** build it now. Bump (brief screen jolt) + a new synthesized
"engine sputter" audio cue. The car-glyph flinch (a tiny stutter-forward motion reusing
F4's car sprite) is noted as a possible later addition, not part of this pass.

**Why this shape:** the sputter cue can be built the same way the existing
`correct`/`incorrect`/`spanish-hint` cues are — procedurally synthesized via Web Audio
oscillators in `src/feedback-audio.js` — so it needs **no ElevenLabs asset and doesn't
depend on G3's ambience work landing first.** It's also intentionally decoupled from
ambience: the sputter plays as a one-shot feedback cue regardless of whether cabin
ambience is on, off, or not yet built.

**Task shape:**
1. `src/feedback-audio.js` — add a `sputter` (or rename/extend `incorrect`) cue
   definition: a couple of short, uneven, low-frequency tones with slight pitch
   wobble/detuning to read as an engine stumble rather than a buzzer. Keep it brief
   (under ~400ms total, matching the existing cues' scale).
2. `src/app.js` — `feedbackCueForTransition` already returns `'incorrect'` on a wrong
   answer; either repoint that to the new cue name or layer it alongside the existing
   buzz (decide during implementation which reads better — likely replace, not stack).
3. New CSS: a `bump` keyframe — one short, small-amplitude transform (e.g. a brief
   downward/sideways jolt with quick ease-out) applied to the surface stage on a wrong
   answer. Gate it the same way `post-answer-motion` is gated: `prefers-reduced-motion`
   users get the sputter sound only, no shake (`@media (prefers-reduced-motion: reduce)`
   disables the animation, same pattern as `styles.css`'s existing motion rules).
4. Wire the bump trigger through the same reveal-transition path that currently drives
   `feedbackCueForTransition`, scoped to `outcome === 'incorrect'`.
5. Tests: assert the new cue definition exists and is under the duration budget: assert
   the bump animation is disabled under `prefers-reduced-motion` (matching the existing
   CSS-contract test pattern in `tests/post-answer-motion-view.test.js`); assert the
   trigger only fires on incorrect, not correct/timeout.
6. Verify in-browser: trigger a wrong answer, confirm the bump reads as "a little
   bump," not jarring or crash-like, and confirm reduced-motion suppresses it while
   keeping the audio.

## G2 — Cabin ambience: light first pass

**Direction (2026-08-09):** do a light first pass now, not a full build. Generate
candidate loops via the ElevenLabs sound-effects generator, wire minimal playback,
defer polish.

**Scope for this pass (explicitly light):**
1. **Asset generation** — Jeffrey generates 1-2 candidate loops each for city and rural
   ambience via ElevenLabs' sound-effects generator (a distinct product from the
   voice-generation pipeline already used for command audio — check what output
   format/length it gives; sound-effect loops are usually short one-shots meant to be
   looped by the player, not pre-rendered long loops). Store under a new
   `audio/ambience/` (or similar) directory with the same provenance-recording
   discipline as the command audio corpus.
2. **Minimal playback** — a small new module (e.g. `src/ambience.js`) that loops one
   clip via `<audio loop>` or a looped Web Audio buffer source, starts only when: Test
   mode is active AND the (new) ambience setting is on. Off by default everywhere,
   including Test mode, per spec ("off by default elsewhere" — read as: ambience is
   opt-in even where it's offered).
3. **Volume** — hold ambience clearly under command-audio/speech volume; simplest
   correct approach for this pass is a fixed low gain, not dynamic ducking (defer
   ducking/crossfade to a follow-up once there's a reason to refine it).
4. **Settings** — one new toggle (bilingual copy, persisted like `roadMovement`).
5. **Explicitly deferred to a follow-up, not this pass:** crossfade/seamless looping
   polish, more than one clip per environment, dynamic volume ducking under speech,
   folding the assets into the offline-bundle manifest (worth a follow-up check against
   `docs/superpowers/specs/2026-07-20-offline-readiness-native-roadmap-design.md`'s
   acceptance gate once the assets are real).

**Open item before implementation starts:** need the actual generated clips from
Jeffrey (or a decision to generate them together) before any playback code can be
meaningfully tested — this task is blocked on asset generation, not on scoping.

## G3 — Vehicle cue polish (existing controls)

**Direction (2026-08-09):** split from start/seatbelt (G4) — scope and build
separately.

**Scope:** add a small perceptual cue to the four controls that already exist as real
commands, on top of today's plain state-label toggle
(`stateLabelKey`, `yaris-surfaces.js:352-354`):
- **Indicator** (`c-intermitente`) — a brief blink/tick animation (and optionally a
  short synthesized tick sound, same procedural-cue approach as G1) when toggled on.
- **Parking brake** (`secure-yaris-v1` target `parking-brake`) — a short lever-motion
  cue (CSS transform on the icon/target) rather than an instant state flip.
- **Demister** (front/rear, `c-pre-desempanar-*`) — a brief fade/clear visual on the
  glass icon.
- **Engine stop** (`secure-yaris-v1` target `engine-stop`) — a brief "power down" cue
  (e.g. a quick fade or a one-shot low tone) distinct from the sputter cue in G1 (that
  one signals a wrong answer; this one signals a correct, intentional shutdown — should
  read differently).

**Task shape:**
1. Design one small, restrained CSS transition/keyframe per control family
   (`stalk-ring-control`, `hand-parking-brake-lever`, `climate-button`,
   `ignition-control` — the existing `kind` values already distinguish these in
   `control-surfaces.js`/`yaris-surfaces.js`, so cues can be scoped by `kind` rather
   than one-off per target).
2. Respect `prefers-reduced-motion` throughout — same established pattern.
3. Tests extending `tests/yaris-surfaces.test.js` / `tests/control-surfaces.test.js`
   (whichever the coordinate/state tests already live in) to assert the cue markup/CSS
   hooks exist and are reduced-motion-safe.
4. Verify visually for all four controls in both states.

## G4 — Start/seatbelt: new command + target

**Important finding (2026-08-09):** this isn't a gap that was simply never built —
`references/fermin-practical-test-commands-2020.md` documents that `c-cint` ("Póngase
el cinturón" / put on the seatbelt) and `c-arr` ("Arranque el motor" / start the
engine) existed in an earlier provisional command set and were **deliberately
excluded** because Jeffrey's actual source material (the Autoescuela Fermín student
guide) doesn't contain them — the same provenance discipline that gives every other
command in `data/commands.json` a `sourcePage`/`sourceText` citation.

**Direction (2026-08-09), given that finding:**
1. **Provenance tier** — add them anyway, but as lower-tier content. The catalog
   already supports this: some phrasings carry `"validation": "instructor-plausible"`
   or `"review-derived"` rather than a guide citation (e.g. `c-est`'s supplementary
   phrasings). `c-cint`/`c-arr` should use that same tier, explicitly *not* claiming
   guide verification — `wording`/`validation`/`sourceText` fields should read
   honestly (e.g. `"validation": "instructor-plausible"`, a `provenanceNote` similar to
   the 2026-07-20 review-derived entries), not be dressed up to look guide-sourced.
2. **Grouping** — two separate commands (`c-cint`, `c-arr`), each independent with its
   own phrasing/provenance/single-target surface — not combined into one multi-step
   command like `c-inmov`.
3. **Surface style** — photo-based, matching the visual style of the other precheck
   surfaces (not the icon-driven `secure-yaris-v1` pattern).

**New blocker this direction creates:** a photo-based surface needs a new AI-generated
illustrative photo (or photos) — same asset category as the existing
`assets/precheck/generic-*.webp` images. There's no image-generation tooling in this
repo (`scripts/` only has `optimize-runtime-images.mjs`, which post-processes existing
images, not a generation pipeline) and none available in this session — **this needs
Jeffrey to generate the photo(s), the same way G2 needs him to generate ambience audio
via ElevenLabs.** Two separate commands don't necessarily need two separate photos —
worth generating one "driver's seat / ignition area" illustrative photo depicting both
the seatbelt buckle and the ignition/start switch if they'd plausibly appear together
in one shot, similar to how `generic-lighting-stalk` already serves three targets from
one photo. Once a photo exists, target-coordinate calibration can reuse the same
manual-calibration approach used for F3 (a click-to-place tool against the real image).

**Command catalog work still needed regardless of asset status:** command IDs
(`c-cint`, `c-arr`), Spanish phrasing text, EN translation, and — per `AGENTS.md` —
recorded or AI-voice command audio for each. This is real content work Jeffrey needs
to be involved in (phrasing wording is his call, not something to invent unreviewed).

**Status:** scoped, blocked on Jeffrey producing (a) the illustrative photo(s) and (b)
the actual Spanish phrasing text for `c-cint`/`c-arr` to use as instructor-plausible
content. Not ready to implement until at least the phrasing text exists — the surface
target work depends on it (target `resultId`s tie back to the command's
`acceptedResult`).

## Suggested build order

1. **G1** (wrong-choice bump + sputter) — done, `feature/g1-wrong-choice-consequence`.
2. **G3** (vehicle cue polish) — done, `feature/g3-vehicle-cue-polish`.
3. **G2** (ambience light pass) — blocked on Jeffrey generating/approving clips via
   ElevenLabs; code can be scaffolded in parallel but needs real assets to finish.
4. **G4** (start/seatbelt) — blocked on Jeffrey producing phrasing text and an
   illustrative photo; scoping itself is done (provenance tier, grouping, and surface
   style all decided above).
