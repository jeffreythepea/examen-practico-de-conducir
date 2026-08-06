# Examiner Modes and Themed Drives Live Integration Design

**Date:** 2026-08-06
**Status:** Draft for Jeffrey review
**Roadmap scope:** Solo E1 live integration and the first reversible Solo E2
theme/mock slice
**Depends on:**
`2026-08-06-examiner-modes-themed-drives-design.md` and
`2026-08-06-solo-engagement-roadmap-design.md`

## Purpose

Integrate the reviewed examiner, preset, theme, and setup-view foundations into
the production offline web app without changing Spanish command text, accepted
responses, readiness evidence, or the five-voice audio corpus. The release
should make sessions feel deliberately assigned while preserving the existing
advanced practice workflow and a clean rollback boundary.

This design intentionally separates ordinary Learn/Practice behavior from the
higher-risk Mock lifecycle. It does not add achievements, ambience, brisk
recordings, social behavior, or an official-test claim.

## Protected Invariants

- Existing command, phrasing, action, surface, voice, and audio-variant IDs do
  not change.
- Spanish command recordings and command text do not change.
- A fixed or Today examiner changes only eligible voice variants, never the
  accepted response or command selection evidence.
- Mixed continues to use coverage-aware selection across all five voices.
- Readiness outcomes and scheduling remain exactly `unaided`, `assisted`, and
  `incorrect`; experience mode is not a scoring dimension.
- Every new interface string exists in English and Spanish.
- Mock is labeled as simulated and never described as an official DGT exam.
- Credentials remain absent from Git and browser-delivered files.
- Existing schema-3 backups remain importable.
- Reduced motion, Road movement Off, offline installation, and browser-speech
  fallback remain first-class.

## Product Defaults and Compatibility

### Existing saves

Schema-3 saves migrate to:

- experience mode `practice`;
- examiner choice `mixed`;
- no selected theme (`themeId: null`).

This exactly preserves current behavior until the learner chooses one of the
new experiences.

### Fresh saves

Fresh saves use the same conservative defaults: Practice, Mixed, and adaptive
practice with no theme. Today's examiner and the themed drives are prominent
choices, not silent behavior changes.

### Advanced practice

The setup screen leads with mode, examiner, and optional drive theme. Existing
technical controls remain available inside an Advanced practice disclosure.
Changing an advanced setting does not silently rename the chosen mode. Learn
and Mock enforce their policy-owned hint, timing, speed, replay, and reveal
values at session start; Practice uses the visible advanced values.

The no-theme choice is presented as **Adaptive practice**. It continues to use
the existing phase, readiness target, and Recommended/Free selection behavior.

## Schema 4

Storage schema 4 adds only three settings fields:

```js
{
  experienceMode: 'learn' | 'practice' | 'mock',
  examinerChoice: 'today' | 'mixed' | 'roger' | 'sarah' | 'george' | 'matilda' | 'eric',
  themeId: null | 'first-drive' | 'city-circuit' | 'roundabout-circuit'
    | 'manoeuvres' | 'precheck-inspection' | 'full-mock'
}
```

Migration is additive. It preserves all schema-3 settings, attempts,
action-progress records, lesson flags, and any valid resumable session. A
schema-3 active session migrates with a compatibility experience snapshot:
Practice, Mixed, immediate reveal, unlimited replay, no theme, and no resolved
examiner. It must resume with its already-snapshotted item voice IDs.

Backup export includes schema 4. Import continues to validate before replacing
local state and discards only the already-prohibited serialized surface model.

## Active Session Version 2

New sessions store version 2. Existing version-1 sessions remain readable and
normalize to the compatibility experience described above.

The session adds one immutable `experience` record:

```js
{
  modeId: 'learn' | 'practice' | 'mock',
  examinerChoice: 'today' | 'mixed' | <stable examiner ID>,
  resolvedExaminerId: null | <stable examiner ID>,
  themeId: null | <stable theme ID>,
  replayPolicy: 'unlimited' | 'none',
  revealPolicy: 'immediate' | 'session-end',
  simulated: boolean
}
```

