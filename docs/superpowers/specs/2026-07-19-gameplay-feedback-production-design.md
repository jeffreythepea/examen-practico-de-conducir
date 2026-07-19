# Gameplay Feedback Production Design

**Date:** 2026-07-19
**Status:** Approved through gameplay feedback; implementation in progress

## Goal

Resolve the remaining gameplay dead end, promote the approved photographic road
direction into production, and make session lengths concrete and useful.

## Manual Immobilization

The generic manual procedure remains: stop the engine, apply the hand parking
brake, and select first gear uphill or reverse downhill. Once all three choices
have been made, the trial must end: the required gear produces a correct reveal
and the other gear produces an incorrect reveal with Continue available. A
wrong gear selected before the other two controls does not end the trial.

The slope context uses a recognizable side-view car silhouette with wheels,
roofline, bonnet, and a visually distinct front. It is oriented along the road
so uphill and downhill direction are understandable without reading the label.

## Production Photographic Road Surfaces

Promote the three approved review plates into production assets while retaining
all existing surface, result, and target IDs:

- overtaking uses the approved rural two-lane road and distinct learner/lead cars;
- parking and voluntary stopping share the approved urban roadside plate, with
  code-native markings and signs retained where a template requires them;
- four-exit roundabouts use the approved four-exit plate;
- five-exit roundabouts use a new matching six-arm plate: bottom learner entry
  plus five selectable exits.

Raster images contain only scenery and vehicles. Targets, route traces, reveal
markers, restriction symbols, and accessible labels remain code-native. The
model stores a stable scene ID; a small registry resolves that ID to a local
asset, bilingual alt text, and AI-generated illustrative provenance. Junction
and U-turn surfaces remain code-drawn because no photographic plates have been
approved for them in this increment.

## Session Length

The setup offers exactly `5 commands`, `10 commands`, and `15 commands`, with
10 as the fresh-install default. Existing stable values remain compatible:
`short` maps to 5, `medium` to 10, and legacy `all` maps to 15. Session creation
caps naturally when the selected content pool contains fewer commands.

Spanish labels are `5 preguntas`, `10 preguntas`, and `15 preguntas`.

## Testing and Review

- Use test-first cycles for terminal wrong-gear behavior, car silhouette markup,
  photo-scene registry/rendering, and session-length semantics.
- Preserve deterministic geometry, JSON-safe frozen models, 44-pixel targets,
  bilingual interface copy, and stable identifiers.
- Review active prompt and reveal states at 1024×768.
- Run `npm test`, `git diff --check`, the release audit, AI-voice disclosure
  check, credential audit, and browser-log inspection.

## Scope Boundary

This build does not change Spanish commands or audio, add road animation, add
photographic junction/U-turn plates, or claim that any scene is an actual exam
route or specific test vehicle.
