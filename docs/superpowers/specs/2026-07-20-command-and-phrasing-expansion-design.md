# Command and Phrasing Expansion Design

**Date:** 2026-07-20

## Goal

Broaden first-listen comprehension without weakening the app's provenance,
audio-integrity, or action-matched response rules. Fermín remains the primary
source. The supplied consolidated JSON is supplementary evidence for plausible
examiner wording and additional commands.

## Approved source policy

- Treat the Spanish text in the Fermín guide as authoritative when its English
  translation conflicts. In particular, PDF page 3 supports `líquido de
  frenos`; the English `windscreen wiper fluid` label is recorded as a
  translation/diagram-key discrepancy rather than allowed to suppress the
  Spanish item.
- Include windscreen-washer fluid as a separate useful precheck. It is supported
  by the Fermín page-3 diagram key, the page-4 under-bonnet levels context, and
  the Toyota manual's engine-compartment and washer-fluid sections.
- Keep exact source text and a stable source reference on every phrasing.
  Composite-only text is labeled supplementary rather than presented as a
  verbatim Fermín quotation.
- Favor a few plausible extra commands over a narrowly minimal catalog, as long
  as the current game can test the requested action clearly.

Source files supplied by Jeffrey:

- `20200303 Fermin - Practical Driving Test Student Guide copy.pdf`, SHA-256
  `da85b5e8adf782c917a0127b3c0538c61352cfd2bdd65c8659d7be102524ed17`
- `spanish_driving_exam_commands.json`, SHA-256
  `332a6762b7b5d407d50132d12f763a0e3300f2596dfca8ec67697e4dcf7a614b`

## Catalog expansion

Add six atomic commands:

1. `c-recto` — `Siga todo recto`; a driving command using the existing
   four-way junction with left, straight, and right choices.
2. `c-intermitente` — `Ponga el intermitente`; a supplementary safety-correction
   command using the lighting-stalk photograph and a distinct indicator target.
3. `c-pre-frenos` — `Localice el líquido de frenos`; Fermín-authoritative
   precheck on the generic engine-bay photograph.
4. `c-pre-lavaparabrisas` — `Localice el líquido lavaparabrisas`; separate
   engine-bay precheck centered on the blue washer cap.
5. `c-pre-posicion` — `Encienda las luces de posición`; supplementary precheck
   using the native position-light symbol on the existing stalk photograph.
6. `c-pre-cruce` — `Encienda las luces de cruce`; supplementary precheck using
   the native dipped-headlight symbol on the existing stalk photograph.

The active inventory becomes 36 commands: 18 driving and 18 prechecks. Stable
IDs for all existing commands remain unchanged, and existing progress remains
valid.

## Initial phrasing expansion

Add one supplementary alternative to the highest-value actions rather than
importing every unverified JSON string. The first pass covers:

- right and left turns;
- all five roundabout exits;
- change of direction;
- voluntary stopping and parking;
- immobilization and exam completion;
- battery, oil, coolant, bonnet, fuel, and temperature prechecks.

The alternatives deliberately vary meaningful listening cues (for example,
`en la próxima`, short ordinal exit forms, `Aparque`, and direct questions)
without changing the expected action. Colloquial Asturias-only variants,
ambiguous phrases such as `Adelante`, and variants that imply a different
maneuver remain out of scope.

## Runtime phrasing selection

The app selects among all audio-backed phrasings for the current command and
speed, then randomly selects one of the available voices for that phrasing.
The selected phrasing ID is retained on the trial, used for the Spanish hint,
reveal copy, and attempt record, and never changes on replay or audio retry.
Setup excludes a command only if it has no playable phrasing at the selected
speed. A missing alternative cannot suppress an otherwise playable command.

## Response surfaces

- Extend `junction-v2` to accept `continue-forward`; its existing three targets
  already display the required action choices.
- Add brake-fluid and washer-fluid contracts to the engine-bay photograph. The
  brake target is centered on the small reservoir cap near the firewall; the
  washer target retains the existing blue-cap placement.
- Reuse the lighting-stalk photograph through separate scene definitions so
  large iPad tap targets do not overlap. The existing high-beam/fog scene is not
  crowded with the new targets. One scene tests position versus dipped lights;
  another tests the indicator stalk against clear distractors.
- Use translucent target rings and native symbols. Do not add icons over
  legible physical-control symbols.

## Audio generation and recovery

Generate only missing `(command, phrasing, voice, speed)` variants. Existing
verified files and manifest records are reused. Each newly generated file is
written atomically and its integrity is recorded in a durable checkpoint before
the next provider request. Publication of the new manifest occurs only after
all required records validate.

If ElevenLabs reaches the free-credit limit:

- preserve every successfully generated clip and its recovery metadata;
- leave the last complete production manifest usable;
- write the exact missing-variant inventory and restart command;
- continue and finish all non-audio implementation and verification work.

No payment or subscription change is authorized or required.

## Deferred material

Safety barks (`¡Frene!`, `¡Cuidado!`, mirror/shoulder corrections) and illegal or
contradictory “trick” instructions need a separate fast-response mode and are
not added to the current action-surface drill. Broader colloquial Gijón wording
also remains deferred until the initial source-labeled variant set is useful in
practice.

## Verification

- TDD for catalog counts, provenance, phrasing selection, reveal accuracy,
  audio reuse/recovery, and every new surface contract.
- Full `npm test`, `npm run release:check`, and `git diff --check`.
- Release audit must continue to verify bilingual copy, AI-voice disclosure,
  audio completeness, absence of orphan assets, and absence of credentials.
- Browser review at iPad landscape dimensions must confirm the new targets are
  clear, non-overlapping, and at least 44 CSS pixels in both dimensions.
