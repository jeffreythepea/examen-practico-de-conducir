import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { translate } from '../src/i18n.js';
import { readinessTargetAvailability, renderReadinessView } from '../src/readiness-view.js';

const NOW = Date.UTC(2026, 6, 22, 12);

const commands = Object.freeze([
  Object.freeze({
    id: 'c-der',
    actionId: 'turn-right',
    phase: 'driving',
    acceptedResult: 'turn-right',
    phrasings: Object.freeze([
      Object.freeze({ es: 'Gire a la derecha', en: 'turn right' })
    ])
  }),
  Object.freeze({
    id: 'c-pre-frenos',
    actionId: 'locate-brake-fluid',
    phase: 'precheck',
    acceptedResult: 'locate-brake-fluid',
    phrasings: Object.freeze([
      Object.freeze({ es: 'Localice el líquido de frenos', en: 'locate the brake fluid' })
    ])
  }),
  Object.freeze({
    id: 'c-ready',
    actionId: 'continue-forward',
    phase: 'driving',
    acceptedResult: 'continue-forward',
    phrasings: Object.freeze([
      Object.freeze({ es: 'Siga recto', en: 'continue straight' })
    ])
  }),
  Object.freeze({
    id: 'c-new',
    actionId: 'turn-left',
    phase: 'driving',
    acceptedResult: 'turn-left',
    phrasings: Object.freeze([
      Object.freeze({ es: 'Gire a la izquierda', en: 'turn left' })
    ])
  })
]);

const readiness = Object.freeze([
  Object.freeze({
    commandId: 'c-der', actionId: 'turn-right', phase: 'driving', state: 'needs-practice',
    recentOutcomes: Object.freeze(['incorrect', 'unaided']),
    lastPracticedAt: NOW - 86_400_000,
    averageResponseMs: 1300,
    replayCount: 2,
    hintCount: 1,
    openLessonFlagCount: 1,
    nextDueAt: NOW - 1
  }),
  Object.freeze({
    commandId: 'c-pre-frenos', actionId: 'locate-brake-fluid', phase: 'precheck', state: 'in-progress',
    recentOutcomes: Object.freeze(['unaided']),
    lastPracticedAt: NOW - 172_800_000,
    averageResponseMs: 2100,
    replayCount: 0,
    hintCount: 0,
    openLessonFlagCount: 0,
    nextDueAt: NOW + 86_400_000
  }),
  Object.freeze({
    commandId: 'c-ready', actionId: 'continue-forward', phase: 'driving', state: 'ready',
    recentOutcomes: Object.freeze(['unaided', 'unaided']),
    lastPracticedAt: NOW,
    averageResponseMs: 900,
    replayCount: 0,
    hintCount: 0,
    openLessonFlagCount: 0,
    nextDueAt: null
  }),
  Object.freeze({
    commandId: 'c-new', actionId: 'turn-left', phase: 'driving', state: 'not-tested',
    recentOutcomes: Object.freeze([]),
    lastPracticedAt: null,
    averageResponseMs: null,
    replayCount: 0,
    hintCount: 0,
    openLessonFlagCount: 0,
    nextDueAt: null
  })
]);

const lessonFlags = Object.freeze([
  Object.freeze({
    id: 'flag-1', commandId: 'c-der', category: 'wording',
    note: 'Ask whether the shorter wording is common.', status: 'open',
    createdAt: NOW - 10, updatedAt: NOW - 5
  }),
  Object.freeze({
    id: 'flag-2', commandId: 'c-pre-frenos', category: 'vehicle-control',
    note: 'Confirmed in the lesson car.', status: 'resolved',
    createdAt: NOW - 20, updatedAt: NOW - 2
  })
]);

function render(overrides = {}) {
  const locale = overrides.locale ?? 'en';
  return renderReadinessView({
    locale,
    t: (key, variables) => translate(locale, key, variables),
    commands,
    readiness,
    lessonFlags,
    filters: { phase: 'mixed', state: 'all', ...(overrides.filters ?? {}) },
    now: NOW,
    ...overrides,
    locale,
    t: (key, variables) => translate(locale, key, variables)
  });
}

