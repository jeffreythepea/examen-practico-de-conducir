# Offline, Readiness, and Native Roadmap Design

**Date:** 2026-07-20
**Status:** Approved by Jeffrey
**Product priority:** Jeffrey's exam readiness first; friends second; public release undecided

## Purpose

The next product phase makes Examen Práctico dependable on an iPad without a
Mac or network connection, then improves the decisions the app helps Jeffrey
make about what to practice. After those web releases settle the product model,
development moves to a true native iPad implementation.

This is a product roadmap, not one monolithic implementation scope. Each
release must produce useful, testable software on its own:

1. **Release A — Dependable offline iPad web app**
2. **Release B — Readiness and targeted practice**
3. **Release C — Native iPad feasibility and port**
4. **Release D — Lesson-driven content calibration and exam mode**
5. **Evidence-gated realism experiments**

Release A receives the first implementation plan. Later releases receive their
own reviewed specifications and plans when their entry criteria are met.

## Product Principles

- Optimize for Jeffrey's practical-exam preparation, not user acquisition.
- Make the app easy to share with friends without building public onboarding,
  accounts, administration, or commercial infrastructure.
- Preserve Spanish command text and command audio in Spanish.
- Keep every piece of interface copy in English and Spanish.
- Preserve stable command, action, phrasing, surface, and provenance IDs.
- Keep credentials out of Git, runtime files, caches, and browser-delivered
  assets.
- Expose learning evidence directly; do not hide it behind an invented score.
- Treat the web app as the reference product prototype for a later SwiftUI app,
  not necessarily as the permanent platform.
- Do not add engagement features merely to increase app use. Streaks, badges,
  notifications, and similar retention mechanics are unlikely to be built.

## Current Product Baseline

The app is a static, local-first web application with no runtime backend and no
required frontend build. It contains 36 commands, 76 source-labeled Spanish
phrasings, photo-backed action surfaces, local progress, versioned JSON
backup/import, a complete 456-variant recorded ElevenLabs audio corpus, and
browser Spanish-speech fallback.

The current runtime media is dominated by roughly 40 MB of PNG photographs,
plus the audio corpus. This is small relative to current iPad storage quotas but
unnecessarily expensive to download and cache. The current same-Wi-Fi
development route, `npm run serve:lan`, is appropriate for testing, not
installation: service workers and reliable offline web-app behavior require a
secure origin outside localhost.

## Release A — Dependable Offline iPad Web App

### Entry prerequisite

The full 456-variant recorded corpus is validated, atomically published, and
included in the verified offline package. Browser speech cannot substitute for
recorded media in this acceptance gate because offline availability of a browser
voice is not under the app's control. **Ready offline** remains available only
when every recorded variant required by the production audio manifest is
packaged and integrity-verified.

### Outcome

After one online installation and one explicit offline download, the complete
game runs from the iPad Home Screen without the Mac, Wi-Fi, or mobile data. The
offline guarantee covers all gameplay, command data, photographs, feedback
sounds, and packaged ElevenLabs recordings. Browser speech is an emergency
fallback, not part of the offline guarantee.

No web app can prevent iPadOS from evicting website data under device-storage
pressure. The product guarantee is therefore: the app verifies and clearly
reports whether its complete offline package is present, and never claims to be
ready when it is not.

### Distribution and installation

- Publish a strict runtime artifact to GitHub Pages over enforced HTTPS.
- Do not publish tests, plans, source references, recovery audio, Git metadata,
  credentials, or other repository-only files.
- Add a Web App Manifest with a stable `id`, relative `start_url` and `scope`,
  standalone display mode, landscape orientation intent, theme colors, and
  iPad-appropriate icons.
- Retain the Apple standalone metadata as compatible fallback metadata.
- Provide concise bilingual installation instructions for Safari's **Add to
  Home Screen** flow.
- Treat the Safari site and installed Home Screen app as separate storage
  contexts. The installation flow must guide an existing user through backup
  export/import when moving progress into the installed app.

