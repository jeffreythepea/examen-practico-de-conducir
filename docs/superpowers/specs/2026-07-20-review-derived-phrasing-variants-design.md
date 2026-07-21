# Review-Derived Phrasing Variants Design

**Date:** 2026-07-20
**Status:** Reviewer-approved for implementation

## Goal

Add 22 instructor-plausible wording variants to the existing 36-command
catalog without changing any action, response surface, canonical wording, or
stable identifier. Record a separate set of uncertain variants for instructor
review rather than exposing them in practice.

## Invariants

- Existing command and phrasing IDs and their Spanish and English text never
  change.
- A variant changes wording only. It remains inside its existing command and
  therefore uses that command's exact `acceptedResult`, `surfaceId`, and
  scoring behavior.
- The 22 supplied Spanish strings are copied verbatim.
- New IDs continue the existing `<command-id>-supplementary-N` sequence.
- Each new record carries the exact provenance note
  `review-derived 2026-07-20, instructor-plausible`.
- Credentials never enter Git or browser-delivered files. ElevenLabs calls use
  only the existing `ELEVENLABS_API_KEY` environment-variable workflow.

## Catalog Representation

The 22 records are appended to the existing command-level `phrasings` arrays.
They use:

```json
{
  "id": "<next supplementary ID>",
  "es": "<approved verbatim Spanish>",
  "en": "<approved English meaning>",
  "wording": "source-derived",
  "validation": "instructor-plausible",
  "sourcePage": "review-derived 2026-07-20",
  "sourceText": "<same verbatim Spanish>",
  "sourceDocument": "review-derived 2026-07-20",
  "provenanceNote": "review-derived 2026-07-20, instructor-plausible"
}
```

The catalog grows from 54 to 76 phrasings. Command count remains 36. No
phrasing record receives its own `acceptedResult` or `surfaceId`; those remain
single command-level values.

## Approved A List

The new records are:

- `c-recto`: `Siga recto` / `Continue straight`; `Continúe recto` /
  `Continue straight ahead`.
- `c-rot1` through `c-rot5`: `Tome la primera/segunda/tercera/cuarta/quinta
  salida en la rotonda` / `Take the Nth exit at the roundabout`.
- `c-est`: `Estacione donde esté permitido` / `Park where permitted`.
- `c-parada`: `Pare donde esté permitido` / `Stop where permitted`.
- `c-der`: `La próxima a la derecha` / `The next one on the right`.
- `c-izq`: `La próxima a la izquierda` / `The next one on the left`.
- `c-sentido`: `Dé la vuelta cuando pueda` / `Turn around when you can`.
- `c-adel`: `Adelante cuando pueda` / `Overtake when you can`.
- `c-volante`: `Enderece el volante` / `Straighten the steering wheel`.
- `c-pre-largo-alcance`: `Ponga las largas` / `Put on the high beams`.
- `c-pre-cruce`: `Ponga las cortas` / `Put on the low beams`.
- `c-pre-frenos`: `¿Dónde está el líquido de frenos?` /
  `Where is the brake fluid?`.
- `c-pre-lavaparabrisas`: `¿Dónde se rellena el lavaparabrisas?` /
  `Where do you refill the washer fluid?`.
- `c-pre-desempanar-delantera`: `¿Cómo desempañaría la luna delantera?` /
  `How would you demist the front window?`.
- `c-pre-desempanar-trasera`: `¿Cómo desempañaría la luna trasera?` /
  `How would you demist the rear window?`.
- `c-pre-bloquear-elevalunas`: `Bloquee los elevalunas traseros` /
  `Lock the rear windows`.
- `c-pre-desbloquear-elevalunas`: `Quite el bloqueo de los elevalunas` /
  `Unlock the rear windows`.

## Deferred B List

`references/phrasing-variant-backlog.md` records the supplied B-list wording
verbatim, with the open instructor question beside each item. These records do
not enter `data/commands.json`, the audio plan, or scored practice.

The backlog also records the standing exclusion rule: a wording variant may
not change the required response. For example, `¿Cómo se abre el capó?` asks
for an opening demonstration, while `c-pre-capo` requires opening the bonnet
and identifying the levels to check; it is therefore a different action, not a
phrasing variant.

## Audio Generation and Pre-Generation State

`scripts/generate-audio.mjs` already enumerates every catalog phrasing and
cross-products it with the two selected voices and three provider-native
speeds. Tests will make the production expectation explicit:

- 76 phrasings × 2 voices × 3 speeds = 456 planned variants;
- 324 existing integrity-addressed variants are reusable;
- 132 variants are missing before Jeffrey runs the generator.

No manifest entry or MP3 is fabricated. Before generation, browser speech can
play the new wording online, while the verified offline corpus remains the
previous 324 recordings and must not be described as complete for the expanded
catalog.

The ordinary `npm test` suite remains green by checking the published manifest
as a valid integrity-checked subset and by explicitly checking the 132-item
generation backlog. Tests that assert a complete expanded recorded corpus are
skipped with the missing count until generation publishes all 456 verified
assets; after generation they activate automatically. The release/runtime
metadata must derive completeness from the catalog rather than a hard-coded
324 count.

The existing generator command remains:

```sh
node scripts/generate-audio.mjs \
  --provider elevenlabs \
  --voice CwhRBWXzGAHq8TQ4Fs17 \
  --voice EXAVITQu4vr4xnSDxMaL
```

It checksum-reuses existing production assets, checkpoints each new clip, and
publishes only after the complete staged corpus validates.

## Documentation and Verification

- Link the deferred backlog from the Command and Action Model in
  `docs/design.md`.
- Update current catalog/audio counts in `README.md` and `docs/design.md`
  without claiming the 132 pending clips are published.
- Update `CHANGELOG.md` with the 22 new phrasings and deferred B list.
- Extend catalog tests for exact IDs, exact bilingual text, provenance, total
  count, and command-level action/surface invariants.
- Extend generation tests for the 456 planned, 324 reusable, 132 missing
  production state.
- Run focused tests red then green, followed by `npm test` and
  `git diff --check`.

## Non-Goals

- Generating or publishing the 132 audio clips in this task.
- Adding any B-list phrase to gameplay.
- Changing command selection, scoring, mastery, response surfaces, or UI copy.
- Renaming any existing internal command, action, surface, or phrasing ID.
