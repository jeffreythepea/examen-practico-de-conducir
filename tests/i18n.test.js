import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, STRINGS, SUPPORTED_LOCALES, translate } from '../src/i18n.js';
import { readFile } from 'node:fs/promises';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));

const requiredKeys = [
  'app.title','app.subtitle','app.skip','setting.language','phase.driving','phase.precheck','phase.mixed',
  'setting.speed','setting.hint','hint.available','hint.shown','hint.unavailable','setting.timing',
  'timing.off','timing.on','setting.length','length.short','length.medium','length.all',
  'setting.phase','setting.mode','mode.weak','mode.free','action.start','action.replay','action.showSpanish','action.continue','action.retry','action.newSession',
  'screen.setup','screen.loading','screen.prompt','screen.results','prompt.listen','prompt.progress','prompt.timer',
  'reveal.spanish','reveal.meaning','reveal.expected','reveal.vehicle','result.unaided','result.assisted','result.incorrect',
  'miss.hearing','miss.meaning','miss.mapping','miss.target','miss.accidental','miss.other',
  'miss.title','miss.optional','warning.source','warning.vehicle','data.export','data.import','data.importConfirm',
  'data.management','data.reset','data.resetConfirm','error.audio','error.import','error.recovery','error.init','summary.unaidedPercent','summary.averageTime',
  'summary.replays','summary.hints','summary.weak','summary.noWeak','summary.milliseconds','status.audioReady'
];

test('English and Spanish dictionaries are complete and symmetric', () => {
  assert.deepEqual(SUPPORTED_LOCALES, ['en', 'es']);
  assert.equal(DEFAULT_LOCALE, 'en');
  const enKeys = Object.keys(STRINGS.en).sort();
  const esKeys = Object.keys(STRINGS.es).sort();
  assert.deepEqual(enKeys, esKeys);
  for (const key of requiredKeys) assert.ok(enKeys.includes(key), `missing ${key}`);
});

test('every stable normalized action/result has a distinct English and Spanish label', () => {
  for (const command of commands) {
    const key = `actionResult.${command.acceptedResult}`;
    const en = translate('en', key);
    const es = translate('es', key);
    assert.ok(en, `missing English ${key}`);
    assert.ok(es, `missing Spanish ${key}`);
    assert.notEqual(en.toLocaleLowerCase('en'), command.phrasings[0].en.toLocaleLowerCase('en'), `${key} repeats the command meaning`);
    assert.notEqual(es.toLocaleLowerCase('es'), command.phrasings[0].es.toLocaleLowerCase('es'), `${key} repeats the Spanish command`);
  }
});

test('translation validates locale, key, and interpolation variables', () => {
  assert.equal(translate('en', 'phase.driving'), 'Driving');
  assert.equal(translate('es', 'phase.driving'), 'Conducción');
  assert.equal(translate('en', 'summary.count', { count: 3 }), '3 commands');
  assert.throws(() => translate('fr', 'phase.driving'), /Unsupported locale: fr/);
  assert.throws(() => translate('en', 'missing'), /Missing translation: en.missing/);
  assert.throws(() => translate('en', 'summary.count'), /Missing variable: count/);
});

test('backup confirmation and import failure copy are localized', () => {
  assert.equal(
    translate('en', 'data.importConfirm'),
    'Replace current settings and progress with this backup?'
  );
  assert.equal(
    translate('es', 'error.import'),
    'No se pudo importar esta copia. Tus datos actuales no se han modificado.'
  );
  assert.match(translate('en', 'data.resetConfirm'), /settings, mastery, and practice history/);
  assert.match(translate('es', 'data.resetConfirm'), /ajustes, el dominio y el historial de práctica/);
});

test('interface dictionaries do not duplicate Spanish command content', () => {
  const source = JSON.stringify(STRINGS);
  assert.doesNotMatch(source, /Gire a la derecha cuando pueda/);
  assert.doesNotMatch(source, /Tome la primera salida/);
});
