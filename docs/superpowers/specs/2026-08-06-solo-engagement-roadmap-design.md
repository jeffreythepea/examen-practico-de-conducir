# Solo Engagement Roadmap Design

**Date:** 2026-08-06
**Status:** Approved by Jeffrey on 2026-08-06
**Priority decision:** Solo engagement now precedes a full native port and the
lesson-gated Release D; social expansion remains later

## Priority Realignment

This roadmap deliberately changes two earlier priorities in the approved
offline/readiness/native roadmap:

1. The earlier roadmap placed a full native iPad port above simulation and
   engagement. The working offline web app, completed SwiftUI feasibility
   spike, and recent AI-assisted experiments have reduced the urgency of that
   port. A focused solo-engagement track now comes first.
2. The earlier roadmap categorically deferred badges and engagement mechanics.
   The product now permits challenge, examiner identity, themed experiences,
   and evidence-backed accomplishments. It still rejects mechanics designed
   principally to compel use, such as energy, currencies, expiring rewards,
   punitive streaks, and notification pressure.

Release D remains gated on real driving lessons. The native port remains a
valuable later direction rather than the next mandatory release. Accounts,
multiplayer, and community infrastructure remain below a complete solo game.

## Purpose

The game now covers most of its core listening and action-training objective:
it has a broad command catalog, multiple phrasings, five recorded examiner
voices, physical response surfaces, readiness evidence, offline iPad support,
and bounded road movement. The next product problem is making learners want to
return because practice feels like an involving driving-test experience rather
than a sequence of drills.

This track does not replace lesson-gated vehicle calibration and does not
require accounts, public onboarding, leaderboards, or multiplayer.

## Engagement Principles

- Make the fantasy **taking and mastering a Spanish practical driving test**.
- Reward demonstrated competence, courage, and improvement rather than time
  spent in the app.
- Use examiner continuity, route continuity, physical consequence, sound, and
  pacing before adding abstract rewards.
- Let learners select experiences instead of confronting only technical
  settings.
- Keep practice adult and credible. Examiners are recognizable people, not
  caricatures.
- Preserve learner control and the existing configurable practice mode.
- Never require a streak, energy, currency, randomized reward, or notification
  to progress.
- Keep evidence honest. An accomplishment describes a real feat such as an
  audio-only pass; it never substitutes for readiness.

## Core Experience

### Learn, Practice, and Mock test

The setup screen should eventually lead with three understandable modes while
retaining advanced settings behind a secondary control.

1. **Learn:** written Spanish readily available, unrestricted replay,
   immediate explanation, and physical guidance.
2. **Practice:** current adaptive behavior, hidden-until-requested Spanish,
   immediate scoring, and configurable content and difficulty.
3. **Mock test:** one examiner for the drive, no written hint, unavailable or
   limited replay, continuous pacing, and corrections withheld until the end.

Mock test ends with a transparent pass or needs-practice result and its
underlying evidence. Until lessons establish an authentic Spanish exam order,
its sequence must be labeled as a simulation.

### Examiner cast

The five production voices become a restrained recurring cast. Each examiner
has:

- A stable localized display name and short tone description grounded in the
  recordings.
- A simple identity such as a color, initials, or restrained portrait.
- A consistent voice for an entire themed drive or mock test.
- Optional reviewed Spanish greeting and closing audio.
- Meaningful accomplishments associated with that examiner.

Do not invent regional origin, temperament, accent, or difficulty claims that
the recordings do not support. **Today's examiner** may rotate locally as an
invitation; manual selection and mixed-voice coverage remain available.

### Themed drives

- **First drive:** common directions at a forgiving pace.
- **City circuit:** junctions, stopping, parking, and speed adaptation.
- **Roundabout circuit:** exit-number contrasts across both layouts.
- **Manoeuvres:** overtaking, U-turns, parking, stopping, and immobilization.
- **Precheck inspection:** controls, fluids, lights, and safety procedures.
- **Difficult examiner:** brisk delivery, no written help, limited replay.
- **Full mock:** prechecks and driving in a disclosed simulated sequence.

Themes select stable command and surface criteria; they never duplicate or
silently rewrite catalog content.

## Staged Roadmap

### Solo E1 — Examiner identity and mode presets

