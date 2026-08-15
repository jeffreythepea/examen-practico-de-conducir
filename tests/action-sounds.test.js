import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import commands from '../data/commands.json' with { type: 'json' };
import { ACTION_SOUNDS, SILENT_RESULTS, actionSoundFor, actionSoundPath } from '../src/action-sounds.js';
import { createFeedbackCuePlayer } from '../src/feedback-audio.js';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const activeResults = [...new Set(commands.filter(c => c.active !== false).map(c => c.acceptedResult))];

test('every accepted result is answered either by a sound or deliberately by the chime', () => {
  // The point of the split is that a reviewer can tell "this action is silent
  // in a real car" from "somebody forgot this one". Anything missing from
  // both lists is the second.
  for (const result of activeResults) {
    const sounded = actionSoundFor(result) !== null;
    const silent = SILENT_RESULTS.includes(result);
    assert.ok(sounded !== silent, `${result} must be in exactly one of the two: sounded=${sounded} silent=${silent}`);
  }
  // And neither list may name a result the catalog no longer has.
  for (const result of SILENT_RESULTS) {
    assert.ok(activeResults.includes(result), `${result} is listed as silent but is not an active result`);
  }
});

test('the sounded results are the actions a car can actually be heard doing', () => {
  const bySound = {};
  for (const result of activeResults) {
    const sound = actionSoundFor(result);
    if (sound) (bySound[sound] ??= []).push(result);
  }
  // One recording serves every command performing the same physical action;
  // an entry serving nothing is a file shipped for no reason.
  for (const sound of Object.keys(ACTION_SOUNDS)) {
    assert.ok(bySound[sound]?.length > 0, `${sound} is registered but no result uses it`);
  }
  assert.ok(bySound.indicator.length >= 8, 'signalling should serve the turns, exits and lane changes');
  assert.deepEqual(bySound.seatbelt, ['fasten-seatbelt']);
  assert.deepEqual(bySound['engine-start'], ['start-engine']);
  assert.deepEqual(bySound['latch-release'].sort(), ['open-boot', 'open-bonnet-check-levels'].sort());
  // The dashboard's five lighting settings and both demist buttons.
  assert.equal(bySound['switch-click'].length, 7);
  // The child-safety lock is a lock engaging, not the glass moving, and it
  // must not sound like the dashboard controls.
  assert.deepEqual(bySound['door-lock'].sort(), ['lock-rear-windows', 'unlock-rear-windows']);
  assert.notEqual(actionSoundPath('door-lock'), actionSoundPath('switch-click'));
});

test('every registered sound is a real packaged file under audio/effects', async () => {
  for (const [id, path] of Object.entries(ACTION_SOUNDS)) {
    assert.match(path, /^audio\/effects\/[a-z-]+\.mp3$/, id);
    assert.equal(actionSoundPath(id), path);
    const info = await stat(resolve(ROOT, path));
    assert.ok(info.isFile() && info.size > 4_000, `${path} is missing or implausibly small`);
  }
  assert.equal(actionSoundPath('not-a-sound'), null);
  assert.equal(actionSoundFor('not-a-result'), null);
  assert.equal(actionSoundFor(undefined), null);
});

test('an action sound plays through the cue context rather than a new audio element', async () => {
  // iPadOS hands the media session to whichever element played last: a fresh
  // <audio> here would take it from the command recording and leave the cue
  // context parked in the silent 'interrupted' state.
  const started = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    async resume() {},
    async decodeAudioData() { return { duration: 0.4 }; },
    createBufferSource() {
      const source = { buffer: null, connect: target => target, start: () => started.push(source.buffer) };
      return source;
    },
    createGain() {
      return { gain: { setValueAtTime() {} }, connect: target => target };
    }
  };
  let fetched = 0;
  const player = createFeedbackCuePlayer({
    contextFactory: () => context,
    fetchImpl: async () => { fetched += 1; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }
  });

  assert.equal(await player.playSample('audio/effects/seatbelt.mp3'), true);
  assert.equal(started.length, 1);
  // Decoded once and reused: decoding on the tap would put the sound behind
  // the answer it confirms.
  assert.equal(await player.playSample('audio/effects/seatbelt.mp3'), true);
  assert.equal(fetched, 1);
  assert.equal(started.length, 2);

  assert.equal(await player.playSample('audio/effects/seatbelt.mp3', { enabled: false }), false);
  assert.equal(await player.playSample('audio/effects/seatbelt.mp3', { busy: true }), false);
  assert.equal(await player.playSample(''), false);
});

test('a sound that cannot be played reports failure so the chime can answer instead', async () => {
  const context = {
    state: 'running', currentTime: 0, destination: {},
    async resume() {},
    async decodeAudioData() { throw new Error('undecodable'); },
    createBufferSource() { return { connect: t => t, start() {} }; },
    createGain() { return { gain: { setValueAtTime() {} }, connect: t => t }; }
  };
  const missing = createFeedbackCuePlayer({
    contextFactory: () => context,
    fetchImpl: async () => ({ ok: false })
  });
  assert.equal(await missing.playSample('audio/effects/seatbelt.mp3'), false);

  const undecodable = createFeedbackCuePlayer({
    contextFactory: () => context,
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  });
  assert.equal(await undecodable.playSample('audio/effects/seatbelt.mp3'), false);
});
