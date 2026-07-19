import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REVIEW_ROOT = 'docs/mockups/driving-surfaces';

test('driving mockup page exposes three review-only scenes and no production script', async () => {
  const html = await readFile(`${REVIEW_ROOT}/index.html`, 'utf8');
  assert.deepEqual(
    [...html.matchAll(/class="scene-card" data-scene="([^"]+)"/g)].map(match => match[1]),
    ['overtaking', 'roundabout-four-exit', 'legal-stopping']
  );
  assert.equal((html.match(/class="scene-base"/g) ?? []).length, 3);
  assert.doesNotMatch(html, /src="(?:\.\.\/)+src\/|src="\/src\//);
});

test('every review target declares an accessible label and a 44px minimum', async () => {
  const [html, css] = await Promise.all([
    readFile(`${REVIEW_ROOT}/index.html`, 'utf8'),
    readFile(`${REVIEW_ROOT}/mockups.css`, 'utf8')
  ]);
  const targets = [...html.matchAll(/<button class="target[^>]+>/g)].map(match => match[0]);
  assert.ok(targets.length >= 7);
  targets.forEach(target => assert.match(target, /aria-label="[^"]+"/));
  assert.match(css, /min-width:\s*44px/);
  assert.match(css, /min-height:\s*44px/);
});

test('overtaking review separates learner, lead, follow, and pass geometry', async () => {
  const html = await readFile(`${REVIEW_ROOT}/index.html`, 'utf8');
  const card = html.match(/<figure class="scene-card" data-scene="overtaking">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.match(card, /overtaking-v1\.png/);
  assert.match(card, /data-role="learner-vehicle"/);
  assert.match(card, /data-role="lead-vehicle"/);
  assert.match(card, /data-target="safe-follow"/);
  assert.match(card, /data-target="passing-lane"/);
  assert.match(card, /data-correct-route/);
});

test('roundabout review uses a packaged base plate, bottom entry, and exactly four exits', async () => {
  const [html, bytes] = await Promise.all([
    readFile(`${REVIEW_ROOT}/index.html`, 'utf8'),
    readFile(`${REVIEW_ROOT}/roundabout-four-exit-v1.png`)
  ]);
  const card = html.match(/<figure class="scene-card" data-scene="roundabout-four-exit">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(card, /roundabout-four-exit-v1\.png/);
  assert.match(card, /data-entry="bottom"/);
  assert.equal((card.match(/data-exit="[1-4]"/g) ?? []).length, 4);
  assert.doesNotMatch(card, /data-exit="5"/);
});

test('legal-stopping review packages one legal curb and two contextual restrictions', async () => {
  const [html, bytes] = await Promise.all([
    readFile(`${REVIEW_ROOT}/index.html`, 'utf8'),
    readFile(`${REVIEW_ROOT}/legal-stopping-v1.png`)
  ]);
  const card = html.match(/<figure class="scene-card" data-scene="legal-stopping">([\s\S]*?)<\/figure>/)?.[1] ?? '';
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.match(card, /legal-stopping-v1\.png/);
  assert.equal((card.match(/data-legality="legal"/g) ?? []).length, 1);
  assert.equal((card.match(/data-legality="illegal"/g) ?? []).length, 2);
  assert.match(card, /data-context="crossing"/);
  assert.match(card, /data-context="driveway"/);
});

test('mockup assets remain review-only and document AI provenance', async () => {
  const assetNames = [
    'overtaking-v1.png',
    'roundabout-four-exit-v1.png',
    'legal-stopping-v1.png'
  ];
  for (const filename of assetNames) {
    const bytes = await readFile(`${REVIEW_ROOT}/${filename}`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  }

  const production = await Promise.all([
    readFile('src/manoeuvre-surfaces.js', 'utf8'),
    readFile('src/spatial-surfaces.js', 'utf8'),
    readFile('src/app.js', 'utf8')
  ]);
  production.forEach(source => assert.doesNotMatch(source, /docs\/mockups\/driving-surfaces/));

  const readme = await readFile(`${REVIEW_ROOT}/README.md`, 'utf8');
  assert.match(readme, /built-in image-generation workflow/i);
  assert.match(readme, /not a real Asturias test route/i);
  assetNames.forEach(filename => assert.match(readme, new RegExp(filename.replace('.', '\\.'))));
});
