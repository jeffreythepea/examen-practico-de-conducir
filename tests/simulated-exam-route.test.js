import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSimulatedExamRoute } from '../src/simulated-exam-route.js';

const commands = [
  { id: 'c-pre-1', phase: 'precheck' },
  { id: 'c-pre-2', phase: 'precheck' },
  { id: 'c-cint', phase: 'driving' },
  { id: 'c-arr', phase: 'driving' },
  { id: 'c-incorp', phase: 'driving' },
  { id: 'c-der', phase: 'driving' },
  { id: 'c-izq', phase: 'driving' },
  { id: 'c-recto', phase: 'driving' },
  { id: 'c-final', phase: 'driving' },
  { id: 'c-inmov', phase: 'driving' }
];

function item(commandId) {
  return {
    commandId,
    phrasingId: `${commandId}-phrasing`,
    voiceId: 'examiner-1',
    speed: 1
  };
}

function commandSteps(route) {
  return route.filter(step => step.kind === 'command');
}

function transitionSteps(route) {
  return route.filter(step => step.kind === 'transition');
}

test('rejects malformed planner inputs and session items', () => {
  assert.throws(() => buildSimulatedExamRoute(null, commands), /items.*array/i);
  assert.throws(() => buildSimulatedExamRoute([], commands), /items.*empty/i);
  assert.throws(() => buildSimulatedExamRoute([item('c-der')], null), /commands.*array/i);
  assert.throws(() => buildSimulatedExamRoute([item('c-der')], []), /commands.*empty/i);
  assert.throws(() => buildSimulatedExamRoute([item('c-der')], commands, 1), /RNG.*function/i);
  assert.throws(
    () => buildSimulatedExamRoute([{ ...item('c-der'), commandId: '   ' }], commands),
    /commandId/i
  );
  assert.throws(
    () => buildSimulatedExamRoute([{ ...item('c-der'), phrasingId: '' }], commands),
    /phrasingId/i
  );
  assert.throws(
    () => buildSimulatedExamRoute([{ ...item('c-der'), voiceId: '' }], commands),
    /voiceId/i
  );
  assert.throws(
    () => buildSimulatedExamRoute([{ ...item('c-der'), speed: Number.NaN }], commands),
    /speed/i
  );
});

test('rejects unknown or malformed command data', () => {
  assert.throws(() => buildSimulatedExamRoute([item('c-missing')], commands), /Unknown command/i);
  assert.throws(
    () => buildSimulatedExamRoute([item('c-der')], [...commands, { id: 'c-bad', phase: 'mixed' }]),
    /phase/i
  );
  assert.throws(
    () => buildSimulatedExamRoute([item('c-der')], [...commands, { id: 'c-der', phase: 'driving' }]),
    /Duplicate command id/i
  );
  assert.throws(
    () => buildSimulatedExamRoute([item('c-arr')], commands.map(command => (
      command.id === 'c-arr' ? { ...command, phase: 'precheck' } : command
    ))),
    /Invalid phase for c-arr/i
  );
});

test('rejects duplicate selected session items', () => {
  assert.throws(
    () => buildSimulatedExamRoute([item('c-der'), item('c-der')], commands),
    /duplicate session item/i
  );
});

test('partitions commands into the approved narrative order while preserving group order', () => {
  const items = [
    item('c-final'),
    item('c-izq'),
    item('c-pre-2'),
    item('c-incorp'),
    item('c-inmov'),
    item('c-pre-1'),
    item('c-der'),
    item('c-arr')
  ];

  const route = buildSimulatedExamRoute(items, commands, () => 0);
  assert.deepEqual(
    commandSteps(route).map(step => step.commandId),
    ['c-pre-2', 'c-pre-1', 'c-arr', 'c-incorp', 'c-izq', 'c-der', 'c-final', 'c-inmov']
  );
  assert.deepEqual(
    commandSteps(route).map(step => step.itemIndex),
    [2, 5, 7, 3, 1, 6, 0, 4]
  );
  assert.deepEqual(
    commandSteps(route).map(step => step.chapter),
    ['precheck', 'precheck', 'departure', 'departure', 'driving', 'driving', 'finish', 'finish']
  );
});

test('uses a preparation bridge when start-engine is absent without fabricating a command', () => {
  const route = buildSimulatedExamRoute(
    [item('c-pre-1'), item('c-incorp'), item('c-der')],
    commands
  );
  assert.deepEqual(commandSteps(route).map(step => step.commandId), ['c-pre-1', 'c-incorp', 'c-der']);
  assert.equal(route[1].kind, 'transition');
  assert.equal(route[1].sceneId, 'preparation-bridge');
  assert.equal(route[2].commandId, 'c-incorp');
});

test('fasten-seatbelt sits between prechecks and departure with no adjacent transition', () => {
  const route = buildSimulatedExamRoute(
    [item('c-der'), item('c-cint'), item('c-pre-1'), item('c-arr'), item('c-izq')],
    commands
  );
  assert.deepEqual(
    commandSteps(route).map(step => step.commandId),
    ['c-pre-1', 'c-cint', 'c-arr', 'c-der', 'c-izq']
  );
  const cintIndex = route.findIndex(step => step.commandId === 'c-cint');
  assert.equal(route[cintIndex - 1].kind, 'command', 'no transition before fastening the seatbelt');
  assert.equal(route[cintIndex - 1].commandId, 'c-pre-1');
  assert.equal(route[cintIndex + 1].kind, 'command', 'no transition between seatbelt and engine start');
  assert.equal(route[cintIndex + 1].commandId, 'c-arr');
  assert.equal(route[cintIndex].chapter, 'departure');
});

