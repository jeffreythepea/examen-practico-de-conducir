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
const UNSAFE_MARKDOWN_SERVING_PATTERNS = Object.freeze([
  /http\.server/i,
  /\b0\.0\.0\.0\b/,
  /\[\s*::\s*\]/
]);
const UNSAFE_NORMALIZED_BIND_PATTERNS = Object.freeze([
  /(?:--host|--bind|-b)(?:\s*=\s*|\s+)::(?:\s|$)|(?:\bbind(?:ing)?(?:\s+to)?|\blisten(?:ing)?(?:\s+on)?)\s+::(?:\s|$)/i
]);

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

async function releaseDocumentationFiles() {
  return (await gitReleaseFiles()).filter(path => path.endsWith('.md'));
}

function assertSafeReleaseDocumentation(path, text) {
  for (const pattern of UNSAFE_MARKDOWN_SERVING_PATTERNS) {
    assert.doesNotMatch(text, pattern, `${path} contains an unsafe static-server instruction`);
  }
  const normalized = text
    .normalize('NFKC')
    .replace(/[`'"*_~\[\](){}<>.,;!?]/g, ' ')
    .replace(/\s+/g, ' ');
  for (const pattern of UNSAFE_NORMALIZED_BIND_PATTERNS) {
    assert.doesNotMatch(normalized, pattern, `${path} contains an unsafe static-server instruction`);
  }
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

test('all release documentation routes LAN use through serve:lan without repository-root server commands', async () => {
  const documentationFiles = await releaseDocumentationFiles();
  const documentationPaths = documentationFiles.map(path => relative(ROOT, path));
  assert.ok(documentationPaths.includes('AGENTS.md'), 'root AGENTS.md must be audited');
  assert.ok(documentationPaths.includes('references/audio-audition.md'), 'reference Markdown must be audited');
  const lanGuides = [];
  for (const path of documentationFiles) {
    const text = await readFile(path, 'utf8');
    assertSafeReleaseDocumentation(relative(ROOT, path), text);
    if (/same[- ]Wi-?Fi|local network|LAN bind/i.test(text)) lanGuides.push([path, text]);
  }
  assert.ok(lanGuides.length >= 2, 'README and implementation plan must document LAN use');
  for (const [path, text] of lanGuides) {
    assert.match(text, /serve:lan/, `${relative(ROOT, path)} must use serve:lan`);
  }
});

test('documentation audit rejects HTTP-server references and normalized wildcard-bind guidance', () => {
  const unsafeFixtures = [
    ['AGENTS.md', 'python -m http.server'],
    ['references/example.md', 'python3 -m http.server 9000 --directory .'],
    ['references/versioned.md', 'python3.14 -mhttp.server 8123'],
    ['docs/reference.md', 'The HTTP.SERVER module is convenient for previews.'],
    ['README.md', 'Serve with --host 0.0.0.0'],
    ['docs/design.md', 'Listen on [::] for LAN access'],
    ['docs/quoted.md', 'Listen on `"::"` for LAN access'],
    ['docs/spec.md', 'Start the server with --bind ::'],
    ['docs/equals-host.md', 'Start the server with --host=::'],
    ['docs/equals-single-quote.md', "Start the server with --bind='::'"],
    ['docs/equals-double-quote.md', 'Start the server with --bind="::"'],
    ['docs/short-option.md', 'Start the server with `-b "::"`.'],
    ['docs/prose.md', 'Bind to **`::`** for other devices.'],
    ['CHANGELOG.md', 'Binding to :: exposes every interface']
  ];
  for (const [path, text] of unsafeFixtures) {
    assert.throws(() => assertSafeReleaseDocumentation(path, text), /unsafe static-server instruction/);
  }
  assert.doesNotThrow(() => assertSafeReleaseDocumentation(
    'README.md',
    'Use `npm --prefix /project run serve:lan`; the hardened script owns the approved bind configuration.'
  ));
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
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8'),
    readFile(resolve(ROOT, 'references/fermin-atomic-command-inventory.md'), 'utf8')
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

test('Stage 2 release documents the activated action surfaces and review limits', async () => {
  const [catalogText, readme, changelog, design, inventory] = await Promise.all([
    readFile(resolve(ROOT, 'data/commands.json'), 'utf8'),
    readFile(resolve(ROOT, 'README.md'), 'utf8'),
    readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8'),
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8'),
    readFile(resolve(ROOT, 'references/fermin-atomic-command-inventory.md'), 'utf8')
  ]);
  const catalog = JSON.parse(catalogText);

  assert.deepEqual(
    catalog.filter(command => command.phase === 'driving' && command.surfaceId === 'option-grid-v1')
      .map(command => command.id).sort(),
    ['c-adapte', 'c-detencion', 'c-final']
  );
  assert.equal(catalog.filter(command => command.surfaceId === 'roundabout-v2').length, 5);
  assert.ok(catalog.filter(command => command.phase === 'precheck')
    .every(command => command.surfaceId.startsWith('yaris-') && command.surfaceId.endsWith('-v2')));

  assert.match(readme, /action-matched response model/i);
  assert.match(readme, /landscape iPad/i);
  assert.match(readme, /exactly three semantic exceptions/i);
  assert.match(readme, /c-adapte.*c-detencion.*c-final/s);
  assert.match(readme, /parking.*stopping.*provisional/i);
  assert.match(readme, /photo-backed.*icon-first prechecks/i);
  assert.match(readme, /precise physical anchors/i);
  assert.match(readme, /illustrative generic images/i);
  assert.match(readme, /conventional.*battery.*under the bonnet/i);
  assert.match(readme, /Article 92.*manual immobilization/i);
  assert.match(readme, /actual test car.*confirm/i);
  assert.match(readme, /npm --prefix \/Users\/jeffreypease\/Projects\/examen-practico-de-conducir run serve:lan/);
  assert.doesNotMatch(readme, /python3 -m http\.server/);
  assert.match(readme, /rejects dotfiles.*\.git.*\.superpowers/i);
  assert.doesNotMatch(readme, /battery is represented beneath the rear-right seat|battery.*never in the engine bay/i);
  assert.doesNotMatch(readme, /securing the vehicle uses.*selector-P|current `c-inmov`.*selector-P/i);
  assert.match(readme, /browser.*automation.*export.*import.*manual.*smoke/i);
  assert.match(changelog, /Stage 2 action surfaces/i);
  assert.match(design, /Stage 2 implemented for review/i);
  assert.match(design, /photo-backed.*precise.*anchor/is);
  assert.match(design, /Article 92.*first.*uphill.*reverse.*downhill/is);
  assert.match(changelog, /photo-backed.*precheck/i);
  assert.match(changelog, /generic manual.*Article 92/i);
  assert.match(inventory, /photo-backed.*illustrative.*precise physical\s+feature/is);
  assert.match(inventory, /conventional.*battery.*under the\s+bonnet/is);
  assert.match(inventory, /manual immobilization.*Article 92|Article 92.*manual immobilization/is);
  assert.match(design, /simulation.*phrasing.*mastery.*deferred/is);
});
