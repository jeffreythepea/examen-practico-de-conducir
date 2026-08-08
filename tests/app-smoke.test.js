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
  assert.match(source, /selectControl\('roadMovement', 'setting\.roadMovement'/);
  assert.match(source, /\['timed', 'feedbackSounds', 'roadMovement'\]\.includes\(setting\)/);
  assert.match(source, /roadMovement/);
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

test('Mock hides replay and answer feedback during the drive and advances through a neutral frame', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /model\.experience\?\.replayPolicy !== 'none'/);
  assert.match(source, /screen:\s*model\.experience\?\.revealPolicy === 'session-end'\s*\? 'mock-transition'/);
  assert.match(source, /data-screen-focus[^>]*>\$\{translate\(locale\(\), 'screen\.mockTransition'\)\}/);
  assert.match(source, /type:\s*'MOCK_CONTINUE'/);
  assert.match(source, /model\.screen === 'mock-transition'/);
});

test('Full Mock continuity persists a narrative route and renders skippable unscored transitions', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /continuityEnabledForExperience\(experience\)/);
  assert.match(source, /prepareContinuitySession\(session, selectableCommands\)/);
  assert.match(source, /continuity,\s*\n\s*experience:/);
  assert.match(source, /currentContinuityStep\(state\.activeSession\)/);
  assert.match(source, /renderContinuityTransition\(transition, locale\(\)\)/);
  assert.match(source, /advanceActiveSessionTransition\(state\.activeSession\)/);
  assert.match(source, /data-action="skip-continuity-transition"/);
  assert.match(source, /type:\s*'CONTINUITY_SYNC'/);
});

test('completed Mock results disclose the non-official rule and exact deferred command evidence', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /mockResultStatus\(attempts, model\.session\.length\)/);
  assert.match(source, /class="mock-review-list"/);
  assert.match(source, /data-mock-miss-reason/);
  assert.match(source, /const \{ attemptId \} = button\.dataset/);
  assert.match(source, /mock\.result\.nonOfficial/);
});

test('prompts, neutral Mock transitions, and results show compact localized session identity', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(source, /function renderSessionIdentity\(\)/);
  assert.ok((source.match(/\$\{renderSessionIdentity\(\)\}/g) ?? []).length >= 3);
  assert.match(source, /examiner\.mixed\.title/);
  assert.match(source, /class="examiner-token-stack"/);
  assert.match(css, /\.session-identity/);
  assert.match(css, /\.examiner-token/);
  assert.match(css, /@media \(orientation: landscape\) and \(min-width: 900px\)[\s\S]*?\.session-identity/);
});

test('app enables incomplete static-audio sessions only through supported browser speech', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /sessionStartEligibility\([\s\S]*?player\.supportsFallback\(\)/);
  assert.match(source, /selectPlaybackVariant\([\s\S]*?examinerChoice:\s*experience\.resolvedExaminerId \?\? 'mixed'/);
  assert.match(source, /player\.play\([\s\S]*?variant,[\s\S]*?\{ text: phrasing\.es, speed: variant\.speed \}/);
});

test('browser controller coordinates moving junction audio, rendering, animation end, and timer lock', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /roadMotionView\(model\.roadMotion, Date\.now\(\)\)/);
  assert.match(source, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(source, /onStarted/);
  assert.match(source, /type:\s*'AUDIO_STARTED'/);
  assert.match(source, /type:\s*'ROAD_APPROACH_ENDED'/);
  assert.match(source, /initialAudioPending/);
  assert.match(source, /status\.audioPlaying/);
  assert.match(source, /if \(model\.initialAudioPending\) return;/);
  assert.match(source, /renderSurfaceModel\([\s\S]*?motion[\s\S]*?renderSurfaceModel\([\s\S]*?motion/);
  assert.match(source, /road-camera-push/);
});

test('correct post-answer movement starts only after saved scoring and remains presentation-only', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const controller = source.slice(source.indexOf('function completeTrial(event)'), source.indexOf('function playFeedbackCue'));
  const saveIndex = controller.indexOf('persistState()');
  const startIndex = controller.indexOf("type: 'POST_ANSWER_MOTION_STARTED'");
  const renderIndex = controller.lastIndexOf('render()');

  assert.ok(saveIndex >= 0 && startIndex > saveIndex, 'movement must start only after the scored state is saved');
  assert.ok(renderIndex > startIndex, 'the saved movement state must be installed before reveal rendering');
  assert.match(source, /postAnswerMotionView\(model\.postAnswerMotion, Date\.now\(\)\)/);
  assert.match(source, /postAnswerMotion\s*\n\s*\}\)\}/);
  assert.match(source, /attempt:\s*result\.attempt/);
  assert.match(source, /reducedMotion/);
  assert.doesNotMatch(controller, /await .*postAnswer|setTimeout\([^)]*postAnswer/);
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

test('results screen frames hint-heavy non-mock sessions with an assisted-answers notice', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /\$\{!isMock && summary\.counts\.assisted > summary\.counts\.unaided \? `<p class="notice">\$\{translate\(locale\(\), 'results\.hintNotice'\)\}<\/p>` : ''\}/
  );
  const i18nSource = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');
  assert.match(i18nSource, /'results\.hintNotice': '[^']+work toward answering from audio alone[^']+'/);
  assert.match(i18nSource, /'results\.hintNotice': '[^']+intenta responder solo con el audio[^']+'/);
});

