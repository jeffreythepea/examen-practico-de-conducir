import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { activeCommands } from '../src/catalog.js';
import { generateSurface } from '../src/surfaces.js';
import { hasTurnClip } from '../src/turn-through.js';

export const GLYPH_AUDIT_SEEDS = Object.freeze(
  Array.from({ length: 100 }, (_, seed) => seed)
);

/**
 * Find active route-backed commands whose normal correct reveal still uses
 * the animated post-answer car because no scene/result clip is registered.
 */
export function auditGoldGlyphConsumers(catalog, seeds = GLYPH_AUDIT_SEEDS) {
  if (!Array.isArray(seeds) || seeds.length === 0 || seeds.some(seed => !Number.isInteger(seed))) {
    throw new Error('Gold-glyph audit requires a nonempty integer seed list');
  }

  const findings = new Map();
  for (const command of activeCommands(catalog)) {
    for (const seed of seeds) {
      const surface = generateSurface(command, seed);
      if (!Array.isArray(surface?.geometry?.correctRoute)) continue;
      const sceneId = surface.geometry.sceneId;
      const resultId = surface.expectedResult;
      if (hasTurnClip(sceneId, resultId)) continue;

      const key = [command.id, command.surfaceId, sceneId, resultId].join('\u0000');
      if (!findings.has(key)) {
        findings.set(key, Object.freeze({
          commandId: command.id,
          actionId: command.actionId,
          surfaceId: command.surfaceId,
          sceneId,
          resultId,
          family: surface.family
        }));
      }
    }
  }

  return Object.freeze([...findings.values()].sort((left, right) => (
    left.commandId.localeCompare(right.commandId)
      || left.sceneId.localeCompare(right.sceneId)
      || left.resultId.localeCompare(right.resultId)
  )));
}

export function formatGoldGlyphAudit(findings) {
  if (!Array.isArray(findings)) throw new Error('Gold-glyph findings must be an array');
  if (findings.length === 0) return '0 active normal-path gold-glyph consumers.\n';
  return `${findings.length} active normal-path gold-glyph consumers:\n${findings
    .map(finding => `- ${finding.commandId} | ${finding.surfaceId} | ${finding.sceneId} / ${finding.resultId}`)
    .join('\n')}\n`;
}

function parseArguments(argv) {
  const flags = new Set(argv);
  for (const flag of flags) {
    if (flag !== '--check' && flag !== '--json') throw new Error(`Unknown option: ${flag}`);
  }
  return { check: flags.has('--check'), json: flags.has('--json') };
}

function main(argv) {
  const options = parseArguments(argv);
  const commandUrl = new URL('../data/commands.json', import.meta.url);
  const catalog = JSON.parse(fs.readFileSync(commandUrl, 'utf8'));
  const findings = auditGoldGlyphConsumers(catalog);
  process.stdout.write(options.json
    ? `${JSON.stringify(findings, null, 2)}\n`
    : formatGoldGlyphAudit(findings));
  if (options.check && findings.length > 0) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2));
}
