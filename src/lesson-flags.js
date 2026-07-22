export const LESSON_FLAG_CATEGORIES = Object.freeze([
  'wording', 'audio', 'visual', 'accepted-action', 'vehicle-control', 'other'
]);

export const LESSON_FLAG_STATUSES = Object.freeze(['open', 'resolved']);

const CATEGORY_SET = new Set(LESSON_FLAG_CATEGORIES);
const STATUS_SET = new Set(LESSON_FLAG_STATUSES);
const MAX_NOTE_CODEPOINTS = 280;

function countCodePoints(str) {
  return [...str].length;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a safe integer timestamp`);
  }
}

function createUUID(randomUUID, cryptoRef) {
  if (typeof randomUUID === 'function') return randomUUID();
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();
  if (typeof cryptoRef?.getRandomValues !== 'function') {
    throw new Error('Cryptographic UUID generation is unavailable');
  }
  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, v => v.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function validateFlagObject(flag) {
  if (!isRecord(flag)) return 'Flag must be an object';
  if (!CATEGORY_SET.has(flag.category)) return `Invalid category: ${flag.category}`;
  if (!STATUS_SET.has(flag.status)) return `Invalid status: ${flag.status}`;
  if (typeof flag.note !== 'string') return 'Note must be a string';
  const trimmed = flag.note.trim();
  const cp = countCodePoints(trimmed);
  if (cp < 1 || cp > MAX_NOTE_CODEPOINTS) return `Note must be 1–${MAX_NOTE_CODEPOINTS} Unicode code points after trimming`;
  if (flag.note !== trimmed) return 'Note must be stored trimmed';
  if (typeof flag.commandId !== 'string' || flag.commandId.trim().length === 0) return 'commandId is required';
  if (typeof flag.id !== 'string' || flag.id.trim().length === 0) return 'id is required';
  if (!Number.isSafeInteger(flag.createdAt) || flag.createdAt < 0) return 'createdAt must be a safe integer timestamp';
  if (!Number.isSafeInteger(flag.updatedAt) || flag.updatedAt < 0) return 'updatedAt must be a safe integer timestamp';
  if (flag.updatedAt < flag.createdAt) return 'updatedAt must be >= createdAt';
  return null;
}

export function validateLessonFlag(flag) {
  const error = validateFlagObject(flag);
  if (error) throw new Error(error);
  return true;
}

function validatedFrozenFlags(flags) {
  if (!Array.isArray(flags)) throw new Error('Lesson flags must be an array');
  const ids = new Set();
  const result = flags.map(flag => {
    validateLessonFlag(flag);
    if (ids.has(flag.id)) throw new Error(`Duplicate lesson flag id: ${flag.id}`);
    ids.add(flag.id);
    return Object.freeze({ ...flag });
  });
  return Object.freeze(result);
}

export function createLessonFlag(flags, { commandId, category, note }, { now = Date.now, randomUUID, cryptoRef = globalThis.crypto } = {}) {
  const current = validatedFrozenFlags(flags);
  requireNonEmptyString(commandId, 'commandId');
  if (typeof note !== 'string') throw new Error('Note must be a string');
  const trimmedNote = note.trim();
  const cp = countCodePoints(trimmedNote);
  if (cp < 1 || cp > MAX_NOTE_CODEPOINTS) {
    throw new Error(`Note must be 1–${MAX_NOTE_CODEPOINTS} Unicode code points after trimming`);
  }
  if (!CATEGORY_SET.has(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  const timestamp = now();
  requireTimestamp(timestamp, 'createdAt');
  const id = createUUID(randomUUID, cryptoRef);
  requireNonEmptyString(id, 'id');
  if (current.some(flag => flag.id === id)) throw new Error(`Duplicate lesson flag id: ${id}`);

  const newFlag = {
    id,
    commandId,
    category,
    note: trimmedNote,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'open'
  };
  validateLessonFlag(newFlag);

  return Object.freeze([...current, Object.freeze(newFlag)]);
}

export function updateLessonFlag(flags, id, changes, { now = Date.now } = {}) {
  const current = validatedFrozenFlags(flags);
  requireNonEmptyString(id, 'id');
  if (!isRecord(changes)) throw new Error('Lesson flag changes must be an object');
  const index = current.findIndex(f => f.id === id);
  if (index === -1) {
    throw new Error(`Lesson flag not found: ${id}`);
  }

  const original = current[index];
  const allowedChanges = ['category', 'note', 'status'];
  for (const key of Object.keys(changes)) {
    if (!allowedChanges.includes(key)) {
      throw new Error(`Unknown update field: ${key}`);
    }
  }

  const updated = { ...original };

  if (changes.category !== undefined) {
    if (!CATEGORY_SET.has(changes.category)) {
      throw new Error(`Invalid category: ${changes.category}`);
    }
    updated.category = changes.category;
  }

  if (changes.note !== undefined) {
    if (typeof changes.note !== 'string') throw new Error('Note must be a string');
    const trimmed = changes.note.trim();
    const cp = countCodePoints(trimmed);
    if (cp < 1 || cp > MAX_NOTE_CODEPOINTS) {
      throw new Error(`Note must be 1–${MAX_NOTE_CODEPOINTS} Unicode code points after trimming`);
    }
    updated.note = trimmed;
  }

  if (changes.status !== undefined) {
    if (!STATUS_SET.has(changes.status)) {
      throw new Error(`Invalid status: ${changes.status}`);
    }
    updated.status = changes.status;
  }

  updated.updatedAt = now();
  requireTimestamp(updated.updatedAt, 'updatedAt');
  if (updated.updatedAt < updated.createdAt) {
    throw new Error('updatedAt must be >= createdAt');
  }
  validateLessonFlag(updated);

  const frozenUpdated = Object.freeze(updated);
  const newFlags = [...current];
  newFlags[index] = frozenUpdated;
  return Object.freeze(newFlags);
}
