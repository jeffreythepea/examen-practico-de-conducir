import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { commandById, commandsForPhase, validateCatalog } from '../src/catalog.js';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));

test('catalog contains the complete safe atomic command inventory', () => {
  assert.doesNotThrow(() => validateCatalog(commands));
  assert.equal(commands.length, 36);
  assert.equal(commandsForPhase(commands, 'driving').length, 18);
  assert.equal(commandsForPhase(commands, 'precheck').length, 18);
  assert.equal(commandsForPhase(commands, 'mixed').length, 36);
  assert.equal(new Set(commands.map(command => command.id)).size, 36);
  assert.equal(new Set(commands.map(command => command.actionId)).size, 36);
  assert.equal(commands.some(command => command.id === 'c-pre-deposito-b'), false);
});

test('expanded inventory keeps six source-labeled atomic additions', () => {
  const additions = new Map([
    ['c-recto', ['continue-forward', 'driving']],
    ['c-intermitente', ['operate-indicator', 'driving']],
    ['c-pre-frenos', ['locate-brake-fluid', 'precheck']],
    ['c-pre-lavaparabrisas', ['locate-washer-fluid', 'precheck']],
    ['c-pre-posicion', ['position-lights', 'precheck']],
    ['c-pre-cruce', ['dipped-headlights', 'precheck']]
  ]);

  for (const [id, [actionId, phase]] of additions) {
    const command = commandById(commands, id);
    assert.equal(command.actionId, actionId);
    assert.equal(command.acceptedResult, actionId);
    assert.equal(command.phase, phase);
    assert.match(command.phrasings[0].sourceText, /\S/);
  }
});

test('selected high-value commands include one traceable supplementary phrasing', () => {
  const expandedIds = [
    'c-der', 'c-izq', 'c-sentido',
    'c-rot1', 'c-rot2', 'c-rot3', 'c-rot4', 'c-rot5',
    'c-parada', 'c-est', 'c-inmov', 'c-final',
    'c-pre-bateria', 'c-pre-aceite', 'c-pre-refrigerante',
    'c-pre-capo', 'c-pre-combustible', 'c-pre-temperatura'
  ];

  for (const id of expandedIds) {
    const command = commandById(commands, id);
    assert.equal(command.phrasings.length, 2, `${id} should have one alternative`);
    const alternative = command.phrasings[1];
    assert.equal(alternative.id, `${id}-supplementary-1`);
    assert.equal(alternative.validation, 'supplementary-composite');
    assert.equal(alternative.sourceDocument, 'spanish_driving_exam_commands.json');
    assert.match(String(alternative.sourcePage), /composite/);
    assert.match(alternative.sourceText, /\S/);
  }
});

test('Fermín Spanish is authoritative for brake fluid while washer fluid remains separate', () => {
  const brake = commandById(commands, 'c-pre-frenos');
  const washer = commandById(commands, 'c-pre-lavaparabrisas');
  assert.match(brake.phrasings[0].es, /líquido de frenos/i);
  assert.match(brake.phrasings[0].sourceText, /Liquido de frenos/i);
  assert.equal(brake.vehicle.reference, 'fermin-spanish-authoritative-generic');
  assert.match(washer.phrasings[0].es, /lavaparabrisas/i);
  assert.equal(washer.vehicle.page, 491);
  assert.notEqual(brake.actionId, washer.actionId);
});

test('right-turn action retains source-backed canonical phrasing', () => {
  const command = commandById(commands, 'c-der');
  assert.equal(command.actionId, 'turn-right');
  assert.deepEqual(command.phrasings[0], {
    id: 'c-der-canonical',
    es: 'Gire a la derecha cuando pueda',
    en: 'turn right when you can',
    wording: 'source-derived',
    validation: 'guide-only',
    sourcePage: 5,
    sourceText: 'Gire a la derecha (o izquierda) cuando pueda'
  });
});

test('vehicle procedures describe a generic manual car, not a Toyota Yaris Hybrid', () => {
  for (const command of commandsForPhase(commands, 'precheck')) {
    assert.doesNotMatch(command.vehicle.answer, /toyota|yaris|h[ií]brido/i, `${command.id} Spanish vehicle answer must stay generic`);
    assert.doesNotMatch(command.vehicle.answerEn, /toyota|yaris|hybrid/i, `${command.id} English vehicle answer must stay generic`);
  }
});

test('prechecks retain vehicle evidence and uncertainty status', () => {
  for (const command of commandsForPhase(commands, 'precheck')) {
    assert.ok(command.vehicle?.page, `${command.id} needs a vehicle manual page`);
    assert.ok(command.vehicle?.answer, `${command.id} needs a vehicle answer`);
    assert.ok(command.vehicle?.answerEn, `${command.id} needs an English vehicle answer`);
    assert.notEqual(command.vehicle.answerEn, command.vehicle.answer, `${command.id} vehicle answers must be explicit per locale`);
    assert.ok(['manual-baseline', 'trim-dependent'].includes(command.phrasings[0].validation));
  }
  const battery = commandById(commands, 'c-pre-bateria');
  assert.equal(battery.vehicle.reference, 'generic-conventional');
  assert.match(battery.vehicle.answer, /bajo el capó/i);
  assert.match(battery.vehicle.answerEn, /under the bonnet/i);
  assert.doesNotMatch(battery.vehicle.answerEn, /rear seat/i);
});

test('immobilization catalog metadata records the generic manual legal baseline', () => {
  const immobilization = commandById(commands, 'c-inmov');
  assert.equal(immobilization.procedure.reference, 'RGC Article 92');
  assert.equal(immobilization.procedure.status, 'generic-manual-test-car-confirmation-required');
  assert.match(immobilization.procedure.answerEn, /stop the engine.*parking brake.*first gear.*uphill.*reverse.*downhill/i);
  assert.match(immobilization.procedure.answer, /detener el motor.*freno de estacionamiento.*primera.*cuesta arriba.*marcha atrás.*cuesta abajo/i);
});

test('phase and lookup APIs reject invalid input', () => {
  assert.throws(() => commandsForPhase(commands, 'sequential'), /Unknown phase: sequential/);
  assert.throws(() => commandById(commands, 'missing'), /Unknown command: missing/);
});

test('catalog validation names malformed records', () => {
  const malformed = structuredClone(commands);
  malformed[0].phrasings[0].sourceText = '';
  assert.throws(() => validateCatalog(malformed), /c-der.*sourceText/);

  const wrongCanonicalId = structuredClone(commands);
  wrongCanonicalId[0].phrasings[0].id = 'arbitrary';
  assert.throws(() => validateCatalog(wrongCanonicalId), /c-der.*canonical phrasing id/);

  const wrongPrecheckStatus = structuredClone(commands);
  wrongPrecheckStatus.find(command => command.phase === 'precheck').phrasings[0].validation = 'invented';
  assert.throws(() => validateCatalog(wrongPrecheckStatus), /c-pre-bateria.*validation/);

  const missingEnglishVehicleAnswer = structuredClone(commands);
  missingEnglishVehicleAnswer.find(command => command.phase === 'precheck').vehicle.answerEn = '';
  assert.throws(() => validateCatalog(missingEnglishVehicleAnswer), /c-pre-bateria.*vehicle\.answerEn/);
});
