import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AUDIO_DIRECTORY,
  AUDIO_SPEEDS,
  buildGenerationPlan,
  generateCorpus,
  main,
  parseArguments,
  validateGeneratedAssetFiles
} from '../scripts/generate-audio.mjs';

const voices = Object.freeze([
  'CwhRBWXzGAHq8TQ4Fs17',
  'EXAVITQu4vr4xnSDxMaL'
]);

function catalog() {
  return [
    {
      id: 'c-01',
      phrasings: [
        { id: 'c-01-canonical', es: 'Instrucción española 1' },
        { id: 'c-01-alt-1', es: 'Otra instrucción española 1' }
      ]
    },
    { id: 'c-02', phrasings: [{ id: 'c-02-canonical', es: 'Instrucción española 2' }] }
  ];
}

test('plans every phrasing for an arbitrary catalog, selected voices, and provider-native speeds', () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices });

  assert.deepEqual(AUDIO_SPEEDS, [0.75, 0.9, 1]);
  assert.equal(plan.variants.length, 18);
  assert.equal(plan.audioDirectory, AUDIO_DIRECTORY);
  assert.deepEqual(plan.variants[0], {
    id: 'c-01--c-01-canonical--CwhRBWXzGAHq8TQ4Fs17--0.75',
    commandId: 'c-01',
    phrasingId: 'c-01-canonical',
    voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
    speed: 0.75,
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    path: 'audio/c-01/c-01-canonical/CwhRBWXzGAHq8TQ4Fs17/0.75.mp3'
  });
  assert.deepEqual(plan.variants.at(-1), {
    id: 'c-02--c-02-canonical--EXAVITQu4vr4xnSDxMaL--1',
    commandId: 'c-02',
    phrasingId: 'c-02-canonical',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    speed: 1,
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    path: 'audio/c-02/c-02-canonical/EXAVITQu4vr4xnSDxMaL/1.mp3'
  });
  assert.equal(plan.textsByVariantId['c-01--c-01-alt-1--CwhRBWXzGAHq8TQ4Fs17--0.75'], 'Otra instrucción española 1');
});

test('rejects configurations that cannot safely produce the complete selected corpus', () => {
  assert.throws(
    () => parseArguments(['--provider', 'openai', '--voice', voices[0]]),
    /provider must be elevenlabs/
  );
  assert.throws(
    () => parseArguments(['--provider', 'elevenlabs']),
    /--voice requires at least one value/
  );
  assert.throws(
    () => parseArguments(['--provider', 'elevenlabs', '--voice', '../outside']),
    /voice IDs may contain only/
  );
  assert.doesNotThrow(() => buildGenerationPlan({ catalog: catalog().slice(0, 1), provider: 'elevenlabs', voices }));
  assert.throws(
    () => buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: ['../outside'] }),
    /voice IDs may contain only/
  );
});

test('generates one MP3 per planned variant and atomically replaces the manifest without exposing credentials', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices });
  const calls = [];
  const writes = [];
  const renames = [];
  const messages = [];
  const bytes = new Uint8Array([1, 2, 3, 4]);

  const result = await generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [],
    recoveryManifest: [],
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(bytes, { status: 200 });
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (path, content) => { writes.push({ path, content }); },
    copyFileImpl: async () => {},
    renameImpl: async (from, to) => { renames.push({ from, to }); },
    rmImpl: async () => {},
    statImpl: async () => ({ size: bytes.byteLength }),
    readFileImpl: async () => bytes,
    runId: 'test-success',
    log: message => { messages.push(message); }
  });

  assert.equal(result.manifest.length, 18);
  assert.equal(calls.length, 18);
  assert.equal(result.generated, 18);
  assert.ok(writes.length >= 20);
  assert.ok(renames.length >= 23);
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-speech/CwhRBWXzGAHq8TQ4Fs17');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    text: 'Instrucción española 1',
    model_id: 'eleven_multilingual_v2',
    voice_settings: { speed: 0.75 }
  });
  assert.equal(calls[0].options.headers['xi-' + 'api-key'], 'secret-not-for-output');
  assert.match(writes[0].path, /audio-expansion-recovery\/test-success\/audio\/c-01\/c-01-canonical\/CwhRBWXzGAHq8TQ4Fs17\/0\.75\.mp3\.tmp-/);
  assert.match(writes.at(-1).path, /data\/audio-manifest\.json\.staging-test-success\.tmp-/);
  assert.ok(writes.some(({ path }) => path.includes('/audio.staging-test-success/.gitkeep.tmp-')));
  assert.ok(renames.some(({ to }) => to.endsWith('/audio')));
  assert.ok(renames.some(({ to }) => to.endsWith('/data/audio-manifest.json')));
  assert.deepEqual(result.manifest[0].integrity, {
    bytes: 4,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
  assert.doesNotMatch(messages.join('\n'), /secret-not-for-output/);
});

test('reuses a verified production variant and requests only missing audio', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const bytes = new Uint8Array([4, 3, 2, 1]);
  const existing = {
    ...plan.variants[0],
    integrity: {
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  };
  let calls = 0;
  const copies = [];

  const result = await generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [existing],
    recoveryManifest: [],
    fetchImpl: async () => { calls += 1; return new Response(bytes, { status: 200 }); },
    mkdirImpl: async () => {},
    writeFileImpl: async () => {},
    copyFileImpl: async (from, to) => { copies.push({ from, to }); },
    renameImpl: async () => {},
    rmImpl: async () => {},
    statImpl: async () => ({ size: bytes.byteLength }),
    readFileImpl: async () => bytes,
    runId: 'reuse-production'
  });

  assert.equal(calls, plan.variants.length - 1);
  assert.equal(result.reusedProduction, 1);
  assert.ok(copies.some(({ from }) => from.endsWith(existing.path.slice('audio/'.length))));
});

