# Live-play review — examen-practico-de-conducir

Companion to the code review (same commit, `b8f212a`). Method: served the app locally, played a full Practice session (Adaptive, mixed examiners), deliberately answered wrong once, reloaded mid-session to test resume, discarded, played a complete 8-command City circuit to the results screen, and inspected the Readiness screen and both UI locales. Audio playback ran (recorded MP3s completed and scored); voice *quality* was not evaluated in this environment.

## Verdict

As a learning tool this is genuinely good — and unusually honest. The core loop (hear a real examiner-style Spanish command → perform the matching physical action on a photo) trains exactly the skill the practical exam tests, not vocabulary recall. The distractor design teaches driving rules and Spanish simultaneously: the stopping scene offers a pedestrian crossing and a signed no-stopping zone as traps; parking offers a no-parking sign. The incorrect-answer reveal is the best screen in the app: your pick gets an ✗, the right answer gets a ✓ with the route traced, your error is *named* ("Pedestrian crossing"), and an optional plain-language "What caused the miss?" diagnosis feeds the readiness system. Everything I threw at it behaved correctly: assisted vs. unaided scoring, stateful controls (window-lock visibly toggles to "locked"), mid-session reload → resume card at the exact command, session identity chips, complete bilingual UI, and a results screen that tells the truth that matters: "0% correct from audio alone."

Two findings matter; the rest is polish.

## Findings, prioritized

### P1 — Spatial targets are indistinguishable to assistive technology (accessibility, high)

The precheck surfaces label every target descriptively ("Fuel gauge", "Brake-fluid reservoir", "Indicator arrows: off"). The **spatial** surfaces don't: the junction exposes three buttons all named "Select this road", and the stopping/parking scenes three × "Select this space". A VoiceOver user — the app's stated iPad-first audience makes this plausible — cannot tell which target is which, and DOM order does not match visual left-to-right order. This isn't hypothetical: navigating by the accessibility tree during this review, I selected the pedestrian crossing when I meant the kerbside space, for exactly this reason.

The fix doesn't leak answers: label targets with what a *sighted* user already sees. Junction: "Left road" / "Road straight ahead" / "Right road". Stopping/parking: "Space before the pedestrian crossing" / "Kerbside space between parked cars" / "Space marked with a no-stopping sign" — the sign is visible in the photo, so naming it gives assistive-tech users equal information, not extra. Implementation: the target definitions in `src/spatial-surfaces.js` / `src/driving-scenes.js` already carry stable IDs; add localized (EN+ES) `aria-label` text per target and render it in `src/surfaces.js` where the reveal labels already exist. The reveal labels ("Correct road: continue straight") prove the strings largely exist already.

### P2 — No way to end a session from inside it (UX, medium)

Once a session starts, there is no "End session" control on the prompt/reveal screens; the only way out is reloading the page (which then offers Resume/Discard — that flow works well). In the installed home-screen app, where there's no reload affordance, a learner who picked the wrong drive is stuck for the whole session. Add a small, non-prominent "End session" control (with a confirm step, discarding cleanly via the existing `discardSession` path) to the prompt screen. Bilingual copy required.

### P3 — Results headline framing after hint-heavy sessions (pedagogy, low)

"0% correct from audio alone" is the right metric and honestly reported — but after a deliberately hint-assisted Learn-style session it reads as a failing grade. Keep the number; add one contextual sentence when assisted answers dominate, e.g. "You used written hints this session — work toward answering from audio alone as the exam approaches. / Has usado ayudas escritas — intenta responder solo con el audio a medida que se acerque el examen." Framing, not gamification, consistent with the no-score philosophy.

### P4 — Mixed adaptive sessions can front-load one phase (pedagogy, low)

My first Adaptive/Mixed session served four prechecks and a semantic command before any driving command — the priority groups are shuffled uniformly, so a phase can cluster by chance. When `phase === 'mixed'`, interleave phases within each priority group after shuffling (a stratified merge in `selectPracticeCommands`, `src/practice-selection.js:156`). Keeps the priority ordering; improves variety.

### P5 — ES locale repeats the command as its own "meaning" (polish, low)

Readiness cards in Spanish show the command twice (title "Localice la batería", subtitle "Localice la batería"). The reveal screen already guards this (`meaning` row only when locale is `en`, `src/app.js:1236`); apply the same guard to the readiness card subtitle in `src/readiness-view.js`.

### P6 — Millisecond formatting (polish, trivial)

"Average scored response time: 22091 ms" would read better as seconds ("22.1 s"), localized. Affects results and readiness cards (`summary.milliseconds` i18n key).

## Explicitly fine (tested, no action)

- Resume after reload lands on the exact interrupted command; discard is clean; attempts from discarded sessions still count toward readiness (correct — evidence is evidence).
- Assisted/unaided/incorrect classification behaved correctly in every combination I produced, including the readiness state transitions ("Needs practice" after an assisted answer).
- Post-answer route animation renders and never blocks Continue.
- Both locales are complete on every screen I visited; the AI-voice disclosure is visible in both.
- The blank regions I saw in some mid-scroll screenshots were automation capture artifacts — DOM inspection confirmed the content was present; not an app bug.

## Note for the implementing model

Same rules as the code review: `AGENTS.md` governs (tests gate changes, EN+ES for all copy, propose diffs only). P1 is the substantive item — do it first and add a test asserting spatial surface targets have distinct accessible names (the existing surface-render tests in `tests/surfaces.test.js` / `tests/spatial-surfaces.test.js` show the pattern). P2–P6 are small independent diffs.
