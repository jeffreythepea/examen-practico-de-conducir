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

test('cabin ambience is wired to sync on every render and cut immediately on End session', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /import \{ createAmbiencePlayer, pickAmbienceClip \} from '\.\/ambience\.js';/);
  assert.match(source, /ambiencePlayer = createAmbiencePlayer\(\{ AudioCtor: window\.Audio \}\)/);
  assert.match(source, /function syncAmbience\(\) \{\s*\n\s*if \(ambienceEligible\(model\)\)/);
  assert.match(source, /lastRenderedScreen = model\.screen;\s*\n\s*syncAmbience\(\);\s*\n\s*\}/);
  assert.match(source, /feedbackPlayer\.stop\(\);\s*\n\s*ambiencePlayer\.stop\(\);/);
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
  assert.match(landscapeCss, /\.prompt-layout\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*0\.55fr\)\s*minmax\(0,\s*1\.45fr\);/s);
  assert.match(landscapeCss, /\.reveal-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.25fr\)\s*minmax\(300px,\s*0\.75fr\);/s);
  assert.match(landscapeCss, /\.gameplay-surface \.surface-stage\s*\{[^}]*width:\s*min\(100%,\s*66vh\);/s);
});

test('wrong answers get a brief, reduced-motion-safe bump distinct from the reveal outcome color', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(css, /wrong-answer-bump:begin/);
  assert.match(
    css,
    /\.panel\.reveal:has\(\.outcome\.incorrect\) \.gameplay-surface\s*\{[^}]*animation:\s*wrong-answer-bump\s+\d+ms/
  );
  const keyframeMatch = css.match(/@keyframes wrong-answer-bump\s*\{([\s\S]*?)\n\}/);
  assert.ok(keyframeMatch, 'wrong-answer-bump keyframes must exist');
  assert.match(keyframeMatch[1], /0%\s*\{\s*transform:\s*translate\(0,\s*0\);?\s*\}/);
  assert.match(keyframeMatch[1], /100%\s*\{\s*transform:\s*translate\(0,\s*0\);?\s*\}/);

  const reducedMotionStart = css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('wrong-answer-bump:begin'));
  const bumpEnd = css.indexOf('wrong-answer-bump:end');
  assert.ok(reducedMotionStart >= 0 && reducedMotionStart < bumpEnd, 'reduced-motion override must live inside this block');
  const reducedMotionBlock = css.slice(reducedMotionStart, bumpEnd);
  assert.match(
    reducedMotionBlock,
    /\.panel\.reveal:has\(\.outcome\.incorrect\) \.gameplay-surface\s*\{\s*animation:\s*none;\s*\}/
  );

  assert.match(css, /wrong-answer-bump:end/);
});

test('all setup controls receive a 44px-capable layout', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /button,\s*\na\s*\{[\s\S]*?min-height:\s*44px;/);
  assert.match(css, /select,\s*\ninput\[type="checkbox"\]\s*\{[\s\S]*?min-height:\s*44px;/);
});

