import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { translate } from '../src/i18n.js';
import { EXAMINERS, selectTodaysExaminer } from '../src/examiners.js';
import { SESSION_PRESET_IDS } from '../src/session-presets.js';
import { THEME_IDS } from '../src/session-themes.js';
import { renderSoloSetupView } from '../src/solo-setup-view.js';

const DATE_PARTS = Object.freeze({ year: 2026, month: 8, day: 6 });

function render(locale = 'en', overrides = {}) {
  return renderSoloSetupView({
    locale,
    t: (key, variables) => translate(locale, key, variables),
    selectedPresetId: 'practice',
    selectedExaminerChoiceId: 'today',
    dateParts: DATE_PARTS,
    ...overrides
  });
}

test('renders semantic radio groups for all experience modes, examiner choices, and themes', () => {
  const html = render();
  assert.equal((html.match(/<fieldset/g) ?? []).length, 3);
  assert.match(html, /<legend[^>]*>Choose an experience</);
  assert.match(html, /<legend[^>]*>Choose your examiner</);

  for (const id of SESSION_PRESET_IDS) {
    assert.match(html, new RegExp(`type="radio"[^>]*name="experience-mode"[^>]*value="${id}"`));
    assert.match(html, new RegExp(`data-action="select-experience-mode"[^>]*data-experience-mode="${id}"`));
    assert.match(html, new RegExp(`<label[^>]*for="experience-mode-${id}"[\\s\\S]*?id="experience-mode-${id}"`));
  }
  for (const id of ['today', 'mixed', ...EXAMINERS.map(examiner => examiner.id)]) {
    assert.match(html, new RegExp(`type="radio"[^>]*name="examiner-choice"[^>]*value="${id}"`));
    assert.match(html, new RegExp(`data-action="select-examiner"[^>]*data-examiner-choice="${id}"`));
    assert.match(html, new RegExp(`<label[^>]*for="examiner-choice-${id}"[\\s\\S]*?id="examiner-choice-${id}"`));
  }
  for (const id of ['adaptive', ...THEME_IDS]) {
    assert.match(html, new RegExp(`type="radio"[^>]*name="theme-choice"[^>]*value="${id}"`));
    assert.match(html, new RegExp(`data-action="select-theme"[^>]*data-theme="${id}"`));
  }
});

test('marks exactly the supplied choices and exposes a visible selected cue', () => {
  const html = render('en', {
    selectedPresetId: 'mock',
    selectedExaminerChoiceId: 'matilda',
    selectedThemeId: 'full-mock'
  });
  assert.equal((html.match(/ checked/g) ?? []).length, 3);
  assert.match(html, /value="mock"[^>]* checked/);
  assert.match(html, /value="matilda"[^>]* checked/);
  assert.match(html, /value="full-mock"[^>]* checked/);
  assert.equal((html.match(/>Selected</g) ?? []).length, 3);
});

test('maps the null domain theme to an Adaptive practice radio choice', () => {
  const html = render();
  assert.match(html, /value="adaptive"[^>]* checked/);
  assert.match(html, /Adaptive practice/);
});

test('Today identifies the deterministic examiner for the injected local date', () => {
  const today = selectTodaysExaminer(DATE_PARTS);
  const html = render();
  assert.match(html, /Today’s examiner/);
  assert.match(html, new RegExp(`Changes each day: ${today.displayName}`));
});

test('renders complete English and Spanish copy without inventing examiner biography', () => {
  const english = render('en');
  const spanish = render('es');
  for (const text of ['Learn', 'Practice', 'Mock test', 'Mixed examiners', 'Simulated format']) {
    assert.match(english, new RegExp(text));
  }
  for (const text of ['Aprender', 'Practicar', 'Simulacro', 'Examinadores variados', 'Formato simulado']) {
    assert.match(spanish, new RegExp(text));
  }
  for (const examiner of EXAMINERS) {
    assert.match(english, new RegExp(examiner.displayName));
    assert.match(spanish, new RegExp(examiner.displayName));
  }
  assert.match(english, /Roundabout circuit/);
  assert.match(spanish, /Circuito de glorietas/);
  assert.doesNotMatch(`${english}${spanish}`, /asturian|asturiano|madrid|sevilla|strict|estricto/i);
});

test('escapes all injected localization and registry text in markup and attributes', () => {
  const html = renderSoloSetupView({
    locale: 'en',
    t: (key, variables) => key === 'experience.heading'
      ? `<script data-bad='yes'>& "unsafe"</script>`
      : translate('en', key, variables),
    selectedPresetId: 'practice',
    selectedExaminerChoiceId: 'today',
    dateParts: DATE_PARTS
  });
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /&lt;script data-bad=&#39;yes&#39;&gt;&amp; &quot;unsafe&quot;&lt;\/script&gt;/);
});

test('rejects unsupported locale, choices, date, and translation function', () => {
  assert.throws(() => render('fr'), /locale/i);
  assert.throws(() => render('en', { selectedPresetId: 'arcade' }), /experience mode/i);
  assert.throws(() => render('en', { selectedExaminerChoiceId: 'mystery' }), /examiner choice/i);
  assert.throws(() => render('en', { selectedThemeId: 'mystery' }), /theme/i);
  assert.throws(() => render('en', { dateParts: { year: 2026, month: 2, day: 30 } }), /calendar date/i);
  assert.throws(() => renderSoloSetupView({ locale: 'en' }), /translation function/i);
});

test('pure renderer contains no controller or persistence behavior', async () => {
  const source = await readFile(new URL('../src/solo-setup-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|saveState|createSession|addEventListener|fetch\(/);
});