**Goal:** Make existing content feel like a deliberate session with a
recognizable examiner.

- Add Learn, Practice, and Mock test presets.
- Add examiner cards for all five production voices.
- Hold one selected examiner for the entire session.
- Add Today's examiner while retaining manual and Mixed choices.
- Show the assigned examiner on setup, during play, and in results.
- Preserve advanced access to all current settings.

**Gate:** modes are understandable without knowing their underlying settings;
examiner continuity works; UI remains bilingual; coverage-aware selection
still works when Mixed is chosen.

### Solo E2 — Themed drives and mock-test pacing

**Goal:** Give sessions a beginning, coherent middle, and satisfying end.

- Add First drive, City circuit, Roundabout circuit, Manoeuvres, and Precheck
  inspection.
- Add a simulated Mock test with results withheld until completion.
- Add approved Spanish opening, transition, and closing cues.
- Preserve a continuous-session frame between commands.
- End with pass or needs-practice plus a concise review itinerary.

**Gate:** the route is recognizable; corrections do not leak during the mock;
interruption recovery remains reliable; simulated order is never presented as
official.

### Solo E3 — Sensory and physical consequence

**Goal:** Make choices feel like actions performed in a car.

- Complete appropriate movement after a correct choice: turn, exit, overtake,
  pull over, park, or reverse direction.
- Give a brief unambiguous wrong-choice consequence without depicting a crash.
- Evaluate approved city and rural cabin-noise loops as optional Test ambience,
  below speech and off by default elsewhere.
- Add restrained vehicle cues where they clarify action: indicator, parking
  brake, demister, engine stop, and start/seatbelt.
- Keep reduced-motion and no-ambience alternatives first-class.

**Gate:** feedback stays clear on iPad, does not move accepted targets, never
masks Spanish speech, works offline, and respects reduced motion.

### Solo E4 — Challenge cabinet

**Goal:** Add replayable, self-selected tests of real skills.

- Audio only: no written Spanish.
- One listen: replay disabled.
- Brisk examiner: reviewed hard-delivery recordings.
- Five examiners: a clean session with every voice.
- Perfect roundabouts: distinguish every exit without assistance.
- Control check: complete a precheck inspection without a miss.
- Personal best: improve a comparable clean session's response time.
- Confusion pairs: contrast commands the learner has actually confused.

Challenges retain ordinary readiness outcomes and can be abandoned without
penalty.

### Solo E5 — Competence-linked collection

**Goal:** Give long-term shape without manipulative retention.

- Award descriptive accomplishments such as **Audio-only pass**,
  **Roundabout ready**, **Precheck ready**, **No-replay pass**, and
  **Five-examiner pass**.
- Present them as examiner stamps, route cards, or test-folder endorsements.
- Keep personal bests only for comparable challenge configurations.
- Show completed themed drives and examiner encounters.
- Explain the evidence that earned every accomplishment.

**Gate:** accomplishments are reconstructible from evidence, survive backup,
never decay, and do not require scheduled use.

### Solo E6 — Listening game formats

**Goal:** Add variety after the physical loop is strong.

- **What did they just say?** Choose a plausible meaning, then perform it.
- **Near-neighbour contrasts:** parada versus estacionamiento, adjacent exits,
  or position versus dipped lights.
- **Examiner switch:** recognize the same action across voices and phrasings.
- **Hostile conditions, honest limits:** reviewed ambience and brisk delivery,
  never arbitrary distortion.

These formats supplement physical response; they do not replace it as the
primary readiness signal.

## Recommended Build Order

1. Specify and build Solo E1 and E2 together.
2. Add the most useful E3 physical consequences and optional soundscape.
3. Add a small first E4 challenge cabinet.
4. Add E5 only after challenge results feel worth commemorating.
5. Add E6 selectively from observed confusion patterns.
6. Reconsider the native port, Release D, and social expansion at their new
   evidence gates rather than by the old fixed ordering.

E1 and E2 share one session contract. E3 remains separately reversible because
motion and sound carry greater accessibility and performance risk.

## Effort and Delegation Estimate

