import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTINUITY_SCENE_FAMILIES,
  renderContinuityTransition
} from '../src/continuity-transition-view.js';

const BASE_MODEL = Object.freeze({
  family: 'urban-cruise',
  sceneId: 'urban-roadside-photo-v1',
  progressText: 'Driving section · 3 of 8',
  motionEnabled: true,
  sceneTappable: true
});

function render(overrides = {}, locale = 'en') {
  return renderContinuityTransition({ ...BASE_MODEL, ...overrides }, locale);
}

test('exports an immutable registry for all approved transition families', () => {
  assert.deepEqual(Object.keys(CONTINUITY_SCENE_FAMILIES), [
    'departure',
    'urban-cruise',
    'rural-cruise',
    'arrival',
    'parked'
  ]);
  assert.ok(Object.isFrozen(CONTINUITY_SCENE_FAMILIES));
  for (const family of Object.values(CONTINUITY_SCENE_FAMILIES)) {
    assert.ok(Object.isFrozen(family));
    assert.match(family.asset, /^\.\/assets\/driving\/[a-z0-9-]+\.webp$/);
  }
});

test('renders every approved family with stable family and scene attributes', () => {
  for (const [family, scene] of Object.entries(CONTINUITY_SCENE_FAMILIES)) {
    const html = render({ family, sceneId: scene.sceneId });
    assert.match(html, new RegExp(`data-continuity-family="${family}"`));
    assert.match(html, new RegExp(`data-continuity-scene="${scene.sceneId}"`));
    assert.match(html, new RegExp(`src="${scene.asset.replaceAll('.', '\\.')}`));
  }
});

test('rejects unsupported locales, families, scene IDs, and malformed view models', () => {
  assert.throws(() => render({}, 'fr'), /unsupported continuity locale/i);
  assert.throws(() => render({ family: 'motorway' }), /unknown continuity scene family/i);
  assert.throws(() => render({ sceneId: 'roundabout-five-photo-v1' }), /scene does not match family/i);
  assert.throws(() => render({ progressText: '' }), /progressText/i);
  assert.throws(() => render({ motionEnabled: 'yes' }), /motionEnabled/i);
  assert.throws(() => render({ sceneTappable: 'yes' }), /sceneTappable/i);
  assert.throws(() => render({ camera: { endScale: Number.NaN } }), /camera/i);
});

test('escapes caller text and never emits executable caller markup', () => {
  const html = render({ progressText: '<script>alert("x")</script> & \'route\'' });
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#39;route&#39;/);
  assert.doesNotMatch(html, /<script>/);
});

test('does not mutate the supplied view model or nested camera values', () => {
  const camera = Object.freeze({ startScale: 1, endScale: 1.06, originX: 66, originY: 84, durationMs: 1900 });
  const model = Object.freeze({ ...BASE_MODEL, camera });
  const before = JSON.stringify(model);
  renderContinuityTransition(model, 'en');
  assert.equal(JSON.stringify(model), before);
});

test('renders localized visible Skip controls in English and Spanish', () => {
  const english = render();
  const spanish = render({ progressText: 'Tramo de conducción · 3 de 8' }, 'es');
  assert.match(english, /<button[^>]*data-action="skip-continuity-transition"[^>]*>\s*Skip\s*<\/button>/);
  assert.match(spanish, /<button[^>]*data-action="skip-continuity-transition"[^>]*>\s*Saltar\s*<\/button>/);
});

