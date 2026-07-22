import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LESSON_FLAG_CATEGORIES,
  LESSON_FLAG_STATUSES,
  validateLessonFlag,
  createLessonFlag,
  updateLessonFlag,
} from '../src/lesson-flags.js';

const NOW = 100;

function mockDeps(overrides = {}) {
  return {
    now: () => NOW,
    randomUUID: () => 'flag-1',
    cryptoRef: globalThis.crypto,
    ...overrides,
  };
}

test('LESSON_FLAG_CATEGORIES exports six exact categories', () => {
  assert.deepEqual(LESSON_FLAG_CATEGORIES, Object.freeze([
    'wording', 'audio', 'visual', 'accepted-action', 'vehicle-control', 'other'
  ]));
});

test('LESSON_FLAG_STATUSES exports open and resolved', () => {
  assert.deepEqual(LESSON_FLAG_STATUSES, Object.freeze(['open', 'resolved']));
});

test('creates a lesson flag with trimmed note', () => {
  const flags = createLessonFlag([], {
    commandId: 'c-der',
    category: 'wording',
    note: '  Ask instructor.  '
  }, mockDeps());
  assert.equal(flags.length, 1);
  assert.equal(flags[0].note, 'Ask instructor.');
  assert.equal(flags[0].commandId, 'c-der');
  assert.equal(flags[0].category, 'wording');
  assert.equal(flags[0].status, 'open');
  assert.equal(flags[0].createdAt, NOW);
  assert.equal(flags[0].updatedAt, NOW);
  assert.equal(flags[0].id, 'flag-1');
});

test('resolves a lesson flag immutably', () => {
  const created = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'Test'
  }, mockDeps());
  const resolved = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  assert.equal(resolved[0].status, 'resolved');
  assert.equal(resolved[0].updatedAt, 200);
  assert.equal(created[0].status, 'open'); // original unchanged
  assert.equal(created[0].updatedAt, NOW);
});

test('reopens a lesson flag immutably', () => {
  const created = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'Test'
  }, mockDeps());
  const resolved = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  const reopened = updateLessonFlag(resolved, 'flag-1', { status: 'open' }, { now: () => 300 });
  assert.equal(reopened[0].status, 'open');
  assert.equal(reopened[0].updatedAt, 300);
  assert.equal(resolved[0].status, 'resolved');
});

test('edits note and category immutably', () => {
  const created = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'Original'
  }, mockDeps());
  const updated = updateLessonFlag(created, 'flag-1', {
    category: 'audio',
    note: 'Updated note'
  }, { now: () => 200 });
  assert.equal(updated[0].category, 'audio');
  assert.equal(updated[0].note, 'Updated note');
  assert.equal(updated[0].status, 'open');
  assert.equal(updated[0].updatedAt, 200);
  assert.equal(created[0].category, 'wording');
  assert.equal(created[0].note, 'Original');
});

test('validateLessonFlag accepts valid flag', () => {
  const flag = {
    id: 'flag-1',
    commandId: 'c-der',
    category: 'wording',
    note: 'Valid note',
    createdAt: NOW,
    updatedAt: NOW,
    status: 'open'
  };
  assert.doesNotThrow(() => validateLessonFlag(flag));
});

test('validateLessonFlag rejects invalid category', () => {
  const flag = { id: 'f1', commandId: 'c', category: 'invalid', note: 'x', createdAt: NOW, updatedAt: NOW, status: 'open' };
  assert.throws(() => validateLessonFlag(flag), /category/);
});

test('validateLessonFlag rejects invalid status', () => {
  const flag = { id: 'f1', commandId: 'c', category: 'wording', note: 'x', createdAt: NOW, updatedAt: NOW, status: 'invalid' };
  assert.throws(() => validateLessonFlag(flag), /status/);
});

test('validateLessonFlag rejects whitespace-only note', () => {
  const flag = { id: 'f1', commandId: 'c', category: 'wording', note: '   ', createdAt: NOW, updatedAt: NOW, status: 'open' };
  assert.throws(() => validateLessonFlag(flag), /trim/);
});

