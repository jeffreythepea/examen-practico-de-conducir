# AI-Assisted Coding Spikes Lab

## Recovery Snapshot

- Checkout: `/Users/jeffreypease/Projects/examen-practico-de-conducir`
- Current checkpoint: SwiftUI proof implemented and manually reviewed
- Current commit: `8bb2523`
- Working tree: intentionally dirty with the complete SwiftUI spike
- Exact next task: run final gates, commit, and push the SwiftUI checkpoint
- Blocker: none

## Shared Rubric

For each spike record proof achieved, elapsed clock time, automated tests,
manual setup burden, human interventions, defects, reusable work, recovery
quality, model/account, delegated work, and visible token usage.

## Moving-Road Spike

### Checkpoints

- Timebox started: `2026-08-04T18:18:13Z`
- Model/account: GPT-5.6 Sol, personal account
- Starting commit: `137aafc`
- Starting tree: clean and synchronized with `origin/main`
- First task: write and observe the RED reducer contract
- Delegated work: none; Jeffrey selected inline sequential execution
- `2026-08-04T18:20:23Z`: state-machine checkpoint complete in 2 minutes.
  Six reducer tests first failed with `ERR_MODULE_NOT_FOUND`, then passed
  against the immutable implementation. Files:
  `moving-road-state.js` and `tests/moving-road-state.test.js`. No departure
  from plan. Current base commit: `137aafc`; working tree intentionally dirty.
  Exact next task: write the real catalog/audio selection contract.
- `2026-08-04T18:22:21Z`: catalog/audio checkpoint complete in 2 minutes.
  Three data-contract tests first failed with `ERR_MODULE_NOT_FOUND`, then the
  combined state/data suite passed 9/9 against the real production JSON.
  Selection is limited to the canonical Roger 0.9× recordings and returns
  frozen trials without altering catalog text. Current base commit: `137aafc`;
  working tree intentionally dirty. Exact next task: write the bilingual
  browser UI contract.
- `2026-08-04T18:55:13Z`: browser UI and manual interaction checkpoint
  complete. Five UI-contract tests first failed with `ERR_MODULE_NOT_FOUND`;
  the complete spike suite then passed 14/14. Safari verified Start-gated
  audio, delayed answer availability, Replay, Pause/Resume, wrong and correct
  reveals, Try another, and an EN-to-ES locale switch without resetting the
  active trial. The three real trials revealed their exact catalog wording.
  Screenshots are preserved under
  `docs/experiments/evidence/2026-08-04-moving-road/`.
- Browser setup burden: the in-app browser blocked both loopback and LAN
  addresses, so review used Safari against the LAN server. The repository
  server does not resolve a directory URL to `index.html`; the explicit
  `/experiments/moving-road-spike/index.html` suffix was required.
- Reduced-motion behavior is covered by the reducer/UI contract but was not
  manually emulated because doing so would change Jeffrey's macOS accessibility
  setting. No production source, catalog, progress data, or deployment entry
  point references the experiment.

### Final Result

- Proof achieved: a browser-native moving-junction drill using three real
  command phrasings and their packaged Roger 0.9× recordings. The learner car
  stays fixed while the junction approaches; scoring opens after three
  seconds. Replay, pause/resume, correct/incorrect reveal, next-trial
  progression, EN/ES switching, and static reduced-motion state are present.
- Automated evidence: focused spike suite 14/14 and full repository suite
  443/443, both freshly green; `git diff --check` clean.
- Manual evidence: Safari completed all three direction trials, recorded audio
  and Replay, early-answer lockout, pause/resume, both outcomes, trial
  progression, and a locale switch during an active trial. Approach and reveal
  screenshots are preserved in the evidence directory.
- Proof not achieved: reduced motion was not manually emulated, exact
  1024×768 viewport automation was unavailable, and the local-page browser
  path did not expose console inspection. Static contracts cover reduced
  motion, 44px controls, focus-visible styling, and local-only assets.
- Elapsed clock time: 37 minutes from timebox start through final gates.
- Manual setup burden: two server attempts plus Safari fallback; explicit
  `index.html` was required.
- Human interventions after start: zero.
- Defects/setup friction: in-app browser blocked local addresses; directory
  routing produced `Bad request`; reduced-motion manual evidence remains
  absent.
- Reusable work: immutable timing/scoring reducer, exact catalog/audio
  selection boundary, bilingual copy, and an accessible local experiment
  shell.
- Recovery quality: implementation, tests, screenshots, limitations, base
  commit, and next action are all inside the repository.
- Visible token usage: not exposed by the environment.
- Delegated work: none.
- Recommendation: retain the prototype as a useful browser interaction
  reference, but do not integrate it into the production game from this spike
  alone.

## SwiftUI Spike

### Toolchain Preflight

