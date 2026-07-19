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