`resolvedExaminerId` is required for Today and fixed choices and is `null` for
Mixed. Today resolves once from the local calendar date at session creation.
That resolved ID, the chosen audio item voice IDs, and the effective policy
remain unchanged if the session crosses midnight or resumes another day.

Validation rejects an unknown mode, examiner, theme, or policy; inconsistent
fixed/Today identity; a fixed-examiner item with another voice; and a theme item
outside the snapshotted theme. It never silently falls back to Mixed.

## Session Construction

Session construction has four explicit steps:

1. Apply the selected experience preset to obtain effective settings and
   replay/reveal policies.
2. If a theme is selected, filter the stable command catalog by that theme's
   criteria. Otherwise retain the complete catalog.
3. Pass that eligible catalog through the existing practice selector so
   Recommended/Free, readiness priority, lesson flags, phase, and session
   length keep their current semantics.
4. For every selected command, filter audio candidates by the snapshotted
   examiner choice and then run the existing coverage-aware variant selector.

Theme selection is therefore an eligibility boundary before adaptive practice,
not a competing scheduler. `src/session-themes.js` should expose an immutable
theme-eligibility helper. Its existing deterministic `selectThemeCommands`
remains testable but is not the production scheduler.

For Mixed, candidate filtering is an identity operation. For Today or a fixed
examiner, all selected items use the resolved examiner's existing voice ID,
while phrasing and speed coverage remain eligible.

If the selected theme, phase, target, or examiner has no playable commands, the
Start action remains disabled with a bilingual explanation; nothing is saved.

## Setup and Session Identity

The production setup incorporates the semantic mode and examiner cards from
`src/solo-setup-view.js` and adds theme cards for Adaptive practice plus the six
approved themes. The selected examiner appears during prompts and on results
using localized name, neutral description, and visual token. Mixed is labeled
as a rotating set of examiners rather than pretending to be one person.

The existing Readiness entry, offline controls, data-management disclosure,
language controls, and AI-voice disclosure remain available. Cards must retain
44px touch targets, visible keyboard focus, semantic radio behavior, and a
non-color selected-state cue.

## Learn and Practice Lifecycles

Learn and Practice retain the existing immediate prompt → reveal → continue
flow and immediate local persistence after each scored answer.

- Learn begins with written Spanish visible and allows Replay.
- Practice uses the configured hint and timing behavior and allows Replay.
- Both play the existing correct/incorrect feedback cues when enabled.
- Both expose the existing optional miss-reason and lesson-note controls on
  reveal.

The only new behavior is examiner continuity, optional theme eligibility, and
the visible session identity.

## Simulated Mock Lifecycle

Mock enforces 1× audio, unavailable written Spanish, timing on, no Replay, and
session-end reveal. It displays **Simulated mock test** in both languages.

### During the drive

- Prompt choices become active after initial Spanish audio exactly as now.
- A response is scored and persisted immediately.
- The active-session `nextIndex` and attempt ID advance in the same local-state
  save as the attempt.
- Correct/incorrect sound cues, outcome text, expected route/control, meaning,
  and miss-reason controls are withheld.
- The app moves directly to a neutral between-command frame and then the next
  loading state. The frame states progress and examiner identity only.
- The learner may leave; resuming restarts only the first unanswered command.

### Completion and recovery

Unlike ordinary sessions, a completed Mock retains its version-2 active-session
snapshot until the learner dismisses the results. `nextIndex` may equal item
count, allowing results to be reconstructed after a reload that occurs between
the final answer and results review. Starting a new session or explicitly
dismissing results clears it.

### Results

The initial result is deliberately non-official:

- **Clean simulated drive** when every scored response is unaided.
- **Needs practice** when any response is incorrect or assisted.

Because Mock makes written Spanish unavailable, an assisted result should be
impossible but remains supported for imported or future-compatible evidence.
The result page explicitly explains the rule and does not claim a DGT pass.