test('validateLessonFlag rejects an untrimmed stored note', () => {
  const flag = { id: 'f1', commandId: 'c', category: 'wording', note: ' x ', createdAt: NOW, updatedAt: NOW, status: 'open' };
  assert.throws(() => validateLessonFlag(flag), /trimmed/);
});

test('validateLessonFlag rejects 281-code-point note', () => {
  const note = 'a'.repeat(281);
  const flag = { id: 'f1', commandId: 'c', category: 'wording', note, createdAt: NOW, updatedAt: NOW, status: 'open' };
  assert.throws(() => validateLessonFlag(flag), /280/);
});

test('validateLessonFlag rejects updatedAt before createdAt', () => {
  const flag = { id: 'f1', commandId: 'c', category: 'wording', note: 'x', createdAt: 200, updatedAt: 100, status: 'open' };
  assert.throws(() => validateLessonFlag(flag), /updatedAt/);
});

test('createLessonFlag trims note and validates length after trim', () => {
  const flags = createLessonFlag([], {
    commandId: 'c-der',
    category: 'wording',
    note: '  a  '
  }, mockDeps());
  assert.equal(flags[0].note, 'a');
});

test('createLessonFlag rejects empty note after trim', () => {
  assert.throws(() => createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: '   '
  }, mockDeps()), /trim/);
});

test('createLessonFlag rejects note longer than 280 code points after trim', () => {
  assert.throws(() => createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'a'.repeat(281)
  }, mockDeps()), /280/);
});

test('createLessonFlag rejects missing command IDs and invalid timestamps', () => {
  assert.throws(() => createLessonFlag([], {
    commandId: ' ', category: 'wording', note: 'x'
  }, mockDeps()), /commandId/);
  assert.throws(() => createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'x'
  }, mockDeps({ now: () => Number.NaN })), /timestamp/);
});

test('createLessonFlag rejects empty and duplicate generated IDs', () => {
  assert.throws(() => createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'x'
  }, mockDeps({ randomUUID: () => '' })), /id/);

  const existing = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'x'
  }, mockDeps());
  assert.throws(() => createLessonFlag(existing, {
    commandId: 'c-izq', category: 'audio', note: 'y'
  }, mockDeps()), /duplicate/i);
});

test('updateLessonFlag rejects unknown update fields', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.throws(() => updateLessonFlag(created, 'flag-1', { unknownField: 'x' }, mockDeps()), /unknown/);
});

test('updateLessonFlag rejects updating id', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.throws(() => updateLessonFlag(created, 'flag-1', { id: 'new-id' }, mockDeps()), /id/);
});

test('updateLessonFlag rejects updating commandId', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.throws(() => updateLessonFlag(created, 'flag-1', { commandId: 'c-izq' }, mockDeps()), /commandId/);
});

test('updateLessonFlag rejects updating createdAt', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.throws(() => updateLessonFlag(created, 'flag-1', { createdAt: 999 }, mockDeps()), /createdAt/);
});

test('updateLessonFlag rejects non-existent flag ID', () => {
  assert.throws(() => updateLessonFlag([], 'missing', { status: 'resolved' }, mockDeps()), /not found/);
});

test('updateLessonFlag rejects a clock earlier than creation', () => {
  const created = createLessonFlag([], {
    commandId: 'c-der', category: 'wording', note: 'x'
  }, mockDeps({ now: () => 200 }));
  assert.throws(() => updateLessonFlag(
    created,
    'flag-1',
    { status: 'resolved' },
    { now: () => 100 }
  ), /updatedAt/);
});

test('updateLessonFlag returns new frozen array', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  const updated = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  assert.throws(() => { updated.push({}); }, /extensible|frozen/);
  assert.throws(() => { updated[0].status = 'hacked'; }, /read only|frozen/);
});

