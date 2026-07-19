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