test('renders every controller integration action', () => {
  const html = render({
    filters: {
      phase: 'mixed', state: 'all',
      editor: { commandId: 'c-der', flagId: 'flag-1', category: 'wording', note: 'Check this.' }
    }
  });
  for (const action of [
    'close-readiness', 'set-readiness-phase', 'set-readiness-state',
    'start-readiness-practice', 'start-command-practice', 'open-lesson-flag',
    'save-lesson-flag', 'resolve-lesson-flag', 'reopen-lesson-flag'
  ]) {
    assert.match(html, new RegExp(`data-action="${action}"`), `missing ${action}`);
  }
  assert.match(html, /id="readiness-title"[^>]*data-screen-focus[^>]*tabindex="-1"/);
});

test('renders labelled phase and state filters with supplied selections', () => {
  const html = render({ filters: { phase: 'precheck', state: 'in-progress' } });
  assert.match(html, /<label[^>]*for="readiness-phase"/);
  assert.match(html, /<select[^>]*id="readiness-phase"[^>]*data-action="set-readiness-phase"/);
  assert.match(html, /value="precheck" selected/);
  assert.match(html, /<label[^>]*for="readiness-state"/);
  assert.match(html, /<select[^>]*id="readiness-state"[^>]*data-action="set-readiness-state"/);
  assert.match(html, /value="in-progress" selected/);
});

test('groups commands by phase and displays all four readiness states', () => {
  const html = render();
  assert.match(html, />Driving</);
  assert.match(html, />Prechecks</);
  assert.match(html, />Ready</);
  assert.match(html, />In progress</);
  assert.match(html, />Needs practice</);
  assert.match(html, />Not tested</);
  assert.match(html, /Gire a la derecha/);
  assert.match(html, /turn right/);
});

test('renders every evidence field and recent outcomes as text', () => {
  const html = render();
  for (const label of [
    'Recent outcomes', 'Last practiced', 'Average response time', 'Audio replays',
    'Written-Spanish hints', 'Open lesson flags', 'Next due'
  ]) assert.match(html, new RegExp(label));
  assert.match(html, /Incorrect/);
  assert.match(html, /Correct from audio/);
  assert.match(html, /1,300 ms/);
  assert.match(html, /data-lesson-flag-count="1"/);
});

test('renders the supported targeted-practice choices and stable command IDs', () => {
  const html = render();
  for (const target of ['needs-practice', 'not-tested', 'lesson-flags', 'not-ready']) {
    assert.match(html, new RegExp(`data-target-kind="${target}"`));
  }
  assert.match(html, /data-action="start-command-practice"[^>]*data-command-id="c-der"/);
  assert.match(html, /data-action="open-lesson-flag"[^>]*data-command-id="c-der"/);
});

test('disables targeted practice choices whose phase-filtered pool is empty', () => {
  const html = render({
    lessonFlags: lessonFlags.map(flag => ({ ...flag, status: 'resolved' })),
    filters: { phase: 'precheck', state: 'all', flag: 'all' }
  });

  assert.match(html, /data-target-kind="needs-practice"[^>]*disabled/);
  assert.match(html, /data-target-kind="not-tested"[^>]*disabled/);
  assert.match(html, /data-target-kind="lesson-flags"[^>]*disabled/);
  assert.doesNotMatch(html, /data-target-kind="not-ready"[^>]*disabled/);
});

test('computes targeted-practice availability from readiness and open flags', () => {
  assert.deepEqual(
    readinessTargetAvailability(commands, readiness, lessonFlags, 'driving'),
    {
      'needs-practice': 1,
      'not-tested': 1,
      'lesson-flags': 1,
      'not-ready': 2
    }
  );
});

