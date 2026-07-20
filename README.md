# Examen Práctico de Conducir

An iPad-first static web app for daily practice of Spanish practical-driving-exam commands. It trains the connection between a spoken Spanish examiner command and the corresponding action. Command content and audio remain Spanish; interface chrome is available in English and Spanish.

## Use on iPad

The public HTTPS release URL is:

<https://jeffreythepea.github.io/examen-practico-de-conducir/>

Open that address in Safari, use **Share → Add to Home Screen**, and launch **Examen Práctico** from the new Home Screen icon. On the setup screen, tap **Download for offline use** and keep the app open until it reports **Ready offline**. That status is shown only after the complete runtime—including all recorded Spanish audio—has downloaded and passed its integrity checks.

Safari and the installed Home Screen app can keep separate local data. To transfer existing progress, use **Export backup** in Safari before installation, then in the Home Screen app use **Import backup**. Settings and completed attempts remain on the device; there is no account or server-side sync.

Offline website storage is best-effort rather than permanent. iPadOS may evict cached website data under storage pressure; if the app stops reporting **Ready offline**, reconnect and restore the offline files. Browser speech is an online-playback fallback, not the offline guarantee—the verified recorded corpus is what makes the complete game available without a connection. Updates download into staging and can be applied only from the setup screen, so an active practice session continues on its current verified version.

## Scope

Stage 1 provides a standalone daily-practice baseline: driving, precheck, and mixed filters; three audio speeds; written-Spanish hint policies; optional timing; selectable 5-, 10-, and 15-command sessions; previously-missed and free-practice ordering; unaided, text-assisted, and incorrect scoring; diagnostics; and local backup/restore. Fresh saves start with Mixed practice and 10 commands; existing saves retain their chosen settings.

The app has no runtime dependency on Piso Asturiano and no backend. The source remains a plain static browser application; public releases use a deterministic build step to select and verify only runtime assets. Stage 2 is implemented for release review with an action-matched response model. The current expansion contains 36 commands and 54 source-labeled Spanish phrasings; deeper phrasing/voice mastery reporting, road simulation, sequential exam simulation, and automatic difficulty progression remain deferred.

## Stage 2 action surfaces

The landscape iPad baseline uses taps and direct controls that match the commanded action: photo-backed four-way junctions offer left, straight, and right roads; photo-backed four- or five-exit roundabouts use outgoing roads; and photo-backed U-turns, overtaking, parking, and voluntary stopping use spatial road choices. Parking has a dedicated parallel-parking gap between two parked cars, while voluntary stopping retains a clear roadside curb. Steering centres a wheel; securing the vehicle uses a generic manual-car procedure; and prechecks use photo-backed, icon-first prechecks. Mac pointer and keyboard equivalents remain supported.

There are exactly three semantic exceptions: `c-adapte`, `c-detencion`, and `c-final` retain `option-grid-v1`. They are intentional, not fallbacks: adapting speed, involuntary stopping, and finishing the test lack enough road context for a defensible physical gesture. Parking and voluntary stopping scenarios are provisional training hypotheses; practical lessons may correct their geometry, distractors, or accepted targets without changing stable command, action, phrasing, or provenance IDs.

## Illustrative vehicle prechecks

Stage 2 uses seven packaged photo-backed scenes for the instrument cluster, lighting stalk, climate panel, driver-door controls, bonnet release, tailgate release, and engine bay. These are illustrative generic images, not photographs of the test vehicle. The precise physical anchors place every response ring on the relevant gauge, switch, control symbol, cap, battery body, or oil dipstick handle. The icon-first design tests Spanish language comprehension without requiring the learner to decode abstract stick figures. Stable diagram and target IDs preserve progress and response provenance as imagery improves.

The active baseline treats the car as a generic conventional manual car for the location drill: the 12 V battery is under the bonnet. The Article 92 generic manual immobilization exercise requires stopping the engine, applying the hand parking brake, and selecting first gear uphill or reverse downhill. The actual test car must still be confirmed with the driving school because control positions, dashboard displays, lighting equipment, release mechanisms, and the precise securing procedure can differ.

## Requirements and local use

Node.js 20 or newer is required for the tests, local server, and audio tools. From any directory, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve
```

Then open `http://127.0.0.1:4173`. The supported baseline is current Safari on iPadOS and macOS, plus current Chromium browsers on macOS. Touch and pointer input use the same response controls.

To preview the exact verified distribution package on loopback, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve:dist
```

To serve the app to an iPad on the same Wi-Fi network, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve:lan
```

