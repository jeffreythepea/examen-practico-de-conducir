import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';

export const AUDIO_SPEEDS = Object.freeze([0.75, 0.9, 1]);
export const AUDIO_DIRECTORY = fileURLToPath(new URL('../audio', import.meta.url));

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const MANIFEST_PATH = resolve(PROJECT_ROOT, 'data/audio-manifest.json');
const PROVIDER = Object.freeze({
  name: 'elevenlabs',
  apiKeyEnvironment: 'ELEVENLABS_API_KEY',
  model: 'eleven_multilingual_v2'
});
const SAFE_PATH_COMPONENT = /^[A-Za-z0-9_-]+$/;
const AUDIO_MARKER = '.gitkeep';

export async function main(argv = process.argv.slice(2), environment = process.env, dependencies = {}) {
  const options = parseArguments(argv);
  const apiKey = environment[PROVIDER.apiKeyEnvironment];
  if (!apiKey?.trim()) {
    throw new Error(`${PROVIDER.apiKeyEnvironment} must be set in the environment`);
  }

  const catalog = dependencies.catalog ?? await loadCatalog(dependencies.readFileImpl ?? readFile);
  const plan = buildGenerationPlan({ catalog, provider: options.provider, voices: options.voices });
  const log = dependencies.log ?? console.log;
  log(`Generating ${plan.variants.length} Spanish MP3 files with ${plan.provider} (${plan.model}).`);

  const result = await generateCorpus(plan, {
    apiKey,
    fetchImpl: dependencies.fetchImpl ?? globalThis.fetch,
    mkdirImpl: dependencies.mkdirImpl ?? mkdir,
    writeFileImpl: dependencies.writeFileImpl ?? writeFile,
    renameImpl: dependencies.renameImpl ?? rename,
    unlinkImpl: dependencies.unlinkImpl ?? unlink,
    rmImpl: dependencies.rmImpl ?? rm,
    statImpl: dependencies.statImpl ?? stat,
    readFileImpl: dependencies.readFileImpl ?? readFile,
    runId: dependencies.runId,
    log
  });
  log(`Generated ${result.manifest.length} static audio variants.`);
  return Object.freeze({ exitCode: 0, plan, manifest: result.manifest });
}

