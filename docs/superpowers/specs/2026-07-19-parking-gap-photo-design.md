# Parking Gap Photo Design

## Purpose

Make the parking exercise test comprehension of `Realice un estacionamiento`, rather than asking the learner to interpret an arbitrary curbside point as parking.

## Approved design

- Parking uses a dedicated 3:2 illustrative photo viewed from an elevated rear-driving perspective.
- A blue learner car remains at the bottom entry point.
- Two parked cars on the right curb create one unmistakable car-length parallel-parking gap.
- The correct response target sits inside that gap.
- A driveway and pedestrian crossing remain visible for contextually wrong choices.
- Existing code-native no-parking and marked-restriction overlays remain available for the seeded variants.
- Voluntary stopping continues to use `urban-roadside-photo-v1`; its empty curb is appropriate for stopping.
- The new asset receives a new stable scene ID and bilingual alt text with `ai-generated-illustrative` provenance.
- Existing command, action, phrasing, result, and response-target IDs remain unchanged.

## Acceptance criteria

- Before reveal, the correct parking location is visually recognizable without labels.
- The accepted target is centered in the visible gap and does not overlap either parked car, the traffic lane, or the pavement.
- The driveway and crossing targets remain on their photographed features.
- All targets retain the 44 px minimum touch size and remain non-overlapping across seeded jitter.
- Repository tests, release checks, bilingual disclosure checks, and credential scans remain green.
