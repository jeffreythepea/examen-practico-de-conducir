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
  'summary.replays','summary.hints','summary.weak','summary.noWeak','summary.milliseconds','status.audioReady',
  'surface.selectRoad','surface.selectSpace','surface.correctRoute','surface.correctControl','surface.correctSpace',
  'surface.targetSpace',
  'surface.selectionCorrect','surface.selectionWrong',
  'surface.error','surface.retry',
  'surface.centerWheel','surface.wheelPosition','surface.wheelFinalPosition','surface.wheelCenteredReference',
  'surface.operateSecureControls','surface.brakePedalHeld',
  'surface.handParkingBrake','surface.selectorPark','surface.sequenceIncorrect',
  'surface.secureProvisionalTitle','surface.secureProvisionalPromptDisclosure',
  'surface.secureProvisionalRevealDisclosure',
  'surface.yaris.locateInstruction','surface.yaris.operateInstruction','surface.yaris.equipmentVariant',
  'surface.yaris.fuelGauge','surface.yaris.temperatureGauge','surface.yaris.windowLock',
  'surface.yaris.frontDemist','surface.yaris.rearDemist','surface.yaris.highBeam',
  'surface.yaris.frontFog','surface.yaris.rearFog','surface.yaris.battery',
  'surface.yaris.bonnetRelease','surface.yaris.bootRelease','surface.yaris.engineOil','surface.yaris.coolant',
  'surface.yaris.state.on','surface.yaris.state.off','surface.yaris.state.open',
  'surface.yaris.state.closed','surface.yaris.state.locked','surface.yaris.state.unlocked',
  'surface.restricted.blockedAccess','surface.restricted.crosswalk','surface.restricted.markedRestriction',
  'surface.restricted.noParkingSign','surface.restricted.noStoppingSign'
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

test('manoeuvre instructions and restricted-location explanations are bilingual', () => {
  assert.equal(translate('en', 'surface.selectRoad'), 'Select this road');
  assert.equal(translate('es', 'surface.selectSpace'), 'Seleccione un espacio adecuado');
  assert.equal(translate('en', 'surface.correctRoute'), 'Correct route');
  assert.equal(translate('es', 'surface.correctControl'), 'Control correcto');
  assert.equal(translate('en', 'surface.restricted.blockedAccess'), 'Blocked access');
  assert.equal(translate('es', 'surface.restricted.crosswalk'), 'Paso de peatones');
  assert.equal(translate('en', 'surface.selectionCorrect'), 'Correct selection');
  assert.equal(translate('es', 'surface.selectionWrong'), 'Selección incorrecta');
  assert.equal(translate('en', 'surface.restricted.noParkingSign'), 'No-parking sign');
  assert.equal(translate('es', 'surface.restricted.noStoppingSign'), 'Señal de prohibido parar');
});

test('wheel and Yaris securing controls are bilingual', () => {
  assert.equal(translate('en', 'surface.centerWheel'), 'Centre the steering wheel');
  assert.equal(translate('es', 'surface.wheelPosition'), 'Posición del volante');
  assert.equal(translate('en', 'surface.wheelFinalPosition'), 'Your final wheel position');
  assert.equal(translate('es', 'surface.wheelFinalPosition'), 'Posición final del volante');
  assert.equal(translate('en', 'surface.wheelCenteredReference'), 'Centered correct reference');
  assert.equal(translate('es', 'surface.wheelCenteredReference'), 'Referencia correcta centrada');
  assert.equal(translate('en', 'surface.brakePedalHeld'), 'Brake pedal held');
  assert.equal(translate('es', 'surface.handParkingBrake'), 'Palanca manual del freno de estacionamiento');
  assert.equal(translate('en', 'surface.selectorPark'), 'Selector in P');
  assert.equal(translate('es', 'surface.sequenceIncorrect'), 'Orden incorrecto');
  assert.equal(translate('en', 'surface.secureProvisionalTitle'), 'Provisional sequence');
  assert.match(translate('en', 'surface.secureProvisionalPromptDisclosure'), /provisional automatic-hybrid reference.*confirmation or replacement.*manual test car/i);
  assert.doesNotMatch(translate('en', 'surface.secureProvisionalPromptDisclosure'), /parking|brake|selector|→/i);
  assert.match(translate('en', 'surface.secureProvisionalRevealDisclosure'), /provisional automatic-hybrid reference.*parking-brake.*selector-P.*confirmation or replacement.*manual test car/i);
  assert.equal(translate('es', 'surface.secureProvisionalTitle'), 'Secuencia provisional');
  assert.match(translate('es', 'surface.secureProvisionalPromptDisclosure'), /referencia provisional del híbrido automático.*confirmación o sustitución.*coche manual del examen/i);
  assert.doesNotMatch(translate('es', 'surface.secureProvisionalPromptDisclosure'), /freno|estacionamiento|selector|→/i);
  assert.match(translate('es', 'surface.secureProvisionalRevealDisclosure'), /referencia provisional del híbrido automático.*freno de estacionamiento.*selector P.*confirmación o sustitución.*coche manual del examen/i);
});

test('surface generation failure and retry copy are bilingual', () => {
  assert.equal(translate('en', 'surface.retry'), 'Try another layout');
  assert.equal(translate('es', 'surface.retry'), 'Probar otra disposición');
  assert.match(translate('en', 'surface.error'), /could not be prepared/i);
  assert.match(translate('es', 'surface.error'), /no se pudo preparar/i);
});

test('Yaris schematic targets, control states, and equipment ambiguity are bilingual', () => {
  assert.equal(translate('en', 'surface.yaris.battery'), '12 V battery beneath the rear-right seat');
  assert.equal(translate('es', 'surface.yaris.windowLock'), 'Bloqueo de las ventanillas de pasajeros');
  assert.equal(translate('en', 'surface.yaris.frontDemist'), 'Windscreen demister');
  assert.equal(translate('es', 'surface.yaris.rearFog'), 'Mando de la luz antiniebla trasera');
  assert.equal(translate('en', 'surface.yaris.state.locked'), 'locked');
  assert.equal(translate('es', 'surface.yaris.state.unlocked'), 'desbloqueado');
  assert.match(translate('en', 'surface.yaris.equipmentVariant'), /controls or displays may differ or be absent/i);
  assert.match(translate('es', 'surface.yaris.equipmentVariant'), /los mandos o las pantallas pueden ser diferentes o no estar instalados/i);
});
