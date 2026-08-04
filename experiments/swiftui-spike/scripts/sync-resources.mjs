import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUTPUT_AUDIO_NAME = 'c-recto-canonical-roger-0.9.mp3';

function asArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function syncSwiftResources({
  root,
  destination,
  commandId = 'c-recto',
  phrasingId = 'c-recto-canonical',
  voiceId = 'CwhRBWXzGAHq8TQ4Fs17',
  speed = 0.9
}) {
  if (typeof root !== 'string' || typeof destination !== 'string') {
    throw new TypeError('root and destination must be paths');
  }

  const catalogPath = path.join(root, 'data/commands.json');
  const manifestPath = path.join(root, 'data/audio-manifest.json');
  const [catalogBytes, manifestText] = await Promise.all([
    readFile(catalogPath),
    readFile(manifestPath, 'utf8')
  ]);

  const commands = asArray(JSON.parse(catalogBytes.toString('utf8')), 'catalog');
  const manifest = asArray(JSON.parse(manifestText), 'audio manifest');

  const command = commands.find(({ id }) => id === commandId);
  if (!command) {
    throw new Error(`Missing catalog command: ${commandId}`);
  }
  if (!command.phrasings?.some(({ id }) => id === phrasingId)) {
    throw new Error(`Missing catalog phrasing: ${phrasingId}`);
  }

  const recording = manifest.find(
    (candidate) =>
      candidate.commandId === commandId &&
      candidate.phrasingId === phrasingId &&
      candidate.voiceId === voiceId &&
      candidate.speed === speed
  );
  if (!recording) {
    throw new Error('Missing exact Swift spike recording');
  }
  if (
    !recording.integrity ||
    !Number.isInteger(recording.integrity.bytes) ||
    typeof recording.integrity.sha256 !== 'string'
  ) {
    throw new Error('Recording integrity metadata is missing');
  }

  const audioPath = path.join(root, recording.path);
  const audioBytes = await readFile(audioPath);
  const sha256 = createHash('sha256').update(audioBytes).digest('hex');
  if (
    audioBytes.byteLength !== recording.integrity.bytes ||
    sha256 !== recording.integrity.sha256
  ) {
    throw new Error('Recording integrity check failed');
  }

  const parent = path.dirname(destination);
  const suffix = randomUUID();
  const staging = path.join(parent, `.Resources-staging-${suffix}`);
  const backup = path.join(parent, `.Resources-backup-${suffix}`);
  const hadDestination = await exists(destination);

  await mkdir(parent, { recursive: true });
  await mkdir(staging);

  try {
    await Promise.all([
      writeFile(path.join(staging, 'commands.json'), catalogBytes),
      writeFile(path.join(staging, OUTPUT_AUDIO_NAME), audioBytes)
    ]);

    if (hadDestination) {
      await rename(destination, backup);
    }

    try {
      await rename(staging, destination);
    } catch (error) {
      if (hadDestination) {
        await rename(backup, destination);
      }
      throw error;
    }

    if (hadDestination) {
      await rm(backup, { recursive: true });
    }
  } catch (error) {
    await rm(staging, { force: true, recursive: true });
    throw error;
  }

  return Object.freeze({
    recordingId: recording.id,
    bytes: audioBytes.byteLength,
    sha256
  });
}

const isCli =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const destination = fileURLToPath(
    new URL('../ExamenPracticoSpike/Resources', import.meta.url)
  );

  await syncSwiftResources({ root, destination });
  process.stdout.write(`Synced Swift resources to ${destination}\n`);
}
