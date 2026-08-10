const RAW_EXAMINERS = [
  {
    id: 'roger',
    voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
    displayName: 'Roger',
    nameKey: 'examiner.roger.name',
    descriptionKey: 'examiner.roger.description',
    visualToken: 'forest'
  },
  {
    id: 'sarah',
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    displayName: 'Sara',
    nameKey: 'examiner.sarah.name',
    descriptionKey: 'examiner.sarah.description',
    visualToken: 'blue'
  },
  {
    id: 'george',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb',
    displayName: 'Jorge',
    nameKey: 'examiner.george.name',
    descriptionKey: 'examiner.george.description',
    visualToken: 'amber'
  },
  {
    id: 'matilda',
    voiceId: 'XrExE9yKIg1WjnnlVkGX',
    displayName: 'Matilde',
    nameKey: 'examiner.matilda.name',
    descriptionKey: 'examiner.matilda.description',
    visualToken: 'plum'
  },
  {
    id: 'eric',
    voiceId: 'cjVigY5qzO86Huf0OWal',
    displayName: 'Eric',
    nameKey: 'examiner.eric.name',
    descriptionKey: 'examiner.eric.description',
    visualToken: 'slate'
  }
];

const CSS_TOKEN = /^[a-z][a-z0-9-]*$/;

function nonempty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`Invalid ${label}`);
}

function cloneAndFreeze(value) {
  const clone = structuredClone(value);
  return deepFreeze(clone);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function validateExaminerRegistry(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Invalid examiner registry');
  const ids = new Set();
  const voiceIds = new Set();
  const records = value.map((examiner, index) => {
    if (!examiner || typeof examiner !== 'object' || Array.isArray(examiner)) {
      throw new Error(`Invalid examiner registry record ${index}`);
    }
    for (const field of ['id', 'voiceId', 'displayName', 'nameKey', 'descriptionKey', 'visualToken']) {
      nonempty(examiner[field], `examiner ${field}`);
    }
    if (!CSS_TOKEN.test(examiner.visualToken)) throw new Error('Invalid examiner visual token');
    if (ids.has(examiner.id)) throw new Error(`Duplicate examiner id: ${examiner.id}`);
    if (voiceIds.has(examiner.voiceId)) throw new Error(`Duplicate voice id: ${examiner.voiceId}`);
    ids.add(examiner.id);
    voiceIds.add(examiner.voiceId);
    return Object.freeze({
      id: examiner.id,
      voiceId: examiner.voiceId,
      displayName: examiner.displayName,
      nameKey: examiner.nameKey,
      descriptionKey: examiner.descriptionKey,
      visualToken: examiner.visualToken
    });
  });
  return Object.freeze(records);
}

export const EXAMINERS = validateExaminerRegistry(RAW_EXAMINERS);
export const EXAMINER_CHOICE_IDS = Object.freeze([
  'today',
  'mixed',
  ...EXAMINERS.map(({ id }) => id)
]);

export function examinerById(id, registry = EXAMINERS) {
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  const examiner = examiners.find(candidate => candidate.id === id);
  if (!examiner) throw new Error(`Unknown examiner: ${String(id)}`);
  return examiner;
}

export function examinerForVoiceId(voiceId, registry = EXAMINERS) {
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  const examiner = examiners.find(candidate => candidate.voiceId === voiceId);
  if (!examiner) throw new Error(`Unknown voice: ${String(voiceId)}`);
  return examiner;
}

export function selectTodaysExaminer(dateParts, registry = EXAMINERS) {
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  const dayNumber = calendarDayNumber(dateParts);
  const index = ((dayNumber % examiners.length) + examiners.length) % examiners.length;
  return examiners[index];
}

export function filterVariantsForExaminer(variants, choiceId, {
  dateParts = currentLocalDateParts(),
  registry = EXAMINERS
} = {}) {
  if (!Array.isArray(variants)) throw new Error('Invalid audio variants');
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  if (choiceId === 'mixed') return cloneAndFreeze(variants);

  let examiner;
  if (choiceId === 'today') examiner = selectTodaysExaminer(dateParts, examiners);
  else if (examiners.some(candidate => candidate.id === choiceId)) examiner = examinerById(choiceId, examiners);
  else throw new Error(`Unknown examiner choice: ${String(choiceId)}`);

  return cloneAndFreeze(variants.filter(variant => variant?.voiceId === examiner.voiceId));
}

/**
 * Returns `count` examiner IDs guaranteed to be a full shuffled rotation of
 * the registry before repeating — so a 5-command session gets each examiner
 * exactly once (the Five examiners challenge's coverage guarantee), and any
 * count beyond the registry size cycles through fresh reshuffled rotations
 * rather than clustering repeats.
 */
export function assignExaminerRotation(count, rng = Math.random, registry = EXAMINERS) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid examiner rotation count');
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  const assignment = [];
  while (assignment.length < count) {
    assignment.push(...fisherYatesShuffle(examiners.map(({ id }) => id), rng));
  }
  return Object.freeze(assignment.slice(0, count));
}

function fisherYatesShuffle(items, rng) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function missingExaminerVoiceIds(variants, registry = EXAMINERS) {
  if (!Array.isArray(variants)) throw new Error('Invalid audio variants');
  const examiners = registry === EXAMINERS ? registry : validateExaminerRegistry(registry);
  const available = new Set(variants.map(({ voiceId }) => voiceId));
  return Object.freeze(examiners
    .filter(({ voiceId }) => !available.has(voiceId))
    .map(({ voiceId }) => voiceId));
}

function calendarDayNumber(dateParts) {
  if (!dateParts || typeof dateParts !== 'object' || Array.isArray(dateParts)) {
    throw new Error('Invalid local calendar date');
  }
  const { year, month, day } = dateParts;
  if (![year, month, day].every(Number.isInteger)) throw new Error('Invalid local calendar date');
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) throw new Error('Invalid local calendar date');
  return Math.floor(timestamp / 86_400_000);
}

function currentLocalDateParts(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  };
}