export function parseArguments(argv) {
  const options = { voices: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!['--provider', '--voice'].includes(flag)) throw new Error(`Unknown argument: ${flag}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    if (flag === '--provider') {
      if (options.provider) throw new Error('--provider may only be provided once');
      options.provider = value;
    } else {
      if (!SAFE_PATH_COMPONENT.test(value)) {
        throw new Error('voice IDs may contain only letters, numbers, underscores, and hyphens');
      }
      if (options.voices.includes(value)) throw new Error(`duplicate voice ID: ${value}`);
      options.voices.push(value);
    }
    index += 1;
  }

  if (options.provider !== PROVIDER.name) throw new Error('provider must be elevenlabs');
  if (options.voices.length === 0) throw new Error('--voice requires at least one value');
  return Object.freeze({ provider: options.provider, voices: Object.freeze([...options.voices]) });
}

export function buildGenerationPlan({ catalog, provider, voices }) {
  if (provider !== PROVIDER.name) throw new Error('provider must be elevenlabs');
  validateVoiceIds(voices);
  const canonicalCommands = canonicalCommandsFrom(catalog);
  const textsByVariantId = {};
  const variants = canonicalCommands.flatMap(command => voices.flatMap(voiceId => AUDIO_SPEEDS.map(speed => {
    const path = `audio/${command.commandId}/${command.phrasingId}/${voiceId}/${speed}.mp3`;
    const variant = Object.freeze({
      id: `${command.commandId}--${command.phrasingId}--${voiceId}--${speed}`,
      commandId: command.commandId,
      phrasingId: command.phrasingId,
      voiceId,
      speed,
      provider: PROVIDER.name,
      model: PROVIDER.model,
      path
    });
    textsByVariantId[variant.id] = command.text;
    return variant;
  })));

  return Object.freeze({
    provider: PROVIDER.name,
    model: PROVIDER.model,
    voices: Object.freeze([...voices]),
    audioDirectory: AUDIO_DIRECTORY,
    manifestPath: MANIFEST_PATH,
    variants: Object.freeze(variants),
    textsByVariantId: Object.freeze(textsByVariantId)
  });
}

export async function generateCorpus(plan, dependencies) {
  const {
    apiKey,
    fetchImpl,
    mkdirImpl,
    writeFileImpl,
    renameImpl,
    unlinkImpl = unlink,
    rmImpl = rm,
    statImpl = stat,
    readFileImpl = readFile,
    runId,
    log = () => {}
  } = dependencies;
  if (!apiKey?.trim()) throw new Error(`${PROVIDER.apiKeyEnvironment} must be set in the environment`);
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for provider generation');

  const staging = stagingPaths(runId);
  try {
    const manifest = [];
    for (let index = 0; index < plan.variants.length; index += 1) {
      const variant = plan.variants[index];
      const response = await requestElevenLabsAudio(variant, plan.textsByVariantId?.[variant.id], apiKey, fetchImpl);
      if (!response.ok) throw new Error(`ElevenLabs generation failed for ${variant.id} with HTTP ${response.status}`);
      const audio = new Uint8Array(await response.arrayBuffer());
      if (audio.byteLength === 0) throw new Error(`ElevenLabs returned an empty audio asset for ${variant.id}`);

      await writeAtomically(stagedAudioPath(variant.path, staging.audioDirectory), audio, index, {
        mkdirImpl,
        writeFileImpl,
        renameImpl,
        unlinkImpl
      });
      manifest.push(Object.freeze({
        ...manifestRecord(variant),
        integrity: Object.freeze({
          bytes: audio.byteLength,
          sha256: sha256(audio)
        })
      }));
      log(`Generated ${index + 1}/${plan.variants.length}: ${variant.id}`);
    }

    const frozenManifest = Object.freeze(manifest);
    await writeAtomically(resolve(staging.audioDirectory, AUDIO_MARKER), '', plan.variants.length, {
      mkdirImpl,
      writeFileImpl,
      renameImpl,
      unlinkImpl
    });
    await validateGeneratedAssetFiles(frozenManifest, {
      audioDirectory: staging.audioDirectory,
      statImpl,
      readFileImpl
    });
    await writeAtomically(staging.manifestPath, `${JSON.stringify(frozenManifest, null, 2)}\n`, plan.variants.length + 1, {
      mkdirImpl,
      writeFileImpl,
      renameImpl,
      unlinkImpl
    });
    await publishStagedCorpus(staging, { renameImpl, rmImpl });
    return Object.freeze({ manifest: frozenManifest });
  } finally {
    await removeStaging(staging, { rmImpl, unlinkImpl });
  }
}

export async function validateGeneratedAssetFiles(manifest, {
  audioDirectory = AUDIO_DIRECTORY,
  statImpl = stat,
  readFileImpl = readFile
} = {}) {
  if (!Array.isArray(manifest)) throw new Error('Audio manifest must be an array');
  for (const variant of manifest) {
    const assetPath = assetPathInDirectory(variant?.path, audioDirectory);
    const integrity = variant?.integrity;
    if (!Number.isInteger(integrity?.bytes) || integrity.bytes <= 0 || !/^[a-f\d]{64}$/.test(integrity.sha256 ?? '')) {
      throw new Error(`invalid integrity metadata for ${variant?.id ?? '<unknown>'}`);
    }
    const details = await statImpl(assetPath);
    if (details.size === 0) throw new Error(`empty audio asset: ${variant.path}`);
    if (details.size !== integrity.bytes) throw new Error(`size mismatch for ${variant.path}`);
    const content = await readFileImpl(assetPath);
    if (sha256(content) !== integrity.sha256) throw new Error(`checksum mismatch for ${variant.path}`);
  }
}

function canonicalCommandsFrom(catalog) {
  if (!Array.isArray(catalog) || catalog.length !== 30) {
    throw new Error('Catalog must contain exactly 30 canonical commands');
  }
  const commandIds = new Set();
  return catalog.map(command => {
    const commandId = command?.id;
    const phrasing = command?.phrasings?.[0];
    if (!SAFE_PATH_COMPONENT.test(commandId ?? '')) throw new Error(`invalid command ID: ${commandId ?? '<unknown>'}`);
    if (commandIds.has(commandId)) throw new Error(`duplicate command ID: ${commandId}`);
    commandIds.add(commandId);
    if (phrasing?.id !== `${commandId}-canonical` || !phrasing.es?.trim()) {
      throw new Error(`Missing canonical Spanish phrasing for ${commandId}`);
    }
    if (!SAFE_PATH_COMPONENT.test(phrasing.id)) throw new Error(`invalid phrasing ID: ${phrasing.id}`);
    return Object.freeze({ commandId, phrasingId: phrasing.id, text: phrasing.es });
  });
}

function validateVoiceIds(voices) {
  if (!Array.isArray(voices) || voices.length === 0) throw new Error('at least one voice is required');
  const seen = new Set();
  for (const voiceId of voices) {
    if (!SAFE_PATH_COMPONENT.test(voiceId ?? '')) {
      throw new Error('voice IDs may contain only letters, numbers, underscores, and hyphens');
    }
    if (seen.has(voiceId)) throw new Error(`duplicate voice ID: ${voiceId}`);
    seen.add(voiceId);
  }
}

async function requestElevenLabsAudio(variant, text, apiKey, fetchImpl) {
  if (!text?.trim()) throw new Error(`Missing Spanish text for ${variant.id}`);
  return fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(variant.voiceId)}`, {
    method: 'POST',
    headers: {
      accept: 'audio/mpeg',
      'content-type': 'application/json',
      ['xi-' + 'api-key']: apiKey
    },
    body: JSON.stringify({
      text,
      model_id: variant.model,
      voice_settings: { speed: variant.speed }
    })
  });
}

