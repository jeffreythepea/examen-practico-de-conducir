import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectMovingRoadTrials } from '../moving-road-data.js';

const ROOT = resolve(new URL('../../../', import.meta.url).pathname);
const commands = JSON.parse(await readFile(resolve(ROOT, 'data/commands.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/audio-manifest.json'), 'utf8'));

const EXPECTED = [
  {
    commandId: 'c-izq',
    phrasingId: 'c-izq-canonical',
    es: 'Gire a la izquierda cuando pueda',
    en: 'turn left when you can',
    acceptedResult: 'turn-left',
    audioPath: '../../audio/c-izq/c-izq-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  },
  {
    commandId: 'c-recto',
    phrasingId: 'c-recto-canonical',
    es: 'Siga todo recto',
    en: 'continue straight ahead',
    acceptedResult: 'continue-forward',
    audioPath: '../../audio/c-recto/c-recto-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  },
  {
    commandId: 'c-der',
    phrasingId: 'c-der-canonical',
    es: 'Gire a la derecha cuando pueda',
    en: 'turn right when you can',
    acceptedResult: 'turn-right',
    audioPath: '../../audio/c-der/c-der-canonical/CwhRBWXzGAHq8TQ4Fs17/0.9.mp3'
  }
];

test('selects the exact canonical Roger trials from the real production corpus', () => {
  const trials = selectMovingRoadTrials(commands, manifest);

  assert.deepEqual(trials, EXPECTED);
  assert.ok(Object.isFrozen(trials));
  assert.ok(trials.every(Object.isFrozen));
});

test('rejects missing or duplicate experiment commands', () => {
  assert.throws(
    () => selectMovingRoadTrials(commands.filter(command => command.id !== 'c-der'), manifest),
    /exactly one command c-der/
  );
  assert.throws(
    () => selectMovingRoadTrials([...commands, commands.find(command => command.id === 'c-der')], manifest),
    /exactly one command c-der/
  );
});

test('rejects missing, mismatched, or non-ElevenLabs recordings', () => {
  const target = manifest.findIndex(entry =>
    entry.commandId === 'c-der'
    && entry.phrasingId === 'c-der-canonical'
    && entry.voiceId === 'CwhRBWXzGAHq8TQ4Fs17'
    && entry.speed === 0.9
  );
  assert.notEqual(target, -1);

  assert.throws(
    () => selectMovingRoadTrials(commands, manifest.filter((_, index) => index !== target)),
    /exactly one recording for c-der/
  );

  const mismatched = structuredClone(manifest);
  mismatched[target].phrasingId = 'c-der-supplementary-1';
  assert.throws(
    () => selectMovingRoadTrials(commands, mismatched),
    /exactly one recording for c-der/
  );

  const wrongProvider = structuredClone(manifest);
  wrongProvider[target].provider = 'other';
  assert.throws(
    () => selectMovingRoadTrials(commands, wrongProvider),
    /ElevenLabs/
  );
});
