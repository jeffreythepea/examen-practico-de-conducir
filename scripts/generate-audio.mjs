import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
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
    copyFileImpl: dependencies.copyFileImpl ?? copyFile,
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
  const commandPhrasings = commandPhrasingsFrom(catalog);
  const textsByVariantId = {};
  const variants = commandPhrasings.flatMap(command => voices.flatMap(voiceId => AUDIO_SPEEDS.map(speed => {
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
    copyFileImpl = copyFile,
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

  const staging = stagingPaths(plan, runId);
  const recovery = recoveryPaths(runId);
  const existingManifest = dependencies.existingManifest
    ?? await readJsonArray(plan.manifestPath, readFileImpl);
  const recoveryManifest = dependencies.recoveryManifest
    ?? await readJsonArray(recovery.manifestPath, readFileImpl);
  const existingById = new Map(existingManifest.map(record => [record.id, record]));
  const recoveryById = new Map(recoveryManifest.map(record => [record.id, record]));
  let reusedProduction = 0;
  let reusedRecovery = 0;
  let generated = 0;
  let completed = false;
  try {
    const manifest = [];
    for (let index = 0; index < plan.variants.length; index += 1) {
      const variant = plan.variants[index];
      let record = existingById.get(variant.id);
      if (await isReusableRecord(record, variant, plan.audioDirectory, { statImpl, readFileImpl })) {
        await copyAtomically(
          assetPathInDirectory(record.path, plan.audioDirectory),
          stagedAudioPath(variant.path, staging.audioDirectory),
          index,
          { mkdirImpl, copyFileImpl, renameImpl, unlinkImpl }
        );
        reusedProduction += 1;
        log(`Reused production ${index + 1}/${plan.variants.length}: ${variant.id}`);
      } else {
        record = recoveryById.get(variant.id);
        if (await isReusableRecord(record, variant, recovery.audioDirectory, { statImpl, readFileImpl })) {
          reusedRecovery += 1;
          log(`Reused recovery ${index + 1}/${plan.variants.length}: ${variant.id}`);
        } else {
          const response = await requestElevenLabsAudio(variant, plan.textsByVariantId?.[variant.id], apiKey, fetchImpl);
          if (!response.ok) throw new Error(`ElevenLabs generation failed for ${variant.id} with HTTP ${response.status}`);
          const audio = new Uint8Array(await response.arrayBuffer());
          if (audio.byteLength === 0) throw new Error(`ElevenLabs returned an empty audio asset for ${variant.id}`);
          record = Object.freeze({
            ...manifestRecord(variant),
            integrity: Object.freeze({ bytes: audio.byteLength, sha256: sha256(audio) })
          });
          await writeAtomically(assetPathInDirectory(variant.path, recovery.audioDirectory), audio, index, {
            mkdirImpl,
            writeFileImpl,
            renameImpl,
            unlinkImpl
          });
          recoveryById.set(variant.id, record);
          await writeRecoveryManifest(recovery, [...recoveryById.values()], index, {
            mkdirImpl,
            writeFileImpl,
            renameImpl,
            unlinkImpl
          });
          generated += 1;
          log(`Generated ${index + 1}/${plan.variants.length}: ${variant.id}`);
        }
        await copyAtomically(
          assetPathInDirectory(record.path, recovery.audioDirectory),
          stagedAudioPath(variant.path, staging.audioDirectory),
          index,
          { mkdirImpl, copyFileImpl, renameImpl, unlinkImpl }
        );
      }
      manifest.push(Object.freeze({ ...record, integrity: Object.freeze({ ...record.integrity }) }));
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
    await publishStagedCorpus(plan, staging, { renameImpl, rmImpl });
    completed = true;
    return Object.freeze({ manifest: frozenManifest, reusedProduction, reusedRecovery, generated });
  } finally {
    await removeStaging(staging, { rmImpl, unlinkImpl });
    if (completed) await rmImpl(recovery.directory, { recursive: true, force: true }).catch(() => {});
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

function commandPhrasingsFrom(catalog) {
  if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('Catalog must contain commands');
  const commandIds = new Set();
  const phrasingIds = new Set();
  return catalog.flatMap(command => {
    const commandId = command?.id;
    if (!SAFE_PATH_COMPONENT.test(commandId ?? '')) throw new Error(`invalid command ID: ${commandId ?? '<unknown>'}`);
    if (commandIds.has(commandId)) throw new Error(`duplicate command ID: ${commandId}`);
    commandIds.add(commandId);
    if (!Array.isArray(command.phrasings) || command.phrasings.length === 0
        || command.phrasings[0]?.id !== `${commandId}-canonical`) {
      throw new Error(`Missing canonical Spanish phrasing for ${commandId}`);
    }
    return command.phrasings.map(phrasing => {
      if (!SAFE_PATH_COMPONENT.test(phrasing?.id ?? '')) throw new Error(`invalid phrasing ID: ${phrasing?.id ?? '<unknown>'}`);
      if (phrasingIds.has(phrasing.id)) throw new Error(`duplicate phrasing ID: ${phrasing.id}`);
      phrasingIds.add(phrasing.id);
      if (!phrasing.es?.trim()) throw new Error(`Missing Spanish text for ${phrasing.id}`);
      return Object.freeze({ commandId, phrasingId: phrasing.id, text: phrasing.es });
    });
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

async function copyAtomically(source, destination, sequence, { mkdirImpl, copyFileImpl, renameImpl, unlinkImpl }) {
  const resolvedDestination = resolve(destination);
  const temporary = `${resolvedDestination}.tmp-${process.pid}-${sequence}`;
  await mkdirImpl(dirname(resolvedDestination), { recursive: true });
  try {
    await copyFileImpl(source, temporary);
    await renameImpl(temporary, resolvedDestination);
  } catch (error) {
    await unlinkImpl?.(temporary).catch(() => {});
    throw error;
  }
}

async function writeRecoveryManifest(recovery, manifest, sequence, dependencies) {
  const ordered = manifest.toSorted((left, right) => left.id.localeCompare(right.id));
  await writeAtomically(recovery.manifestPath, `${JSON.stringify(ordered, null, 2)}\n`, sequence, dependencies);
}

async function isReusableRecord(record, variant, audioDirectory, { statImpl, readFileImpl }) {
  if (!record || !sameVariant(record, variant) || !validIntegrity(record.integrity)) return false;
  try {
    const path = assetPathInDirectory(record.path, audioDirectory);
    const details = await statImpl(path);
    if (details.size !== record.integrity.bytes || details.size <= 0) return false;
    return sha256(await readFileImpl(path)) === record.integrity.sha256;
  } catch {
    return false;
  }
}

function sameVariant(record, variant) {
  return ['id', 'commandId', 'phrasingId', 'voiceId', 'speed', 'provider', 'model', 'path']
    .every(field => record[field] === variant[field]);
}

function validIntegrity(integrity) {
  return Number.isInteger(integrity?.bytes)
    && integrity.bytes > 0
    && /^[a-f\d]{64}$/.test(integrity.sha256 ?? '');
}

async function readJsonArray(path, readFileImpl) {
  try {
    const parsed = JSON.parse(await readFileImpl(path, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`Expected JSON array in ${path}`);
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
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

function stagingPaths(plan, runId = 'audio-expansion') {
  if (!SAFE_PATH_COMPONENT.test(runId)) throw new Error('invalid generation run ID');
  return Object.freeze({
    audioDirectory: resolve(dirname(plan.audioDirectory), `audio.staging-${runId}`),
    backupAudioDirectory: resolve(dirname(plan.audioDirectory), `audio.backup-${runId}`),
    manifestPath: resolve(dirname(plan.manifestPath), `audio-manifest.json.staging-${runId}`)
  });
}

function recoveryPaths(runId = 'audio-expansion') {
  if (!SAFE_PATH_COMPONENT.test(runId)) throw new Error('invalid generation run ID');
  const directory = resolve(PROJECT_ROOT, '.superpowers/sdd/audio-expansion-recovery', runId);
  return Object.freeze({
    directory,
    audioDirectory: resolve(directory, 'audio'),
    manifestPath: resolve(directory, 'manifest.json')
  });
}

async function publishStagedCorpus(plan, staging, { renameImpl, rmImpl }) {
  let audioBackedUp = false;
  let stagedAudioPublished = false;
  try {
    await renameImpl(plan.audioDirectory, staging.backupAudioDirectory);
    audioBackedUp = true;
    await renameImpl(staging.audioDirectory, plan.audioDirectory);
    stagedAudioPublished = true;
    await renameImpl(staging.manifestPath, plan.manifestPath);
  } catch (error) {
    const rollbackErrors = [];
    // Audio and manifest live in separate directories, so no single filesystem rename can publish both atomically.
    // On a normal publish failure, restore the prior audio tree before surfacing the error.
    if (stagedAudioPublished) {
      try {
        await renameImpl(plan.audioDirectory, staging.audioDirectory);
        stagedAudioPublished = false;
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (audioBackedUp) {
      try {
        await renameImpl(staging.backupAudioDirectory, plan.audioDirectory);
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