Results then reveal each command's Spanish wording, localized meaning, expected
action, outcome, response time, and replay count. Incorrect attempts expose the
existing miss-reason choices at this deferred stage; choosing a reason updates
that already-persisted attempt without changing its score.

## Interruption Semantics

- Before a response: the current command remains unscored and repeats on
  resume with its exact phrasing, voice, and speed.
- After a response: the attempt and next index are already saved atomically;
  the answered command never repeats.
- During a between-command frame: resume begins the next unanswered command.
- After the final Mock answer but before review: resume opens reconstructed
  Mock results.
- Catalog or manifest mismatch clears only the resumable session and preserves
  completed attempts and lesson flags, matching current recovery behavior.
- Audio failure remains unscored and never advances the session.

## Offline and Packaging

The release initially adds no new production audio. Examiner identity reuses
the five complete recorded corpora. Opening, transition, and closing recordings
remain a separate reviewed asset build after exact Spanish wording is approved.

Runtime packaging must include the new source modules, styles, and bilingual
copy; verify the five-voice 1,140-recording corpus remains complete. The service
worker update must stage atomically so the old installed release remains usable
until the new package is complete.

## Explicitly Deferred

- Official pass thresholds or claims about the real DGT test.
- Brisk/hard-mode audition clips and road/cabin ambience.
- Examiner greetings, transitions, and closings until their Spanish wording
  and recordings receive separate approval.
- Post-answer manoeuvre animation beyond the already-approved road movement.
- Challenges, accomplishments, badges, social features, accounts, and native
  app integration.

## Ordered Implementation Slices

1. Schema-4 migration and settings validation, with old-backup fixtures.
2. Active-session v2 experience snapshot, v1 normalization, and resume tests.
3. Theme eligibility composed before existing adaptive practice selection.
4. Examiner-filtered coverage-aware audio selection and Today snapshot tests.
5. Production setup/cards, bilingual copy, focus, and advanced disclosure.
6. Learn/Practice live wiring with unchanged immediate-reveal regressions.
7. Mock reducer transitions and immediate atomic attempt persistence without
   feedback leakage.
8. Completed-Mock resume and deferred result/diagnostic reconstruction.
9. Examiner/theme identity on prompt and results plus responsive styling.
10. Full release audit, runtime package, offline update, browser matrix, and
    physical iPad acceptance.

Slices 1, 3, 4, and presentational parts of 5 and 9 are suitable for bounded
Hermes work after approval. Codex retains slices 2, 6, 7, 8, and 10 because
they cross persistence, scoring, playback, accessibility, and recovery.

## Acceptance Gate

- Schema-3 state and backups migrate without evidence loss.
- Version-1 sessions resume exactly as before.
- Today remains one examiner across midnight and resume.
- Fixed sessions contain no other examiner voice; Mixed retains coverage-aware
  selection across all five.
- Theme sessions contain only eligible stable commands and retain existing
  readiness priority within that pool.
- Learn and Practice reveal and persist exactly as before.
- Mock exposes no correctness, expected-action, diagnostic, or feedback-sound
  signal before completion.
- Every Mock answer persists before progression; completed results survive a
  reload until dismissed.
- No provider credential or new unreviewed audio enters the runtime.
- English and Spanish, keyboard focus, reduced motion, browser-speech fallback,
  offline update, and physical iPad landscape review pass.
- `npm test`, `npm run release:check`, and `git diff --check` pass.

## Decisions Requested From Jeffrey

1. Approve conservative migrated/fresh defaults: Practice, Mixed, and Adaptive
   practice rather than silently assigning Today or a theme.
2. Approve theme filtering before the existing readiness-aware selector.
3. Approve the non-official Mock result rule: every answer unaided yields
   **Clean simulated drive**; anything else yields **Needs practice**.
4. Approve retaining a completed Mock snapshot until results are dismissed so
   final review survives reload.
5. Approve deferring examiner greeting/transition/closing audio to a separate
   wording-and-generation review.
