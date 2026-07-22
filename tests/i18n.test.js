import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LOCALE, STRINGS, SUPPORTED_LOCALES, translate } from '../src/i18n.js';
import { readFile } from 'node:fs/promises';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));

const requiredKeys = [
  'app.title','app.subtitle','app.skip','setting.language','phase.driving','phase.precheck','phase.mixed',
  'setting.speed','setting.hint','hint.available','hint.shown','hint.unavailable','setting.timing',
  'timing.off','timing.on','setting.length','length.short','length.medium','length.all',
  'setting.feedbackSounds','feedbackSounds.on','feedbackSounds.off',
  'setting.phase','setting.mode','mode.recommended','mode.free','action.start','action.replay','action.showSpanish','action.continue','action.retry','action.newSession',
  'screen.setup','screen.loading','screen.prompt','screen.results','prompt.listen','prompt.progress','prompt.timer',
  'reveal.spanish','reveal.meaning','reveal.expected','reveal.vehicle','result.unaided','result.assisted','result.incorrect',
  'miss.hearing','miss.meaning','miss.mapping','miss.target','miss.accidental','miss.other',
  'miss.title','miss.optional','settings.title','data.export','data.import','data.importConfirm',
  'data.management','data.reset','data.resetConfirm','error.audio','error.import','error.recovery','error.init','summary.unaidedPercent','summary.averageTime',
  'offline.title','offline.onlineOnly','offline.unsupported','offline.download','offline.resumeDownload',
  'offline.downloading','offline.ready','offline.updateReady','offline.applyUpdate','offline.redownload',
  'offline.failedRetained','offline.installTitle','offline.installSafari','offline.transferProgress',
  'offline.cancel','offline.bytes',
  'resume.title','resume.progress','resume.action','resume.discard','resume.recovery',
  'summary.replays','summary.hints','summary.weak','summary.noWeak','summary.milliseconds','status.audioReady',
  'surface.selectRoad','surface.selectSpace','surface.correctRoute','surface.correctControl','surface.correctSpace',
  'surface.targetSpace',
  'surface.selectionCorrect','surface.selectionWrong',
  'surface.error','surface.retry',
  'surface.centerWheel','surface.wheelPosition','surface.wheelFinalPosition','surface.wheelCenteredReference',
  'surface.operateSecureControls','surface.engineStop','surface.handParkingBrake',
  'surface.manualFirst','surface.manualReverse','surface.slopeUphill','surface.slopeDownhill',
  'surface.checkSecureAnswer',
  'surface.secureProvisionalTitle','surface.secureProvisionalPromptDisclosure',
  'surface.secureProvisionalRevealDisclosure',
  'surface.yaris.locateInstruction','surface.yaris.operateInstruction','surface.yaris.equipmentVariant',
  'surface.yaris.fuelGauge','surface.yaris.temperatureGauge','surface.yaris.windowLock',
  'surface.yaris.frontDemist','surface.yaris.rearDemist','surface.yaris.highBeam',
  'surface.yaris.frontFog','surface.yaris.rearFog','surface.yaris.battery',
  'surface.yaris.bonnetRelease','surface.yaris.bootRelease','surface.yaris.engineOil','surface.yaris.coolant',
  'surface.yaris.brakeFluid','surface.yaris.washerFluid','surface.yaris.positionLights',
  'surface.yaris.dippedHeadlights','surface.yaris.indicator',
  'surface.yaris.state.on','surface.yaris.state.off','surface.yaris.state.open',
  'surface.yaris.state.closed','surface.yaris.state.locked','surface.yaris.state.unlocked',
  'surface.restricted.blockedAccess','surface.restricted.crosswalk','surface.restricted.markedRestriction',
  'surface.restricted.noParkingSign','surface.restricted.noStoppingSign'
  ,'screen.readiness','screen.lesson','readiness.intro',
  'readiness.state.ready','readiness.state.in-progress','readiness.state.needs-practice','readiness.state.not-tested',
  'readiness.filter.phase','readiness.filter.state','readiness.filter.title','readiness.filter.allPhases','readiness.filter.allStates',
  'readiness.group.driving','readiness.group.precheck',
  'readiness.evidence.recent','readiness.evidence.lastPracticed','readiness.evidence.averageResponse',
  'readiness.evidence.replays','readiness.evidence.hints','readiness.evidence.openFlags','readiness.evidence.nextDue',
  'readiness.evidence.noData','readiness.evidence.milliseconds',
  'readiness.outcome.unaided','readiness.outcome.assisted','readiness.outcome.incorrect',
  'readiness.practice.title',
  'readiness.action.startNeedsPractice','readiness.action.startNotTested','readiness.action.startLessonFlags',
  'readiness.action.startNotReady','readiness.action.startCommandPractice','readiness.action.close',
  'readiness.action.openFlag','readiness.action.editFlag','readiness.action.saveFlag','readiness.action.resolveFlag','readiness.action.reopenFlag',
  'readiness.flag.editorTitle','readiness.flag.editTitle','readiness.flag.category','readiness.flag.note',
  'readiness.flag.status.open','readiness.flag.status.resolved',
  'readiness.empty.practice'
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

test('readiness and lesson-note copy is complete and bilingual', () => {
  assert.equal(translate('en', 'screen.readiness'), 'Readiness');
  assert.equal(translate('es', 'screen.readiness'), 'Preparación');
  assert.equal(translate('en', 'readiness.action.startCommandPractice'), 'Practice this command');
  assert.equal(translate('es', 'readiness.action.startCommandPractice'), 'Practicar esta orden');
  assert.equal(translate('en', 'readiness.filter.allStates'), 'All states');
  assert.equal(translate('es', 'readiness.filter.allStates'), 'Todos los estados');
  assert.equal(translate('en', 'readiness.outcome.incorrect'), 'Incorrect');
  assert.equal(translate('es', 'readiness.outcome.incorrect'), 'Incorrecto');
});

test('written-Spanish policy labels state when text appears and how it scores', () => {
  assert.equal(translate('en', 'hint.available'), 'Hidden until you tap Show Spanish');
  assert.equal(translate('es', 'hint.available'), 'Oculto hasta pulsar Mostrar español');
  assert.equal(translate('en', 'hint.shown'), 'Shown automatically (answers count as assisted)');
  assert.equal(translate('es', 'hint.shown'), 'Visible automáticamente (las respuestas cuentan como asistidas)');
  assert.equal(translate('en', 'hint.unavailable'), 'No Spanish text or Show Spanish button');
  assert.equal(translate('es', 'hint.unavailable'), 'Sin texto en español ni botón Mostrar español');
});

test('practice-order labels use plain language', () => {
  assert.equal(translate('en', 'mode.recommended'), 'Recommended practice');
  assert.equal(translate('es', 'mode.recommended'), 'Práctica recomendada');
});

test('session lengths state exact command counts in both locales', () => {
  assert.deepEqual(
    ['short', 'medium', 'all'].map(length => translate('en', `length.${length}`)),
    ['5 commands', '10 commands', '15 commands']
  );
  assert.deepEqual(
    ['short', 'medium', 'all'].map(length => translate('es', `length.${length}`)),
    ['5 preguntas', '10 preguntas', '15 preguntas']
  );
});

test('feedback-sound setting is explicit and bilingual', () => {
  assert.equal(translate('en', 'setting.feedbackSounds'), 'Feedback sounds');
  assert.equal(translate('en', 'feedbackSounds.on'), 'On');
  assert.equal(translate('en', 'feedbackSounds.off'), 'Off');
  assert.equal(translate('es', 'setting.feedbackSounds'), 'Sonidos de respuesta');
  assert.equal(translate('es', 'feedbackSounds.on'), 'Activados');
  assert.equal(translate('es', 'feedbackSounds.off'), 'Desactivados');
});

test('headlight labels name the controls without redundant symbol wording', () => {
  assert.equal(translate('en', 'surface.yaris.positionLights'), 'Position lights');
  assert.equal(translate('en', 'surface.yaris.dippedHeadlights'), 'Dipped headlights');
  assert.equal(translate('es', 'surface.yaris.positionLights'), 'Luces de posición');
  assert.equal(translate('es', 'surface.yaris.dippedHeadlights'), 'Luces de cruce');
});

test('the setup Settings disclosure control is bilingual', () => {
  assert.equal(translate('en', 'settings.title'), 'Settings');
  assert.equal(translate('es', 'settings.title'), 'Ajustes');
});

test('the reveal heading describes a generic manual car without obsolete setup-warning copy', () => {
  assert.doesNotMatch(translate('en', 'reveal.vehicle'), /toyota|yaris|hybrid/i);
  assert.doesNotMatch(translate('es', 'reveal.vehicle'), /toyota|yaris|h[ií]brido/i);
  assert.match(translate('en', 'reveal.vehicle'), /generic.*manual|manual.*generic/i);
  assert.match(translate('es', 'reveal.vehicle'), /gen[eé]rico.*manual|manual.*gen[eé]rico/i);
  assert.equal('warning.source' in STRINGS.en, false);
  assert.equal('warning.vehicle' in STRINGS.en, false);
  assert.equal('warning.source' in STRINGS.es, false);
  assert.equal('warning.vehicle' in STRINGS.es, false);
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

test('wheel and generic manual securing controls are bilingual', () => {
  assert.equal(translate('en', 'surface.centerWheel'), 'Centre the steering wheel');
  assert.equal(translate('es', 'surface.wheelPosition'), 'Posición del volante');
  assert.equal(translate('en', 'surface.wheelFinalPosition'), 'Your final wheel position');
  assert.equal(translate('es', 'surface.wheelFinalPosition'), 'Posición final del volante');
  assert.equal(translate('en', 'surface.wheelCenteredReference'), 'Centered correct reference');
  assert.equal(translate('es', 'surface.wheelCenteredReference'), 'Referencia correcta centrada');
  assert.equal(translate('en', 'surface.engineStop'), 'Stop engine');
  assert.equal(translate('es', 'surface.handParkingBrake'), 'Palanca manual del freno de estacionamiento');
  assert.equal(translate('en', 'surface.manualFirst'), 'First gear');
  assert.equal(translate('en', 'surface.checkSecureAnswer'), 'Check answer');
  assert.equal(translate('es', 'surface.checkSecureAnswer'), 'Comprobar respuesta');
  assert.equal(translate('es', 'surface.manualReverse'), 'Marcha atrás');
  assert.equal(translate('en', 'surface.secureProvisionalTitle'), 'Generic manual procedure');
  assert.match(translate('en', 'surface.secureProvisionalPromptDisclosure'), /generic manual-car practice.*actual test car/i);
  assert.doesNotMatch(translate('en', 'surface.secureProvisionalPromptDisclosure'), /automatic|selector P/i);
  assert.match(translate('en', 'surface.secureProvisionalRevealDisclosure'), /Article 92.*stop the engine.*parking brake.*first gear uphill.*reverse downhill/i);
  assert.equal(translate('es', 'surface.secureProvisionalTitle'), 'Procedimiento genérico para coche manual');
  assert.match(translate('es', 'surface.secureProvisionalPromptDisclosure'), /práctica genérica.*coche manual.*vehículo real/i);
  assert.match(translate('es', 'surface.secureProvisionalRevealDisclosure'), /Artículo 92.*detener el motor.*freno de estacionamiento.*primera cuesta arriba.*marcha atrás cuesta abajo/i);
});

test('surface generation failure and retry copy are bilingual', () => {
  assert.equal(translate('en', 'surface.retry'), 'Try another layout');
  assert.equal(translate('es', 'surface.retry'), 'Probar otra disposición');
  assert.match(translate('en', 'surface.error'), /could not be prepared/i);
  assert.match(translate('es', 'surface.error'), /no se pudo preparar/i);
});

test('Yaris schematic targets, control states, and equipment ambiguity are bilingual', () => {
  assert.equal(translate('en', 'surface.yaris.battery'), 'Conventional 12 V battery under the bonnet');
  assert.equal(translate('es', 'surface.yaris.windowLock'), 'Bloqueo de las ventanillas de pasajeros');
  assert.equal(translate('en', 'surface.yaris.frontDemist'), 'Windscreen demister');
  assert.equal(translate('es', 'surface.yaris.rearFog'), 'Mando de la luz antiniebla trasera');
  assert.equal(translate('en', 'surface.yaris.state.locked'), 'locked');
  assert.equal(translate('es', 'surface.yaris.state.unlocked'), 'desbloqueado');
  assert.match(translate('en', 'surface.yaris.equipmentVariant'), /controls or displays may differ or be absent/i);
  assert.match(translate('es', 'surface.yaris.equipmentVariant'), /los mandos o las pantallas pueden ser diferentes o no estar instalados/i);
  assert.equal(translate('en', 'surface.precheck.illustrative'), 'Illustrative vehicle image; the exact layout may differ.');
  assert.equal(translate('es', 'surface.precheck.illustrative'), 'Imagen ilustrativa del vehículo; la disposición exacta puede variar.');
  assert.equal(translate('en', 'surface.precheck.scene.engineBay'), 'Generic engine compartment');
});