test('announces progress once as an atomic status and labels the section', () => {
  const html = render();
  assert.match(html, /<section[^>]*aria-labelledby="continuity-transition-status"/);
  assert.match(html, /<p[^>]*id="continuity-transition-status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.equal(html.match(/role="status"/g)?.length, 1);
});

test('provides a separate optional scene shortcut without replacing visible Skip', () => {
  const tappable = render();
  assert.match(tappable, /<button[^>]*class="continuity-transition-scene"[^>]*data-action="skip-continuity-transition"/);
  assert.match(tappable, /aria-label="Skip transition"/);
  assert.equal(tappable.match(/data-action="skip-continuity-transition"/g)?.length, 2);

  const staticScene = render({ sceneTappable: false });
  assert.match(staticScene, /<div class="continuity-transition-scene"/);
  assert.equal(staticScene.match(/data-action="skip-continuity-transition"/g)?.length, 1);
});

test('exposes camera-transform variables only for enabled motion', () => {
  const moving = render({
    camera: { startScale: 1, endScale: 1.08, originX: 52, originY: 86, durationMs: 2100 }
  });
  assert.match(moving, /data-continuity-motion="true"/);
  assert.match(moving, /--continuity-start-scale:1/);
  assert.match(moving, /--continuity-end-scale:1\.08/);
  assert.match(moving, /--continuity-origin-x:52%/);
  assert.match(moving, /--continuity-origin-y:86%/);
  assert.match(moving, /--continuity-duration:2100ms/);

  const still = render({ motionEnabled: false });
  assert.match(still, /data-continuity-motion="false"/);
  assert.doesNotMatch(still, /--continuity-/);
});

test('uses decorative image semantics and excludes answer and scoring markup', () => {
  const html = render();
  assert.match(html, /<img[^>]*alt=""[^>]*aria-hidden="true"/);
  for (const forbidden of [
    'data-target=',
    'data-correct-route',
    'target-status-marker',
    'correct',
    'incorrect',
    'timer',
    'spanish-hint',
    'command-text',
    'data-score'
  ]) assert.doesNotMatch(html, new RegExp(forbidden, 'i'));
});

test('scoped CSS supplies touch, focus, landscape, lower-edge, and reduced-motion rules', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const start = css.indexOf('/* continuity-transition:start */');
  const end = css.indexOf('/* continuity-transition:end */');
  assert.ok(start >= 0 && end > start, 'missing scoped continuity CSS section');
  const section = css.slice(start, end);
  assert.match(section, /\.continuity-transition-skip[\s\S]*min-height:\s*44px/);
  assert.match(section, /\.continuity-transition-skip:focus-visible/);
  assert.match(section, /transform-origin:\s*var\(--continuity-origin-x[^;]+var\(--continuity-origin-y/);
  assert.match(section, /@media \(orientation: landscape\)[\s\S]*\.continuity-transition-stage/);
  assert.match(section, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none/);
});

const INTRO = Object.freeze({
  sceneId: 'four-way-intersection-photo-v1',
  asset: './assets/driving/four-way-intersection-photo-v1.webp',
  dx: 12.25,
  dy: 0,
  scale: 1.22,
  rotate: -2,
  yawDeg: -13.48,
  settleDx: -3.06,
  startScale: 1.06,
  midScale: 1.12,
  turnScale: 1.2,
  originX: 50,
  originY: 82,
  durationMs: 1400
});

test('renders a decorative turn-through intro overlay when supplied', () => {
  const html = render({ intro: INTRO });
  assert.match(html, /class="continuity-transition-image-frame turn-through-intro"[^>]*aria-hidden="true"/);
  assert.match(html, /data-turn-through-scene="four-way-intersection-photo-v1"/);
  assert.match(html, /--turn-dx:12\.25%/);
  assert.match(html, /--turn-dy:0%/);
  assert.match(html, /--turn-scale:1\.22/);
  assert.match(html, /--turn-rotate:-2deg/);
  assert.match(html, /--turn-yaw:-13\.48deg/);
  assert.match(html, /--turn-start-scale:1\.06/);
  assert.match(html, /--turn-mid-scale:1\.12/);
  assert.match(html, /--turn-turn-scale:1\.2/);
  assert.match(html, /--turn-origin-x:50%/);
  assert.match(html, /--turn-origin-y:82%/);
  assert.match(html, /--turn-duration:1400ms/);
  assert.match(html, /src="\.\/assets\/driving\/four-way-intersection-photo-v1\.webp"/);
});

test('marks the cruise img to settle only while an intro plays', () => {
  const html = render({ intro: INTRO });
  assert.match(html, /<img[^>]*data-turn-settle="true"[^>]*--settle-dx:-3\.06%/);
  assert.match(html, /--settle-duration:1400ms/);
  assert.doesNotMatch(render(), /data-turn-settle|--settle-/);
  assert.doesNotMatch(render({ intro: INTRO, motionEnabled: false }), /data-turn-settle|--settle-/);
});

test('omits the intro overlay when absent, null, or motion is disabled', () => {
  assert.doesNotMatch(render(), /turn-through-intro/);
  assert.doesNotMatch(render({ intro: null }), /turn-through-intro/);
  assert.doesNotMatch(render({ intro: INTRO, motionEnabled: false }), /turn-through-intro/);
});

test('renders byte-identical no-intro markup with and without the intro field', () => {
  assert.equal(render(), render({ intro: null }));
  assert.equal(render({ motionEnabled: false }), render({ intro: INTRO, motionEnabled: false }));
});

test('keeps the main camera frame attributes unchanged when the intro is present', () => {
  const camera = { startScale: 1, endScale: 1.08, originX: 52, originY: 86, durationMs: 2100 };
  const plain = render({ camera });
  const withIntro = render({ camera, intro: INTRO });
  const frameTag = /<span class="continuity-transition-image-frame"[^>]*>/;
  assert.equal(withIntro.match(frameTag)?.[0], plain.match(frameTag)?.[0]);
  assert.match(withIntro, /--continuity-end-scale:1\.08/);
});

test('rejects malformed turn-through intros', () => {
  assert.throws(() => render({ intro: 'zoom' }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, asset: '' } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, dx: Number.NaN } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, scale: 0 } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, yawDeg: 'right' } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, settleDx: Number.POSITIVE_INFINITY } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, startScale: 0 } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, originX: 120 } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, originY: undefined } }), /turn-through intro/i);
  assert.throws(() => render({ intro: { ...INTRO, durationMs: 60_000 } }), /turn-through intro/i);
});

