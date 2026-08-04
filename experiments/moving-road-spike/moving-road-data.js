const VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17';
const SPEED = 0.9;

const TRIAL_DEFINITIONS = Object.freeze([
  Object.freeze({ commandId: 'c-izq', acceptedResult: 'turn-left' }),
  Object.freeze({ commandId: 'c-recto', acceptedResult: 'continue-forward' }),
  Object.freeze({ commandId: 'c-der', acceptedResult: 'turn-right' })
]);

export function selectMovingRoadTrials(commands, manifest) {
  if (!Array.isArray(commands) || !Array.isArray(manifest)) {
    throw new TypeError('commands and manifest must be arrays');
  }

  const trials = TRIAL_DEFINITIONS.map(definition => {
    const matchingCommands = commands.filter(command => command?.id === definition.commandId);
    if (matchingCommands.length !== 1) {
      throw new Error(`expected exactly one command ${definition.commandId}`);
    }
    const command = matchingCommands[0];
    if (command.acceptedResult !== definition.acceptedResult) {
      throw new Error(`acceptedResult mismatch for ${definition.commandId}`);
    }

    const phrasingId = `${definition.commandId}-canonical`;
    const matchingPhrasings = command.phrasings?.filter(phrasing => phrasing?.id === phrasingId) ?? [];
    if (matchingPhrasings.length !== 1) {
      throw new Error(`expected exactly one canonical phrasing for ${definition.commandId}`);
    }
    const phrasing = matchingPhrasings[0];

    const recordings = manifest.filter(entry =>
      entry?.commandId === definition.commandId
      && entry?.phrasingId === phrasingId
      && entry?.voiceId === VOICE_ID
      && entry?.speed === SPEED
    );
    if (recordings.length !== 1) {
      throw new Error(`expected exactly one recording for ${definition.commandId}`);
    }
    const recording = recordings[0];
    if (recording.provider !== 'elevenlabs') {
      throw new Error(`recording for ${definition.commandId} must use ElevenLabs`);
    }
    const expectedPath = `audio/${definition.commandId}/${phrasingId}/${VOICE_ID}/${SPEED}.mp3`;
    if (recording.path !== expectedPath) {
      throw new Error(`recording path mismatch for ${definition.commandId}`);
    }

    return Object.freeze({
      commandId: definition.commandId,
      phrasingId,
      es: phrasing.es,
      en: phrasing.en,
      acceptedResult: definition.acceptedResult,
      audioPath: `../../${recording.path}`
    });
  });

  return Object.freeze(trials);
}
