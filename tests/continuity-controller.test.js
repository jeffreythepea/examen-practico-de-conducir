import test from 'node:test';
import assert from 'node:assert/strict';
import {
  continuityEnabledForExperience,
  continuityTransitionViewModel,
  currentContinuityStep,
  isClosingTransition,
  prepareContinuitySession
} from '../src/continuity-controller.js';

function command(id, phase) {
  return Object.freeze({
    id,
    phase,
    audioVariant: Object.freeze({ phrasingId: `${id}-p`, voiceId: 'v-1', speed: 1 })
  });
}

test('continuity is the default for every experience behind the Continuous drive setting', () => {
  assert.equal(continuityEnabledForExperience({ modeId: 'mock', themeId: 'full-mock' }, { continuousDrive: true }), true);
  assert.equal(continuityEnabledForExperience({ modeId: 'mock', themeId: 'city-circuit' }, { continuousDrive: true }), true);
  assert.equal(continuityEnabledForExperience({ modeId: 'practice', themeId: 'full-mock' }, { continuousDrive: true }), true);
  assert.equal(continuityEnabledForExperience({ modeId: 'learn', themeId: null }, {}), true);
  assert.equal(continuityEnabledForExperience({ modeId: 'practice', themeId: null }, { continuousDrive: false }), false);
  assert.equal(continuityEnabledForExperience({ modeId: 'mock', themeId: 'full-mock' }, { continuousDrive: false }), false);
  assert.equal(continuityEnabledForExperience(null, { continuousDrive: true }), false);
});

test('continuity never applies to the pair-adjacent confusion drill', () => {
  assert.equal(
    continuityEnabledForExperience(
      { modeId: 'practice', themeId: null, challengeId: 'confusion-pairs' },
      { continuousDrive: true }
    ),
    false
  );
});

test('session preparation orders selected commands into the narrative route', () => {
  const session = [
    command('c-final', 'driving'),
    command('c-pre-aceite', 'precheck'),
    command('c-der', 'driving'),
    command('c-incorp', 'driving'),
    command('c-arr', 'driving'),
    command('c-inmov', 'driving')
  ];
  const catalog = session.map(({ id, phase }) => ({ id, phase }));
  const prepared = prepareContinuitySession(session, catalog, () => 0);

  assert.deepEqual(prepared.session.map(({ id }) => id), [
    'c-pre-aceite', 'c-arr', 'c-incorp', 'c-der', 'c-final', 'c-inmov'
  ]);
  assert.equal(prepared.continuity.nextRouteStepIndex, 0);
  assert.deepEqual(
    prepared.continuity.route.filter(step => step.kind === 'command').map(step => step.itemIndex),
    [0, 1, 2, 3, 4, 5]
  );
  assert.equal(Object.isFrozen(prepared), true);
  assert.equal(Object.isFrozen(prepared.session), true);
  assert.equal(Object.isFrozen(prepared.continuity.route), true);
  assert.deepEqual(session.map(({ id }) => id), [
    'c-final', 'c-pre-aceite', 'c-der', 'c-incorp', 'c-arr', 'c-inmov'
  ]);
});

test('current step follows persisted route progress and ends at null', () => {
  const route = Object.freeze([
    Object.freeze({ kind: 'command', commandId: 'c-arr' }),
    Object.freeze({ kind: 'transition', sceneId: 'departure-consequence' })
  ]);
  assert.equal(currentContinuityStep({ continuity: { route, nextRouteStepIndex: 0 } }).commandId, 'c-arr');
  assert.equal(currentContinuityStep({ continuity: { route, nextRouteStepIndex: 1 } }).sceneId, 'departure-consequence');
  assert.equal(currentContinuityStep({ continuity: { route, nextRouteStepIndex: 2 } }), null);
  assert.equal(currentContinuityStep({}), null);
});

test('route scene tokens map to transition-view families', () => {
  const cases = [
    ['preparation-bridge', 'departure'],
    ['departure-consequence', 'departure'],
    ['urban-cruise', 'urban-cruise'],
    ['rural-cruise', 'rural-cruise'],
    ['arrival', 'arrival'],
    ['parked-closure', 'parked']
  ];
  for (const [sceneId, family] of cases) {
    const viewModel = continuityTransitionViewModel(
      { kind: 'transition', sceneId },
      { motionEnabled: true, progressText: 'Drive 2 of 10' }
    );
    assert.equal(viewModel.family, family);
    assert.equal(viewModel.motionEnabled, true);
    assert.equal(viewModel.progressText, 'Drive 2 of 10');
    assert.equal(Object.isFrozen(viewModel), true);
  }
  assert.throws(
    () => continuityTransitionViewModel({ kind: 'transition', sceneId: 'missing' }, {
      motionEnabled: false,
      progressText: 'x'
    }),
    /Unknown continuity route scene/
  );
});

test('a transition with no command after it is the closing shot', () => {
  // The route ends on one. It earns its place when the last answer has a clip
  // to drive away into; empty — as in every mock, where clips are withheld —
  // it appears after the final answer, says the drive is continuing, and is
  // gone in a second. Device report 2026-08-15.
  const route = [
    { kind: 'command', id: 'command-0', commandId: 'c-der' },
    { kind: 'transition', id: 'transition-0', sceneId: 'urban-street' },
    { kind: 'command', id: 'command-1', commandId: 'c-inmov' },
    { kind: 'transition', id: 'transition-1-parked-closure', sceneId: 'urban-street' }
  ];
  const at = index => ({ continuity: { route, nextRouteStepIndex: index } });

  assert.equal(isClosingTransition(at(3), route[3]), true, 'nothing follows the last transition');
  assert.equal(isClosingTransition(at(1), route[1]), false, 'a command still follows this one');
  // Only transitions can close a route.
  assert.equal(isClosingTransition(at(0), route[0]), false);
  assert.equal(isClosingTransition(at(2), route[2]), false);
  // A null event after the transition is not a command, so the drive is over.
  const withNullEvent = [...route, { kind: 'null-event', id: 'null-0' }];
  assert.equal(
    isClosingTransition({ continuity: { route: withNullEvent, nextRouteStepIndex: 3 } }, withNullEvent[3]),
    true
  );
  // Malformed or absent continuity must not throw on the answer path.
  assert.equal(isClosingTransition(null, route[3]), false);
  assert.equal(isClosingTransition(at(3), null), false);
  assert.equal(isClosingTransition({ continuity: { route: 'nope', nextRouteStepIndex: 0 } }, route[3]), false);
});

test('the simulated route really does end on a transition, which is why this matters', async () => {
  const { buildSimulatedExamRoute } = await import('../src/simulated-exam-route.js');
  const commands = (await import('../data/commands.json', { with: { type: 'json' } })).default;
  const active = commands.filter(command => command.active !== false);
  const items = active.slice(0, 20).map(command => ({
    commandId: command.id, phrasingId: command.phrasings[0].id, voiceId: 'v', speed: 0.9
  }));
  const route = buildSimulatedExamRoute(items, active, () => 0.5);
  assert.equal(route.at(-1).kind, 'transition', 'the closing transition is what the fix skips');
  assert.equal(
    isClosingTransition({ continuity: { route, nextRouteStepIndex: route.length - 1 } }, route.at(-1)),
    true
  );
});
