# AI-Assisted Coding Spikes Design

**Date:** 2026-08-04
**Status:** Approved in conversation; written-spec review pending
**Product role:** Experimental test bed, not near-term exam preparation

## Goal

Run two deliberately small experiments that compare AI-assisted development in
the game's familiar browser stack with AI-assisted development in an unfamiliar
native Apple stack:

1. a moving-road browser exercise; and
2. a SwiftUI simulator prototype.

Each spike receives a hard two-to-three-hour implementation timebox. The goal is
to produce honest, reproducible evidence about the development workflow, not to
start two partially defined products.

Release D remains gated on evidence from practical driving lessons. These
experiments do not claim to improve immediate exam readiness and do not change
the accepted Releases A or B.

## Repository Isolation

Both experiments live in the existing public repository:

```text
experiments/
  README.md
  moving-road-spike/
    index.html
    moving-road.js
    moving-road-state.js
    styles.css
    tests/
  swiftui-spike/
    ExamenPracticoSpike.xcodeproj/
    ExamenPracticoSpike/
    README.md

docs/experiments/
  2026-08-04-ai-assisted-spikes-lab.md
```

The experiment directories may read or copy production catalog and media
assets, but production source, runtime packaging, service-worker behavior, and
GitHub Pages deployment must remain unchanged. The verified game must not
include either experiment in its release artifact.

Separate repositories are unnecessary. Keeping both spikes beside the
reference implementation makes stable IDs, assets, tests, history, and
handoffs discoverable without duplicating the product.

## Spike 1: Moving-Road Browser Exercise

### User proof

The browser displays a moving approach to a four-way junction. A real Spanish
command and packaged recording instruct the learner to go left, straight, or
right. The learner selects an action before or at the decision point and
receives the existing style of correct or incorrect reveal.

The spike includes:

- one real catalog command and stable accepted-result ID per direction;
- one packaged Spanish recording for the selected instruction;
- an approaching road animation;
- left, straight, and right actions;
- pause or replay;
- one scored reveal state; and
- a reduced-motion presentation using clear static stages.

It does not include steering physics, collision detection, traffic, hazards,
procedural road simulation, multiple junction types, scheduling, readiness,
storage, or production-game integration.

### Architecture

`moving-road-state.js` owns a deterministic state machine with phases such as
`approaching`, `decision-open`, `answered`, and `reveal`. It accepts explicit
tick/time and action events and returns immutable state.

`moving-road.js` owns DOM rendering, packaged-audio playback, and
`requestAnimationFrame`. Visual motion never determines correctness. The
selected stable accepted-result ID does.

The HTML/CSS/SVG presentation uses browser-native technology and introduces no
game-engine dependency. Explicit seed and timing inputs make runs reproducible.

### Verification

Node tests cover:

- deterministic phase transitions;
- the decision window;
- all three accepted actions;
- correct and incorrect scoring;
- replay behavior; and
- reduced-motion behavior.

A browser smoke covers animation, recorded audio, touch targets, reveal,
landscape layout, console output, and reduced motion.

## Spike 2: SwiftUI Simulator Prototype

### User proof

An Xcode project launches in the iOS Simulator, decodes the production command
catalog, displays one real Spanish command with its English meaning, and plays
one bundled Spanish MP3.

This spike proves native project/resource setup, production-data decoding,
basic SwiftUI presentation, and native audio playback. It does not include:

- physical-iPad signing or installation;
- scoring or response surfaces;
- persistence or backup import;
- readiness or lesson notes;
- offline package migration;
- complete audio/catalog browsing; or
- a broader port of the JavaScript architecture.

### Architecture

- `CatalogLoader` decodes the real bundled `data/commands.json`.
- `CommandViewModel` exposes one selected stable command/phrasing record.
- `ContentView` displays the Spanish command and English meaning.
- `AudioPlayer` wraps `AVAudioPlayer` for one bundled production recording.

The project must not substitute generated fixture text for the production
catalog merely to simplify decoding. A build-time copy step or checked-in
resource copy may be used if its provenance and refresh command are explicit.

### Verification

The native test target verifies:

- the production catalog decodes;
- the selected stable command and phrasing IDs exist; and
- the view model exposes the expected record.

Simulator review verifies launch, Spanish/English display, and recorded-audio
playback. Xcode installation, component downloads, simulator availability, and
resource-configuration work count against the timebox and are recorded as
setup burden.

## Execution Order

1. Commit this design, the implementation plan, experiment scaffolds, and lab
   template.
2. Build and verify the moving-road spike first.
3. Commit the moving-road proof and evidence.
4. Preflight Xcode and Simulator.
5. Build and verify the SwiftUI spike.
6. Commit the Swift proof, comparison, and recommendation.

The familiar browser spike establishes a baseline for the lab procedure. The
native spike then exposes the additional cost of an unfamiliar platform.
Parallel work is deliberately avoided because different models and context
would make the comparison less informative.

## Timeboxes and Failure Behavior

Each implementation spike stops after two to three hours. The plan must define
the exact clock start and end conditions.

- Incomplete work is recorded honestly rather than expanded.
- Missing Xcode components, downloads, or simulator support are valid findings.
- No Apple Developer enrollment, paid service, or other spending occurs
  without separate approval.
- A failed spike is still a useful experiment if its evidence and recovery
  state are reproducible.
- Neither spike may modify production behavior to make its proof easier.
- The final repository-wide `npm test` must demonstrate that the production
  game remains intact.

## Lab Record and Comparison

`docs/experiments/2026-08-04-ai-assisted-spikes-lab.md` is the authoritative
experiment and recovery record. For each checkpoint it records:

- current commit;
- model, account, and delegated work;
- prompt and scope boundaries;
- elapsed clock time;
- completed work;
- tests and manual evidence;
- human interventions and approvals;
- defects and unresolved questions;
- exact next task and commands; and
- subjective assessment of whether the direction is worth continuing.

The final comparison considers:

- proof achieved within the timebox;
- automated-test quality;
- manual setup burden;
- human interventions;
- defects found during review;
- reusable production work;
- ease of delegation and recovery; and
- model/token usage where visible.

The comparison remains descriptive. It must not present a fake numerical
productivity score or ignore the Swift platform's greater setup difficulty.

## Cross-Account Recovery

A later ChatGPT/Codex account on the same Mac mini continues from the existing
checkout:

`/Users/jeffreypease/Projects/examen-practico-de-conducir`

It must not clone over or replace that folder. Its first actions are:

1. read `AGENTS.md`;
2. inspect `git status -sb` and preserve any uncommitted work;
3. read this design, its implementation plan, `experiments/README.md`, and the
   lab record;
4. compare the current commit with the lab's recovery checkpoint; and
5. pull with `--ff-only` only when the working tree and branch state make that
   safe.

Switching ChatGPT accounts does not remove local files. GitHub authentication
is supplied by the Mac user's existing Git/Keychain configuration rather than
the ChatGPT account. Cloning is a fallback only for a damaged checkout or a
different computer.

Essential state must never exist only in chat history, ignored files, or a
model's memory. Recovery entries and bounded checkpoint commits are required.
Jeffrey has authorized commits and pushes at the defined recovery checkpoints
without an additional approval pause.

## Release Safety

Before each checkpoint commit:

- run the spike's relevant tests;
- run `git diff --check`;
- scan intended changes for credentials;
- update the lab recovery entry; and
- confirm only intended files are staged.

Before the final comparison:

- run the complete repository `npm test`;
- run the production release audit or packaging check if shared production
  files changed unexpectedly;
- confirm the bilingual AI-voice disclosure remains present; and
- confirm neither experiment is included in the verified runtime package.