test('local server rejects dotfiles and resolves files within its real root', async () => {
  const source = await readFile(new URL('../scripts/serve.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ isForbiddenPathname, parseByteRange, parseServerOptions \} from '\.\/serve-options\.mjs'/);
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
  assert.match(source, /\['timed', 'feedbackSounds', 'roadMovement', 'continuousDrive', 'ambience'\]\.includes\(setting\)/);
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

  assert.match(source, /continuityEnabledForExperience\(experience, sessionSettings\)/);
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

test('gameplay screens collapse the chrome and grow the stage while the AI-voice disclosure stays on setup surfaces', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(source, /function gameplayScreen\(\)/);
  assert.match(source, /class="app-header compact"/);
  assert.match(source, /class="audio-disclosure">\$\{translate\(locale\(\), 'audio\.disclosure'\)\}/,
    'the bilingual AI-voice disclosure must stay in the full header');
  assert.match(source, /class="session-identity\$\{gameplayScreen\(\) \? ' compact' : ''\}"/);
  assert.doesNotMatch(source, /<p>\$\{translate\(locale\(\), 'prompt\.listen'\)\}<\/p>/,
    'the prompt h2 is not restated as an instruction sentence mid-drive');

  assert.match(css, /\.app-header\.compact/);
  assert.match(css, /\.session-identity\.compact/);
  assert.match(css, /\.gameplay-surface \.surface-stage\.driving-photo-stage\s*\{[^}]*width:\s*min\(100%,\s*108vh\);/s);
  assert.match(css, /\.continuity-transition-stage\s*\{[^}]*width:\s*min\(100%,\s*108vh\);/s,
    'transition clips get the same enlarged stage');
});

test('app enables incomplete static-audio sessions only through supported browser speech', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /sessionStartEligibility\([\s\S]*?player\.supportsFallback\(\)/);
  assert.match(source, /selectPlaybackVariant\([\s\S]*?examinerChoice:\s*examinerRotation \? examinerRotation\[index\] : \(experience\.resolvedExaminerId \?\? 'mixed'\)/);
  assert.match(source, /player\.play\([\s\S]*?variant,[\s\S]*?\{ text: phrasing\.es, speed: variant\.speed \}/);
});

test('browser controller coordinates moving junction audio, rendering, animation end, and timer lock', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /roadMotionView\(model\.roadMotion, Date\.now\(\)\)/);
  assert.match(source, /matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(source, /onStarted/);
  assert.match(source, /type:\s*'SCENE_STARTED'/);
  assert.match(source, /commandOnsetDelayMs\(motionEnabled\)/);
  assert.match(source, /type:\s*'AUDIO_STARTED'/);
  assert.match(source, /type:\s*'ROAD_APPROACH_ENDED'/);
  assert.match(source, /initialAudioPending/);
  assert.match(source, /status\.audioPlaying/);
  assert.match(source, /if \(model\.initialAudioPending\) return;/);
  assert.match(source, /renderSurfaceModel\([\s\S]*?motion[\s\S]*?renderSurfaceModel\([\s\S]*?motion/);
  assert.match(source, /road-camera-push/);
});

test('null events render silently with live targets and never reach attempt recording', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function renderNullEvent\(\)/);
  const view = source.slice(source.indexOf('function renderNullEvent()'), source.indexOf('function renderResults()'));
  assert.doesNotMatch(view, /data-action="replay"|show-spanish|data-timer/);
  assert.match(view, /id="prompt-title"[^>]*>\$\{translate\(locale\(\), 'screen\.prompt'\)\}/, 'silence keeps the standard examiner framing (same prompt heading as spoken commands)');
  assert.match(view, /nullEvent\.neutral/, 'mock mode withholds correct/incorrect framing');

  const binder = source.slice(source.indexOf('function bindNullEventEvents()'), source.indexOf('function bindResultsEvents()'));
  assert.match(binder, /NULL_EVENT_SELECT/);
  assert.match(binder, /advanceContinuityTransition/);
  assert.doesNotMatch(binder, /recordAttempt|completeTrial|dispatchSurfaceEvent/);
});

test('scored reveal persists before rendering and contains no obsolete answer-glyph runtime', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const controller = source.slice(source.indexOf('function completeTrial(event)'), source.indexOf('function playFeedbackCue'));
  const saveIndex = controller.indexOf('persistState()');
  const renderIndex = controller.lastIndexOf('render()');

  assert.ok(saveIndex >= 0 && renderIndex > saveIndex, 'scored state must persist before reveal rendering');
  assert.doesNotMatch(source, /postAnswerMotion|POST_ANSWER_MOTION|post-answer-motion/);
  assert.match(source, /turnClipWillPlay/);
});

test('the clip-backed reveal auto-advance is keyed to its attempt and yields to the flag editor', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const scheduler = source.slice(
    source.indexOf('function scheduleRevealAutoAdvance()'),
    source.indexOf('function bindMockTransitionEvents()')
  );

  // The reveal re-binds on every render, so an unkeyed timer would stack one
  // per render and a stale one would fire into the following question.
  assert.match(scheduler, /revealAutoAdvanceFor === attemptId/, 'must not schedule twice for one attempt');
  assert.match(scheduler, /currentAttemptId !== attemptId/, 'a stale timer must not fire into a later attempt');
  assert.match(scheduler, /model\.screen !== 'reveal'/, 'must not fire once the reveal is gone');
  assert.match(scheduler, /readinessFilters\.editor/, 'must not interrupt a lesson flag being written');
  // Auto-advance and manual Continue must run the identical path.
  assert.match(scheduler, /continueFromReveal\(\)/);
  assert.match(source, /data-action="continue"\]'\)\.addEventListener\('click', continueFromReveal\)/);
});

test('hover styling never reaches a touch screen', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  // iOS applies :hover to whatever sits under the finger after a tap and keeps
  // it there through the next render, so an unguarded hover rule paints an
  // element the learner never pointed at. On the answer targets that meant the
  // gold reserved for the correct answer landing on an untouched roundabout
  // exit (device report, 2026-08-14).
  const unguarded = [];
  let depth = 0;
  let guardDepth = null;
  for (const raw of css.replaceAll(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const line = raw.trim();
    if (guardDepth === null && /@media[^{]*\(hover:\s*hover\)/.test(line)) guardDepth = depth;
    else if (guardDepth === null && line.includes(':hover')) unguarded.push(line);
    depth += (raw.match(/\{/g) ?? []).length - (raw.match(/\}/g) ?? []).length;
    if (guardDepth !== null && depth <= guardDepth) guardDepth = null;
  }
  assert.deepEqual(unguarded, [], 'every :hover rule must sit inside @media (hover: hover)');
  // The correct-answer gold must not itself be trapped behind that guard.
  assert.match(css, /\.road-target\[aria-current="true"\]\s*\{/);
  assert.match(css, /\.manoeuvre-target\[aria-current="true"\]\s*\{/);
});

test('the end screen acknowledges the round and waits for Continue or Retry', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /class="round-complete">\$\{translate\(locale\(\), 'results\.roundComplete'/);
  assert.match(source, /data-action="setup">\$\{translate\(locale\(\), 'action\.backHome'\)\}/);
  assert.match(source, /data-action="retry">\$\{translate\(locale\(\), 'action\.retryRound'\)\}/);
  // Retry reruns the settings just played, so it must clear the finished
  // session exactly as leaving for home does before starting the next one.
  assert.match(source, /data-action="retry"\]'\)[\s\S]{0,200}?returnHomeFromResults\(\);\s*\n\s*startSession\(\);/);
  // Nothing may leave the end screen on its own: the only two exits are those
  // buttons, plus the readiness and collection links.
  const results = source.slice(source.indexOf('function bindResultsEvents()'), source.indexOf('function returnHomeFromResults()'));
  assert.doesNotMatch(results, /setTimeout|setInterval/);

  // The screen can render under a finger still tapping through the closing
  // transition, and that stray tap dismissed the round before it could be
  // read. Both exits check the arrival time.
  assert.match(results, /data-action="setup"\]'\)\.addEventListener\('click', \(\) => \{\s*\n\s*if \(tapArrivedWithTheScreen\(\)\) return;/);
  assert.match(results, /data-action="retry"\]'\)\?\.addEventListener\('click', \(\) => \{\s*\n\s*if \(tapArrivedWithTheScreen\(\)\) return;/);
  // Arrival only: a locale switch re-renders the screen and must not re-arm it.
  assert.match(source, /model\.screen === 'results' && previousScreen !== 'results'\) resultsShownAt = Date\.now\(\)/);
  // A timestamp, not a disabled control: a guard that fails open cannot strand
  // the learner on the screen the way a throttled timer or animation could.
  assert.match(source, /function tapArrivedWithTheScreen\(\) \{\s*\n\s*return Date\.now\(\) - resultsShownAt < RESULTS_TAP_GUARD_MS;/);
});

test('an installed offline package can be asked for updates without a relaunch', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  // 'ready' used to render no button at all, so the only update check was the
  // one at registration — unreachable without force-quitting the app.
  assert.match(source, /status === 'ready'\s*\n?\s*\? `<button type="button" data-offline-action="check">/);
  assert.match(source, /data-offline-action="check"\]'\)[\s\S]{0,260}?checkForUpdate\(\)/);
  // A check that finds nothing returns to the same state, so it has to say so.
  assert.match(source, /offlineUpToDate = next\?\.status === 'ready'/);
  assert.match(source, /offlineUpToDate && status === 'ready'[\s\S]{0,120}?'offline\.upToDate'/);
  // The pending status needs its own line, or the card reads "online only"
  // mid-check, as though the package had vanished.
  assert.match(source, /status === 'checking-update'\s*\n?\s*\? 'offline\.checkingUpdate'/);
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
  const replacementIndex = source.indexOf('app.replaceChildren(template.content)');
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

test('screen re-renders parse into a template and adopt stable images before swapping the DOM', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const parseIndex = source.indexOf('template.innerHTML = `${renderHeader()}${screen}`');
  const decodeIndex = source.indexOf("image.decoding = 'sync'");
  const stageIndex = source.indexOf('adoptStableStages(app, template.content)');
  const adoptIndex = source.indexOf('adoptStableImages(app, template.content)');
  const replaceIndex = source.indexOf('app.replaceChildren(template.content)');
  assert.ok(parseIndex >= 0, 'render must parse the screen markup into a template');
  assert.ok(parseIndex < decodeIndex,
    'sync decode is reflected onto parsed images before adoption so live and parsed stages serialize identically');
  assert.ok(decodeIndex < stageIndex, 'stage adoption compares markup after the decode attribute lands');
  assert.ok(stageIndex < adoptIndex, 'stage adoption runs before image adoption');
  assert.ok(adoptIndex < replaceIndex, 'adoption happens before the live DOM swap');
});

test('stage controls bind through the WeakSet guard so adopted stages never double-fire', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(source, /const boundStageControls = new WeakSet\(\)/);
  const stageBindings = source.match(/bindStageControl\(/g) ?? [];
  assert.ok(stageBindings.length >= 8, 'every stage control binding site routes through the guard');
  assert.match(source, /forEach\(button => bindStageControl\(button, 'click'/);
  assert.match(source, /\.road-target'\)\.forEach\(button => bindStageControl/);
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

test('End session is a small secondary control on the prompt and mock-transition screens, guarded by a confirm, that keeps scored attempts', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  const promptSection = source.slice(source.indexOf('function renderPrompt()'), source.indexOf('function renderReveal()'));
  assert.match(promptSection, /<button type="button" data-action="end-session">\$\{translate\(locale\(\), 'session\.end'\)\}<\/button>/);

  const mockTransitionSection = source.slice(source.indexOf('function renderMockTransition()'), source.indexOf('function renderNullEvent()'));
  const endSessionButtons = mockTransitionSection.match(/<button type="button" data-action="end-session">/g) ?? [];
  assert.equal(endSessionButtons.length, 2, 'both the mock-transition-step branch and the plain branch must render End session');
  const nullEventSection = source.slice(source.indexOf('function renderNullEvent()'), source.indexOf('function renderResults()'));
  assert.match(nullEventSection, /<button type="button" data-action="end-session">\$\{translate\(locale\(\), 'session\.end'\)\}<\/button>/);

  assert.match(source, /'\[data-action="end-session"\]'\)\?\.addEventListener\('click', endSession\)/);
  const bindPromptEvents = source.slice(source.indexOf('function bindPromptEvents()'), source.indexOf('function bindRevealEvents()'));
  assert.match(bindPromptEvents, /'\[data-action="end-session"\]'\)\?\.addEventListener\('click', endSession\)/);
  const bindMockTransitionEvents = source.slice(source.indexOf('function bindMockTransitionEvents()'), source.indexOf('function bindResultsEvents()'));
  assert.match(bindMockTransitionEvents, /'\[data-action="end-session"\]'\)\?\.addEventListener\('click', endSession\)/);

  const endSessionFn = source.slice(source.indexOf('function endSession()'), source.indexOf('async function playCurrentCommand()'));
  assert.match(endSessionFn, /if \(!window\.confirm\(translate\(locale\(\), 'session\.endConfirm'\)\)\) return;/);
  const confirmIndex = endSessionFn.indexOf('window.confirm');
  for (const mutation of ['stopTimer()', 'player.cancel(', 'discardActiveSession(state)', "model = { screen: 'setup'", 'persistState()']) {
    const index = endSessionFn.indexOf(mutation);
    assert.ok(index > confirmIndex, `${mutation} must run only after the confirm check, so a decline leaves session state, timer, and audio untouched`);
  }
  assert.doesNotMatch(source.slice(0, source.indexOf('function endSession()')), /function discardActiveSession/, 'sanity: discardActiveSession is imported, not locally defined, so this slice technique is valid');

  const i18n = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');
  assert.match(i18n, /'session\.end': 'End session'/);
  assert.match(i18n, /'session\.endConfirm': 'End this session\? Progress on answered commands is kept\.'/);
  assert.match(i18n, /'session\.end': 'Terminar sesión'/);
  assert.match(i18n, /'session\.endConfirm': '¿Terminar esta sesión\? Se conserva el progreso de las órdenes respondidas\.'/);
});

test('the app opens on a bilingual title screen that enters setup on one tap', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

  assert.match(source, /model = \{ screen: 'title', settings: state\.settings, session: \[\], index: 0 \}/);
  assert.match(source, /model\.screen === 'title'\s*\n?\s*\? renderTitle\(\)/);
  assert.match(source, /class="title-scene"/);
  assert.match(source, /data-action="enter"[^>]*>\$\{translate\(locale\(\), 'title\.enter'\)\}/);
  assert.match(source, /if \(model\.screen === 'title'\) bindTitleEvents\(\);/);
  assert.match(source, /type: 'GO_TO_SETUP'/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*\.title-overlay \{\s*\n\s*animation: none;/);

  // The scene carries the app's name, so the header must not repeat it — but
  // the bilingual AI-voice disclosure has to survive that removal, and the
  // language switch has to stay reachable before entering.
  assert.match(source, /model\.screen === 'title'[\s\S]{0,200}?class="app-header title-only">\$\{languageSwitch\}/);
  assert.doesNotMatch(source, /class="app-header title-only">[\s\S]{0,80}app\.shortTitle/);
  assert.match(source, /class="title-disclosure">\$\{translate\(locale\(\), 'audio\.disclosure'\)\}/);

  // Looping footage is exactly what reduced motion asks us to stop, and the
  // autoplay attribute alone is unreliable, so playback is asserted in JS.
  assert.match(source, /class="title-scene-media"[\s\S]{0,220}?muted loop playsinline autoplay/);
  assert.match(source, /prefers-reduced-motion: reduce[\s\S]{0,120}?scene\.pause\(\)/);
  assert.match(source, /scene\.playbackRate = 0\.5/);
});

test('setup leads with the simulated-drive primary card and hides configuration behind Advanced options', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /\$\{renderPrimaryDriveCard\(dateParts\)\}/);
  assert.match(source, /experienceMode: 'practice',\s*\n\s*themeId: 'full-mock',\s*\n\s*challengeId: null,\s*\n\s*phase: 'mixed'/);
  assert.match(source, /data-action="start-drive"/);
  assert.match(source, /data-action="toggle-primary-hint"/);
  assert.match(source, /hintPolicy: event\.target\.checked \? 'available' : 'unavailable'/);

  const advancedMatch = source.match(/<details class="setup-advanced">[\s\S]*?<p class="pool-count">/);
  assert.ok(advancedMatch, 'setup must wrap configuration in a setup-advanced <details> element');
  assert.doesNotMatch(advancedMatch[0], /<details class="setup-advanced"[^>]* open/, 'Advanced must never render pre-opened');
  assert.match(advancedMatch[0], /renderSoloSetupView/);
  assert.match(advancedMatch[0], /'continuousDrive', 'setting\.continuousDrive'/);
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
  assert.match(source, /selectPlaybackVariant\([\s\S]*?state\.attempts[\s\S]*?examinerChoice:\s*examinerRotation \? examinerRotation\[index\] : \(experience\.resolvedExaminerId \?\? 'mixed'\)/);
});

test('targeted practice filters selection without rewriting saved setup preferences', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

  assert.match(source, /function startSession\(target = null, selectionPhase = state\.settings\.phase\)/);
  assert.match(source, /const baseSessionSettings = effectiveSessionSettings\(state\.settings\);/);
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

test('the mock-transition screen wires the correct-answer turn-through intro', async () => {
  const source = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
  const mockTransitionSection = source.slice(
    source.indexOf('function renderMockTransition()'),
    source.indexOf('function renderNullEvent()')
  );
  assert.match(mockTransitionSection, /intro: mockTransitionIntro\(motionEnabled\)/);
  assert.match(mockTransitionSection, /turnThroughIntro\(\{/);
  assert.match(mockTransitionSection, /outcome: source\.outcome/);
  const bindSection = source.slice(
    source.indexOf('function bindMockTransitionEvents()'),
    source.indexOf('function bindNullEventEvents()')
  );
  assert.match(bindSection, /\+ \(intro\?\.durationMs \?\? 0\)/,
    'the auto-advance delay must stretch to cover a playing intro');
});