test('a persistence failure keeps the session alive and surfaces a dismissible setup notice, replacing every direct saveState call', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  const helperBody = source.slice(
    source.indexOf('function persistState()'),
    source.indexOf('function render()')
  );
  assert.match(helperBody, /try\s*\{\s*saveState\(window\.localStorage, state\);\s*persistError = false;\s*\}\s*catch\s*\{\s*persistError = true;\s*\}/);
  assert.doesNotMatch(helperBody, /throw/, 'persistState must never rethrow — a failed save must not break the caller');

  const completeTrial = source.slice(
    source.indexOf('function completeTrial(event)'),
    source.indexOf('function playFeedbackCue')
  );
  const persistIndex = completeTrial.indexOf('persistState();');
  const renderIndex = completeTrial.lastIndexOf('render()');
  assert.ok(persistIndex >= 0 && renderIndex > persistIndex,
    'the trial must still reach render()/reveal after a persistState() call, whether or not the save succeeded');

  assert.match(source, /\$\{persistError \? `<p class="notice" role="alert">\$\{translate\(locale\(\), 'error\.persistence'\)\} <button type="button" data-action="dismiss-persist-error">/);
  assert.match(source, /'\[data-action="dismiss-persist-error"\]'\)\?\.addEventListener\('click', \(\) => \{\s*persistError = false;\s*render\(\);\s*\}\)/);

  const directCalls = source.match(/saveState\(window\.localStorage, state\)/g) ?? [];
  assert.equal(directCalls.length, 1, 'saveState(window.localStorage, state) must appear only inside persistState() itself — every call site must go through persistState()');

  const i18n = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');
  assert.match(i18n, /'error\.persistence': 'Progress could not be saved to this device\. Consider Export backup\.'/);
  assert.match(i18n, /'error\.persistence': 'El progreso no se pudo guardar en este dispositivo\. Considera Exportar copia\.'/);
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

test('production setup renders and binds the semantic experience, examiner, and theme choices', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ renderSoloSetupView \} from '\.\/solo-setup-view\.js'/);
  assert.match(source, /renderSoloSetupView\(\{[\s\S]*?selectedPresetId:\s*state\.settings\.experienceMode/);
  assert.match(source, /selectedExaminerChoiceId:\s*state\.settings\.examinerChoice/);
  assert.match(source, /selectedThemeId:\s*state\.settings\.themeId/);
  assert.match(source, /data-action="select-experience-mode"/);
  assert.match(source, /data-action="select-examiner"/);
  assert.match(source, /data-action="select-theme"/);
  assert.match(source, /class="advanced-practice-disclosure"/);
  assert.match(source, /sessionStartEligibility\(/);
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
  assert.match(source, /persistedActiveSessionAfterAttempt\(state\.activeSession/);
  assert.match(source, /audioVariant/);
  assert.match(css, /\.resume-card/);
});

test('app integrates readiness navigation, targeted sessions, and lesson-note lifecycle', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /renderReadinessView/);
  assert.match(source, /readinessForCatalog/);
  assert.match(source, /createLessonFlag/);
  assert.match(source, /updateLessonFlag/);
  assert.match(source, /data-action="open-readiness"/);
  assert.match(source, /model\.screen === 'readiness'/);
  assert.match(source, /bindReadinessEvents\(\)/);
  assert.match(source, /data-action="start-readiness-practice"/);
  assert.match(source, /data-action="start-command-practice"/);
  assert.match(source, /data-action="save-lesson-flag"/);
  assert.match(source, /['"]resolve-lesson-flag['"]/);
  assert.match(source, /['"]reopen-lesson-flag['"]/);
  assert.match(source, /target:\s*practiceTarget/);
  assert.match(source, /lessonFlags:\s*state\.lessonFlags/);
  assert.match(source, /createActiveSession\(\{[\s\S]*?target:\s*practiceTarget/);
});

test('reveal offers the same persisted lesson-note editor used by Readiness', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /import \{ renderLessonFlagEditor, renderReadinessView \} from '\.\/readiness-view\.js'/);
  assert.match(source, /renderLessonFlagEditor\([\s\S]*?readinessFilters\.editor/);
  assert.match(source, /data-action="open-reveal-lesson-flag"/);
  assert.match(source, /bindRevealEvents\(\)[\s\S]*?open-reveal-lesson-flag[\s\S]*?save-lesson-flag/);
});

test('setup exposes only recommended and free modes and playback receives prior attempts', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /\['recommended',\s*'mode\.recommended'\]/);
  assert.match(source, /\['free',\s*'mode\.free'\]/);
  assert.doesNotMatch(source, /\['weakest-first',\s*'mode\.weak'\]/);
  assert.match(source, /selectPlaybackVariant\([\s\S]*?state\.attempts[\s\S]*?examinerChoice:\s*experience\.resolvedExaminerId \?\? 'mixed'/);
});

test('targeted practice filters selection without rewriting saved setup preferences', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function startSession\(target = null, selectionPhase = state\.settings\.phase\)/);
  assert.match(source, /const sessionSettings = effectiveSessionSettings\(state\.settings\);/);
  assert.match(source, /createSession\(selectableCommands, \{[\s\S]*?phase: selectionPhase/);
  assert.match(source, /themeId:\s*sessionSettings\.themeId/);
  assert.match(source, /experience:\s*experience/);
  assert.doesNotMatch(source, /state = \{ \.\.\.state, settings: sessionSettings, activeSession \}/);
  assert.doesNotMatch(source, /state = \{ \.\.\.state, settings: restoredSettings \}/);
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
