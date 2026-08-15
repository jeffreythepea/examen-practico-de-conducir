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
import { ACTION_SOUNDS } from '../src/action-sounds.js';
import { AMBIENCE_CLIPS } from '../src/ambience.js';
import { CONTINUITY_SCENE_FAMILIES } from '../src/continuity-transition-view.js';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';
import { TURN_CLIPS } from '../src/turn-through.js';

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
  // Command recordings plus the cabin-ambience clips, which are registered in
  // code rather than in the manifest.
  assert.equal(
    paths.filter(path => path.endsWith('.mp3')).length,
    audioManifest.length + Object.keys(AMBIENCE_CLIPS).length + Object.keys(ACTION_SOUNDS).length
  );
  assert.ok(paths.includes('assets/driving/urban-roadside-drive-v2.mp4'));
  assert.ok(paths.includes('assets/driving/urban-roadside-drive-v2-poster.webp'));
  assert.ok(paths.includes('assets/driving/overtaking-drive-v2.mp4'));
  assert.ok(paths.includes('assets/driving/overtaking-drive-v2-poster.webp'));
  for (const clip of ['four-way-turn-left-v1', 'four-way-turn-right-v1', 'four-way-straight-v1',
    'parallel-parking-v1', 'overtake-pass-v1', 'roadside-stop-v1',
    'regular-u-turn-v1', 'join-traffic-merge-v1',
    'roundabout-first-exit-v1', 'roundabout-second-exit-v1',
    'roundabout-third-exit-v1', 'roundabout-change-direction-v1']) {
    assert.ok(paths.includes(`assets/driving/${clip}.mp4`), `${clip} clip ships offline`);
    assert.ok(paths.includes(`assets/driving/${clip}-poster.webp`), `${clip} poster ships offline`);
  }
  assert.equal(paths.filter(path => path.endsWith('.mp4')).length, 14);
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
    assert.equal(
      result.assets.filter(asset => asset.path.endsWith('.mp3')).length,
      audioManifest.length + Object.keys(AMBIENCE_CLIPS).length + Object.keys(ACTION_SOUNDS).length
    );
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

test('every asset a code registry references ships in the package', async () => {
  // Cabin ambience shipped its player and none of its sound: the clips live in
  // a code registry that the package builder never consulted, so the installed
  // app had audio/ambience/*.mp3 missing while the hosted app played them. The
  // builder now reads each registry, and this asserts it kept reading them.
  const catalog = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
  const audioManifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
  const paths = new Set(await collectRuntimeAssets({ root: ROOT, catalog, audioManifest }));

  const registered = [
    ['ambience', Object.values(AMBIENCE_CLIPS)],
    ['action sound', Object.values(ACTION_SOUNDS)],
    ['driving scene', Object.values(DRIVING_SCENES).map(scene => scene.asset)],
    ['precheck scene', Object.values(PRECHECK_SCENES).map(scene => scene.asset)],
    ['cruise video', Object.values(CONTINUITY_SCENE_FAMILIES)
      .flatMap(family => family.video ? [family.video.asset, family.video.poster] : [])],
    ['turn clip', Object.values(TURN_CLIPS)
      .flatMap(scene => Object.values(scene))
      .flatMap(clip => [clip.asset, clip.poster])]
  ];

  for (const [label, assets] of registered) {
    assert.ok(assets.length > 0, `the ${label} registry is empty, so this proves nothing`);
    for (const asset of assets) {
      const path = asset.replace(/^\.\//, '');
      assert.ok(paths.has(path), `${label} asset is registered but not packaged: ${path}`);
    }
  }
});