- Timebox started: `2026-08-04T19:04:00Z`
- Model/account: GPT-5.6 Sol, personal account
- Starting commit: `8bb2523`
- Starting tree: clean and synchronized with `origin/main`
- Xcode.app is present and reports Xcode 26.6, build 17F113.
- The Xcode license is accepted: `xcodebuild -version` completed normally.
- CoreSimulator access required one macOS permission. Outside the sandbox,
  `simctl list devices available` succeeded but returned no devices, confirming
  that an iOS Simulator runtime must be downloaded.
- XcodeGen is absent; Homebrew 6.0.11 is available.
- Xcode downloaded and installed the iOS 26.5 Simulator runtime (8.52 GB).
- XcodeGen 2.46.0 was installed with Homebrew.
- Selected simulator: iPad Pro 13-inch (M5),
  `2C586ED9-FAB8-40B9-AFC9-7352C54EEAE3`.

### Checkpoints

- Toolchain/project checkpoint: XcodeGen produced a reproducible app and test
  project. The simulator-selection script passed 4/4 focused tests. The first
  resource build exposed a project-spec error: XcodeGen ignored a top-level
  `resources` key. Current XcodeGen documentation confirmed that the resource
  directory belongs under `sources` with `buildPhase: resources`; after that
  correction, the generated app bundle contained the catalog and MP3.
- Resource checkpoint: the atomic sync script passed 3/3 focused tests and
  copied exactly the production `commands.json` plus the checksum-verified
  `c-recto-canonical` Roger 0.9× recording. No credential, network request, or
  fabricated audio entered the prototype.
- Catalog checkpoint: XCTest first failed because the Swift catalog types did
  not exist, then passed after adding the minimal decoder and immutable view
  model. It loads all 36 production commands and preserves the exact
  `Siga todo recto` / `continue straight ahead` wording and
  `continue-forward` accepted result.
- Display/audio checkpoint: the audio test first failed because `AudioPlayer`
  did not exist. Swift 6 then exposed an enum/global-name collision and an
  actor-isolation issue in the test boundary; both were corrected without
  changing the proof scope. The fresh simulator XCTest run passed 4/4.
- Manual simulator checkpoint: the app launched on the selected iPad in
  portrait and landscape. EN/ES switching updated every interface string while
  leaving the Spanish command and English meaning intact. The bundled-audio
  action completed without an error state. Both orientations had 44-point
  controls and no clipping. Evidence is preserved under
  `docs/experiments/evidence/2026-08-04-swiftui/`.
- A system update restarted Codex after the first portrait review. All
  implementation, commands, selected simulator ID, tests, and next actions
  were recovered from tracked repository files and the working tree; no code
  was reconstructed from chat memory.

### Final Result

- Proof achieved: a real SwiftUI app decodes the production catalog, selects
  the stable `c-recto` / `c-recto-canonical` command, shows its exact Spanish
  and English text, and plays one bundled production MP3 in the iOS Simulator.
- Automated evidence: simulator XCTest 4/4, simulator-selection tests 4/4,
  resource-sync tests 3/3, and a clean simulator build. Complete repository
  and release gates are recorded at the final checkpoint.
- Manual evidence: portrait and landscape screenshots plus an accessibility
  review of English, Spanish, and audio-trigger states. The selected iPad
  showed no clipping or runtime error banner.
- Proof not achieved: physical-device installation, signing, persistence,
  scoring, production integration, and Xcode-native agent collaboration were
  intentionally excluded.
- Elapsed clock time: approximately 61 minutes from preflight start through
  manual review, including toolchain setup and the interrupted-app recovery.
- Manual setup burden: Xcode license acceptance, one CoreSimulator permission,
  the 8.52 GB iOS runtime download, XcodeGen installation, and simulator boot.
- Human interventions after start: no design or code decisions; only previously
  authorized system/tool permissions.
- Defects/setup friction: the XcodeGen resource syntax in the approved plan was
  stale; Swift 6 isolation rules required two small compile-boundary fixes; the
  first sandboxed screenshot command could not reach CoreSimulator and was
  rerun with the existing simulator permission.
- Reusable work: deterministic simulator selection, checksum-verified resource
  sync, production catalog decoder, immutable command view model, bilingual
  native copy, bundled-audio player, reproducible XcodeGen project, and exact
  recovery commands.
- Recovery quality: high. The restart recovered directly from the shared
  checkout and tracked lab/plan; the other account on this Mac can use the same
  folder without cloning.
- Visible token usage: not exposed by the environment.
- Delegated work: none; Jeffrey selected inline sequential execution.
- Follow-up experiment: compare this repo-first workflow with direct agentic
  coding inside Xcode, the capability shown in Jeffrey's lost screenshot.

## Comparison and Recommendation
