import { mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { DRIVING_SCENES } from '../src/driving-scenes.js';
import { PRECHECK_SCENES } from '../src/precheck-scenes.js';

export async function optimizeRuntimeImages({ root, quality = 82 }) {
  const sources = [...new Set(
    [...Object.values(DRIVING_SCENES), ...Object.values(PRECHECK_SCENES)]
      .map(scene => scene.asset.replace(/^\.\//, '').replace(/\.webp$/, '.png'))
  )].sort();
  const results = [];

  for (const source of sources) {
    const output = source.replace(/\.png$/, '.webp');
    const sourcePath = resolve(root, source);
    const outputPath = resolve(root, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await sharp(sourcePath).webp({ quality, effort: 6 }).toFile(outputPath);
    results.push(Object.freeze({
      source,
      output,
      sourceBytes: (await stat(sourcePath)).size,
      outputBytes: (await stat(outputPath)).size
    }));
  }

  return Object.freeze(results);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = resolve(new URL('..', import.meta.url).pathname);
  const results = await optimizeRuntimeImages({ root });
  console.log(`Optimized ${results.length} runtime photographs.`);
}
