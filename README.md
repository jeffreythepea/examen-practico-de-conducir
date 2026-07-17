# Examen Práctico de Conducir

An iPad-first static web app for daily practice of Spanish practical-driving-exam commands. It trains the connection between a spoken Spanish examiner command and the corresponding action. Command content and audio remain Spanish; interface chrome is available in English and Spanish.

## Scope

Stage 1 provides a standalone daily-practice baseline: driving, precheck, and mixed filters; three audio speeds; written-Spanish hint policies; optional timing; weak/due and free-practice ordering; unaided, text-assisted, and incorrect scoring; diagnostics; and local backup/restore.

The app has no runtime dependency on Piso Asturiano, no backend, no required build step, and no browser speech fallback. Stage 2 physical controls are deferred until real-session evidence shows which response surfaces limit learning. Sequential exam simulation and automatic difficulty progression are also out of scope for this release.

## Requirements and local use

Node.js 20 or newer is required for the tests, local server, and audio tools. From any directory, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir test
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run serve
```

Then open `http://127.0.0.1:4173`. The supported baseline is current Safari on iPadOS and macOS, plus current Chromium browsers on macOS. Touch and pointer input use the same response controls.

## Static hosting

Publish the repository root as an ordinary static site, preserving the `audio/`, `data/`, `src/`, and `references/` paths. No environment variables, server functions, or build output belong in the deployed site. HTTPS is recommended for public hosting. Before publication, run:

```sh
npm --prefix /Users/jeffreypease/Projects/examen-practico-de-conducir run release:check
```

Creating a remote repository or enabling hosting requires separate approval.

## Local data and backup

Settings, mastery, schedules, and attempt history remain in this app's browser-local storage. Use **Export backup** before clearing browser data or moving devices, and **Import backup** to restore a compatible versioned JSON file. Import validation is atomic: an invalid backup does not replace the active save. Backups contain learning history, so store them as personal data.

## Audio provenance and disclosure

Stage 1 uses 180 pre-generated ElevenLabs `eleven_multilingual_v2` MP3s: 30 canonical Spanish commands, Roger and Sarah voices, and provider-native speeds of 0.75x, 0.9x, and 1x. A voice is randomized per trial and replay preserves the selected recording. Integrity and provider/model provenance are recorded in `data/audio-manifest.json`; the audition decision is in `references/audio-audition.md`.

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
- Confirm `data/audio-manifest.json` resolves to all 180 nonempty assets.
- Exercise English and Spanish setup, playback, hint, response, reveal, results, export, and import in a supported browser.
- Confirm the AI-generated-voice disclosure is visible in both locales.
- Confirm no credentials or generated temporary files are included.
- Use several real practice sessions before planning Stage 2; collect target confusion, audio complaints, outcomes, response times, replay reliance, and lesson mismatches.