Then open the Mac's local-network address with port `4173` on the iPad. This explicit LAN command uses the same hardened project server as loopback development: it resolves files inside the real project root and rejects dotfiles such as `.git` and `.superpowers`. Use only a trusted local network, and stop the server when practice is finished.

## Static hosting

GitHub Pages deploys only the deterministic `dist/` artifact; it never publishes the repository root, tests, plans, scripts, or references. The workflow runs the full release check, builds and hashes the runtime allowlist, and uploads `dist/` only after those checks pass. No environment variables, server functions, provider credentials, or runtime API calls are required. Before publication, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run release:check
```

Enabling or changing the GitHub Pages source is an external repository action and requires separate approval.

## Local data and backup

Settings, mastery, schedules, attempt history, and stable interrupted-session identifiers remain in this app's browser-local storage. Use **Export backup** before clearing browser data or moving devices, and **Import backup** to restore a compatible versioned JSON file. Import validation is atomic: an invalid backup does not replace the active save. Backups contain learning history, so store them as personal data. Reloading during an unanswered command offers Resume; that interrupted command restarts from its exact Spanish recording and remains unscored.

The Task 7 browser automation limitation means export downloads and confirm-plus-file-picker import cannot be completed reliably by automation; automated backup tests are green, but Jeffrey must perform a manual export/import smoke during release review.

## Audio provenance and disclosure

The expanded corpus contains 324 pre-generated ElevenLabs `eleven_multilingual_v2` MP3s: 54 Spanish phrasings, Roger and Sarah voices, and provider-native speeds of 0.75x, 0.9x, and 1x. Each trial randomly selects one playable phrasing/voice recording and retains it through replay, Show Spanish, reveal, and attempt logging. Integrity and provider/model provenance are recorded in `data/audio-manifest.json`; the audition decision is in `references/audio-audition.md`.

Audio generation is resumable and fail-closed. It checksum-verifies reusable published and recovery assets, checkpoints every new clip outside the browser-delivered tree, and replaces the published audio tree and manifest only after the complete staged corpus validates. An interrupted generation therefore does not create a partially published static corpus.

Static MP3 playback is always preferred. When a recording is missing or fails to play, the app automatically uses browser Spanish speech with `lang="es-ES"` and the selected speed. A successfully completed fallback is scored exactly like recorded audio and retains the same phrasing through Replay, Show Spanish, reveal, and attempt logging. If both the recording and browser speech fail or are interrupted, the attempt remains unscored. This fallback uses no runtime API key or other credential, no backend, and no paid browser request.

**These voices are AI-generated. / Estas voces han sido generadas por inteligencia artificial.** The same disclosure is visible in the app in both UI locales.

Provider calls cost credits. Check the provider's current pricing and account balance before auditioning or regenerating audio. Never paste a credential into a repository file, command history, browser-delivered file, issue, or log.

The audio tools read the environment variable named `ELEVENLABS_API_KEY` (and the audition tool also supports the name `OPENAI_API_KEY`). One macOS Keychain workflow that avoids putting the secret in the command text is:

```sh
export ELEVENLABS_API_KEY
read -r ELEVENLABS_API_KEY < <(security find-generic-password -a "$USER" -s examen-practico-elevenlabs -w)
```

Audition one voice and speed with absolute paths:

```sh
node /Users/jeffreypease/Projects/examen-practico-de-conducir/scripts/audition-tts.mjs \
  --provider elevenlabs \
  --voice CwhRBWXzGAHq8TQ4Fs17 \
  --speed 0.9 \
  --out /private/tmp/examen-practico-audition/roger
```

Regenerate the selected corpus atomically and verify it before replacing published assets:

```sh
node /Users/jeffreypease/Projects/examen-practico-de-conducir/scripts/generate-audio.mjs \
  --provider elevenlabs \
  --voice CwhRBWXzGAHq8TQ4Fs17 \
  --voice EXAVITQu4vr4xnSDxMaL
```

When finished, remove the variable from the shell with `unset ELEVENLABS_API_KEY`.

## Release checklist

- Run the release check and confirm every test passes with no whitespace errors.
- Confirm `data/audio-manifest.json` resolves to all 324 nonempty, integrity-matching assets before treating the command expansion as release-ready.
- Exercise English and Spanish setup, playback, hint, response, reveal, results, export, and import in a supported browser.
- Confirm the AI-generated-voice disclosure is visible in both locales.
- Confirm no credentials or generated temporary files are included.
- Manually smoke export/import because browser automation cannot complete its download and file-picker path.
- Use several real practice sessions before planning a moving-road prototype; collect command confusion, target-selection errors, misleading layouts, stopping/parking corrections, precheck-target mismatches, response times, and hint/replay dependence.