Apple documents that a site with a manifest using standalone display mode
becomes a separate Home Screen web app on iOS and iPadOS. GitHub Pages supports
HTTPS for public repositories.

### Runtime asset optimization

- Retain source-quality images as development assets when useful.
- Create visually equivalent compressed runtime derivatives for every
  photo-backed surface.
- Preserve exact aspect ratios and target-coordinate geometry.
- Update production scene references to the optimized assets only after visual
  comparison at the landscape-iPad baseline.
- The deploy artifact contains only runtime derivatives required by the app.
- Do not reduce legibility of physical controls, road mouths, vehicles, signs,
  or response-target anchors merely to minimize bytes.

### Offline package contract

A generated, versioned offline-package manifest is the authority for the
deployable runtime. It records every required path, byte size, and integrity
value. Its inventory includes:

- HTML, CSS, and JavaScript modules
- Command and audio manifests
- Runtime photographs and icons
- Every packaged command recording
- Any static feedback-sound assets, if introduced
- The offline fallback page or shell resources

Generation uses an explicit runtime allowlist and deterministic ordering. A
release check fails when a runtime dependency is missing, when an integrity
value differs, when an unapproved repository path enters the artifact, or when
the inventory is stale.

### Service-worker and cache lifecycle

The service worker manages two logical cache states:

- **Active:** the complete version currently serving the app.
- **Staging:** a fully downloaded candidate that is never served until it has
  passed completeness and integrity checks.

First-run behavior:

1. Register the service worker from the secure hosted origin.
2. Load enough shell resources to show a reliable setup screen.
3. Offer **Download for offline use** with total size and available-space
   information when supported.
4. Download the complete version with visible progress.
5. Verify every required resource.
6. Mark **Ready offline** only after verification succeeds.
7. Request persistent storage and report whether the request is granted.

The installer may fetch resources in bounded batches to avoid fragile large
`addAll` operations. A partial download remains staging data and never replaces
the active package.

### Updates

- Check for a new package only while online.
- Download and verify it in the background as staging.
- Never replace application code or media during an active session.
- On the setup screen, show **Update ready** after staging completes.
- Apply the update only after an explicit tap.
- Keep the previous active version if staging, verification, or activation
  fails.
- Remove obsolete caches only after the new version is active and confirmed.
- Preserve local progress through code and content updates.

### Offline and storage status

The setup screen exposes one concise status:

- Online only
- Downloading for offline use, with progress
- Ready offline
- Update downloading
- Update ready
- Offline files need to be downloaded again
- Insufficient storage
- Offline download failed; current version retained

All status and recovery copy exists in English and Spanish. The app uses
`StorageManager.estimate()`, `persisted()`, and `persist()` when available, with
feature detection and honest fallback copy when unavailable.

WebKit documents current storage quotas, eviction conditions, and persistent
storage heuristics for Home Screen apps. Cache and progress logic must still be
resilient to individual cache entries or an entire origin being removed.

### Interrupted-session recovery

- Persist the stable identity and progress of an active session after each
  completed command.
- On a cold relaunch, offer **Resume session** or **Discard session**.
- Restart the interrupted command from audio and do not record an outcome for
  the interruption.
- Do not serialize live DOM, timers, audio elements, random generators, or
  mutable surface objects.
- Resume from stable session command IDs, selected immutable variants, and
  completed attempt IDs.
- Reject or safely discard an active session that references unsupported
  future data.

### Storage migration

Release A introduces an explicit sequential migration mechanism before adding
new persisted fields. It must:

- Accept the current schema-1 save and backup.
- Apply named, deterministic migrations one version at a time.
- Validate after every completed migration.
- Replace active local data only after the final candidate validates.
- Preserve compatible unknown additive fields through export.
- Reject unsupported future major schemas without mutation.

### Release A failure behavior

