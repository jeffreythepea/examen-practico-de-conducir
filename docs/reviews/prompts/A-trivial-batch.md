# Session A — trivial batch (6 small items)

You are implementing six small, fully specified items in the repo
examen-practico-de-conducir (vanilla-JS static PWA, no dependencies, no build step for
the app). The design work is done — implement exactly what is written here. Do not
redesign, do not expand scope, do not fix unrelated things (list them at the end
instead).

## Setup
```
git clone https://github.com/jeffreythepea/examen-practico-de-conducir.git
cd examen-practico-de-conducir && npm install && npm test
```
All tests must pass before you change anything. Then: `git checkout -b review-trivial`
(if the branch already exists, check it out, read `docs/reviews/PROGRESS.md`, and resume
from the first unfinished item below).

## Ground rules (binding — from AGENTS.md)
- `npm test` gates every item; never move on with a red suite.
- Every piece of user-facing copy must exist in BOTH English and Spanish (`src/i18n.js`).
- No new dependencies. Match existing code style (pure functions, `Object.freeze`,
  descriptive validation errors).
- **Checkpoint after each item:** one local commit per green item on this branch, message
  style matching `git log` (short imperative, e.g. "Skip image derivative test without
  sharp"). Do NOT push. Update the item's row in `docs/reviews/PROGRESS.md` in the same
  commit.

## Items, in order

### A1. Test suite green without sharp (code review P3)
`tests/runtime-images.test.js:5` does a top-level `import sharp from 'sharp'`, so a clone
without `npm install` fails 1/612. Replace with a dynamic `await import('sharp')` in a
try/catch; when unavailable, `test.skip('sharp not installed — run npm install to enable
image derivative checks')`. The test must remain fully active when sharp IS present.
Verify `.github/workflows/pages.yml` installs devDependencies so CI still enforces it.
Acceptance: `node --test tests/*.test.js` passes on a clone with no node_modules (1
skipped); passes with node_modules (0 skipped).

### A2. Remove dead code (code review P4)
- Delete the unused function `hasAudio` (`src/app.js` ~line 1978).
- Delete the export `selectAudioVariant` (`src/app.js` ~line 637) and rewrite the tests
  in `tests/app-state.test.js` that import it to assert the equivalent behavior through
  `selectPlaybackVariant` (or through `findAudioVariant` in `src/audio.js` for
  exact-selection lookups).
Acceptance: no unused exports in app.js; suite green.

### A3. Results-screen framing after hint-heavy sessions (play review P3)
On the results screen, when assisted answers outnumber unaided ones (non-mock sessions
only), render one additional context sentence under the headline. EN: "You used written
hints this session — work toward answering from audio alone as the exam approaches." ES:
"Has usado ayudas escritas en esta sesión: intenta responder solo con el audio a medida
que se acerque el examen." Plain `<p class="notice">`, no styling changes, no scoring
changes. Acceptance: sentence appears exactly when `counts.assisted > counts.unaided`
and mode is not mock; new i18n keys in both locales; a rendering test in the style of
the existing results tests.

### A4. ES locale duplicate meaning on readiness cards (play review P5)
In Spanish locale, readiness cards show the command twice (title and meaning are the
same string). The reveal screen already guards this (`src/app.js` ~line 1236 renders the
meaning row only when locale is `en`). Apply the same guard to the card subtitle in
`src/readiness-view.js`. Acceptance: ES cards show the Spanish once; EN cards unchanged;
test updated.

### A5. Millisecond formatting (play review P6)
Response times render as raw milliseconds ("22091 ms"). Change the `summary.milliseconds`
rendering to seconds with one decimal, localized ("22.1 s" / "22,1 s") wherever it
appears (results screen, mock review, readiness cards). Keep stored values in ms —
formatting only. Add/extend i18n keys as needed in both locales. Acceptance: no
user-visible raw-ms strings remain; suite green.

### A6. Content-Security-Policy meta tag (code review P7)
Add to `index.html` `<head>`:
`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'">`
Add an assertion that the tag exists to `tests/release-audit.test.js` (or
`tests/pwa-manifest.test.js`, whichever fits its existing structure better). Do NOT
attempt browser verification — flag in your summary that Jeffrey must manually smoke-test
Safari (iPad + macOS) and Chromium: playback, browser-speech fallback, offline download,
backup export/import.

## Deliverables
When all items are done (or when you must stop): ensure the last green item is
committed, `docs/reviews/PROGRESS.md` reflects reality, and write a short summary —
per-item status, files touched, anything deliberately not done.
