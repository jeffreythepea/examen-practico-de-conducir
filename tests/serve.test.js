import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isForbiddenPathname, parseServerOptions } from '../scripts/serve-options.mjs';

test('server options default to loopback and accept only the explicit all-interface LAN bind', () => {
  assert.deepEqual(parseServerOptions([], {}), { host: '127.0.0.1', port: 4173 });
  assert.deepEqual(parseServerOptions(['--host', '0.0.0.0'], {}), { host: '0.0.0.0', port: 4173 });
  assert.deepEqual(parseServerOptions(['--host=0.0.0.0'], { PORT: '4310' }), {
    host: '0.0.0.0',
    port: 4310
  });
  assert.throws(() => parseServerOptions(['--host', '192.168.1.8'], {}), /Unsupported host/);
  assert.throws(() => parseServerOptions(['--host'], {}), /requires a value/);
  assert.throws(() => parseServerOptions(['--public'], {}), /Unknown server option/);
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

test('package and same-Wi-Fi docs route LAN use through the hardened server', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts['serve:lan'], 'node scripts/serve.mjs --host 0.0.0.0');
  assert.match(readme, /npm --prefix .* run serve:lan/);
  assert.doesNotMatch(readme, /python3 -m http\.server/);
  assert.match(readme, /rejects dotfiles/i);
});