test('scoped CSS animates the intro and hides it under reduced motion', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const section = css.slice(
    css.indexOf('/* continuity-transition:start */'),
    css.indexOf('/* continuity-transition:end */')
  );
  assert.match(section, /@keyframes turn-through-pan/);
  assert.match(section, /\.turn-through-intro[\s\S]*pointer-events:\s*none/);
  assert.match(section, /calc\(var\(--turn-dx, 0%\) \* -1\)/);
  assert.match(section, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.turn-through-intro[\s\S]*display:\s*none/);
});

test('scoped CSS drives the perspective turn, blur ramp, and cruise settle', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  const section = css.slice(
    css.indexOf('/* continuity-transition:start */'),
    css.indexOf('/* continuity-transition:end */')
  );
  assert.match(section, /@keyframes turn-through-pan[\s\S]*perspective\(/);
  assert.match(section, /rotateY\(var\(--turn-yaw/);
  assert.match(section, /scale\(var\(--turn-start-scale, 1\)\)/);
  assert.match(section, /\.turn-through-intro[\s\S]*transform-origin:\s*var\(--turn-origin-x, 50%\) var\(--turn-origin-y, 50%\)/);
  assert.match(section, /@keyframes turn-through-pan[\s\S]*filter:\s*blur\(2px\)/);
  assert.match(section, /@keyframes cruise-settle[\s\S]*translateX\(var\(--settle-dx/);
  assert.match(section, /img\[data-turn-settle="true"\][\s\S]*animation:\s*cruise-settle/);
  assert.match(
    section,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*img\[data-turn-settle="true"\][\s\S]*animation:\s*none/
  );
});
