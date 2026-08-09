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

**Direction (2026-08-09):** split from vehicle cue polish (G3) — new content, not a
render tweak.

**Gap:** no "fasten seatbelt" or "start the engine" command/target exists anywhere
today. `secure-yaris-v1` only covers securing the vehicle at the end of a drive
(engine stop, parking brake, gear) — there's no beginning-of-drive equivalent.

**Needs deciding before implementation:**
1. **Surface placement** — a new pre-drive checklist surface (mirroring
   `secure-yaris-v1`'s shape but for start-up), or folded into an existing dashboard/
   cabin scene (e.g. `yaris-dashboard-v2`)? Given `secure-yaris-v1`'s family is
   `secure-manual`, a natural parallel would be a `start-manual` family with its own
   surface — but worth checking whether reusing the existing Yaris cabin photo assets
   (rather than sourcing new ones) is possible first.
2. **Scope** — is this one combined action ("prepare to drive": seatbelt + start
   together) or two separate commands (start the engine; fasten the seatbelt)? The
   real driving test treats them as related but distinct checks.
3. **Command catalog work** — new command ID(s), Spanish phrasing with provenance,
   bilingual copy, and (per `AGENTS.md`) recorded/AI-voice command audio — this is
   real content work, similar in shape to any other new command, not just a code change.

**Recommend:** scope this as its own small planning pass once G1-G3 direction is
underway, since it has genuine open product questions (placement, one command vs. two)
that are worth a focused decision rather than folding into this doc's assumptions.

## Suggested build order

1. **G1** (wrong-choice bump + sputter) — self-contained, no dependencies, ready to
   scope into implementation now.
2. **G3** (vehicle cue polish) — self-contained, no dependencies, ready now.
3. **G2** (ambience light pass) — blocked on Jeffrey generating/approving clips via
   ElevenLabs; code can be scaffolded in parallel but needs real assets to finish.
4. **G4** (start/seatbelt) — needs its own short scoping/decision pass first (surface
   placement, one command vs. two) before implementation.
