# Examiner Modes and Themed Drives Design

**Date:** 2026-08-06
**Roadmap scope:** Solo E1 and E2
**Implementation authority:** Jeffrey approved the roadmap and a bounded E1
foundation build on 2026-08-06. Live-controller integration and E2 behavior
remain review-gated.

## Purpose

Turn the existing configuration-heavy practice session into a recognizable
solo experience with one mode, one examiner identity, and eventually one
themed drive. The first bounded build establishes stable pure contracts and a
bilingual UI scaffold without changing the production setup screen, scoring,
persistence, or session lifecycle.

## Invariants

- Spanish command text and generated command recordings do not change.
- Stable command, phrasing, action, surface, and audio-variant IDs do not
  change.
- Readiness and attempt scoring do not change.
- The five production voice IDs remain the authority for playable examiners.
- Every interface label and description exists in English and Spanish.
- Examiner identity never invents accent, origin, temperament, or official
  difficulty.
- Mixed voice coverage remains available.
- Today's examiner is deterministic for one local calendar day and requires no
  network, account, or stored state.
- No live storage schema, backup, active-session record, or controller behavior
  changes during the bounded foundation build.

## Examiner Contract

Create one immutable registry entry per production voice:

| Stable examiner ID | Existing voice ID | Display name |
| --- | --- | --- |
| `roger` | `CwhRBWXzGAHq8TQ4Fs17` | Roger |
| `sarah` | `EXAVITQu4vr4xnSDxMaL` | Sara |
| `george` | `JBFqnCBsd6RMkjVDRZzb` | Jorge |
| `matilda` | `XrExE9yKIg1WjnnlVkGX` | Matilde |
| `eric` | `cjVigY5qzO86Huf0OWal` | Eric |

Each record contains only stable identity, voice ID, localization keys, and a
CSS-safe visual token. Tone descriptions must be neutral observations already
supported by the audition review: measured, clear, warm, or direct wording,
without regional claims.

Character display names use forms natural in contemporary Spain. The stable
internal IDs retain the corresponding ElevenLabs catalog names where they
already exist: `sarah` displays as Sara, `george` as Jorge, and `matilda` as
Matilde. Roger and Eric remain plausible names used in Spain. These display
choices do not rename provider assets, audio paths, voice IDs, or stable
examiner IDs.

Examiner choices are:

- `mixed`: preserve coverage-aware selection across all voices.
- `today`: resolve deterministically from the local `YYYY-MM-DD` date.
- one stable examiner ID: limit eligible recorded variants to that voice.

Daily rotation uses an injected date and a documented deterministic hash. It
does not use randomness, persistence, or locale-sensitive date strings.

## Mode Preset Contract

Mode presets describe an experience and map onto existing settings plus
future session policies. They do not become a new scoring dimension.

### Learn

- Existing settings: recommended practice, Mixed content, 0.9×, written
  Spanish shown, timing off, 10 commands.
- Future policy: replay unrestricted; reveal immediate.

### Practice

- Existing settings: recommended practice, Mixed content, 0.9×, written
  Spanish available on request, timing off, 10 commands.
- Future policy: replay unrestricted; reveal immediate.
- This is the semantic equivalent of the fresh-save production default.

### Mock test

- Existing settings: recommended selection, Mixed content, 1×, written
  Spanish unavailable, timing on, 10 commands.
- Future policy: replay unavailable; reveal deferred until session end.
- Mock ordering is explicitly simulated until lesson evidence defines an
  authentic sequence.
- No pass threshold is defined in the foundation build.

Applying a preset returns a new frozen record and does not mutate base settings.
The domain record includes `replayPolicy` and `revealPolicy` for future use,
but the live controller does not consume them yet.

## Themed Drive Contract

E2 will define immutable theme records that select existing commands by stable
criteria. Initial IDs are:

- `first-drive`
- `city-circuit`
- `roundabout-circuit`
- `manoeuvres`
- `precheck-inspection`
- `full-mock`

Themes never copy command text or accepted results. Theme selection must be
deterministic with injected randomness, never duplicate a command, and remain
compatible with existing session lengths. `full-mock` is labeled simulated.

The bounded foundation build may define localization and markup contracts for
theme cards but does not implement theme selection or expose themes in the live
app.

## Bilingual UI Scaffold

A pure renderer may produce the future mode-and-examiner selection markup. It
must:

- Render the three mode cards and seven examiner choices: Today, Mixed, and
  five named examiners.
- Use semantic fieldsets, legends, radios, and visible selected-state text.
- Expose stable `data-action`, mode, and examiner IDs for later controller use.
- Preserve accessible names without relying on color or portrait imagery.
- Escape every dynamic string.
- Maintain 44px-capable controls and visible keyboard focus when later styled.
- Remain uncalled by production `src/app.js` until the integration spec is
  reviewed.

## Persistence and Integration Boundary

The foundation does not add `experienceMode`, `examinerChoice`, `themeId`,
`replayPolicy`, or `revealPolicy` to saved settings or active sessions. That
integration requires:

1. An explicit schema migration and backup compatibility decision.
2. A stable session snapshot so Today's examiner cannot change after midnight.
3. Active-session validation and recovery updates.
4. Selection changes that preserve coverage-aware Mixed behavior.
5. Mock-test reveal and diagnostic buffering.
6. Focus, audio-interruption, offline, and physical-iPad review.

## Failure Behavior

- Unknown examiner, voice, mode, or malformed date: reject with a descriptive
  error rather than silently falling back.
- Production manifest missing one examiner voice: validation reports the
  mismatch; it does not delete the examiner or fabricate playback.
- Today's examiner receives an empty registry: reject.
- Unsupported future policy: reject at the domain boundary.
- UI scaffold receives missing translations: fail in tests, consistent with
  the existing bilingual contract.

## Foundation Acceptance

- The registry contains exactly the five production voice IDs, once each.
- Records and returned collections are deeply immutable.
- Reverse lookup by voice ID is exact.
- Today's examiner is stable for a local date, changes across the documented
  rotation, and is independent of locale formatting.
- Fixed-examiner filtering retains all of that voice's phrasings and speeds and
  no other voice.
- Mixed filtering preserves every candidate.
- Learn, Practice, and Mock presets map exactly to their documented settings and
  future policies without mutation.
- English and Spanish include every scaffold string.
- The UI scaffold is semantic, escaped, and not imported by production app
  code.
- Focused tests, full `npm test`, and `git diff --check` pass.

## Review Gate Before Live Integration

Jeffrey reviews examiner descriptions, cards, and preset semantics. The next
specification must resolve saved-setting migration, fixed-examiner session
snapshots, Mock replay behavior, results buffering, pass language, and initial
theme composition before the production setup screen changes.
