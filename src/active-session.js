const PHASES = new Set(['driving', 'precheck', 'mixed']);
const SPEEDS = new Set([0.75, 0.9, 1]);
const HINT_POLICIES = new Set(['available', 'shown', 'unavailable']);
const LENGTHS = new Set(['short', 'medium', 'all']);
const MODES = new Set(['free', 'recommended']);
const TARGET_KINDS = new Set([
  'recommended', 'needs-practice', 'not-tested', 'lesson-flags', 'not-ready', 'command', 'free'
]);

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    throw new Error('Active session must be cloneable');
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${path}`);
  return value;
}

function nonempty(value, path) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${path}`);
}

function validateSettings(settings) {
  record(settings, 'activeSession.settings');
  if (!PHASES.has(settings.phase)) throw new Error('Invalid activeSession.settings.phase');
  if (!SPEEDS.has(settings.speed)) throw new Error('Invalid activeSession.settings.speed');
  if (!HINT_POLICIES.has(settings.hintPolicy)) throw new Error('Invalid activeSession.settings.hintPolicy');
  if (typeof settings.timed !== 'boolean') throw new Error('Invalid activeSession.settings.timed');
  if (typeof settings.feedbackSounds !== 'boolean') throw new Error('Invalid activeSession.settings.feedbackSounds');
  if (!LENGTHS.has(settings.length)) throw new Error('Invalid activeSession.settings.length');
  if (!MODES.has(settings.mode)) throw new Error('Invalid activeSession.settings.mode');
}

function validateTarget(target) {
  record(target, 'activeSession.target');
  if (!TARGET_KINDS.has(target.kind)) throw new Error('Invalid activeSession.target.kind');
  const allowedKeys = target.kind === 'command' ? ['commandId', 'kind'] : ['kind'];
  if (Object.keys(target).some(key => !allowedKeys.includes(key))) {
    throw new Error('Invalid activeSession.target');
  }
  if (target.kind === 'command') nonempty(target.commandId, 'activeSession.target.commandId');
}

export function validateStoredActiveSession(value) {
  const session = clone(value);
  record(session, 'activeSession');
  if (session.version !== 1) throw new Error('Invalid activeSession.version');
  nonempty(session.id, 'activeSession.id');
  if (typeof session.startedAt !== 'number' || !Number.isFinite(session.startedAt)) {
    throw new Error('Invalid activeSession.startedAt');
  }
  if (!Array.isArray(session.items) || session.items.length === 0) throw new Error('Invalid activeSession.items');
  const commandIds = new Set();
  session.items.forEach((item, index) => {
    const path = `activeSession.items[${index}]`;
    record(item, path);
    for (const field of ['commandId', 'phrasingId', 'voiceId']) nonempty(item[field], `${path}.${field}`);
    if (!SPEEDS.has(item.speed)) throw new Error(`Invalid ${path}.speed`);
    if (commandIds.has(item.commandId)) throw new Error(`Invalid duplicate command: ${item.commandId}`);
    commandIds.add(item.commandId);
  });
  if (!Number.isSafeInteger(session.nextIndex) || session.nextIndex < 0 || session.nextIndex > session.items.length) {
    throw new Error('Invalid activeSession.nextIndex');
  }
  if (!Array.isArray(session.attemptIds)) throw new Error('Invalid activeSession.attemptIds');
  const attemptIds = new Set();
  session.attemptIds.forEach((attemptId, index) => {
    nonempty(attemptId, `activeSession.attemptIds[${index}]`);
    if (attemptIds.has(attemptId)) throw new Error(`Invalid activeSession.attemptIds[${index}]`);
    attemptIds.add(attemptId);
  });
  if (session.attemptIds.length !== session.nextIndex) throw new Error('Invalid activeSession.attemptIds length');
  validateSettings(session.settings);
  if (session.target === undefined) delete session.target;
  else validateTarget(session.target);
  return deepFreeze(session);
}

export function createActiveSession({ id, startedAt, items, nextIndex = 0, attemptIds = [], settings, target }) {
  const session = { version: 1, id, startedAt, items, nextIndex, attemptIds, settings };
  if (target !== undefined) session.target = target;
  return validateStoredActiveSession(session);
}

export function advanceActiveSession(session, { nextIndex, attemptId }) {
  const current = validateStoredActiveSession(session);
  nonempty(attemptId, 'attemptId');
  if (current.attemptIds.includes(attemptId)) throw new Error('Invalid duplicate attemptId');
  if (nextIndex !== current.nextIndex + 1) throw new Error('Invalid nextIndex');
  return validateStoredActiveSession({
    ...current,
    nextIndex,
    attemptIds: [...current.attemptIds, attemptId]
  });
}

export function resolveActiveSession(session, { commands, audioManifest }) {
  const stored = validateStoredActiveSession(session);
  if (!Array.isArray(commands) || !Array.isArray(audioManifest)) throw new Error('Invalid active-session resolver data');
  const commandById = new Map(commands.map(command => [command.id, command]));
  const sessionItems = stored.items.map(item => {
    const command = commandById.get(item.commandId);
    if (!command) throw new Error(`Unsupported command: ${item.commandId}`);
    if (!command.phrasings?.some(phrasing => phrasing.id === item.phrasingId)) {
      throw new Error(`Unsupported phrasing: ${item.phrasingId}`);
    }
    const variant = audioManifest.find(candidate =>
      candidate.commandId === item.commandId
      && candidate.phrasingId === item.phrasingId
      && candidate.voiceId === item.voiceId
      && candidate.speed === item.speed
    );
    if (!variant) throw new Error(`Unsupported audio variant: ${item.commandId}`);
    return { ...clone(command), audioVariant: clone(variant) };
  });
  const resolved = {
    sessionItems,
    index: stored.nextIndex,
    attemptIds: [...stored.attemptIds],
    settings: clone(stored.settings)
  };
  if (stored.target !== undefined) resolved.target = clone(stored.target);
  return deepFreeze(resolved);
}

export function discardActiveSession(state) {
  return { ...state, activeSession: null };
}
