import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const scenes = [...Object.values(DRIVING_SCENES), ...Object.values(PRECHECK_SCENES)];

test('every photo scene uses a smaller same-size WebP runtime derivative', async () => {
  for (const scene of scenes) {
    assert.match(scene.asset, /\.webp$/, scene.id);
    const runtimePath = resolve(ROOT, scene.asset.replace(/^\.\//, ''));
    const sourcePath = runtimePath.replace(/\.webp$/, '.png');
    const [runtimeMeta, sourceMeta, runtimeStat, sourceStat] = await Promise.all([
      sharp(runtimePath).metadata(),
      sharp(sourcePath).metadata(),
      stat(runtimePath),
      stat(sourcePath)
    ]);
    assert.equal(runtimeMeta.width, sourceMeta.width, scene.id);
    assert.equal(runtimeMeta.height, sourceMeta.height, scene.id);
    assert.ok(runtimeStat.size < sourceStat.size * 0.6,
      `${scene.id} must shrink by at least 40%`);
  }
});
