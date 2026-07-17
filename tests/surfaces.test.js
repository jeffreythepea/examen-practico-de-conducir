import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPORTED_SURFACE_IDS,
  renderSurface,
  supportedCommands,
  surfaceOptions
} from '../src/surfaces.js';

function command(id, {
  phase = 'driving',
  category = 'man',
  surfaceId = 'option-grid-v1',
  acceptedResult = id
} = {}) {
  return {
    id,
    actionId: acceptedResult,
    phase,
    category,
    surfaceId,
    acceptedResult,
    icon: `icon-${id}`,
    phrasings: [{ id: `${id}-canonical`, es: `es-${id}`, en: `en-${id}` }]
  };
}

test('surface options keep answer choices in the active command phase and prioritize same-category confusions', () => {
  const target = command('target', { category: 'man' });
  const sameCategory = command('same', { category: 'man' });
  const otherCategory = command('other', { category: 'spd' });
  const precheck = command('precheck', { phase: 'precheck', category: 'pre-body' });

  const options = surfaceOptions(target, [precheck, otherCategory, sameCategory, target], () => 0.99);

  assert.equal(options[0].id, 'target');
  assert.equal(options[1].id, 'same');
  assert.ok(options.every(option => option.phase === 'driving'));
  assert.ok(options.some(option => option.id === 'other'));
});

test('diagram surfaces never fill missing junction, roundabout, or precheck targets with unrelated categories', () => {
  const junction = command('right', { category: 'dir', surfaceId: 'junction-v1', acceptedResult: 'turn-right' });
  const left = command('left', { category: 'dir', surfaceId: 'junction-v1', acceptedResult: 'turn-left' });
  const roundabout = command('exit-one', { category: 'rot', surfaceId: 'roundabout-v1' });
  const manoeuvre = command('park', { category: 'man' });
  const precheck = command('battery', {
    phase: 'precheck', category: 'pre-eng', surfaceId: 'yaris-manual-v1-eng'
  });
  const otherPrecheck = command('fog', {
    phase: 'precheck', category: 'pre-light', surfaceId: 'yaris-manual-v1-light'
  });

  assert.deepEqual(
    surfaceOptions(junction, [junction, left, roundabout, manoeuvre], () => 0.5).map(option => option.id),
    ['right', 'left']
  );
  assert.deepEqual(
    surfaceOptions(roundabout, [junction, roundabout, manoeuvre], () => 0.5).map(option => option.id),
    ['exit-one']
  );
  assert.deepEqual(
    surfaceOptions(precheck, [precheck, otherPrecheck], () => 0.5).map(option => option.id),
    ['battery']
  );
});

test('rendered Stage 1 surfaces retain stable surface IDs, normalized result IDs, icons, and visible labels', () => {
  const cases = [
    command('right', { category: 'dir', surfaceId: 'junction-v1', acceptedResult: 'turn-right' }),
    command('exit-one', { category: 'rot', surfaceId: 'roundabout-v1', acceptedResult: 'roundabout-exit-1' }),
    command('battery', {
      phase: 'precheck', category: 'pre-eng', surfaceId: 'yaris-manual-v1-eng', acceptedResult: 'locate-battery'
    }),
    command('park', { category: 'man', surfaceId: 'option-grid-v1', acceptedResult: 'park' })
  ];

  for (const target of cases) {
    const markup = renderSurface(target, [target], 'en');
    assert.match(markup, new RegExp(`data-surface="${target.surfaceId}"`));
    assert.match(markup, new RegExp(`data-result="${target.acceptedResult}"`));
    assert.match(markup, new RegExp(target.icon));
    assert.match(markup, new RegExp(`en-${target.id}`));
  }
});

test('unknown surface IDs are rejected rather than rendered as option grids', () => {
  const unknown = command('unknown', { surfaceId: 'future-simulator-v1' });
  assert.throws(() => renderSurface(unknown, [unknown], 'en'), /Unsupported surface: future-simulator-v1/);
  assert.deepEqual(SUPPORTED_SURFACE_IDS, [
    'junction-v1',
    'roundabout-v1',
    'option-grid-v1',
    'yaris-manual-v1-eng',
    'yaris-manual-v1-dash',
    'yaris-manual-v1-light',
    'yaris-manual-v1-body'
  ]);
});

test('unsupported commands are filtered with a development diagnostic before session selection', () => {
  const supported = command('supported');
  const unknown = command('unknown', { surfaceId: 'future-simulator-v1' });
  const diagnostics = [];
  assert.deepEqual(supportedCommands([supported, unknown], message => diagnostics.push(message)), [supported]);
  assert.deepEqual(diagnostics, ['Excluded unknown: unsupported surface future-simulator-v1']);
});

test('surface response controls can be disabled while replay is pending', () => {
  const target = command('park', { acceptedResult: 'park' });
  const markup = renderSurface(target, [target], 'en', { disabled: true });
  assert.match(markup, /data-result="park" disabled/);
});
