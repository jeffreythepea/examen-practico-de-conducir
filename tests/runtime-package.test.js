import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildRuntimePackage,
  collectRuntimeAssets,
  isRecordedCorpusComplete
} from '../scripts/runtime-package.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('runtime asset discovery is deterministic, complete, and excludes development files', async () => {
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
  const paths = await collectRuntimeAssets({ root: ROOT, catalog, audioManifest });

  assert.deepEqual(paths, paths.toSorted((a, b) => a.localeCompare(b)));
  assert.ok(paths.includes('index.html'));
  assert.ok(paths.includes('data/commands.json'));
  assert.ok(paths.includes('manifest.webmanifest'));
  assert.ok(paths.includes('src/app.js'));
  assert.equal(paths.filter(path => path.endsWith('.mp3')).length, 324);
  assert.ok(paths.every(path => !path.startsWith('tests/')));
  assert.ok(paths.every(path => !path.startsWith('docs/')));
  assert.ok(paths.every(path => !path.includes('.superpowers')));
  assert.ok(paths.every(path => !path.endsWith('.png') || path.startsWith('icons/')));
});

test('runtime package is integrity-addressed and copies only declared assets', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'examen-runtime-'));
  const outDir = resolve(temp, 'dist');
  try {
    const result = await buildRuntimePackage({ root: ROOT, outDir });
    assert.equal(result.schemaVersion, 1);
    assert.match(result.version, /^[a-f0-9]{64}$/);
    assert.equal(result.recordedCorpusComplete, true);
    assert.equal(result.assets.filter(asset => asset.path.endsWith('.mp3')).length, 324);
    assert.deepEqual(result.assets, result.assets.toSorted((a, b) => a.path.localeCompare(b.path)));
    assert.equal((await stat(resolve(outDir, 'offline-package.json'))).isFile(), true);
    assert.equal((await stat(resolve(outDir, 'index.html'))).isFile(), true);
    assert.equal((await stat(resolve(outDir, 'sw.js'))).isFile(), true);
    assert.equal(result.assets.some(asset => asset.path === 'sw.js'), false);
    await assert.rejects(stat(resolve(outDir, 'tests')), /ENOENT/);
    await assert.rejects(stat(resolve(outDir, 'docs')), /ENOENT/);
    const serialized = JSON.parse(await readFile(resolve(outDir, 'offline-package.json'), 'utf8'));
    assert.deepEqual(serialized, result);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('corpus completeness rejects duplicate or incomplete audio inventories', async () => {
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));

  assert.equal(isRecordedCorpusComplete({ catalog, audioManifest: audioManifest.slice(1) }), false);

  assert.equal(isRecordedCorpusComplete({ catalog, audioManifest: [...audioManifest, audioManifest[0]] }), false);
});
