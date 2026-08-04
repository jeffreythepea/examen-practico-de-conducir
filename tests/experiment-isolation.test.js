import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectRuntimeAssets } from '../scripts/runtime-package.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('experimental spikes remain outside the verified runtime package', async () => {
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
  const paths = await collectRuntimeAssets({ root: ROOT, catalog, audioManifest });

  assert.ok(paths.every(path => !path.startsWith('experiments/')));
  assert.ok(paths.every(path => !path.startsWith('docs/experiments/')));
});