These are planning ranges, not delivery promises. One focused agent-day means
roughly five to seven hours of implementation, tests, review, and repair. Clock
estimates exclude time waiting for Jeffrey's product review, physical-iPad
testing, provider generation, or a deployment queue. “Frontier tokens” means a
rough primary-review-model working budget, not an API bill; repository context,
failed approaches, and review findings can move it substantially.

Hermes is most useful when given one bounded module or UI slice with explicit
files, contracts, and tests. It should not own several sequential releases in
one uninterrupted prompt. Each handoff still needs Codex review, full-suite
verification, and integration into the shared session lifecycle.

### Solo E1 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Preset definitions and mapping to current settings | 3–5 hours | 15k–25k | Hermes-friendly pure domain task |
| Examiner registry, bilingual names/descriptions, and cards | 4–7 hours | 15k–30k | Hermes-friendly UI/data task |
| Fixed-examiner selection, active-session serialization, and resume | 4–8 hours | 25k–45k | Codex integration task |
| Setup/gameplay/results wiring and accessibility review | 4–7 hours | 20k–35k | Codex, with bounded CSS help possible |

**Stage total:** about 2–4 focused days and 75k–135k frontier tokens if done
entirely by Codex. Delegating the first two pieces should reduce Codex usage to
roughly 45k–85k, including review and integration.

### Solo E2 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Theme definitions, catalog queries, and deterministic route selection | 4–8 hours | 20k–40k | Hermes-friendly domain/data task |
| Mock-test state, withheld reveals, deferred diagnostics, and scoring | 8–14 hours | 40k–75k | Codex; high-risk lifecycle work |
| Continuous-session framing and end-of-drive results | 6–11 hours | 30k–55k | Codex integration; UI scaffold can be delegated |
| Bilingual route cards and result presentation | 4–8 hours | 20k–35k | Hermes-friendly after contracts stabilize |
| Opening/transition/closing audio inventory and offline packaging | 3–7 hours | 15k–30k | Hermes-friendly mechanical task after audio approval |
| Resume, accessibility, browser, and physical-iPad regression review | 5–9 hours | 25k–45k | Codex review task |

**Stage total:** about 4–7 focused days and 150k–280k frontier tokens if done
entirely by Codex. Delegating route selection, presentational UI, and asset
inventory should reduce Codex usage to roughly 95k–180k.

### Solo E3 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Post-answer movement contract and lifecycle integration | 8–14 hours | 40k–75k | Codex; scoring/motion boundary |
| Calibrate correct consequences across road families | 10–20 hours | 45k–90k | Split: Hermes fixtures/tests, Codex visual review |
| Wrong-choice consequence design and implementation | 5–10 hours | 25k–50k | Codex product/interaction judgment |
| Ambience mixing, ducking, persistence, and offline support | 6–12 hours | 30k–60k | Codex audio lifecycle; tests may be delegated |
| Vehicle-cue asset inventory and straightforward playback hooks | 6–12 hours | 25k–50k | Hermes-friendly after hook contract exists |
| Reduced-motion, performance, browser, and iPad review | 6–10 hours | 30k–55k | Codex review task |

**Stage total:** about 6–11 focused days and 195k–380k frontier tokens. A
careful split can reduce Codex usage to roughly 130k–255k, but visual calibration
limits how much real clock time parallelization saves.

### Solo E4 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Challenge-definition schema and rule validation | 5–9 hours | 25k–45k | Hermes-friendly pure domain task |
| Challenge-to-session integration and comparable-result identity | 7–13 hours | 35k–70k | Codex integration task |
| First four challenge cards and bilingual explanations | 4–8 hours | 18k–35k | Hermes-friendly UI task |
| Brisk-audio publication and offline-package update | 4–8 hours | 18k–35k | Hermes-friendly mechanical task after approval |
| Challenge results, abandonment, accessibility, and regression review | 5–9 hours | 25k–45k | Codex review task |

**Stage total:** about 4–7 focused days and 120k–230k frontier tokens. Domain,
UI, and packaging delegation should reduce Codex usage to roughly 70k–140k.
Each later challenge using the established framework should cost about two to
six hours rather than another full stage.

