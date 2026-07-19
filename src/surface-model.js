/**
 * @param {number} seed
 * @returns {() => number}
 */
export function seededRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('Surface seed must be uint32');
  }

  let state = seed || 0x6d2b79f5;
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} input
 */
export function createSurfaceModel(input) {
  validateSurfaceModel(input);
  return deepFreeze(structuredClone(input));
}

/**
 * @param {object} model
 * @returns {true}
 */
export function validateSurfaceModel(model) {
  if (!isPlainObject(model)) throw new Error('Invalid surface model');
  for (const field of ['id', 'family', 'expectedResult']) {
    if (typeof model[field] !== 'string' || !model[field]) throw new Error(`Invalid surface ${field}`);
  }
  if (!Number.isSafeInteger(model.version) || model.version < 1) throw new Error('Invalid surface version');
  if (!Number.isInteger(model.seed) || model.seed < 0 || model.seed > 0xffffffff) {
    throw new Error('Invalid surface seed');
  }
  if (!isPlainObject(model.geometry)) throw new Error('Invalid plain JSON-safe surface geometry');
  if (!isPlainObject(model.meta)) throw new Error('Invalid plain JSON-safe surface meta');
  if (!Array.isArray(model.targets) || !model.targets.some(target => target.resultId === model.expectedResult)) {
    throw new Error('Surface model is missing its expected target');
  }
  const targetIds = new Set();
  for (const target of model.targets) {
    validateTarget(target);
    if (targetIds.has(target.id)) throw new Error(`Duplicate target id: ${target.id}`);
    targetIds.add(target.id);
  }
  validateJsonValue(model, 'surface model', new Set());
  return true;
}

function validateTarget(target) {
  if (!isPlainObject(target)) throw new Error('Invalid target');
  for (const field of ['id', 'resultId', 'kind']) {
    if (typeof target[field] !== 'string' || !target[field]) throw new Error(`Invalid target ${field}`);
  }
  for (const field of ['x', 'y', 'width', 'height']) {
    if (!Number.isFinite(target[field])) throw new Error(`Invalid target ${field}`);
  }
}

function validateJsonValue(value, path, ancestors) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error(`Invalid JSON-safe ${path}`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`Invalid JSON-safe ${path}`);
  if (ancestors.has(value)) throw new Error(`Invalid JSON-safe ${path}`);
  if (!Array.isArray(value) && !isPlainObject(value)) throw new Error(`Invalid plain JSON-safe ${path}`);

  ancestors.add(value);
  for (const [key, nested] of jsonEntries(value, path)) {
    validateJsonValue(nested, `${path}.${key}`, ancestors);
  }
  ancestors.delete(value);
}

function jsonEntries(value, path) {
  if (Object.getOwnPropertySymbols(value).length > 0) throw new Error(`Invalid JSON-safe ${path}`);

  const keys = Object.keys(value);
  const names = Object.getOwnPropertyNames(value);
  if (Array.isArray(value)) {
    if (names.length !== keys.length + 1 || names.some(name => name !== 'length' && !isArrayIndex(name, value.length))) {
      throw new Error(`Invalid JSON-safe ${path}`);
    }
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new Error(`Invalid JSON-safe ${path}`);
    }
  } else if (names.length !== keys.length) {
    throw new Error(`Invalid JSON-safe ${path}`);
  }

  return keys.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      throw new Error(`Invalid JSON-safe ${path}.${key}`);
    }
    return [key, descriptor.value];
  });
}

function isArrayIndex(key, length) {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
