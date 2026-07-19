# Four-Way Junction Photo Design

## Purpose

Make `Gire a la izquierda` and `Gire a la derecha` test recognition of both the turn instruction and its direction.

## Approved design

- Replace the abstract T-junction presentation with a dedicated 3:2 illustrative four-way intersection photo.
- The learner approaches from the bottom; the three response roads lead left, straight, and right.
- Left and right retain their existing result and target IDs.
- Add one stable `straight` target whose result is the existing `continue-forward` distractor vocabulary.
- Only left- and right-turn commands use this surface; straight is a visible wrong option, not a new catalog command.
- Route reveal begins at the bottom entry, passes through the intersection, and ends within the correct road target.
- The new image receives bilingual alt text and `ai-generated-illustrative` provenance.
- No command, action, phrasing, accepted-result, or progress ID changes.

## Acceptance criteria

- All three physical roads are apparent before reveal without arrows or labels.
- Targets sit completely on left, straight, and right asphalt and retain a 44 px minimum.
- Targets remain non-overlapping across seeded jitter.
- Both languages render the same spatial model and existing hint/scoring behavior remains unchanged.
