# Road Route and Target Alignment Design

## Goal

Make the photo-backed driving responses communicate the resulting vehicle movement clearly while keeping every selectable target centered on a plausible part of the road. The exercise remains a Spanish-comprehension test, not a precision-tapping or diagram-decoding test.

## Scope

This increment covers three independent visual refinements:

1. Add a revealed movement trace from the learner vehicle into the legal parking space.
2. Add a revealed movement trace from the learner vehicle to the legal voluntary-stopping location, clear of the driveway.
3. Align four- and five-exit roundabout targets and revealed routes with the photographed road mouths.

It does not change scoring, command text, audio, surface selection, image assets, or interface copy.

## Parking and stopping traces

Parking and voluntary stopping continue to show selectable targets without a route before the learner answers. After evaluation, a gold route appears for the correct response, using the same visual language as overtaking and U-turn responses.

The parking trace begins immediately ahead of the learner car, curves toward the open curbside gap, and terminates at the center of the jittered correct target. It must not imply driving through either parked vehicle.

The voluntary-stopping trace begins immediately ahead of the learner car, moves smoothly toward the curb, and terminates at the legal target below the driveway. It must not cross or terminate within the driveway target.

Routes are static feedback, not animation. The correct target remains the authoritative endpoint so deterministic target variation cannot separate the line from its target.

## Roundabout alignment

Roundabout target placement will use explicit anchor regions calibrated to each photograph instead of deriving target centers solely from idealized polar angles. Four-exit and five-exit scenes retain separate ordered anchor sets, with exit numbers assigned counterclockwise from the bottom entry.

Small seeded variation remains, but is constrained inside reviewed road-mouth bounds. The variation must never move a target onto grass, the central island, or outside the photographed road.

The revealed route follows the paved roundabout lane and exits through the center of the selected road mouth. Its final point matches the correct target. Four-exit maps remain the common case and five-exit maps remain occasional; this increment does not change that distribution.

## Interaction and accessibility

Target hit areas retain the existing iPad-friendly minimum sizing. Stable target IDs, command IDs, seeded reproducibility, keyboard behavior, result labels, and bilingual UI behavior remain unchanged.

## Verification

Automated tests will establish that:

- parking and stopping prompts do not reveal a route before answering;
- their feedback models and rendered feedback include a correct route;
- each route ends exactly at the correct target;
- the parking route moves into the curbside gap;
- the stopping route ends below and clear of the driveway;
- every roundabout target remains within scene-specific road-mouth bounds across many seeds;
- roundabout routes terminate at the correct target and enter the selected road mouth plausibly;
- existing deterministic variation, exit-count behavior, target sizing, and scoring remain intact.

After the automated suite passes, the three surface families will receive a local visual review at the iPad landscape viewport.
