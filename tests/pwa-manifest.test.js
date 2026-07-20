import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('web-app manifest provides subdirectory-safe standalone landscape identity', async () => {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'manifest.webmanifest'), 'utf8'));

  assert.equal(manifest.id, './');
  assert.equal(manifest.name, 'Examen Práctico de Conducir');
  assert.equal(manifest.short_name, 'Examen Práctico');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'landscape');
  assert.equal(manifest.background_color, '#f5f5f3');
  assert.equal(manifest.theme_color, '#1f6f50');
  assert.deepEqual(
    manifest.icons.map(({ src, sizes, type, purpose }) => ({ src, sizes, type, purpose })),
    [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: undefined },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: undefined },
      { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  );
});

test('manifest and Apple icon assets are valid nonempty PNGs at their declared sizes', async () => {
  for (const [path, expectedSize] of [
    ['icons/apple-touch-icon-180.png', 180],
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/icon-maskable-512.png', 512]
  ]) {
    const png = await readFile(resolve(ROOT, path));
    assert.ok(png.length > 100, `${path} must be nonempty`);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), expectedSize, `${path} width`);
    assert.equal(png.readUInt32BE(20), expectedSize, `${path} height`);
  }
});

test('document head references relative PWA assets while retaining iPad standalone metadata', async () => {
  const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');

  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon-180\.png">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="Examen Práctico">/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/);
  assert.match(html, /<meta name="apple-mobile-web-app-status-bar-style" content="default">/);
});

test('initial offline recovery page is bilingual and does not claim readiness', async () => {
  const html = await readFile(resolve(ROOT, 'offline.html'), 'utf8');

  assert.match(html, /Reconnect and reopen the app/i);
  assert.match(html, /Vuelve a conectarte y abre de nuevo la aplicación/i);
  assert.doesNotMatch(html, /Ready offline/i);
});
