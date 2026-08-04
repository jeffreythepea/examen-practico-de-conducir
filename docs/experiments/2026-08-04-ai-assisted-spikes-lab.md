# AI-Assisted Coding Spikes Lab

## Recovery Snapshot

- Checkout: `/Users/jeffreypease/Projects/examen-practico-de-conducir`
- Current checkpoint: moving-road verified, awaiting checkpoint commit
- Current commit: `137aafc`
- Working tree: intentionally dirty with the complete moving-road spike
- Exact next task: commit and push the moving-road spike
- Blocker: Xcode is now installed, but its license has not been accepted

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

### Checkpoints

### Final Result

## Comparison and Recommendation