- Interrupted initial download: remain online-capable; offer Resume download.
- Insufficient quota: report required and estimated available space; do not
  delete the active version.
- Missing or corrupt staged response: reject staging and retain active.
- Network loss during update: pause or fail staging without affecting practice.
- Cache eviction: report that offline files must be restored.
- Service workers unsupported: keep online gameplay available and explain that
  offline installation is unavailable.
- App backgrounded during audio: retain the existing unscored-retry behavior.
- App terminated during a session: offer safe resume and restart the active
  command unscored.

### Release A automated acceptance

- The generated runtime artifact contains every required dependency and no
  repository-only material.
- Every offline path exists and matches its integrity record.
- Any runtime asset change changes the package version.
- A failed staging cache never deletes or replaces the active cache.
- Activation never occurs during an active session.
- Old caches are retained until the new version is active.
- English and Spanish contain every offline, installation, update, and recovery
  string.
- Schema-1 state migrates successfully and invalid migration candidates leave
  current data untouched.
- Interrupted sessions resume at the correct command without creating an
  attempt for the interruption.
- Release credential scanning includes the generated deployment artifact and
  offline manifest.
- Existing catalog, scoring, backup, audio, surface, accessibility, and release
  tests remain green.

### Release A manual iPad acceptance

1. Deploy the release candidate over HTTPS.
2. Add it from Safari to the iPad Home Screen.
3. Open the standalone app and complete the offline download.
4. Enable Airplane Mode and cold-launch the app.
5. Complete a 15-command Mixed session using photographs and recorded audio.
6. Terminate the app mid-session, relaunch, and resume safely.
7. Return online, stage an update, and apply it between sessions.
8. Simulate or induce a failed update and verify the active version still runs.
9. Export and import progress between Safari and the Home Screen app.
10. Verify landscape layout, safe areas, touch targets, audio interruptions,
    status copy, and zero browser warnings/errors.

## Release B — Readiness and Targeted Practice

**Status:** Complete and physically accepted on iPad on 2026-07-22.

Release B begins only after Release A passes its iPad acceptance check.

### Readiness model

Display all commands grouped by Driving and Prechecks. Each command receives
one evidence-based learning state:

- **Ready:** unaided successes on at least three distinct dates and the two
  most recent attempts unaided.
- **In progress:** practiced but not Ready, without a more urgent state.
- **Needs practice:** the most recent outcome is incorrect or text-assisted.
- **Not yet tested:** no scored attempt.

A lesson flag is an independent annotation displayed alongside the learning
state. It never replaces or silently modifies mastery.

Each command row shows:

- Spanish command and interface-locale meaning
- Recent outcome sequence
- Last practiced date
- Typical scored response time
- Hint and replay use
- Lesson-flag indicator

Do not add a composite readiness percentage, streak, badge, daily quota, or
engagement score.

### Targeted practice

Support one-tap session creation for:

- Needs practice
- Not yet tested
- Lesson flags
- One selected command
- All commands not Ready

The default scheduler becomes **Recommended practice**: unseen commands first,
then missed or assisted commands, then commands due for review. Free practice
and the existing phase, speed, hint, timing, and length controls remain.

### Coverage-aware variation

Action mastery remains action-level. Within an eligible action, selection
prefers less-exposed validated phrasings and voices before repeating familiar
variants. The UI may report exposure separately, but a recording never becomes
its own mastery target.

### Lesson correction log

Every reveal screen offers **Flag for lesson review**. A record contains:

- Stable command ID
- Category: wording, audio, visual, accepted action, vehicle
  control/procedure, or other
- Short note
- Created and updated dates
- Status: open or resolved

The Readiness screen can filter flags, edit notes, resolve or reopen them, and
start practice containing flagged commands. Flags remain local and round-trip
through backup/import. They do not alter accepted answers or official source
data. Incorporating a correction requires a separately reviewed catalog or
surface change with provenance.

## Release C — Native iPad Feasibility and Port

