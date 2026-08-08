# Session D — accessible names for spatial targets (Nemotron Ultra; escalate to Sonnet 5 if needed)

You are implementing ONE item in the repo examen-practico-de-conducir: distinct,
localized accessible names for the spatial answer targets. It matches item P1 in
`docs/reviews/2026-08-08-play-review.md`. Implement exactly this; do not redesign or
expand scope.

## Setup
```
git clone https://github.com/jeffreythepea/examen-practico-de-conducir.git
cd examen-practico-de-conducir && npm install && npm test
```
Suite green first. Branch: `git checkout -b a11y-labels`. Run AFTER the
`review-mechanical` branch is merged (both touch src/i18n.js).

## Ground rules (binding — from AGENTS.md)
- `npm test` gates every change. All new copy in BOTH English and Spanish.
- Stable command/action/phrasing/target IDs are invariants — do not rename any ID.
- No new dependencies; match existing code style.
- Commit locally when green; update `docs/reviews/PROGRESS.md`. Do not push.

## The problem
Precheck surfaces already give every target a descriptive accessible name ("Fuel gauge",
"Brake-fluid reservoir"). The SPATIAL surfaces do not: the junction renders three
buttons all named "Select this road"; stopping/parking render three "Select this space".
A VoiceOver user cannot tell targets apart, and DOM order does not match visual
left-to-right order. This is the highest-priority finding of the play review — the app
is iPad-first and otherwise has strong accessibility.

## The fix
Label each spatial target with what a SIGHTED user already sees — position and visible
features. This leaks no answers: the information is already on screen visually.
- Junction (junction-v2): "Left road" / "Road straight ahead" / "Right road" (and the
  corresponding exits for roundabout surfaces, e.g. "First exit" ... matching however
  the geometry defines them).
- Stopping (stopping-v1): e.g. "Space before the pedestrian crossing" / "Kerbside space"
  / "Space marked with a no-stopping sign" — derive from each target's actual scene
  features, do not invent.
- Parking (parking-v1): e.g. "Gap between the parked cars" / "Space marked with a
  no-parking sign" / etc.
- Same treatment for u-turn-v1, overtake-v1, join-traffic-v1 targets.
All labels in EN and ES via src/i18n.js keys (follow the existing key naming
conventions used by the precheck target labels).

Where to implement: target definitions live in src/spatial-surfaces.js /
src/driving-scenes.js (stable IDs and geometry); rendering of target buttons and their
reveal labels is in src/surfaces.js. The reveal-time labels ("Correct road: continue
straight") prove most strings half-exist — reuse/extend that mechanism rather than
inventing a parallel one. Follow how the precheck surfaces (src/precheck-scenes.js,
src/yaris-surfaces.js, src/control-surfaces.js) wire descriptive names through to
buttons.

Constraints:
- Labels must NOT reveal which target is correct for the current command. Position/
  feature descriptions only — never "correct", never the commanded direction.
- Visible UI must not change (labels are accessible names — aria-label or sr-only text —
  not on-screen text), except where a reveal already shows text.
- Keep every existing data-target / result wiring intact.

## Tests
Add to tests/spatial-surfaces.test.js / tests/surfaces.test.js (follow existing
patterns): for EVERY spatial surface, assert (1) each rendered target has a non-empty
accessible name, (2) all names within a surface are pairwise distinct, (3) names exist
in both locales, (4) no name contains the localized word for "correct" or equals the
expected-result label. Run the full suite.

## Deliverables
Diff on the branch (green suite), summary listing each surface and its EN/ES labels in a
table, PROGRESS.md updated. If you find the label wiring requires touching more than
the files named above, STOP and write up what you found instead of forging ahead — that
is the signal to escalate this item to Sonnet.