test('provider failure preserves each completed missing variant for a restart', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const writes = [];
  const removals = [];
  let calls = 0;

  await assert.rejects(() => generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [],
    recoveryManifest: [],
    fetchImpl: async () => {
      calls += 1;
      return new Response(new Uint8Array([1, 2]), { status: calls === 2 ? 429 : 200 });
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (path, content) => { writes.push({ path, content }); },
    copyFileImpl: async () => {},
    renameImpl: async () => {},
    rmImpl: async path => { removals.push(path); },
    statImpl: async () => ({ size: 2 }),
    readFileImpl: async () => new Uint8Array([1, 2]),
    runId: 'recover-provider'
  }), /HTTP 429/);

  assert.equal(calls, 2);
  assert.ok(writes.some(({ path }) => path.includes('/.superpowers/sdd/audio-expansion-recovery/') && path.includes('/manifest.json.tmp-')));
  assert.ok(!removals.some(path => path.includes('/.superpowers/sdd/audio-expansion-recovery')));
});

test('restart reuses a verified recovery variant instead of charging the provider again', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const bytes = new Uint8Array([1, 2]);
  const recovered = {
    ...plan.variants[0],
    integrity: {
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  };
  let calls = 0;

  const result = await generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [],
    recoveryManifest: [recovered],
    fetchImpl: async () => { calls += 1; return new Response(bytes, { status: 200 }); },
    mkdirImpl: async () => {},
    writeFileImpl: async () => {},
    copyFileImpl: async () => {},
    renameImpl: async () => {},
    rmImpl: async () => {},
    statImpl: async () => ({ size: bytes.byteLength }),
    readFileImpl: async () => bytes,
    runId: 'restart-recovery'
  });

  assert.equal(result.reusedRecovery, 1);
  assert.equal(calls, plan.variants.length - 1);
});

test('provider failure mid-run leaves the production corpus and manifest untouched while cleaning staging', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const writes = [];
  const renames = [];
  const removals = [];
  let calls = 0;

  await assert.rejects(() => generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [],
    recoveryManifest: [],
    fetchImpl: async () => {
      calls += 1;
      return new Response(new Uint8Array([1]), { status: calls === 2 ? 500 : 200 });
    },
    mkdirImpl: async () => {},
    writeFileImpl: async (path, content) => { writes.push({ path, content }); },
    copyFileImpl: async () => {},
    renameImpl: async (from, to) => { renames.push({ from, to }); },
    rmImpl: async path => { removals.push(path); },
    runId: 'provider-failure'
  }), /HTTP 500/);

  assert.equal(calls, 2);
  assert.ok(writes.some(({ path }) => path.includes('/audio-expansion-recovery/provider-failure/')));
  assert.ok(renames.every(({ to }) => !to.endsWith('/audio') && !to.endsWith('/data/audio-manifest.json')));
  assert.ok(removals.some(path => path.endsWith('/audio.staging-provider-failure')));
  assert.ok(!removals.some(path => path.endsWith('/audio') || path.endsWith('/data/audio-manifest.json')));
});

test('staged integrity validation failure leaves production corpus and manifest untouched while cleaning staging', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const renames = [];
  const removals = [];

  await assert.rejects(() => generateCorpus(plan, {
    apiKey: 'secret-not-for-output',
    existingManifest: [],
    recoveryManifest: [],
    fetchImpl: async () => new Response(new Uint8Array([1]), { status: 200 }),
    mkdirImpl: async () => {},
    writeFileImpl: async () => {},
    copyFileImpl: async () => {},
    renameImpl: async (from, to) => { renames.push({ from, to }); },
    rmImpl: async path => { removals.push(path); },
    statImpl: async () => ({ size: 0 }),
    readFileImpl: async () => new Uint8Array([1]),
    runId: 'integrity-failure'
  }), /empty audio asset/);

  assert.ok(renames.every(({ to }) =>
    to.includes('/audio.staging-integrity-failure/')
    || to.includes('/audio-manifest.json.staging-integrity-failure')
    || to.includes('/audio-expansion-recovery/integrity-failure/')
  ));
  assert.ok(removals.some(path => path.endsWith('/audio.staging-integrity-failure')));
  assert.ok(!removals.some(path => path.endsWith('/audio') || path.endsWith('/data/audio-manifest.json')));
});

test('validates that every generated manifest asset exists, is nonzero, and matches its recorded integrity metadata', async () => {
  const plan = buildGenerationPlan({ catalog: catalog(), provider: 'elevenlabs', voices: [voices[0]] });
  const bytes = new Uint8Array([8, 6, 7, 5]);
  const manifest = plan.variants.map(variant => ({
    ...variant,
    integrity: {
      bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  }));

  await assert.doesNotReject(() => validateGeneratedAssetFiles(manifest, {
    statImpl: async () => ({ size: bytes.byteLength }),
    readFileImpl: async () => bytes
  }));

  await assert.rejects(
    () => validateGeneratedAssetFiles(manifest, {
      statImpl: async () => ({ size: 0 }),
      readFileImpl: async () => bytes
    }),
    /empty audio asset/
  );
});

test('main refuses missing credentials before provider generation', async () => {
  await assert.rejects(
    () => main(['--provider', 'elevenlabs', '--voice', voices[0]], {}, { catalog: catalog() }),
    /ELEVENLABS_API_KEY must be set/
  );
});
