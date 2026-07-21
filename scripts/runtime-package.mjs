import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';

const STATIC_RUNTIME = Object.freeze([
  'index.html',
  'offline.html',
  'styles.css',
  'manifest.webmanifest',
  'data/commands.json',
  'data/audio-manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon-180.png'
]);

const EXPECTED_VOICE_IDS = Object.freeze([
  'CwhRBWXzGAHq8TQ4Fs17',
  'EXAVITQu4vr4xnSDxMaL'
]);
const EXPECTED_SPEEDS = Object.freeze([0.75, 0.9, 1]);

function variantKey({ commandId, phrasingId, voiceId, speed }) {
  return `${commandId}|${phrasingId}|${voiceId}|${speed}`;
}

export function isRecordedCorpusComplete({ catalog, audioManifest }) {
  const required = catalog.flatMap(command => command.phrasings.flatMap(phrasing =>
    EXPECTED_VOICE_IDS.flatMap(voiceId => EXPECTED_SPEEDS.map(speed =>
      variantKey({ commandId: command.id, phrasingId: phrasing.id, voiceId, speed })
    ))
  ));
  const presentKeys = audioManifest.map(variantKey);
  const present = new Set(presentKeys);
  const voices = [...new Set(audioManifest.map(item => item.voiceId))].sort();
  const speeds = [...new Set(audioManifest.map(item => item.speed))].sort((a, b) => a - b);

  return presentKeys.length === present.size
    && present.size === required.length
    && required.every(key => present.has(key))
    && JSON.stringify(voices) === JSON.stringify([...EXPECTED_VOICE_IDS].sort())
    && JSON.stringify(speeds) === JSON.stringify(EXPECTED_SPEEDS);
}

function normalizeRuntimePath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) {
    throw new Error(`Invalid runtime path: ${value}`);
  }
  const path = value.replace(/^\.\//, '');
  if (isAbsolute(path) || path.split('/').some(segment => segment === '.' || segment === '..' || segment === '')) {
    throw new Error(`Runtime path must remain relative: ${value}`);
  }
  return path;
}

async function assertSafeFile(root, path) {
  const rootReal = await realpath(root);
  const absolute = resolve(rootReal, path);
  const rel = relative(rootReal, absolute);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new Error(`Runtime path escapes project root: ${path}`);
  }
  const info = await lstat(absolute);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`Runtime asset must be a regular file: ${path}`);
  }
  const fileReal = await realpath(absolute);
  if (fileReal !== absolute) {
    throw new Error(`Runtime asset may not resolve through a symlink: ${path}`);
  }
}

export async function collectRuntimeAssets({ root, catalog, audioManifest }) {
  void catalog;
  const srcFiles = (await readdir(resolve(root, 'src'), { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => `src/${entry.name}`);
  const sceneAssets = [...Object.values(DRIVING_SCENES), ...Object.values(PRECHECK_SCENES)]
    .map(scene => scene.asset);
  const audioPaths = audioManifest.map(item => normalizeRuntimePath(item.path));
  if (new Set(audioPaths).size !== audioPaths.length) {
    throw new Error('Audio manifest contains duplicate runtime paths');
  }
  const candidates = [
    ...STATIC_RUNTIME,
    ...srcFiles,
    ...sceneAssets,
    ...audioPaths
  ].map(normalizeRuntimePath);
  const paths = [...new Set(candidates)].sort((a, b) => a.localeCompare(b));
  await Promise.all(paths.map(path => assertSafeFile(root, path)));
  return Object.freeze(paths);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function buildRuntimePackage({ root, outDir }) {
  const [catalog, audioManifest] = await Promise.all([
    readFile(resolve(root, 'data/commands.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'data/audio-manifest.json'), 'utf8').then(JSON.parse)
  ]);
  const paths = await collectRuntimeAssets({ root, catalog, audioManifest });
  const recordedCorpusComplete = isRecordedCorpusComplete({ catalog, audioManifest });
  const tempDir = `${outDir}.tmp-${process.pid}-${Date.now()}`;
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  try {
    const assets = [];
    for (const path of paths) {
      const source = resolve(root, path);
      const bytes = await readFile(source);
      const destination = resolve(tempDir, path);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
      assets.push(Object.freeze({ path, bytes: bytes.byteLength, sha256: sha256(bytes) }));
    }
    await copyFile(resolve(root, 'sw.js'), resolve(tempDir, 'sw.js'));
    const packageIdentity = { schemaVersion: 1, recordedCorpusComplete, assets };
    const version = sha256(Buffer.from(JSON.stringify(packageIdentity), 'utf8'));
    const result = Object.freeze({
      schemaVersion: 1,
      version,
      totalAssets: assets.length,
      totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
      recordedCorpusComplete,
      assets: Object.freeze(assets)
    });
    await writeFile(resolve(tempDir, 'offline-package.json'), `${JSON.stringify(result, null, 2)}\n`);
    await rm(outDir, { recursive: true, force: true });
    await rename(tempDir, outDir);
    return result;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
