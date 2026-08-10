import test from 'node:test';
import assert from 'node:assert/strict';
import {
  continuityEnabledForExperience,
  continuityTransitionViewModel,
  currentContinuityStep,
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
