# Stage 2 Action Surfaces Design

**Date:** 2026-07-17
**Status:** Approved in conversation; awaiting written-spec review

## Purpose

Stage 1 already produces mostly correct command recognition. Stage 2 therefore
focuses on transfer: replace arbitrary answer choices with landscape-iPad
responses that resemble the spatial decision, vehicle control, or location the
learner will use in the practical test.

The release includes junction and roundabout surfaces, action-matched driving
surfaces, and Toyota Yaris Hybrid 2019 precheck schematics. Road simulation,
additional command phrasings, and deeper voice/phrasing mastery reporting remain
deferred.

## Design Principles

- The iPad is used in landscape orientation.
- The driver's vehicle enters spatial diagrams from the bottom and travels
  upward.
- Tapping is the primary response. Route tracing is deferred until a later
  moving-road prototype.
- Each surface represents a defensible real decision, location, or control.
  Automotive-looking controls are not sufficient if their response remains
  arbitrary.
- Layout variation prevents positional memorization without introducing
  unrealistic geometry.
- Existing command, action, phrasing, surface, and provenance IDs remain stable.
- Existing audio, hints, replay, timing, diagnostics, mastery, backup, and
  localization behavior remain intact.

## Command-to-Surface Mapping

### Junctions and roundabouts

- **Turn left/right:** tap the outgoing road at a junction.
- **Change direction:** tap the completed direction of travel on a safe U-turn
  diagram.
- **Roundabout exits:** tap the intended outgoing road.

The vehicle always enters from the bottom. Roundabout exits are counted from
that entry in the normal direction of travel. Four-exit roundabouts are the
default. Five-exit layouts appear less often, always support fifth-exit trials,
and also appear for targets one through four so that a five-exit map does not
uniquely reveal the answer. Exit angles vary within a restrained realistic
range. Exit numbers, arrows, and labels remain hidden before the response.

### Action-matched driving surfaces

- **Overtake:** tap the overtaking path or destination lane in a two-lane road
  diagram.
- **Park:** tap a legal parking space.
- **Voluntary stop:** tap a safe, legal stopping location.
- **Steering wheel straight:** return a large wheel control to its centered
  position.
- **Secure vehicle:** operate the Yaris-specific securing controls in a short
  sequence.

The legal-stopping, parking, and similar scenarios are hypotheses to validate
through play and practical lessons. Their geometry, distractors, and accepted
targets may change without changing the command or action IDs.

**Adapt speed**, **involuntary stop**, and **exam finish** retain simplified
semantic responses initially. Without a road situation, a pedal or control
response would imply a falsely specific physical action. Practical lessons will
determine whether each command needs a contextual surface.

### Yaris prechecks

The test vehicle is a Toyota Yaris Hybrid 2019. The first release uses original
simplified schematics derived from the Toyota manual rather than copied manual
artwork. It covers:

- Dashboard and steering-column controls
- Climate and demisting controls
- Driver-door window controls
- Bonnet and boot releases
- Exterior light controls
- Engine-bay fluid locations and the 12-volt battery beneath the rear-right seat

Locate/show commands require tapping the correct hotspot. Operate commands
require activating the depicted control. Multi-step responses are used only
where the actual task genuinely has multiple steps.

Every diagram and hotspot has a stable ID. Photographs of the actual test
vehicle can later replace schematic backgrounds without changing progress,
tests, or response provenance.

## Surface Generation and Response Flow

The command is selected before the surface is generated. A compatible pure
generator receives an injected seed and returns a serializable surface model:

- Surface family and version
- Layout seed
- Road or diagram geometry
- Stable target IDs
- Accepted result ID
- Eligible distractor IDs

The renderer displays that model and returns only a normalized selected result
ID. The training engine continues to own scoring, timing, attempts, mastery,
storage, and diagnostics.

The attempt record retains the surface family, surface version, layout seed,
expected target, selected target, response time, voice, speed, hint use, and
replay count. A confusing layout can therefore be reproduced during review.

Tapping empty background does not score. Tapping a valid wrong target scores an
incorrect response. Reveal mode traces or highlights the correct route/control
and distinguishes the chosen wrong target. Replaying audio preserves the exact
surface model.

## Architecture

A surface registry maps supported command/action families to independent pure
generators and renderers:

1. Junction and roundabout surfaces
2. Road-manoeuvre surfaces
3. Wheel and vehicle-control surfaces
4. Yaris precheck schematics

Shared geometry utilities define driver-relative coordinates, target sizing,
seeded variation, and overlap checks. Training and storage modules consume the
same normalized surface interface regardless of renderer.

Unsupported commands are excluded from applicable sessions with a development
diagnostic. A renderer must never silently substitute an unrelated option grid.
The three context-dependent commands explicitly retaining semantic surfaces are
declared exceptions rather than fallbacks.

## Error Handling

- Impossible or invalid generated geometry is rejected before a trial begins
  and regenerated with a bounded retry count.
- Exhausting generation retries produces an unscored surface error with a
  retry action and development diagnostic.
- Missing Yaris assets or hotspot definitions exclude the affected command
  rather than displaying a misleading generic diagram.
- Empty-background taps and incomplete control sequences remain unscored.
- Audio failures and interruptions retain the Stage 1 unscored retry behavior.
- Import validation rejects unknown incompatible surface-model versions without
  replacing active data.

## Accessibility and iPad Interaction

- Interactive targets are at least 44 by 44 CSS pixels and do not overlap.
- Correctness never depends on color alone; reveal paths use shape, labels, and
  contrast.
- Native buttons or SVG controls expose localized accessible names and pressed
  or selected states.
- Keyboard and pointer equivalents remain available on Mac.
- Focus remains stable across replay, response, reveal, and continuation.
- The layout avoids edge gestures and browser chrome conflict in landscape
  Safari.

## Testing

Automated tests verify:

- Every eligible command has an explicit compatible surface.
- Generated layouts always contain the requested response.
- Four-exit roundabouts dominate the configured distribution.
- Five-exit layouts include targets one through four as well as five.
- Exit ordering remains correct under angle variation.
- Seeded generation is reproducible.
- Targets meet minimum size and never overlap.
- Replaying preserves the layout model.
- Attempts and backups preserve surface version, seed, and response provenance.
- Unsupported surfaces are rejected rather than replaced.
- English and Spanish interface strings remain complete.

Manual landscape-iPad checks cover tap accuracy, rotation lock, audio startup,
reveal traces, accidental system gestures, and representative layouts from each
surface family. Mac checks cover pointer and keyboard equivalents.

## Delivery and Validation

One Stage 2 release contains all four surface modules. Junction/roundabout and
action-matched driving surfaces are built as the first implementation group;
Yaris prechecks begin immediately in parallel as a separate module. The module
boundaries allow independent review and prevent one family from destabilizing
the others.

After release, use several real practice sessions and record:

- Commands confused despite correct audio recognition
- Surface or target-selection errors
- Generated layouts that feel misleading
- Legal stopping or parking scenarios that need correction
- Yaris control/location mismatches found during practical lessons
- Response-time and hint/replay changes relative to Stage 1

Stage 2 succeeds when answer-target errors decline and responses feel closer to
the real commanded actions. A moving-road prototype begins only if static
spatial surfaces remain the limiting factor.
