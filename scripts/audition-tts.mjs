import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve, sep } from 'node:path';

export const AUDITION_COMMAND_IDS = Object.freeze([
  'c-der',
  'c-rot3',
  'c-est',
  'c-adapte',
  'c-pre-largo-alcance'
]);

export const PROVIDERS = Object.freeze({
  elevenlabs: Object.freeze({
    apiKeyEnvironment: 'ELEVENLABS_API_KEY',
    model: 'eleven_multilingual_v2',
    nativeSpeed: true
  }),
  openai: Object.freeze({
    apiKeyEnvironment: 'OPENAI_API_KEY',
    model: 'gpt-4o-mini-tts',
    instructions: 'Speak in natural Spanish from Spain, in a calm neutral driving-examiner tone, at <speed description> speed. Do not add words.'
  })
});

const SPEEDS = new Set(['0.75', '0.9', '1']);
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DEFAULT_OUTPUT_DIRECTORY = resolve(PROJECT_ROOT, 'tmp/audio-audition');

export async function main(argv = process.argv.slice(2), environment = process.env, dependencies = {}) {
  const options = parseArguments(argv);
  const provider = PROVIDERS[options.provider];
  const commands = await loadAuditionCommands();
  const apiKey = environment[provider.apiKeyEnvironment];
  if (!apiKey?.trim()) {
    throw new Error(`${provider.apiKeyEnvironment} must be set in the environment`);
  }

  const plan = createAuditionPlan({ ...options, provider: options.provider, commands });
  const log = dependencies.log ?? console.log;
  log(`Validated ${commands.length} Spanish audition commands for ${plan.provider} (${plan.model}).`);
  log(`Output directory: ${plan.outputDirectory}`);

  const generated = await generateAudition(plan, {
    apiKey,
    fetchImpl: dependencies.fetchImpl ?? globalThis.fetch,
    mkdirImpl: dependencies.mkdirImpl ?? mkdir,
    writeFileImpl: dependencies.writeFileImpl ?? writeFile
  });
  log(`Generated ${generated.length} audition MP3 files.`);
  return { exitCode: 0, plan, generated };
}

export async function generateAudition(plan, { apiKey, fetchImpl, mkdirImpl, writeFileImpl }) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for provider generation');

  const outputDirectory = resolve(plan.outputDirectory);
  await mkdirImpl(outputDirectory, { recursive: true });

  const generated = [];
  for (const command of plan.commands) {
    const response = await requestProviderAudio(plan, command, apiKey, fetchImpl);
    if (!response.ok) throw new Error(`${plan.provider} generation failed with HTTP ${response.status}`);

    const path = auditionOutputPath(outputDirectory, command, plan.voice, plan.speed);
    const audio = new Uint8Array(await response.arrayBuffer());
    await writeFileImpl(path, audio);
    generated.push(Object.freeze({ ...command, path }));
  }
  return Object.freeze(generated);
}

async function requestProviderAudio(plan, command, apiKey, fetchImpl) {
  if (plan.provider === 'elevenlabs') {
    return fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(plan.voice)}`, {
      method: 'POST',
      headers: {
        accept: 'audio/mpeg',
        'content-type': 'application/json',
        ['xi-' + 'api-key']: apiKey
      },
      body: JSON.stringify({
        text: command.text,
        model_id: plan.model,
        voice_settings: { speed: plan.speed }
      })
    });
  }

  return fetchImpl('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      accept: 'audio/mpeg',
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: plan.model,
      voice: plan.voice,
      input: command.text,
      instructions: plan.instructions,
      response_format: 'mp3',
      speed: plan.speed
    })
  });
}

function auditionOutputPath(outputDirectory, command, voice, speed) {
  const fileName = [command.commandId, command.phrasingId, voice, speed]
    .map(value => encodeURIComponent(value))
    .join('--');
  const path = resolve(outputDirectory, `${fileName}.mp3`);
  if (!path.startsWith(`${outputDirectory}${sep}`)) {
    throw new Error('Audition output must stay within --out');
  }
  return path;
}

export function parseArguments(argv) {
  const options = { out: DEFAULT_OUTPUT_DIRECTORY };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!['--provider', '--voice', '--speed', '--out'].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    const key = flag.slice(2);
    if (options[key] !== undefined && key !== 'out') throw new Error(`${flag} may only be provided once`);
    options[key] = value;
    index += 1;
  }

  if (!Object.hasOwn(PROVIDERS, options.provider)) {
    throw new Error('provider must be elevenlabs or openai');
  }
  if (!options.voice) throw new Error('--voice requires a value');
  if (!SPEEDS.has(options.speed)) throw new Error('speed must be 0.75, 0.9, or 1');
  if (!isAbsolute(options.out)) throw new Error('--out must be an absolute directory');
  if (resolve(options.out) === sep) throw new Error('--out must not be the filesystem root');
  return Object.freeze({ provider: options.provider, voice: options.voice, speed: options.speed, out: options.out });
}

export function createAuditionPlan({ provider, voice, speed, out, commands }) {
  const configuration = PROVIDERS[provider];
  return Object.freeze({
    provider,
    model: configuration.model,
    voice,
    speed: Number(speed),
    outputDirectory: out,
    commands: Object.freeze(commands.map(command => Object.freeze({ ...command }))),
    ...(provider === 'elevenlabs' ? { nativeSpeed: true } : {
      instructions: configuration.instructions.replace('<speed description>', speedDescription(speed))
    })
  });
}

async function loadAuditionCommands() {
  const catalog = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  return AUDITION_COMMAND_IDS.map(commandId => {
    const command = catalog.find(candidate => candidate.id === commandId);
    const phrasing = command?.phrasings?.[0];
    if (!phrasing?.id || !phrasing.es) {
      throw new Error(`Missing canonical Spanish phrasing for ${commandId}`);
    }
    return { commandId, phrasingId: phrasing.id, text: phrasing.es };
  });
}

function speedDescription(speed) {
  return ({
    '0.75': 'a deliberately slow',
    '0.9': 'a slightly slow',
    '1': 'normal'
  })[speed];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