test('filters commands by lesson-note status', () => {
  const openHtml = render({ filters: { phase: 'mixed', state: 'all', flag: 'open' } });
  assert.match(openHtml, /Gire a la derecha/);
  assert.doesNotMatch(openHtml, /Localice el líquido de frenos/);

  const resolvedHtml = render({ filters: { phase: 'mixed', state: 'all', flag: 'resolved' } });
  assert.match(resolvedHtml, /Localice el líquido de frenos/);
  assert.doesNotMatch(resolvedHtml, /Gire a la derecha/);
});

test('renders lesson flags and an associated editor with lifecycle controls', () => {
  const html = render({
    filters: {
      phase: 'mixed', state: 'all',
      editor: {
        commandId: 'c-der', flagId: 'flag-1', category: 'wording',
        note: 'Ask the instructor.', errorKey: 'readiness.flag.error.noteEmpty'
      }
    }
  });
  assert.match(html, /Ask whether the shorter wording is common/);
  assert.match(html, /Confirmed in the lesson car/);
  assert.match(html, /for="lesson-flag-category"/);
  assert.match(html, /for="lesson-flag-note"/);
  assert.match(html, /name="commandId" value="c-der"/);
  assert.match(html, /name="flagId" value="flag-1"/);
  assert.match(html, /value="wording" selected/);
  assert.match(html, /Ask the instructor/);
  assert.match(html, /role="alert"/);
  assert.match(html, /The note cannot be empty/);
  assert.doesNotMatch(html, /maxlength="280"/);
  assert.match(html, /data-command-id="c-der"/);
  assert.match(html, /data-flag-id="flag-1"/);
});

test('escapes dynamic text and attribute values without deleting content', () => {
  const unsafeCommands = [{
    id: `c-'"<unsafe>`, actionId: 'turn-right', phase: 'driving', acceptedResult: 'turn-right',
    phrasings: [{ es: `<script>alert('es')</script>`, en: `turn & "go"` }]
  }];
  const unsafeReadiness = [{ ...readiness[0], commandId: `c-'"<unsafe>` }];
  const unsafeFlags = [{ ...lessonFlags[0], commandId: `c-'"<unsafe>`, note: `<img src=x onerror='bad'>` }];
  const html = render({ commands: unsafeCommands, readiness: unsafeReadiness, lessonFlags: unsafeFlags });
  assert.doesNotMatch(html, /<script>|<img/);
  assert.match(html, /&lt;script&gt;alert\(&#039;es&#039;\)&lt;\/script&gt;/);
  assert.match(html, /turn &amp; &quot;go&quot;/);
  assert.match(html, /data-command-id="c-&#039;&quot;&lt;unsafe&gt;"/);
  assert.match(html, /&lt;img src=x onerror=&#039;bad&#039;&gt;/);
});

test('renders a useful empty state after filters remove every command', () => {
  const html = render({ filters: { phase: 'precheck', state: 'ready' } });
  assert.match(html, /No commands match the selected filters/);
});

test('renders Spanish interface copy while preserving Spanish command language', () => {
  const html = render({ locale: 'es' });
  assert.match(html, /Preparación/);
  assert.match(html, /Conducción/);
  assert.match(html, /Necesita práctica/);
  assert.match(html, /Gire a la derecha/);
  assert.match(html, /Practicar esta orden/);
});

test('does not mutate supplied arrays, records, or filter state', () => {
  const filters = Object.freeze({ phase: 'mixed', state: 'all' });
  const snapshot = JSON.stringify({ commands, readiness, lessonFlags, filters });
  renderReadinessView({ locale: 'en', t: (key, variables) => translate('en', key, variables), commands, readiness, lessonFlags, filters, now: NOW });
  assert.equal(JSON.stringify({ commands, readiness, lessonFlags, filters }), snapshot);
});

test('readiness CSS is scoped, touch-friendly, focus-visible, and responsive', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.readiness-screen\s*\{/);
  assert.match(css, /\.readiness-(?:screen|filters|action)[\s\S]*min-height:\s*44px/);
  assert.match(css, /\.readiness-screen[\s\S]*:focus-visible/);
  assert.match(css, /@media[^\{]*\(max-width:\s*700px\)/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
});
