# Native Photo Controls Cleanup Design

**Date:** 2026-07-19
**Status:** Approved in conversation; written-spec review pending

## Goal

Make every photo-backed response surface test Spanish comprehension rather than
the learner's ability to see through redundant artwork. Correct the apparent
hint inconsistency without changing the meaning of the three existing hint
policies.

## Visual Contract

- The engine-bay scene retains explicit component icons because a generic engine
  photograph does not make oil, coolant, battery, and washer-fluid locations
  self-explanatory.
- The instrument cluster, climate panel, driver door, lighting stalk, bonnet
  release, and tailgate scenes use only translucent target rings. Their native
  symbols or physical forms are already recognizable.
- Rings remain visible before response, have at least a 44 CSS-pixel touch area,
  and do not cover more of a native symbol than necessary.
- The high-beam ring is centered on the photographed high-beam symbol. Every
  other ring is visually re-audited at 1024×768.
- Reveal labels remain visible after response and must not collide.
- Stable command, action, surface, result, and target IDs do not change.

## Hint Contract

- `available`: Spanish starts hidden on every question; **Show Spanish** is
  present; requesting it reveals Spanish only for that question and makes a
  later correct response text-assisted.
- `shown`: Spanish appears automatically on every question, no show button is
  present, and correct responses are text-assisted.
- `unavailable`: Spanish stays hidden and no show button is present.
- Advancing to another question clears trial-local hint state before applying
  the configured policy.

Current reducer inspection shows this state contract is already implemented.
The cleanup therefore adds explicit cross-question regression coverage and
clarifies the setup policy labels or supporting copy, without changing scoring.

## Verification

- Tests first demonstrate the required icon assignments, high-beam coordinates,
  and cross-question hint behavior.
- Focused scene and app-state tests pass.
- Full `npm test`, `git diff --check`, and release credential audits pass.
- Browser review at 1024×768 covers prompts and reveals for all seven photo
  scenes, both UI languages where copy differs, correct/wrong taps, hint reset,
  and console errors.

## Deferred Follow-On

After this cleanup build, create a separate plan and visual mockups for more
photo-like driving surfaces. The mockup set must include overtaking and should
retain the bottom-entry learner viewpoint, action-matched tapping, safe target
separation, and the established landscape-iPad baseline.
