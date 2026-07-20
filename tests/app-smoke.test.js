import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('static shell exposes the localized application mount', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<main id="app"/);
  assert.match(html, /src="\.\/src\/app\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /id="skip-link"/);
  assert.match(html, /This app needs JavaScript.*Esta aplicación necesita JavaScript/);
});

test('prompt and reveal expose one shared responsive gameplay layout', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /class="gameplay-layout prompt-layout"/);
  assert.match(source, /class="gameplay-copy"/);
  assert.match(source, /class="gameplay-layout reveal-layout"/);
  assert.match(source, /class="gameplay-surface"/);
  assert.match(source, /class="gameplay-feedback"/);
});

test('the shared gameplay layout becomes two columns only in wide landscape', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const mediaStart = css.indexOf('@media (orientation: landscape) and (min-width: 900px)');

  assert.ok(mediaStart >= 0, 'wide-landscape media query must exist');
  const globalCss = css.slice(0, mediaStart);
  const landscapeCss = css.slice(mediaStart);

  assert.doesNotMatch(globalCss, /\.gameplay-layout\s*\{[^}]*display:\s*grid;/s);
  assert.match(landscapeCss, /#app\s*\{[^}]*width:\s*min\(100%,\s*1180px\);/s);
  assert.match(landscapeCss, /\.gameplay-layout\s*\{[^}]*display:\s*grid;/s);
  assert.match(landscapeCss, /\.prompt-layout\s*\{[^}]*grid-template-columns:\s*minmax\(250px,\s*0\.75fr\)\s*minmax\(0,\s*1\.25fr\);/s);
  assert.match(landscapeCss, /\.reveal-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s*minmax\(300px,\s*0\.75fr\);/s);
  assert.match(landscapeCss, /\.gameplay-surface \.surface-stage\s*\{[^}]*width:\s*min\(100%,\s*60vh\);/s);
});

test('all setup controls receive a 44px-capable layout', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /button,\s*\na\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /select,\s*\ninput\[type="checkbox"\]\s*\{[\s\S]*?min-height:\s*44px;/);
});

test('local server rejects dotfiles and resolves files within its real root', async () => {
  const source = await readFile(new URL('../scripts/serve.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ isForbiddenPathname, parseServerOptions \} from '\.\/serve-options\.mjs'/);
  assert.match(source, /isForbiddenPathname\(pathname\)/);
  assert.match(source, /realpath\(/);
});

test('static asset directories survive a Git checkout', async () => {
  for (const directory of ['data', 'audio', 'references']) {
    const asset = await readFile(new URL(`../${directory}/.gitkeep`, import.meta.url), 'utf8');
    assert.equal(typeof asset, 'string');
  }
});

test('app shell persists setup settings and exposes atomic backup controls', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /from '\.\/storage\.js'/);
  assert.match(source, /loadState\(window\.localStorage\)/);
  assert.match(source, /saveState\(window\.localStorage, (?:candidate|state)\)/);
  assert.match(source, /data-action="export"/);
  assert.match(source, /data-action="import"/);
  assert.match(source, /data-import-file/);
  assert.match(source, /data-action="reset"/);
  assert.match(source, /removeItem\(STORAGE_KEY\)/);
  assert.match(source, /from '\.\/catalog\.js'/);
  assert.match(source, /from '\.\/audio\.js'/);
  assert.match(source, /selectControl\('feedbackSounds', 'setting\.feedbackSounds'/);
  assert.match(source, /setting === 'timed' \|\| setting === 'feedbackSounds'/);
  assert.match(source, /from '\.\/surfaces\.js'/);
  assert.match(source, /data\/commands\.json/);
  assert.match(source, /data\/audio-manifest\.json/);
});

test('app wires best-effort feedback cues without coupling them to command audio scoring', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ createFeedbackCuePlayer \} from '\.\/feedback-audio\.js'/);
  assert.match(source, /feedbackPlayer = createFeedbackCuePlayer\(\)/);
  assert.match(source, /feedbackCueForTransition\(before, model, event\)/);
  assert.match(source, /enabled: state\.settings\.feedbackSounds/);
  assert.match(source, /busy: audioBusy/);
  assert.match(source, /feedbackPlayer\.stop\(\)/);
  assert.match(source, /void feedbackPlayer\.play/);
});

test('app enables incomplete static-audio sessions only through supported browser speech', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /hasAudio\(command, state\.settings\.speed\)\s*\|\|\s*player\.supportsFallback\(\)/);
  assert.match(source, /selectPlaybackVariant\(manifest, command, state\.settings\.speed, player\.supportsFallback\(\)\)/);
  assert.match(source, /player\.play\(variant, \{ text: phrasing\.es, speed: variant\.speed \}\)/);
});

test('daily-practice controls and SVG response targets preserve 44px touch minimums', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.surface-option[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.setup-grid[\s\S]*?select[\s\S]*?min-height:\s*44px;/);
});

