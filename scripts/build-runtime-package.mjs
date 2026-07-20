import { resolve } from 'node:path';
import { buildRuntimePackage } from './runtime-package.mjs';

const root = resolve(new URL('..', import.meta.url).pathname);
const result = await buildRuntimePackage({ root, outDir: resolve(root, 'dist') });
console.log(`Built runtime package ${result.version}.`);
console.log(`${result.assets.length} assets, ${result.totalBytes} bytes.`);
console.log(`Recorded corpus complete: ${result.recordedCorpusComplete}.`);
