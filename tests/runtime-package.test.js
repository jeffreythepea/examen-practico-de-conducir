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
  assert.ok(paths.includes('src/road-motion.js'));
  assert.equal(paths.includes('src/junction-motion.js'), false);
  assert.equal(paths.filter(path => path.endsWith('.mp3')).length, audioManifest.length);
  assert.ok(paths.includes('assets/driving/urban-roadside-drive-v2.mp4'));
  assert.ok(paths.includes('assets/driving/urban-roadside-drive-v2-poster.webp'));
  assert.ok(paths.includes('assets/driving/overtaking-drive-v2.mp4'));
  assert.ok(paths.includes('assets/driving/overtaking-drive-v2-poster.webp'));
  for (const clip of ['four-way-turn-left-v1', 'four-way-turn-right-v1', 'four-way-straight-v1']) {
    assert.ok(paths.includes(`assets/driving/${clip}.mp4`), `${clip} clip ships offline`);
    assert.ok(paths.includes(`assets/driving/${clip}-poster.webp`), `${clip} poster ships offline`);
  }
  assert.equal(paths.filter(path => path.endsWith('.mp4')).length, 5);
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
    const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
    const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
    assert.equal(result.recordedCorpusComplete, isRecordedCorpusComplete({ catalog, audioManifest }));
    assert.equal(result.totalAssets, result.assets.length);
    assert.equal(result.assets.filter(asset => asset.path.endsWith('.mp3')).length, audioManifest.length);
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

test('corpus completeness derives from the catalog rather than a historical fixed count', () => {
  const catalog = [{
    id: 'c-test',
    phrasings: [
      { id: 'c-test-canonical' },
      { id: 'c-test-supplementary-1' }
    ]
  }];
  const voices = [
    'CwhRBWXzGAHq8TQ4Fs17',
    'EXAVITQu4vr4xnSDxMaL',
    'JBFqnCBsd6RMkjVDRZzb',
    'XrExE9yKIg1WjnnlVkGX',
    'cjVigY5qzO86Huf0OWal'
  ];
  const speeds = [0.75, 0.9, 1];
  const audioManifest = catalog.flatMap(command => command.phrasings.flatMap(phrasing =>
    voices.flatMap(voiceId => speeds.map(speed => ({
      commandId: command.id,
      phrasingId: phrasing.id,
      voiceId,
      speed
    })))
  ));

  assert.equal(audioManifest.length, 30);
  assert.equal(isRecordedCorpusComplete({ catalog, audioManifest }), true);
});

test('corpus completeness rejects duplicate or incomplete audio inventories', async () => {
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));

  assert.equal(isRecordedCorpusComplete({ catalog, audioManifest: audioManifest.slice(1) }), false);

  assert.equal(isRecordedCorpusComplete({ catalog, audioManifest: [...audioManifest, audioManifest[0]] }), false);
});