### Solo E5 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Evidence-derived accomplishment rules | 6–11 hours | 30k–55k | Hermes-friendly pure domain task with fixtures |
| Persistence migration, backup/import, and reconstruction | 8–15 hours | 40k–80k | Codex; data-loss risk |
| Stamp/route-card collection UI and detail evidence | 7–13 hours | 30k–60k | Hermes UI scaffold, Codex product review |
| Personal-best comparability and result history | 6–11 hours | 30k–55k | Split domain/integration task |
| Migration, accessibility, and iPad regression review | 5–9 hours | 25k–45k | Codex review task |

**Stage total:** about 5–9 focused days and 155k–295k frontier tokens. Safe
delegation should reduce Codex usage to roughly 100k–195k. Persistence and
migration remain poor candidates for low-oversight outsourcing.

### Solo E6 estimate

| Significant piece | Effort | Primary-model budget | Recommended owner |
| --- | ---: | ---: | --- |
| Shared alternate-format contract | 6–11 hours | 30k–60k | Codex architecture task |
| What-did-they-say format | 7–13 hours | 35k–70k | Split domain/UI task |
| Near-neighbour contrast generation and curation | 6–12 hours | 25k–55k | Hermes mechanics; human/Codex content review |
| Examiner-switch format | 4–8 hours | 20k–40k | Hermes-friendly after shared contract exists |
| Reviewed adverse-listening format | 5–10 hours | 25k–50k | Codex audio/product review |
| Cross-format scoring, accessibility, and regression review | 6–11 hours | 30k–60k | Codex review task |

**Stage total:** about 5–10 focused days and 165k–335k frontier tokens. Building
only one proven format first would cost about 2–4 days. With stable contracts,
Hermes can reduce Codex usage for the full stage to roughly 105k–220k.

### Aggregate planning range

- **E1 + E2 first release:** 6–11 focused days; approximately 225k–415k Codex
  tokens if kept entirely with the primary model, or about 140k–265k with the
  recommended Hermes split.
- **E1 through E5:** 21–38 focused days; approximately 695k–1.32M primary-model
  tokens without delegation, or about 445k–815k with bounded delegation.
- **E6:** should be commissioned one format at a time rather than presumed in
  the initial program.

Delegation saves primary-model tokens more reliably than clock time. Every
outsourced slice adds prompt preparation, diff review, possible repair, and a
full integration gate. The best savings come from stable pure-domain modules,
bilingual presentational UI, exhaustive fixtures, and asset/package updates;
the worst candidates are active-session transitions, audio scoring, persistence
migrations, and motion/accessibility judgment.

## Measures of Fun and Learning

- Does the learner voluntarily choose another drive?
- Can the learner distinguish the examiner and route just experienced?
- Does Mock test create useful tension without obscuring mistakes?
- Do physical consequences improve recall?
- Do challenges produce varied practice rather than easy repetition?
- Does sensory polish remain pleasant across repeated sessions?

Do not optimize notification opens, streak length, reward collection, daily
active use, or time in app independently of learning.

## Deferred Social Expansion

These ideas are preserved below the solo roadmap:

- Pass-the-iPad local multiplayer with separate names and results.
- Table play in which several learners answer before reveal.
- Shareable no-account challenge links or QR codes.
- Private nickname-based comparisons and asynchronous challenges.
- Cooperative group readiness goals.
- Host mode, with one person selecting commands for another.
- Examiner bingo for lessons or group practice.
- Shareable result cards.
- Lesson debriefs and explicitly shared anonymized wording observations.
- Reviewed regional, driving-school, or community phrase packs.
- Persistent friend groups only if lightweight sharing proves valuable.

Global leaderboards, public profiles, public onboarding, unreviewed community
content, and commercialization remain separate decisions.

## Explicit Non-Goals

- Coins, XP economies, shops, loot, or randomized rewards
- Energy systems or artificial waiting
- Punitive daily streaks or expiring progress
- Push-notification pressure
- Global leaderboards
- Cartoon examiner stereotypes
- Claiming that a mock reproduces an official Asturias test sequence
- Replacing readiness evidence with a game score

## Next Specification Boundary

After roadmap approval, specify **Solo E1 and Solo E2 together**: mode presets,
examiner identity and continuity, initial themed drives, mock-test reveal
timing, and the end-of-drive result. Do not include hard-mode publication,
ambience, achievements, social features, or new command content in that first
build.
