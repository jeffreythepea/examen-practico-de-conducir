import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate } from '../src/i18n.js';
import { renderCollectionView } from '../src/collection-view.js';

function view(overrides = {}) {
  return renderCollectionView({
    locale: 'en',
    t: (key, variables) => translate('en', key, variables),
    accomplishments: [
      { id: 'audio-only', titleKey: 'accomplishment.audioOnly.title', descriptionKey: 'accomplishment.audioOnly.description', earned: true, achievedAt: Date.UTC(2026, 7, 10) },
      { id: 'one-listen', titleKey: 'accomplishment.noReplay.title', descriptionKey: 'accomplishment.noReplay.description', earned: false, achievedAt: null }
    ],
    themes: [
      { themeId: 'first-drive', titleKey: 'theme.first-drive.title', completed: true, achievedAt: Date.UTC(2026, 7, 9) },
      { themeId: 'roundabout-circuit', titleKey: 'theme.roundabout-circuit.title', completed: false, achievedAt: null }
    ],
    examiners: [
      { id: 'roger', nameKey: 'examiner.roger.name', encountered: true },
      { id: 'sarah', nameKey: 'examiner.sarah.name', encountered: false }
    ],
    personalBests: [
      { titleKey: 'theme.adaptive.title', averageResponseMs: 4200 }
    ],
    ...overrides
  });
}

test('renders each section with earned/locked and completed/not-completed markup', () => {
  const html = view();
  assert.match(html, /<h2 id="collection-title"[^>]*>Your collection</);
  assert.match(html, /class="collection-item earned"[\s\S]*?Audio-only pass/);
  assert.match(html, /class="collection-item locked"[\s\S]*?No-replay pass/);
  assert.match(html, /Not yet earned/);
  assert.match(html, /Earned/);
  assert.match(html, /class="collection-item earned"[\s\S]*?First drive/);
  assert.match(html, /class="collection-item locked"[\s\S]*?Roundabout circuit/);
  assert.match(html, /Not yet completed/);
  assert.match(html, /Roger[\s\S]*?Encountered/);
  assert.match(html, /Sara[\s\S]*?Not yet heard/);
  assert.match(html, /4\.2s average/);
});

test('renders an empty state when there are no personal bests yet', () => {
  const html = view({ personalBests: [] });
  assert.match(html, /No personal bests recorded yet/);
});

test('renders bilingual copy without inventing content', () => {
  const english = view();
  const spanish = view({
    locale: 'es',
    t: (key, variables) => translate('es', key, variables)
  });
  assert.match(english, /Accomplishments/);
  assert.match(spanish, /Logros/);
  assert.match(spanish, /Completada el/);
});

test('escapes injected localization text', () => {
  const html = renderCollectionView({
    locale: 'en',
    t: key => (key === 'collection.heading' ? `<script>alert(1)</script>` : translate('en', key)),
    accomplishments: [],
    themes: [],
    examiners: [],
    personalBests: []
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test('pure renderer contains no controller or persistence behavior', async () => {
  const source = await readFile(new URL('../src/collection-view.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|saveState|createSession|addEventListener|fetch\(/);
});
