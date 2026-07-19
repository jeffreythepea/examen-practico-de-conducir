import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import {
  PRECHECK_COMMAND_SCENES,
  PRECHECK_SCENES,
  precheckSceneForCommand,
  renderPrecheckIcon
} from '../src/precheck-scenes.js';

test('engine prechecks share one immutable photo scene with precisely audited anchors', async () => {
  const scene = precheckSceneForCommand('c-pre-aceite');
  assert.equal(scene.id, 'generic-engine-bay');
  assert.equal(scene.asset, 'assets/precheck/generic-engine-bay.png');
  assert.equal(PRECHECK_COMMAND_SCENES['c-pre-refrigerante'], scene.id);
  assert.equal(PRECHECK_COMMAND_SCENES['c-pre-bateria'], scene.id);
  assert.ok(Object.isFrozen(PRECHECK_SCENES));
  assert.ok(Object.isFrozen(scene.targets));

  assert.deepEqual(
    Object.fromEntries(Object.entries(scene.targets).map(([id, target]) => [id, [target.x, target.y, target.iconKey]])),
    {
      'engine-oil': [73.2, 73, 'oil'],
      coolant: [13.5, 37.5, 'coolant'],
      'battery-under-rear-right-seat': [74, 44.5, 'battery'],
      'washer-fluid': [14.7, 61.5, 'washer']
    }
  );
  assert.match(scene.targets['engine-oil'].anchorDescription, /dipstick handle/i);
  assert.match(scene.targets.coolant.anchorDescription, /reservoir cap/i);
  assert.match(scene.targets['battery-under-rear-right-seat'].anchorDescription, /centre.*battery/i);
  assert.match(scene.targets['washer-fluid'].anchorDescription, /washer.*cap/i);

  for (const target of Object.values(scene.targets)) {
    assert.ok(target.iconKey);
    assert.ok(target.anchorDescription);
    assert.match(renderPrecheckIcon(target.iconKey), /class="precheck-icon(?:\s|\")/);
  }
  const asset = await stat(new URL(`../${scene.asset}`, import.meta.url));
  assert.ok(asset.size > 0);
});

test('precheck scene and icon lookups reject unsupported identifiers', () => {
  assert.throws(() => precheckSceneForCommand('missing'), /Unsupported precheck command: missing/);
  assert.throws(() => renderPrecheckIcon('mystery'), /Unsupported precheck icon: mystery/);
});

test('cabin prechecks map to three packaged scenes with distinct, described icon targets', async () => {
  const expectedMappings = {
    'c-pre-combustible': ['generic-instrument-cluster', 'assets/precheck/generic-instrument-cluster.png'],
    'c-pre-temperatura': ['generic-instrument-cluster', 'assets/precheck/generic-instrument-cluster.png'],
    'c-pre-bloquear-elevalunas': ['generic-driver-door', 'assets/precheck/generic-driver-door.png'],
    'c-pre-desbloquear-elevalunas': ['generic-driver-door', 'assets/precheck/generic-driver-door.png'],
    'c-pre-desempanar-delantera': ['generic-climate-panel', 'assets/precheck/generic-climate-panel.png'],
    'c-pre-desempanar-trasera': ['generic-climate-panel', 'assets/precheck/generic-climate-panel.png']
  };

  for (const [commandId, [sceneId, assetPath]] of Object.entries(expectedMappings)) {
    const scene = precheckSceneForCommand(commandId);
    assert.equal(scene.id, sceneId);
    assert.equal(scene.asset, assetPath);
    assert.ok(Object.keys(scene.targets).length >= 3);
    assert.ok(Object.values(scene.targets).every(target => target.iconKey && target.anchorDescription));
    const asset = await stat(new URL(`../${assetPath}`, import.meta.url));
    assert.ok(asset.size > 0);
  }

  assert.notEqual(PRECHECK_SCENES['generic-instrument-cluster'].targets['fuel-gauge'].iconKey,
    PRECHECK_SCENES['generic-instrument-cluster'].targets['temperature-gauge'].iconKey);
  assert.equal(PRECHECK_SCENES['generic-driver-door'].targets['window-lock'].iconKey, 'native-symbol');
  assert.equal(PRECHECK_SCENES['generic-driver-door'].targets['door-lock'].iconKey, 'native-symbol');
  assert.notEqual(PRECHECK_SCENES['generic-climate-panel'].targets['front-demist'].iconKey,
    PRECHECK_SCENES['generic-climate-panel'].targets['rear-demist'].iconKey);
});

test('lighting and exterior-release prechecks map to precise photo targets with clear distractors', async () => {
  const expectedMappings = {
    'c-pre-largo-alcance': 'generic-lighting-stalk',
    'c-pre-niebla-delantera': 'generic-lighting-stalk',
    'c-pre-niebla-trasera': 'generic-lighting-stalk',
    'c-pre-capo': 'generic-bonnet-release',
    'c-pre-maletero': 'generic-tailgate-release'
  };
  for (const [commandId, sceneId] of Object.entries(expectedMappings)) {
    assert.equal(precheckSceneForCommand(commandId).id, sceneId);
  }

  const lighting = PRECHECK_SCENES['generic-lighting-stalk'];
  assert.deepEqual(Object.keys(lighting.targets).sort(), ['front-fog', 'high-beam', 'rear-fog']);
  assert.ok(Object.values(lighting.targets).every(target => target.iconKey === 'native-symbol'));
  assert.match(lighting.targets['high-beam'].anchorDescription, /stalk.*movement/i);
  assert.match(lighting.targets['front-fog'].anchorDescription, /front.*fog.*ring/i);
  assert.match(lighting.targets['rear-fog'].anchorDescription, /rear.*fog.*ring/i);
  assert.deepEqual(
    ['high-beam', 'front-fog', 'rear-fog'].map(id => lighting.targets[id].labelPlacement),
    [
      { x: 17, y: 78, width: 28 },
      { x: 47, y: 78, width: 28 },
      { x: 80, y: 78, width: 28 }
    ],
    'lighting reveal labels must form three separate columns below the controls'
  );

  const door = PRECHECK_SCENES['generic-driver-door'];
  assert.deepEqual(door.targets['window-lock'].labelPlacement, { x: 20, y: 78, width: 34 });
  assert.deepEqual(door.targets['window-switch'].labelPlacement, { x: 55, y: 78, width: 28 });

  const bonnet = PRECHECK_SCENES['generic-bonnet-release'];
  assert.ok(Object.keys(bonnet.targets).length >= 3);
  assert.match(bonnet.targets['bonnet-release'].anchorDescription, /bonnet.*release lever/i);
  const tailgate = PRECHECK_SCENES['generic-tailgate-release'];
  assert.ok(Object.keys(tailgate.targets).length >= 3);
  assert.match(tailgate.targets['boot-release'].anchorDescription, /tailgate.*release/i);

  for (const scene of [lighting, bonnet, tailgate]) {
    assert.ok(Object.values(scene.targets).every(target => target.iconKey && target.anchorDescription));
    const asset = await stat(new URL(`../${scene.asset}`, import.meta.url));
    assert.ok(asset.size > 0);
  }
});