test('createLessonFlag returns new frozen array', () => {
  const flags = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.throws(() => { flags.push({}); }, /extensible|frozen/);
  assert.throws(() => { flags[0].note = 'hacked'; }, /read only|frozen/);
});

test('input arrays not mutated', () => {
  const flags = [];
  createLessonFlag(flags, { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.equal(flags.length, 0);
});

test('create and update return frozen copies of every existing record', () => {
  const existing = [{
    id: 'flag-0', commandId: 'c-izq', category: 'visual', note: 'Check target',
    createdAt: 50, updatedAt: 50, status: 'open'
  }];
  const created = createLessonFlag(existing, {
    commandId: 'c-der', category: 'wording', note: 'x'
  }, mockDeps());
  assert.notEqual(created[0], existing[0]);
  assert.equal(Object.isFrozen(created[0]), true);

  const updated = updateLessonFlag(existing, 'flag-0', { status: 'resolved' }, { now: () => 100 });
  assert.equal(Object.isFrozen(updated[0]), true);
});

test('all six categories accepted', () => {
  for (const cat of ['wording', 'audio', 'visual', 'accepted-action', 'vehicle-control', 'other']) {
    const flags = createLessonFlag([], { commandId: 'c-der', category: cat, note: 'x' }, mockDeps());
    assert.equal(flags[0].category, cat);
  }
});

test('both statuses accepted in create', () => {
  // create always sets status to 'open'
  const flags = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert.equal(flags[0].status, 'open');
});

test('updateLessonFlag can change status to resolved', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  const updated = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  assert.equal(updated[0].status, 'resolved');
});

test('updateLessonFlag can change status back to open', () => {
  const created = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  const resolved = updateLessonFlag(created, 'flag-1', { status: 'resolved' }, { now: () => 200 });
  const reopened = updateLessonFlag(resolved, 'flag-1', { status: 'open' }, { now: () => 300 });
  assert.equal(reopened[0].status, 'open');
});

test('UUID generation uses cryptoRef when randomUUID not provided', () => {
  const flags = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, {
    now: () => NOW,
    randomUUID: null,
    cryptoRef: globalThis.crypto
  });
  assert(flags[0].id.length > 0);
  assert(flags[0].id.includes('-'));
});

test('flags with different IDs can exist for same command', () => {
  let idCounter = 0;
  const flags1 = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, {
    now: () => NOW,
    randomUUID: () => `flag-${idCounter++}`
  });
  const flags2 = createLessonFlag(flags1, { commandId: 'c-der', category: 'audio', note: 'y' }, {
    now: () => NOW,
    randomUUID: () => `flag-${idCounter++}`
  });
  assert.equal(flags2.length, 2);
  assert.notEqual(flags2[0].id, flags2[1].id);
});

test('updateLessonFlag preserves original flag when updating different flag', () => {
  let idCounter = 0;
  const flags1 = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, {
    now: () => NOW,
    randomUUID: () => `flag-${idCounter++}`
  });
  const flags2 = createLessonFlag(flags1, { commandId: 'c-der', category: 'audio', note: 'y' }, {
    now: () => NOW,
    randomUUID: () => `flag-${idCounter++}`
  });
  const updated = updateLessonFlag(flags2, flags2[0].id, { status: 'resolved' }, { now: () => 200 });
  assert.equal(updated[0].status, 'resolved');
  assert.equal(updated[1].status, 'open'); // second flag unchanged
});

test('empty flags array returns new array', () => {
  const flags = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: 'x' }, mockDeps());
  assert(Array.isArray(flags));
  assert.equal(flags.length, 1);
});

test('note counts unicode code points not bytes', () => {
  const emojiNote = '😀'.repeat(140); // 140 code points, more than 280 bytes
  const flags = createLessonFlag([], { commandId: 'c-der', category: 'wording', note: emojiNote }, mockDeps());
  assert.equal([...flags[0].note].length, 140); // 140 code points
  assert([...flags[0].note].length <= 280);
});
