import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { AUDITION_COMMAND_IDS, PROVIDERS, main, parseArguments } from '../scripts/audition-tts.mjs';

const script = new URL('../scripts/audition-tts.mjs', import.meta.url);

test('defines the exact eight-command audition set and approved provider configuration', () => {
  assert.deepEqual(AUDITION_COMMAND_IDS, [
    'c-der', 'c-recto', 'c-rot3', 'c-rot5', 'c-est', 'c-adapte',
    'c-pre-capo', 'c-pre-desempanar-delantera'
  ]);
  assert.deepEqual(PROVIDERS.elevenlabs, {
    apiKeyEnvironment: 'ELEVENLABS_API_KEY',
    model: 'eleven_multilingual_v2',
    nativeSpeed: true
  });
  assert.deepEqual(PROVIDERS.openai, {
    apiKeyEnvironment: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini-tts',
    instructions: 'Speak in natural Spanish from Spain, in a calm neutral driving-examiner tone, at <speed description> speed. Do not add words.'
  });
});

test('rejects invalid arguments and missing provider credentials without writing or contacting a provider', async () => {
  const invalidProvider = await run('--provider', 'other', '--voice', 'voice-a', '--speed', '0.9');
  assert.equal(invalidProvider.code, 1);
  assert.match(invalidProvider.stderr, /provider must be elevenlabs or openai/);

  const relativeOutput = await run('--provider', 'openai', '--voice', 'voice-a', '--speed', '1', '--out', 'tmp/audio');
  assert.equal(relativeOutput.code, 1);
  assert.match(relativeOutput.stderr, /--out must be an absolute directory/);

  const rootOutput = await run('--provider', 'openai', '--voice', 'voice-a', '--speed', '1', '--out', '/');
  assert.equal(rootOutput.code, 1);
  assert.match(rootOutput.stderr, /--out must not be the filesystem root/);

  const noKey = await run('--provider', 'elevenlabs', '--voice', 'voice-a', '--speed', '0.75', '--out', '/tmp/examen-practico-audition');
  assert.equal(noKey.code, 1);
  assert.match(noKey.stderr, /ELEVENLABS_API_KEY must be set/);
});

test('accepts a bounded audition-only brisk speed without changing production speeds', () => {
  assert.deepEqual(
    parseArguments(['--provider', 'elevenlabs', '--voice', 'voice-a', '--speed', '1.15', '--out', '/tmp/examen-practico-hard-mode']),
    {
      provider: 'elevenlabs',
      voice: 'voice-a',
      speed: '1.15',
      out: '/tmp/examen-practico-hard-mode'
    }
  );
});

test('generates one ElevenLabs MP3 for every audition command without exposing its credential', async () => {
  const calls = [];
  const writes = [];
  const messages = [];
  const result = await main(
    ['--provider', 'elevenlabs', '--voice', 'voice-a', '--speed', '0.75', '--out', '/tmp/examen-practico-audition'],
    { ELEVENLABS_API_KEY: 'secret-not-for-output' },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
      mkdirImpl: async () => {},
      statImpl: missingFileStat,
      writeFileImpl: async (path, audio) => { writes.push({ path, audio }); },
      log: message => { messages.push(message); }
    }
  );

  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 8);
  assert.equal(writes.length, 8);
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-speech/voice-a');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    text: 'Gire a la derecha cuando pueda',
    model_id: 'eleven_multilingual_v2',
    voice_settings: { speed: 0.75 }
  });
  assert.equal(calls[0].options.headers['xi-' + 'api-key'], 'secret-not-for-output');
  assert.match(writes[0].path, /^\/tmp\/examen-practico-audition\//);
  assert.match(writes[0].path, /\.mp3$/);
  assert.ok(writes.every(({ audio }) => audio instanceof Uint8Array));
  assert.doesNotMatch(messages.join('\n'), /secret-not-for-output/);
});

test('uses OpenAI native speed and the required Spain-Spanish examiner instructions', async () => {
  const calls = [];
  const writes = [];
  const messages = [];
  const result = await main(
    ['--provider', 'openai', '--voice', 'marin', '--speed', '0.9', '--out', '/tmp/examen-practico-openai-audition'],
    { OPENAI_API_KEY: 'openai-secret-not-for-output' },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(new Uint8Array([4, 5, 6]), { status: 200 });
      },
      mkdirImpl: async () => {},
      statImpl: missingFileStat,
      writeFileImpl: async (path, audio) => { writes.push({ path, audio }); },
      log: message => { messages.push(message); }
    }
  );

  assert.equal(result.exitCode, 0);
  assert.equal(calls.length, 8);
  assert.equal(writes.length, 8);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/audio/speech');
  assert.equal(calls[0].options.headers.authorization, 'Bearer openai-secret-not-for-output');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    model: 'gpt-4o-mini-tts',
    voice: 'marin',
    input: 'Gire a la derecha cuando pueda',
    instructions: 'Speak in natural Spanish from Spain, in a calm neutral driving-examiner tone, at a slightly slow speed. Do not add words.',
    response_format: 'mp3',
    speed: 0.9
  });
  assert.ok(writes.every(({ path, audio }) => path.startsWith('/tmp/examen-practico-openai-audition/') && audio instanceof Uint8Array));
  assert.doesNotMatch(messages.join('\n'), /openai-secret-not-for-output/);
});

test('reuses existing nonempty audition files so an interrupted paid run is resumable', async () => {
  const calls = [];
  const writes = [];
  const messages = [];
  const result = await main(
    ['--provider', 'elevenlabs', '--voice', 'voice-a', '--speed', '1', '--out', '/tmp/examen-practico-audition'],
    { ELEVENLABS_API_KEY: 'secret-not-for-output' },
    {
      fetchImpl: async (...args) => {
        calls.push(args);
        return new Response(new Uint8Array([1]), { status: 200 });
      },
      mkdirImpl: async () => {},
      writeFileImpl: async (...args) => { writes.push(args); },
      statImpl: async () => ({ size: 123 }),
      log: message => { messages.push(message); }
    }
  );

  assert.equal(result.generated.length, 8);
  assert.equal(calls.length, 0);
  assert.equal(writes.length, 0);
  assert.ok(result.generated.every(item => item.reused === true));
  assert.match(messages.join('\n'), /Reused 8 existing audition MP3 files/);
  assert.doesNotMatch(messages.join('\n'), /secret-not-for-output/);
});

async function missingFileStat() {
  const error = new Error('missing test file');
  error.code = 'ENOENT';
  throw error;
}

function run(...args) {
  let environment = {};
  if (typeof args.at(-1) === 'object') environment = args.pop();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script.pathname, ...args], {
      env: { ...process.env, ELEVENLABS_API_KEY: '', OPENAI_API_KEY: '', ...environment }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}