async function writeAtomically(path, content, sequence, { mkdirImpl, writeFileImpl, renameImpl, unlinkImpl }) {
  const destination = resolve(path);
  const temporary = `${destination}.tmp-${process.pid}-${sequence}`;
  await mkdirImpl(dirname(destination), { recursive: true });
  try {
    await writeFileImpl(temporary, content);
    await renameImpl(temporary, destination);
  } catch (error) {
    await unlinkImpl?.(temporary).catch(() => {});
    throw error;
  }
}

function manifestRecord(variant) {
  return variant;
}

function absoluteAudioPath(path) {
  return assetPathInDirectory(path, AUDIO_DIRECTORY);
}

function assetPathInDirectory(path, audioDirectory) {
  if (typeof path !== 'string' || !path.startsWith('audio/')) {
    throw new Error('audio path must be relative to audio/');
  }
  const absoluteDirectory = resolve(audioDirectory);
  const absolutePath = resolve(absoluteDirectory, path.slice('audio/'.length));
  if (!absolutePath.startsWith(`${absoluteDirectory}${sep}`)) {
    throw new Error('audio output must stay within the repository audio directory');
  }
  return absolutePath;
}

function stagedAudioPath(path, stagingAudioDirectory) {
  return assetPathInDirectory(path, stagingAudioDirectory);
}

function stagingPaths(runId = `${process.pid}-${Date.now()}`) {
  if (!SAFE_PATH_COMPONENT.test(runId)) throw new Error('invalid generation run ID');
  return Object.freeze({
    audioDirectory: resolve(PROJECT_ROOT, `audio.staging-${runId}`),
    backupAudioDirectory: resolve(PROJECT_ROOT, `audio.backup-${runId}`),
    manifestPath: resolve(PROJECT_ROOT, `data/audio-manifest.json.staging-${runId}`)
  });
}

async function publishStagedCorpus(staging, { renameImpl, rmImpl }) {
  let audioBackedUp = false;
  let stagedAudioPublished = false;
  try {
    await renameImpl(AUDIO_DIRECTORY, staging.backupAudioDirectory);
    audioBackedUp = true;
    await renameImpl(staging.audioDirectory, AUDIO_DIRECTORY);
    stagedAudioPublished = true;
    await renameImpl(staging.manifestPath, MANIFEST_PATH);
  } catch (error) {
    const rollbackErrors = [];
    // Audio and manifest live in separate directories, so no single filesystem rename can publish both atomically.
    // On a normal publish failure, restore the prior audio tree before surfacing the error.
    if (stagedAudioPublished) {
      try {
        await renameImpl(AUDIO_DIRECTORY, staging.audioDirectory);
        stagedAudioPublished = false;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (audioBackedUp) {
      try {
        await renameImpl(staging.backupAudioDirectory, AUDIO_DIRECTORY);
        audioBackedUp = false;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], 'Audio publication failed and restoration needs attention');
    }
    throw error;
  }
  await rmImpl(staging.backupAudioDirectory, { recursive: true, force: true }).catch(() => {});
}

async function removeStaging(staging, { rmImpl, unlinkImpl }) {
  await rmImpl(staging.audioDirectory, { recursive: true, force: true }).catch(() => {});
  await unlinkImpl(staging.manifestPath).catch(() => {});
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function loadCatalog(readFileImpl) {
  return JSON.parse(await readFileImpl(new URL('../data/commands.json', import.meta.url), 'utf8'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