Release C begins after Release A and Release B are working and have received a
short period of real use. Native development is materially higher priority than
simulation, engagement mechanics, or public-product onboarding.

### Architecture choice

Build a true SwiftUI application. Do not choose a `WKWebView` wrapper or a
Capacitor-style hybrid layer as the primary architecture. Those remain fallback
options only if the feasibility build exposes prohibitive cost.

Reuse:

- Command catalog and stable IDs
- Runtime photographs and audio
- Backup schema and migration semantics
- Scoring, scheduling, readiness, and outcome definitions
- Interaction-surface contracts and geometry
- Bilingual content

Reimplement the training engine, persistence client, audio lifecycle, and
interaction surfaces in Swift. Maintain language-neutral golden fixtures that
both JavaScript and Swift must satisfy for session selection, scoring,
readiness, backup migration, and representative surface results.

### Feasibility build

The native spike must prove:

1. Parse and validate the production command catalog.
2. Play bundled Spanish command audio at the selected speed.
3. Render one photo-backed junction and one precheck surface.
4. Import an existing web backup and score a short session identically.
5. Install and run fully offline on Jeffrey's iPad.

Only after those gates pass should the full surface families be ported.

### Distribution

Development builds install directly from Xcode on Jeffrey's iPad. Sharing with
friends later uses TestFlight unless another distribution decision is made.
Apple currently requires Apple Developer Program membership for TestFlight;
the listed annual fee is USD 99 with regional pricing. External TestFlight
builds are subject to TestFlight review. Enrollment and spending require a
separate explicit decision and are not part of Releases A or B.

When native reaches parity and proves stable, the web app moves to maintenance
mode. The roadmap does not assume indefinite double implementation.

## Release D — Lesson-Driven Calibration and Exam Mode

Practical lessons provide the evidence needed to:

- Confirm the actual manual test vehicle and control layout.
- Correct provisional parking, stopping, and immobilization procedures.
- Validate examiner wording encountered in lessons.
- Add or remove commands based on real evidence.
- Establish a credible precheck/driving order and command count.
- Design a sequential exam mode grounded in that evidence.

Open lesson flags are inputs to this work, not automatic content changes.

## Evidence-Gated Realism

After native and lesson calibration, consider one bounded moving-road exercise
only if static surfaces remain a transfer limitation. Additional candidates are
contrast drills for repeatedly confused commands, more natural-speed/noisy
audio, and more examiner voices.

Full driving simulation is desirable as a later product experience but remains
below native iPad development and evidence-based exam preparation. Expansion
requires evidence of improved unaided transfer or response time, not novelty
alone.

## Explicitly Deferred

- Accounts and cloud synchronization
- Public onboarding for unknown users
- Commercialization infrastructure
- Instructor portal
- General note-taking
- Streaks, badges, daily quotas, push reminders, and other gamified retention
- Community-authored command content

These become relevant only after an explicit decision to release publicly,
whether free or commercial.

## Product Success Evidence

Track outcomes that measure exam transfer:

- Number of commands in each readiness state
- Unaided, text-assisted, and incorrect counts
- Response-time trend
- Replay and Show Spanish dependence
- Recurring miss-reason patterns
- Lesson flags opened and resolved
- Real-car control or procedure mismatches
- Instructor corrections and lesson mistakes

Do not optimize daily active use, streak length, total sessions, or time in app.

## Source Notes

- Apple/WebKit, Home Screen web apps and manifests:
  https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple, What's new in web apps (WWDC23):
  https://developer.apple.com/videos/play/wwdc2023/10120/
- WebKit, storage quotas, eviction, and persistence:
  https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit, Home Screen storage isolation and ITP exemption:
  https://webkit.org/tracking-prevention/
- GitHub, Pages custom deployment workflows:
  https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub, HTTPS for Pages:
  https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- Apple, beta distribution and TestFlight:
  https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases
- Apple Developer Program enrollment and current fee:
  https://developer.apple.com/programs/enroll/
