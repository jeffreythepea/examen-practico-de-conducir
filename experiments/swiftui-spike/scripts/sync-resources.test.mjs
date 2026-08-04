import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { syncSwiftResources } from './sync-resources.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const expectedRecordingId =
  'c-recto--c-recto-canonical--CwhRBWXzGAHq8TQ4Fs17--0.9';
const expectedBytes = 25539;
const expectedSha256 =
  '4abfa0afe52ad8126515a559da7c110c5f5d25f385ac2264886be17361d0a106';

async function temporaryDestination() {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'swift-resource-sync-'));
  return path.join(parent, 'Resources');
}

test('copies the exact catalog and one integrity-verified recording', async () => {
  const destination = await temporaryDestination();
  const selection = await syncSwiftResources({ root, destination });

  assert.equal(selection.recordingId, expectedRecordingId);
  assert.equal(selection.bytes, expectedBytes);
  assert.equal(selection.sha256, expectedSha256);
  assert.deepEqual(
    (await readdir(destination)).sort(),
    ['c-recto-canonical-roger-0.9.mp3', 'commands.json']
  );

  const [sourceCatalog, copiedCatalog, copiedAudio] = await Promise.all([
    readFile(path.join(root, 'data/commands.json')),
    readFile(path.join(destination, 'commands.json')),
    readFile(path.join(destination, 'c-recto-canonical-roger-0.9.mp3'))
  ]);

  assert.deepEqual(copiedCatalog, sourceCatalog);
  assert.equal(copiedAudio.byteLength, expectedBytes);
  assert.equal(
    createHash('sha256').update(copiedAudio).digest('hex'),
    expectedSha256
  );
});

test('fails before replacing existing resources when manifest integrity is wrong', async () => {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), 'swift-resource-fixture-')
  );
  const destination = await temporaryDestination();

  await mkdir(path.join(fixtureRoot, 'data'), { recursive: true });
  await cp(path.join(root, 'data/commands.json'), path.join(fixtureRoot, 'data/commands.json'));
  await cp(
    path.join(root, 'audio'),
    path.join(fixtureRoot, 'audio'),
    { recursive: true }
  );

  const manifest = JSON.parse(
    await readFile(path.join(root, 'data/audio-manifest.json'), 'utf8')
  );
  const selected = manifest.find(({ id }) => id === expectedRecordingId);
  selected.integrity.sha256 = '0'.repeat(64);
  await writeFile(
    path.join(fixtureRoot, 'data/audio-manifest.json'),
    JSON.stringify(manifest)
  );

  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'sentinel.txt'), 'keep me');

  await assert.rejects(
    syncSwiftResources({ root: fixtureRoot, destination }),
    /integrity/i
  );
  assert.deepEqual(await readdir(destination), ['sentinel.txt']);
  assert.equal(
    await readFile(path.join(destination, 'sentinel.txt'), 'utf8'),
    'keep me'
  );
});

test('rejects a missing exact recording before replacing resources', async () => {
  const fixtureRoot = await mkdtemp(
    path.join(os.tmpdir(), 'swift-resource-missing-')
  );
  const destination = await temporaryDestination();

  await mkdir(path.join(fixtureRoot, 'data'), { recursive: true });
  await cp(path.join(root, 'data/commands.json'), path.join(fixtureRoot, 'data/commands.json'));
  await writeFile(path.join(fixtureRoot, 'data/audio-manifest.json'), '[]');
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, 'sentinel.txt'), 'keep me');

  await assert.rejects(
    syncSwiftResources({ root: fixtureRoot, destination }),
    /recording/i
  );
  assert.deepEqual(await readdir(destination), ['sentinel.txt']);
});
