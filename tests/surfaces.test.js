import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SUPPORTED_SURFACE_IDS,
  generateSurface,
  reduceSurfaceResponse,
  renderSurfaceModel,
  supportedCommands
} from '../src/surfaces.js';
import { YARIS_COMMAND_CONTRACT, YARIS_SURFACE_IDS } from '../src/yaris-surfaces.js';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));

test('registry contains every active model-aware ID and no removed legacy diagram ID', () => {
  assert.deepEqual(SUPPORTED_SURFACE_IDS, [
    'junction-v2',
    'roundabout-v2',
    'u-turn-v1',
    'overtake-v1',
    'parking-v1',
    'stopping-v1',
    'wheel-center-v1',
    'secure-yaris-v1',
    'option-grid-v1',
    ...YARIS_SURFACE_IDS
  ]);
  assert.equal(SUPPORTED_SURFACE_IDS.some(id => id.startsWith('yaris-manual-v1-')), false);
  assert.equal(SUPPORTED_SURFACE_IDS.includes('junction-v1'), false);
  assert.equal(SUPPORTED_SURFACE_IDS.includes('roundabout-v1'), false);
});

test('unsupported commands are filtered with a development diagnostic and never substituted', () => {
  const supported = commands[0];
  const unknown = { ...supported, id: 'unknown', surfaceId: 'future-simulator-v1' };
  const diagnostics = [];
  assert.deepEqual(supportedCommands([supported, unknown], message => diagnostics.push(message)), [supported]);
  assert.deepEqual(diagnostics, ['Excluded unknown: unsupported surface future-simulator-v1']);
  assert.throws(() => generateSurface(unknown, 1), /Unsupported surface: future-simulator-v1/);
});

test('semantic generator is limited to the three declared driving exceptions', () => {
  const command = commands.find(candidate => candidate.id === 'c-adapte');
  const model = generateSurface(command, 12);
  assert.equal(model.family, 'semantic');
  assert.equal(model.meta.declaredException, true);
  assert.deepEqual(model.targets.map(target => target.resultId).sort(), [
    'adapt-speed', 'involuntary-stop', 'exam-finish'
  ].sort());
  const unchanged = {};
  assert.strictEqual(
    reduceSurfaceResponse(model, unchanged, { type: 'select-target', targetId: 'missing' }),
    unchanged
  );
  const target = model.targets.find(candidate => candidate.resultId === model.expectedResult);
  assert.deepEqual(reduceSurfaceResponse(model, {}, { type: 'select-target', targetId: target.id }), {
    complete: true,
    selectedResult: 'adapt-speed',
    selectedTargetId: target.id
  });
  assert.throws(
    () => generateSurface({ ...command, id: 'not-exception', actionId: 'park', acceptedResult: 'park' }, 12),
    /Unsupported semantic action: park/
  );
});

test('semantic target positions shuffle reproducibly across seeds without changing stable IDs', () => {
  const command = commands.find(candidate => candidate.id === 'c-adapte');
  assert.deepEqual(generateSurface(command, 12), generateSurface(command, 12));

  const positionsByResult = new Map([
    ['adapt-speed', new Set()],
    ['involuntary-stop', new Set()],
    ['exam-finish', new Set()]
  ]);
  for (let seed = 1; seed <= 64; seed += 1) {
    const model = generateSurface(command, seed);
    for (const [index, target] of model.targets.entries()) {
      assert.equal(target.id, `semantic-${target.resultId}`);
      positionsByResult.get(target.resultId).add(`${index}:${target.x}:${target.y}`);
    }
  }

  for (const [resultId, positions] of positionsByResult) {
    assert.ok(positions.size > 1, `${resultId} must not stay in one memorized position`);
  }
});

test('semantic reveal shows both the correct response and a selected wrong response', () => {
  const command = commands.find(candidate => candidate.id === 'c-adapte');
  const model = generateSurface(command, 12);
  const wrong = model.targets.find(target => target.resultId !== model.expectedResult);
  const markup = renderSurfaceModel(model, {
    complete: true,
    selectedResult: wrong.resultId,
    selectedTargetId: wrong.id
  }, 'es', { reveal: true, disabled: true });
  assert.match(markup, /data-result="adapt-speed"[^>]+aria-current="true"/);
  assert.match(markup, new RegExp(`data-target="${wrong.id}"[^>]+data-selection-state="wrong"`));
  assert.match(markup, /class="target-status-marker correct"[^>]*>✓</);
  assert.match(markup, /class="target-status-marker wrong"[^>]*>×</);
});

test('Task 7 atomically activates every eligible model-aware surface and exactly three semantic exceptions', () => {
  const expectedDriving = {
    'c-der': 'junction-v2',
    'c-izq': 'junction-v2',
    'c-sentido': 'u-turn-v1',
    'c-volante': 'wheel-center-v1',
    'c-rot1': 'roundabout-v2',
    'c-rot2': 'roundabout-v2',
    'c-rot3': 'roundabout-v2',
    'c-rot4': 'roundabout-v2',
    'c-rot5': 'roundabout-v2',
    'c-parada': 'stopping-v1',
    'c-est': 'parking-v1',
    'c-inmov': 'secure-yaris-v1',
    'c-adel': 'overtake-v1',
    'c-adapte': 'option-grid-v1',
    'c-detencion': 'option-grid-v1',
    'c-final': 'option-grid-v1'
  };
  for (const [id, surfaceId] of Object.entries(expectedDriving)) {
    assert.equal(commands.find(command => command.id === id).surfaceId, surfaceId, id);
  }
  assert.deepEqual(
    commands.filter(command => command.phase === 'driving' && command.surfaceId === 'option-grid-v1')
      .map(command => command.id).sort(),
    ['c-adapte', 'c-detencion', 'c-final']
  );
  for (const command of commands.filter(command => command.phase === 'precheck')) {
    assert.equal(command.surfaceId, YARIS_COMMAND_CONTRACT[command.id].diagramId, command.id);
  }
  assert.deepEqual(supportedCommands(commands), commands);
});

test('every active catalog surface generates, reduces, and renders in both locales', () => {
  for (const command of commands) {
    const model = generateSurface(command, 7);
    const correctTarget = model.targets.find(target => target.resultId === model.expectedResult);
    assert.ok(correctTarget, `${command.id} needs an expected target`);
    const events = completionEvents(model, correctTarget);
    let response = {};
    for (const event of events) response = reduceSurfaceResponse(model, response, event);
    assert.equal(response.complete, true, `${command.id} must complete`);
    assert.equal(response.selectedResult, command.acceptedResult, command.id);
    assert.ok(response.selectedTargetId, `${command.id} needs target provenance`);
    for (const locale of ['en', 'es']) {
      const markup = renderSurfaceModel(model, response, locale, {
        disabled: true,
        reveal: true,
        selectedTargetId: response.selectedTargetId
      });
      assert.match(markup, new RegExp(`data-surface="${command.surfaceId}"`));
      assert.match(markup, new RegExp(`data-target="${response.selectedTargetId}"`));
    }
  }
});

function completionEvents(model, correctTarget) {
  if (model.family === 'wheel') return [{ type: 'set-wheel', degrees: 0 }];
  if (model.family === 'secure-manual') {
    return [
      { type: 'activate', targetId: 'engine-stop' },
      { type: 'activate', targetId: 'parking-brake' },
      { type: 'select-gear', targetId: 'manual-gear', gear: model.meta.requiredGear },
      { type: 'submit-secure' }
    ];
  }
  if (model.family === 'yaris') return [{ type: 'activate', targetId: correctTarget.id }];
  return [{ type: 'select-target', targetId: correctTarget.id }];
}
