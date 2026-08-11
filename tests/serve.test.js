import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isForbiddenPathname, parseByteRange, parseServerOptions } from '../scripts/serve-options.mjs';

test('server options default to loopback and accept only the explicit all-interface LAN bind', () => {
  assert.deepEqual(parseServerOptions([], {}), { host: '127.0.0.1', port: 4173, root: 'project' });
  assert.deepEqual(parseServerOptions(['--host', '0.0.0.0'], {}), { host: '0.0.0.0', port: 4173, root: 'project' });
  assert.deepEqual(parseServerOptions(['--host=0.0.0.0'], { PORT: '4310' }), {
    host: '0.0.0.0',
    port: 4310,
    root: 'project'
  });
  assert.throws(() => parseServerOptions(['--host', '192.168.1.8'], {}), /Unsupported host/);
  assert.throws(() => parseServerOptions(['--host'], {}), /requires a value/);
  assert.throws(() => parseServerOptions(['--public'], {}), /Unknown server option/);
});

test('server root is constrained to the project or its generated distribution', () => {
  assert.equal(parseServerOptions([]).root, 'project');
  assert.equal(parseServerOptions(['--root', 'dist']).root, 'dist');
  assert.equal(parseServerOptions(['--root=project']).root, 'project');
  assert.throws(() => parseServerOptions(['--root', '..']), /root/i);
  assert.throws(() => parseServerOptions(['--root', '/tmp']), /root/i);
});

test('server path policy rejects repository and nested dotfiles before filesystem resolution', () => {
  for (const pathname of [
    '/.git/config',
    '/.superpowers/sdd/stage2-final-review.md',
    '/src/.secret',
    '/assets/../.git/HEAD'
  ]) {
    assert.equal(isForbiddenPathname(pathname), true, pathname);
  }
  assert.equal(isForbiddenPathname('/'), false);
  assert.equal(isForbiddenPathname('/src/app.js'), false);
});

test('byte-range parsing serves iPadOS Safari video and stays lenient on bad headers', () => {
  assert.deepEqual(parseByteRange('bytes=0-1023', 4096), { start: 0, end: 1023 });
  assert.deepEqual(parseByteRange('bytes=1024-', 4096), { start: 1024, end: 4095 });
  assert.deepEqual(parseByteRange('bytes=0-9999', 4096), { start: 0, end: 4095 });
  assert.deepEqual(parseByteRange('bytes=-512', 4096), { start: 3584, end: 4095 });
  assert.equal(parseByteRange('bytes=4096-', 4096), 'unsatisfiable');
  assert.equal(parseByteRange('bytes=-0', 4096), 'unsatisfiable');
  for (const invalid of [undefined, '', 'bytes=-', 'bytes=5-2', 'items=0-1', 'bytes=0-1,4-5']) {
    assert.equal(parseByteRange(invalid, 4096), null, String(invalid));
  }
});

test('package and same-Wi-Fi docs route LAN use through the hardened server', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['serve:lan'], 'node scripts/serve.mjs --host 0.0.0.0');
  assert.equal(packageJson.scripts['serve:dist'], 'npm run build:runtime && node scripts/serve.mjs --root dist');
  assert.match(readme, /npm --prefix .* run serve:lan/);
  assert.doesNotMatch(readme, /python3 -m http\.server/);
  assert.match(readme, /rejects dotfiles/i);
});
