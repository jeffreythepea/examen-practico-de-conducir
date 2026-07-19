import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DRIVING_SCENE_IDS,
  DRIVING_SCENES,
  drivingScene
} from '../src/driving-scenes.js';

const EXPECTED = Object.freeze({
  'u-turn-photo-v1': './assets/driving/u-turn-photo-v1.png',
  'overtaking-photo-v1': './assets/driving/overtaking-photo-v1.png',
  'four-way-intersection-photo-v1': './assets/driving/four-way-intersection-photo-v1.png',
  'roundabout-four-photo-v1': './assets/driving/roundabout-four-photo-v1.png',
  'roundabout-five-photo-v1': './assets/driving/roundabout-five-photo-v1.png',
  'parallel-parking-gap-photo-v1': './assets/driving/parallel-parking-gap-photo-v1.png',
  'urban-roadside-photo-v1': './assets/driving/urban-roadside-photo-v1.png'
});

test('driving photo registry exposes only the reviewed stable scene vocabulary', () => {
  assert.deepEqual(DRIVING_SCENE_IDS, Object.keys(EXPECTED));
  assert.deepEqual(Object.keys(DRIVING_SCENES), DRIVING_SCENE_IDS);
  assert.ok(Object.isFrozen(DRIVING_SCENE_IDS));
  assert.ok(Object.isFrozen(DRIVING_SCENES));

  for (const [id, asset] of Object.entries(EXPECTED)) {
    const scene = drivingScene(id);
    assert.strictEqual(scene, DRIVING_SCENES[id]);
    assert.equal(scene.id, id);
    assert.equal(scene.asset, asset);
    assert.equal(scene.provenance, 'ai-generated-illustrative');
    assert.ok(scene.alt.en.length > 20);
    assert.ok(scene.alt.es.length > 20);
    assert.ok(Object.isFrozen(scene));
    assert.ok(Object.isFrozen(scene.alt));
  }
  assert.throws(() => drivingScene('future-scene'), /Unknown driving scene/);
});

test('every production driving scene is a nonempty local PNG', async () => {
  for (const scene of Object.values(DRIVING_SCENES)) {
    const bytes = await readFile(new URL(`../${scene.asset.slice(2)}`, import.meta.url));
    assert.ok(bytes.length > 100_000, `${scene.id} must contain a real raster plate`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }
});
