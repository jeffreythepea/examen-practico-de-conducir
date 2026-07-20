import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Pages deploys only the verified runtime after tests and build succeed', async () => {
  const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*main/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run release:check/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /path:\s*['"]?\.[/'"]?\s*$/m);
  assert.doesNotMatch(workflow, /ELEVENLABS|OPENAI|generate-audio/i);
});
