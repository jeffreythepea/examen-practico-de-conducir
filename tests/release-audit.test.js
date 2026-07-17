import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const execFileAsync = promisify(execFile);
const EXCLUDED_RELEASE_PREFIXES = Object.freeze(['audio/']);

async function candidateTextFiles(directory = ROOT) {
  const files = directory === ROOT
    ? await gitReleaseFiles()
    : await regularFiles(directory);
  const textFiles = [];
  for (const path of files) {
    const contents = await readFile(path);
    if (!contents.includes(0)) textFiles.push(path);
  }
  return textFiles;
}

async function gitReleaseFiles() {
  const { stdout } = await execFileAsync('git', [
    'ls-files', '--cached', '--others', '--exclude-standard', '-z'
  ], { cwd: ROOT, encoding: 'buffer' });
  return stdout.toString('utf8').split('\0').filter(Boolean)
    .filter(path => !EXCLUDED_RELEASE_PREFIXES.some(prefix => path.startsWith(prefix)))
    .map(path => resolve(ROOT, path));
}

async function regularFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await regularFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

test('release candidate contains no credential-shaped text', async () => {
  const forbidden = [
    'OPENAI_API_KEY' + '=',
    'ELEVENLABS_API_KEY' + '=',
    's' + 'k-',
    'xi-' + 'api-key'
  ];
  for (const path of await candidateTextFiles()) {
    const text = await readFile(path, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(text.includes(pattern), false, `${relative(ROOT, path)} contains forbidden credential-shaped text: ${pattern}`);
    }
  }
});

test('release text discovery includes extensionless files and dotfiles while skipping binary data', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'release-audit-'));
  try {
    await writeFile(resolve(fixture, 'NOTICE'), 'ordinary release text');
    await writeFile(resolve(fixture, '.env.example'), 'example variable name only');
    await writeFile(resolve(fixture, 'binary.dat'), Buffer.from([0, 1, 2, 3]));

    const names = (await candidateTextFiles(fixture)).map(path => basename(path)).sort();
    assert.deepEqual(names, ['.env.example', 'NOTICE']);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('audio manifest references complete nonempty static assets', async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));
  assert.equal(manifest.length, 180);
  for (const variant of manifest) {
    const assetPath = resolve(ROOT, variant.path.replace(/^\.\//, ''));
    assert.ok(assetPath.startsWith(`${ROOT}/audio/`), `${variant.id} must stay inside audio/`);
    assert.ok((await stat(assetPath)).size > 0, `${variant.id} asset must be nonempty`);
  }
});

test('release identity, isolation, scope, and bilingual AI voice disclosure are explicit', async () => {
  const [html, app, i18n, storage, readme, design] = await Promise.all([
    readFile(resolve(ROOT, 'index.html'), 'utf8'),
    readFile(resolve(ROOT, 'src/app.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/i18n.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/storage.js'), 'utf8'),
    readFile(resolve(ROOT, 'README.md'), 'utf8'),
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8')
  ]);

  assert.match(i18n, /'audio\.disclosure': 'These voices are AI-generated\.'/);
  assert.match(i18n, /'audio\.disclosure': 'Estas voces han sido generadas por inteligencia artificial\.'/);
  assert.match(app, /translate\(locale\(\), 'audio\.disclosure'\)/);
  assert.match(html, /<title>Examen Práctico de Conducir<\/title>/);
  assert.match(i18n, /'app\.shortTitle': 'Examen Práctico'/);
  assert.match(app, /translate\(locale\(\), 'app\.shortTitle'\)/);
  assert.doesNotMatch(storage, /piso-asturiano/);
  assert.match(design, /no runtime dependency on Piso Asturiano/i);
  assert.match(readme, /no runtime dependency on Piso Asturiano/i);
  assert.match(readme, /Stage 2[^\n]*deferred/i);
});
