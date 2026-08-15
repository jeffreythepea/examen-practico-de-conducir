import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';

import commands from '../data/commands.json' with { type: 'json' };
import {
  GLYPH_AUDIT_SEEDS,
  auditGoldGlyphConsumers,
  formatGoldGlyphAudit,
  sweepGoldGlyphConsumers
} from '../scripts/audit-gold-glyph.mjs';

const COMPLETED_BACKLOG = Object.freeze([
  Object.freeze({
    commandId: 'c-incorp',
    actionId: 'join-traffic',
    surfaceId: 'join-traffic-v1',
    sceneId: 'join-traffic-photo-v1',
    resultId: 'join-traffic',
    family: 'join-traffic'
  }),
  Object.freeze({
    commandId: 'c-sentido',
    actionId: 'change-direction',
    surfaceId: 'u-turn-v1',
    sceneId: 'u-turn-photo-v1',
    resultId: 'change-direction',
    family: 'u-turn'
  })
]);

test('gold-glyph audit covers a fixed seed sweep and reports zero active consumers', () => {
  assert.equal(GLYPH_AUDIT_SEEDS.length, 100);
  assert.deepEqual(GLYPH_AUDIT_SEEDS, Array.from({ length: 100 }, (_, seed) => seed));
  assert.deepEqual(auditGoldGlyphConsumers(commands), []);
});

test('a clean gold-glyph sweep is a sweep that actually looked at the catalog', () => {
  // The audit skips any surface without a correctRoute array and passes on
  // zero findings, so a generator that stopped emitting routes — or an empty
  // catalog — would report the same clean bill as a fixed one.
  const sweep = sweepGoldGlyphConsumers(commands);
  assert.deepEqual(sweep.findings, []);
  assert.ok(sweep.routeBackedSurfaces > 0, 'the sweep visited no route-backed surface');
  assert.ok(sweep.clipMatches > 0, 'the sweep matched no registered clip');
  assert.equal(sweep.clipMatches, sweep.routeBackedSurfaces);
  assert.deepEqual(sweepGoldGlyphConsumers([]), {
    findings: [], routeBackedSurfaces: 0, clipMatches: 0
  });
});

test('gold-glyph audit deduplicates seeds and excludes inactive commands', () => {
  const result = auditGoldGlyphConsumers([
    commands.find(command => command.id === 'c-sentido'),
    commands.find(command => command.id === 'c-rot4'),
    commands.find(command => command.id === 'c-rot5')
  ]);
  assert.deepEqual(result, []);
  assert.ok(Object.isFrozen(result));
});

test('human-readable audit groups findings and reports a clean zero state', () => {
  const report = formatGoldGlyphAudit(COMPLETED_BACKLOG);
  assert.match(report, /^2 active normal-path gold-glyph consumers:/);
  assert.match(report, /c-incorp \| join-traffic-v1 \| join-traffic-photo-v1 \/ join-traffic/);
  assert.match(report, /c-sentido \| u-turn-v1 \| u-turn-photo-v1 \/ change-direction/);
  assert.equal(formatGoldGlyphAudit([]), '0 active normal-path gold-glyph consumers.\n');
});

test('CLI reports zero findings and --check succeeds', () => {
  const report = execFileSync(process.execPath, ['scripts/audit-gold-glyph.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(report, '0 active normal-path gold-glyph consumers.\n');

  const checked = spawnSync(process.execPath, ['scripts/audit-gold-glyph.mjs', '--check'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(checked.status, 0);
  assert.equal(checked.stdout, '0 active normal-path gold-glyph consumers.\n');
});

test('checked-in glyph backlog records both active scene/result pairs', () => {
  const backlog = fs.readFileSync('docs/reviews/2026-08-15-gold-glyph-backlog.md', 'utf8');
  for (const finding of COMPLETED_BACKLOG) {
    const row = backlog.split('\n').find(line => line.startsWith(`| \`${finding.commandId}\` |`));
    assert.ok(row, `missing backlog row for ${finding.commandId}`);
    assert.ok(
      row.includes(`\`${finding.sceneId}\` / \`${finding.resultId}\``),
      `missing scene/result pair for ${finding.commandId}`
    );
  }
});

test('obsolete animated glyph modules and runtime references stay removed', () => {
  assert.equal(fs.existsSync('src/post-answer-motion.js'), false);
  assert.equal(fs.existsSync('src/post-answer-motion-view.js'), false);
  for (const path of [
    'src/app.js',
    'src/spatial-surfaces.js',
    'src/manoeuvre-surfaces.js',
    'src/turn-through.js',
    'styles.css'
  ]) {
    const source = fs.readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /post-answer-motion|data-route-car|route-car__body/, path);
  }
});
