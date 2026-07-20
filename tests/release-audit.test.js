import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { buildRuntimePackage } from '../scripts/runtime-package.mjs';

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
    { label: 'OpenAI key assignment', matches: text => text.includes('OPENAI_API_KEY' + '=') },
    { label: 'ElevenLabs key assignment', matches: text => text.includes('ELEVENLABS_API_KEY' + '=') },
    {
      label: 'provider key value',
      matches: text => new RegExp(`\\b${'s' + 'k-'}[A-Za-z0-9_-]{8,}`).test(text)
    },
    { label: 'ElevenLabs key header', matches: text => text.includes('xi-' + 'api-key') }
  ];
  for (const path of await candidateTextFiles()) {
    const text = await readFile(path, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(pattern.matches(text), false, `${relative(ROOT, path)} contains forbidden credential-shaped text: ${pattern.label}`);
    }
  }
});

test('built runtime contains no development files or credential-shaped text', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'runtime-release-audit-'));
  const outDir = resolve(fixture, 'dist');
  try {
    await buildRuntimePackage({ root: ROOT, outDir });
    const paths = (await regularFiles(outDir)).map(path => relative(outDir, path));
    assert.equal(paths.some(path => /^(?:tests|docs|references|scripts)\//.test(path)), false);
    assert.equal(paths.some(path => /(?:^|\/)\.(?:git|superpowers)(?:\/|$)/.test(path)), false);
    assert.equal(paths.some(path => path.endsWith('.png') && !path.startsWith('icons/')), false);
    for (const path of await candidateTextFiles(outDir)) {
      const text = await readFile(path, 'utf8');
      assert.equal(text.includes('OPENAI_API_KEY' + '='), false);
      assert.equal(text.includes('ELEVENLABS_API_KEY' + '='), false);
      assert.equal(text.includes('xi-' + 'api-key'), false);
      assert.doesNotMatch(text, new RegExp(`\\b${'s' + 'k-'}[A-Za-z0-9_-]{8,}`));
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
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
  const [manifest, catalog] = await Promise.all([
    readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8').then(JSON.parse),
    readFile(resolve(ROOT, 'data/commands.json'), 'utf8').then(JSON.parse)
  ]);
  const phrasingCount = catalog.reduce((total, command) => total + command.phrasings.length, 0);
  const voiceCount = new Set(manifest.map(variant => variant.voiceId)).size;
  const speedCount = new Set(manifest.map(variant => variant.speed)).size;
  assert.equal(voiceCount, 2);
  assert.equal(speedCount, 3);
  assert.equal(manifest.length, phrasingCount * voiceCount * speedCount);
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

test('user-visible copy describes a generic manual car, not a Toyota Yaris Hybrid', async () => {
  const [readme, design, i18n, app] = await Promise.all([
    readFile(resolve(ROOT, 'README.md'), 'utf8'),
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8'),
    readFile(resolve(ROOT, 'src/i18n.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/app.js'), 'utf8')
  ]);

  assert.doesNotMatch(readme, /toyota|yaris hybrid|hybrid.*transmission/i);
  assert.doesNotMatch(app, /toyota|yaris hybrid/i);
  // design.md keeps one historical mention of the superseded hybrid manual by design; it must stay
  // clearly framed as history, not as current guidance.
  assert.match(design, /superseded hybrid\s+manual/i);
  assert.equal((design.match(/hybrid/gi) ?? []).length, 1, 'design.md must keep exactly the one historical "superseded hybrid manual" mention');

  const enBlock = i18n.slice(i18n.indexOf("const ENGLISH"), i18n.indexOf("const SPANISH"));
  const esBlock = i18n.slice(i18n.indexOf("const SPANISH"), i18n.indexOf("export const STRINGS"));
  assert.doesNotMatch(enBlock, /'reveal\.vehicle':[^\n]*(?:toyota|yaris|hybrid)/i);
  assert.doesNotMatch(enBlock, /'warning\.vehicle':[^\n]*(?:toyota|yaris|hybrid)/i);
  assert.doesNotMatch(esBlock, /'reveal\.vehicle':[^\n]*(?:toyota|yaris|h[ií]brido)/i);
  assert.doesNotMatch(esBlock, /'warning\.vehicle':[^\n]*(?:toyota|yaris|h[ií]brido)/i);
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
  assert.match(design, /Stage 2 implemented/i);
  assert.match(design, /photo-backed.*precise.*anchor/is);
  assert.match(design, /Article 92.*first.*uphill.*reverse.*downhill/is);
  assert.match(changelog, /photo-backed.*precheck/i);
  assert.match(changelog, /generic manual.*Article 92/i);
  assert.match(inventory, /photo-backed.*illustrative.*precise physical\s+feature/is);
  assert.match(inventory, /conventional.*battery.*under the\s+bonnet/is);
  assert.match(inventory, /manual immobilization.*Article 92|Article 92.*manual immobilization/is);
  assert.match(design, /simulation.*phrasing.*mastery.*deferred/is);
});

test('Release A documentation explains hosted installation, verified offline limits, updates, and recovery', async () => {
  const [readme, design] = await Promise.all([
    readFile(resolve(ROOT, 'README.md'), 'utf8'),
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8')
  ]);
  assert.match(readme, /https:\/\/jeffreythepea\.github\.io\/examen-practico-de-conducir\//);
  assert.match(readme, /Add to Home Screen/i);
  assert.match(readme, /Download for offline use/i);
  assert.match(readme, /Ready offline/i);
  assert.match(readme, /Safari[\s\S]*Export backup[\s\S]*Home Screen[\s\S]*Import backup/i);
  assert.match(readme, /(?:storage pressure[\s\S]*evict|evict[\s\S]*storage pressure)/i);
  assert.match(readme, /browser speech[\s\S]*not[\s\S]*offline guarantee/i);
  assert.match(readme, /serve:lan/);
  assert.match(readme, /serve:dist/);
  assert.match(design, /active[\s/-]*staging[\s/-]*pointer/i);
  assert.match(design, /schema 2/i);
  assert.match(design, /interrupted command[\s\S]*unscored/i);
  assert.match(design, /staged update[\s\S]*setup/i);
  assert.doesNotMatch(readme, /offline storage is permanent|native iPad app/i);
});

test('Release A records completed physical iPad acceptance', async () => {
  const [design, changelog] = await Promise.all([
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8'),
    readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8')
  ]);

  for (const check of [
    /installation/i,
    /complete-package\s+download/i,
    /Airplane\s+Mode\s+practice[\s\S]*recorded\s+media/i,
    /resume/i,
    /staged-update\s+recovery/i,
    /backup\s+transfer/i,
    /bilingual\s+UI/i,
    /touch\s+targets/i,
    /feedback\s+sounds/i,
    /no\s+Safari\s+Web\s+Inspector\s+warnings\s+or\s+errors/i,
    /two-column\s+landscape\s+prompt\s+and\s+reveal\s+layout/i
  ]) assert.match(design, check);
  assert.match(design, /Offline iPad Release A.*complete/i);
  assert.match(changelog, /Offline iPad Release A — complete/i);
});

test('release documentation defines recorded-first browser Spanish speech fallback', async () => {
  const [readme, changelog, design] = await Promise.all([
    readFile(resolve(ROOT, 'README.md'), 'utf8'),
    readFile(resolve(ROOT, 'CHANGELOG.md'), 'utf8'),
    readFile(resolve(ROOT, 'docs/design.md'), 'utf8')
  ]);

  for (const [name, text] of [['README', readme], ['CHANGELOG', changelog], ['design', design]]) {
    assert.match(text, /pre-generated|recorded|static MP3/i, `${name} must identify recorded audio as preferred`);
    assert.match(text, /automatic.*browser.*(?:Spanish|es-ES).*(?:fallback|missing|fail)|(?:fallback|missing|fail).*automatic.*browser.*(?:Spanish|es-ES)/is,
      `${name} must document browser Spanish fallback`);
    assert.match(text, /fallback.*scor|scor.*fallback/is, `${name} must document fallback scoring`);
    assert.doesNotMatch(text, /no browser[- ]speech fallback/i, `${name} must not describe fallback as absent`);
  }
  assert.match(readme, /no (?:runtime )?(?:credential|API key).*no backend|no backend.*no (?:runtime )?(?:credential|API key)/is);
  assert.match(design, /both.*(?:recorded|MP3).*browser.*fail.*unscored|unscored.*both.*(?:recorded|MP3).*browser.*fail/is);
});