test('screen changes expose managed focus and announced reveal/result headings without focus theft on same-screen updates', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /focusScreen\(document, \{ previousScreen, nextScreen: model\.screen \}\)/);
  const snapshotIndex = source.indexOf('captureFocusSnapshot(app, document)');
  const replacementIndex = source.indexOf('app.innerHTML = `${renderHeader()}${screen}`');
  const restoreIndex = source.indexOf('restoreOrDeferFocus(app, document,');
  assert.ok(snapshotIndex >= 0 && snapshotIndex < replacementIndex);
  assert.ok(restoreIndex > replacementIndex);
  assert.match(source, /deferredFocusSnapshot = restoreOrDeferFocus\(app, document,/);
  assert.match(source, /data-screen-focus tabindex="-1"/);
  assert.match(source, /id="outcome-title"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(source, /id="results-title"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(source, /id="results-title"[^>]*aria-describedby="results-headline"/);
  assert.match(source, /id="results-headline" class="headline"/);
  assert.match(source, /promptControlsDisabled\(model\)/);
});

test('app selects only supported surfaces and uses normalized actions, localized vehicle procedures, and a data-management label', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /supportedCommands\(commands,/);
  assert.match(source, /translate\(locale\(\), `actionResult\.\$\{command\.acceptedResult\}`\)/);
  assert.match(source, /localizedVehicleAnswer\(command, locale\(\)\)/);
  assert.match(source, /translate\(locale\(\), 'data\.management'\)/);
  assert.match(source, /class="data-controls" role="group" aria-label="\$\{translate\(locale\(\), 'data\.management'\)\}"/);
});

test('setup hides data-management actions behind a collapsed-by-default Settings disclosure', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  const detailsMatch = source.match(/<details class="settings-disclosure">[\s\S]*?<\/details>/);
  assert.ok(detailsMatch, 'setup must render a settings-disclosure <details> element');
  const detailsMarkup = detailsMatch[0];

  assert.doesNotMatch(detailsMarkup, /<details class="settings-disclosure"[^>]* open/, 'disclosure must never render pre-opened');
  assert.match(detailsMarkup, /<summary[^>]*>[\s\S]*?aria-hidden="true">⚙️<\/span>[\s\S]*?translate\(locale\(\), 'settings\.title'\)/);
  assert.match(detailsMarkup, /data-action="export"/);
  assert.match(detailsMarkup, /data-action="import"/);
  assert.match(detailsMarkup, /data-import-file/);
  assert.match(detailsMarkup, /data-action="reset"/);
  assert.match(detailsMarkup, /class="data-controls" role="group" aria-label="\$\{translate\(locale\(\), 'data\.management'\)\}"/);
  assert.doesNotMatch(detailsMarkup, /importError/, 'an import failure must remain visible after the disclosure collapses on rerender');
  assert.match(source, /<\/details>\s*\$\{importError \? `<p class="notice error" role="alert">\$\{importError\}<\/p>` : ''\}/);
});

test('setup exposes bilingual offline status and download actions without blocking Start', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(source, /createOfflineClient/);
  assert.match(source, /class="offline-card"/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /<progress[^>]*data-offline-progress/);
  assert.match(source, /data-offline-action="download"/);
  assert.match(source, /data-offline-action="cancel"/);
  assert.match(source, /data-offline-action="apply-update"/);
  assert.match(source, /offlineClient\.register\(\)/);
  assert.match(css, /\.offline-card[\s\S]*?border/);
});

test('setup omits the obsolete source and provisional-vehicle notices', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /warning\.source/);
  assert.doesNotMatch(source, /warning\.vehicle/);
  assert.doesNotMatch(source, /class="notice-group"/);
});

test('setup offers resumable sessions and scoring advances persisted progress before saving', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(source, /resolveActiveSession/);
  assert.match(source, /data-action="resume-session"/);
  assert.match(source, /data-action="discard-session"/);
  assert.match(source, /advanceActiveSession\(state\.activeSession/);
  assert.match(source, /audioVariant/);
  assert.match(css, /\.resume-card/);
});

test('settings disclosure summary receives a 44px-capable, keyboard-focusable layout', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.settings-disclosure[\s\S]*?summary[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /\.settings-disclosure[\s\S]*?summary[\s\S]*?:focus-visible[\s\S]*?outline/);
});

test('reveal no longer cites a model-specific manual page for vehicle procedures', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /class="source-page"/, 'a bare page number with no named manual no longer supports generic guidance');
  assert.match(source, /localizedVehicleAnswer\(command, locale\(\)\)/, 'the generic vehicle-answer text itself must still render');
});

test('app routes model-aware responses, reveal provenance, and unscored surface retries', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /generateSurface/);
  assert.match(source, /reduceSurfaceResponse/);
  assert.match(source, /renderSurfaceModel/);
  assert.match(source, /surfaceModel:\s*before\.activeSurfaceModel/);
  assert.match(source, /selectedTargetId:\s*model\.selectedTargetId/);
  assert.match(source, /data-action="surface-retry"/);
  assert.match(source, /type:\s*'SURFACE_EVENT',\s*surfaceEvent/);
  assert.doesNotMatch(source, /SURFACE_RESPONSE_UPDATED/);
});