test('fasten-seatbelt precedes the preparation bridge when start-engine is absent', () => {
  const route = buildSimulatedExamRoute(
    [item('c-cint'), item('c-der'), item('c-izq')],
    commands
  );
  assert.equal(route[0].commandId, 'c-cint');
  assert.equal(route[1].kind, 'transition');
  assert.equal(route[1].sceneId, 'preparation-bridge');
  assert.equal(route[2].commandId, 'c-der');
});

test('does not add a preparation bridge when start-engine is present', () => {
  const route = buildSimulatedExamRoute([item('c-pre-1'), item('c-arr'), item('c-der')], commands);
  assert.equal(transitionSteps(route).some(step => step.sceneId === 'preparation-bridge'), false);
});

test('places the departure consequence immediately after join-traffic', () => {
  const route = buildSimulatedExamRoute(
    [item('c-arr'), item('c-incorp'), item('c-der')],
    commands
  );
  const joinIndex = route.findIndex(step => step.commandId === 'c-incorp');
  assert.equal(route[joinIndex + 1].sceneId, 'departure-consequence');
  assert.equal(route[joinIndex + 1].chapter, 'departure');
});

test('inserts cruise transitions only between ordinary driving commands', () => {
  const route = buildSimulatedExamRoute(
    [item('c-arr'), item('c-incorp'), item('c-der'), item('c-izq'), item('c-recto')],
    commands,
    () => 0
  );
  const cruises = transitionSteps(route).filter(step => step.sceneId.endsWith('-cruise'));
  assert.equal(cruises.length, 2);
  assert.equal(route[route.findIndex(step => step.commandId === 'c-der') + 1].sceneId, 'urban-cruise');
  assert.equal(route[route.findIndex(step => step.commandId === 'c-izq') + 1].sceneId, 'urban-cruise');
  assert.equal(route[route.findIndex(step => step.commandId === 'c-recto') + 1], undefined);
});

test('uses injected randomness only to select an approved cruise scene', () => {
  const items = [item('c-der'), item('c-izq')];
  const urban = buildSimulatedExamRoute(items, commands, () => 0);
  const rural = buildSimulatedExamRoute(items, commands, () => 0.999);

  assert.deepEqual(commandSteps(urban), commandSteps(rural));
  assert.equal(transitionSteps(urban).find(step => step.sceneId.endsWith('-cruise')).sceneId, 'urban-cruise');
  assert.equal(transitionSteps(rural).find(step => step.sceneId.endsWith('-cruise')).sceneId, 'rural-cruise');
  assert.throws(() => buildSimulatedExamRoute(items, commands, () => 1), /between 0 and 1/i);
});

test('is deterministic for identical inputs and injected randomness', () => {
  const items = [item('c-pre-1'), item('c-der'), item('c-izq'), item('c-final'), item('c-inmov')];
  assert.deepEqual(
    buildSimulatedExamRoute(items, commands, () => 0.75),
    buildSimulatedExamRoute(items, commands, () => 0.75)
  );
});

test('places arrival before available terminal actions and parked closure after them', () => {
  const route = buildSimulatedExamRoute(
    [item('c-der'), item('c-final'), item('c-inmov')],
    commands
  );
  const arrivalIndex = route.findIndex(step => step.sceneId === 'arrival');
  const finalIndex = route.findIndex(step => step.commandId === 'c-final');
  const immobilizeIndex = route.findIndex(step => step.commandId === 'c-inmov');
  const parkedIndex = route.findIndex(step => step.sceneId === 'parked-closure');

  assert.ok(arrivalIndex < finalIndex);
  assert.ok(finalIndex < immobilizeIndex);
  assert.ok(immobilizeIndex < parkedIndex);
});

test('handles either or both absent terminal commands without fabricating commands', () => {
  const onlyFinal = buildSimulatedExamRoute([item('c-der'), item('c-final')], commands);
  assert.deepEqual(commandSteps(onlyFinal).map(step => step.commandId), ['c-der', 'c-final']);

  const onlyImmobilize = buildSimulatedExamRoute([item('c-der'), item('c-inmov')], commands);
  assert.deepEqual(commandSteps(onlyImmobilize).map(step => step.commandId), ['c-der', 'c-inmov']);

  const neither = buildSimulatedExamRoute([item('c-der')], commands);
  assert.deepEqual(commandSteps(neither).map(step => step.commandId), ['c-der']);
  assert.equal(transitionSteps(neither).some(step => step.sceneId === 'arrival'), false);
  assert.equal(transitionSteps(neither).some(step => step.sceneId === 'parked-closure'), false);
});

test('emits stable transition IDs', () => {
  const route = buildSimulatedExamRoute(
    [item('c-incorp'), item('c-der'), item('c-izq'), item('c-final')],
    commands,
    () => 0
  );
  assert.deepEqual(
    transitionSteps(route).map(step => step.id),
    [
      'transition-0-preparation-bridge',
      'transition-1-departure-consequence',
      'transition-2-urban-cruise',
      'transition-3-arrival',
      'transition-4-parked-closure'
    ]
  );
});

test('returns deeply frozen caller-independent data without mutating inputs', () => {
  const items = [item('c-pre-1'), item('c-arr'), item('c-der')];
  const originalItems = structuredClone(items);
  const originalCommands = structuredClone(commands);
  const route = buildSimulatedExamRoute(items, commands);

  assert.deepEqual(items, originalItems);
  assert.deepEqual(commands, originalCommands);
  assert.equal(Object.isFrozen(route), true);
  assert.equal(route.every(Object.isFrozen), true);

  items[0].commandId = 'changed-after-planning';
  commands[0].id = 'changed-after-planning';
  assert.equal(route[0].commandId, 'c-pre-1');
  assert.throws(() => route.push({}), TypeError);
});
