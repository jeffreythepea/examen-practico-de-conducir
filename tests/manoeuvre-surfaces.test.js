import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNonOverlappingTargets } from '../src/surface-geometry.js';
import {
  MANOEUVRE_SURFACE_IDS,
  MANOEUVRE_TEMPLATES,
  generateManoeuvreSurface,
  renderManoeuvreSurface
} from '../src/manoeuvre-surfaces.js';
import { SUPPORTED_SURFACE_IDS, supportedCommands } from '../src/surfaces.js';

function command(action, surfaceId) {
  return {
    id: `command-${action}`,
    actionId: action,
    acceptedResult: action,
    surfaceId
  };
}

const CASES = Object.freeze([
  ['change-direction', 'u-turn-v1', 'u-turn'],
  ['overtake', 'overtake-v1', 'overtake'],
  ['park', 'parking-v1', 'parking'],
  ['voluntary-stop', 'stopping-v1', 'stopping']
]);

test('manoeuvre surfaces expose only explicit stable IDs and named audited templates', () => {
  assert.deepEqual(MANOEUVRE_SURFACE_IDS, [
    'u-turn-v1',
    'overtake-v1',
    'parking-v1',
    'stopping-v1'
  ]);
  assert.deepEqual(
    Object.values(MANOEUVRE_TEMPLATES).flat().map(template => template.id),
    [
      'clear-two-way-turnaround',
      'clear-junction-turnaround',
      'clear-two-lane-pass',
      'clear-return-lane',
      'marked-bays-clear-entry',
      'curb-bays-clear-space',
      'urban-curb-clear',
      'no-stopping-curb-clear'
    ]
  );

  for (const templates of Object.values(MANOEUVRE_TEMPLATES)) {
    assert.equal(templates.length, 2);
    for (const template of templates) {
      assert.ok(template.features.length > 0, `${template.id} must declare visible features`);
      assert.ok(template.targets.length > 1, `${template.id} must declare accepted and rejected targets`);
      assert.ok(template.targets.some(target => target.resultId === template.expectedResult));
    }
  }
});

test('manoeuvre surfaces expose only defensible template-declared spatial targets', () => {
  const park = generateManoeuvreSurface(command('park', 'parking-v1'), 10);
  assert.equal(park.expectedResult, 'park');
  assert.ok(park.targets.some(target => target.kind === 'legal-space' && target.resultId === 'park'));
  assert.ok(park.targets.some(target => target.kind === 'illegal-space' && target.explanationKey));

  const stop = generateManoeuvreSurface(command('voluntary-stop', 'stopping-v1'), 11);
  assert.ok(stop.targets.some(target => target.kind === 'legal-stop'));
  assert.ok(stop.targets.some(target => target.kind === 'restricted-stop' && target.explanationKey));

  for (const [action, surfaceId, family] of CASES) {
    const model = generateManoeuvreSurface(command(action, surfaceId), 12);
    const template = MANOEUVRE_TEMPLATES[surfaceId].find(item => item.id === model.geometry.templateId);
    assert.equal(model.family, family);
    assert.equal(model.expectedResult, action);
    assert.deepEqual(model.geometry.features, template.features);
    assert.deepEqual(
      model.targets.map(({ id, resultId, kind, feature, explanationKey }) => ({
        id, resultId, kind, feature, ...(explanationKey ? { explanationKey } : {})
      })),
      template.targets.map(({ id, resultId, kind, feature, explanationKey }) => ({
        id, resultId, kind, feature, ...(explanationKey ? { explanationKey } : {})
      }))
    );
  }
});

test('the same seed reproduces the complete manoeuvre model and seeds vary only bounded layout details', () => {
  const target = command('overtake', 'overtake-v1');
  assert.deepEqual(generateManoeuvreSurface(target, 88), generateManoeuvreSurface(target, 88));

  const templateIds = new Set();
  const positions = new Set();
  for (let seed = 1; seed <= 32; seed += 1) {
    const model = generateManoeuvreSurface(target, seed);
    templateIds.add(model.geometry.templateId);
    positions.add(model.targets.map(item => `${item.x},${item.y}`).join('|'));
    const template = MANOEUVRE_TEMPLATES['overtake-v1'].find(item => item.id === model.geometry.templateId);
    model.targets.forEach((item, index) => {
      assert.ok(Math.abs(item.x - template.targets[index].x) <= 1.5);
      assert.ok(Math.abs(item.y - template.targets[index].y) <= 1.5);
    });
  }
  assert.deepEqual([...templateIds].sort(), ['clear-return-lane', 'clear-two-lane-pass']);
  assert.ok(positions.size > 16);
});

test('overtaking separates the learner, lead vehicle, safe-follow target, and opposing-lane pass', () => {
  for (let seed = 1; seed <= 32; seed += 1) {
    const model = generateManoeuvreSurface(command('overtake', 'overtake-v1'), seed);
    const { learnerVehicle, leadVehicle } = model.geometry;
    const follow = model.targets.find(target => target.resultId === 'follow-vehicle');
    const passing = model.targets.find(target => target.resultId === 'overtake');

    assert.ok(learnerVehicle.y >= 82, 'learner vehicle must enter at the bottom');
    assert.equal(learnerVehicle.x, 66);
    assert.equal(leadVehicle.x, 66);
    assert.ok(leadVehicle.y < follow.y);
    assert.ok(follow.y - follow.height / 2 > leadVehicle.y + leadVehicle.height / 2,
      'safe-follow target must have a positive visible gap behind the lead car');
    assert.ok(learnerVehicle.y > follow.y, 'learner car remains behind the safe-follow option');
    assert.ok(passing.x < 50, 'passing target must be in the opposing lane');
    assert.ok(model.geometry.correctRoute.some(point => point.x < 50), 'passing route must enter the opposing lane');

    const markup = renderManoeuvreSurface(model, 'en');
    assert.match(markup, /class="scenario-vehicle learner-vehicle"/);
    assert.match(markup, /class="scenario-vehicle lead-vehicle"/);
  }
});

test('every accepted U-turn route geometrically finishes travelling down the original road', () => {
  const templateIds = new Set();
  for (let seed = 1; seed <= 32; seed += 1) {
    const model = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), seed);
    const route = model.geometry.correctRoute;
    const accepted = model.targets.find(target => target.resultId === 'change-direction');
    const entry = route[0];
    const afterEntry = route[1];
    const beforeEndpoint = route.at(-2);
    const endpoint = route.at(-1);

    templateIds.add(model.geometry.templateId);
    assert.ok(afterEntry.y < entry.y, 'vehicle must enter travelling up the road');
    assert.ok(endpoint.y > beforeEndpoint.y, 'accepted endpoint must travel back down the road');
    assert.deepEqual(endpoint, { x: accepted.x, y: accepted.y });
    assert.match(accepted.id, /endpoint$/, 'the accepted target must name the completed direction, not the turning arc');
    assert.ok(endpoint.y >= 75, 'completed direction must be selected after the turn, near the driver side');
    assert.ok(entry.x >= 30 && entry.x <= 70 && endpoint.x >= 30 && endpoint.x <= 70);
    assert.notEqual(Math.sign(entry.x - 50), Math.sign(endpoint.x - 50), 'route must finish in the opposite lane');
  }
  assert.deepEqual([...templateIds].sort(), ['clear-junction-turnaround', 'clear-two-way-turnaround']);
});

test('every generated target is touch-sized, non-overlapping, and comes from its named template', () => {
  for (const [action, surfaceId] of CASES) {
    for (let seed = 0; seed < 100; seed += 1) {
      const model = generateManoeuvreSurface(command(action, surfaceId), seed);
      const template = MANOEUVRE_TEMPLATES[surfaceId].find(item => item.id === model.geometry.templateId);
      assert.deepEqual(model.targets.map(target => target.id), template.targets.map(target => target.id));
      assertNonOverlappingTargets(model.targets);
      for (const target of model.targets) {
        assert.ok(target.width >= 11);
        assert.ok(target.height >= 14.67);
      }
    }
  }
});

test('generator rejects mismatched commands instead of inventing a scenario', () => {
  assert.throws(
    () => generateManoeuvreSurface(command('park', 'stopping-v1'), 1),
    /Unsupported stopping action: park/
  );
  assert.throws(
    () => generateManoeuvreSurface(command('overtake', 'future-road-v1'), 1),
    /Unsupported manoeuvre surface: future-road-v1/
  );
});

test('renderer keeps pre-response targets visibly unlabeled with bilingual instructions', () => {
  const park = generateManoeuvreSurface(command('park', 'parking-v1'), 10);
  const english = renderManoeuvreSurface(park, 'en', { disabled: true });
  const spanish = renderManoeuvreSurface(park, 'es', { disabled: true });

  assert.match(english, /data-surface="parking-v1"/);
  assert.match(english, /class="surface-instruction">Select a suitable space</);
  assert.match(spanish, /class="surface-instruction">Seleccione un espacio adecuado</);
  assert.equal((english.match(/class="manoeuvre-target"/g) ?? []).length, park.targets.length);
  assert.equal((english.match(/ aria-label="Select this space"/g) ?? []).length, park.targets.length);
  assert.equal((english.match(/ disabled/g) ?? []).length, park.targets.length);
  assert.doesNotMatch(english, /surface-result-label|surface-restriction-label|Blocked access|Crossing/);

  const turn = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), 5);
  assert.match(renderManoeuvreSurface(turn, 'es'), /Seleccione esta vía/);
});

test('reveal traces route choices and explains only the selected restricted location', () => {
  const overtake = generateManoeuvreSurface(command('overtake', 'overtake-v1'), 88);
  const routeReveal = renderManoeuvreSurface(overtake, 'en', { reveal: true });
  assert.match(routeReveal, /data-correct-route/);
  assert.match(routeReveal, /class="surface-result-label">Correct route</);
  assert.equal((routeReveal.match(/aria-current="true"/g) ?? []).length, 1);

  const stop = generateManoeuvreSurface(command('voluntary-stop', 'stopping-v1'), 11);
  const restricted = stop.targets.find(target => target.kind === 'restricted-stop');
  const stopReveal = renderManoeuvreSurface(stop, 'es', {
    reveal: true,
    selectedTargetId: restricted.id
  });
  assert.match(stopReveal, /class="surface-result-label">Espacio correcto</);
  assert.match(stopReveal, /class="surface-restriction-label"/);
  assert.match(stopReveal, /Acceso bloqueado|Paso de peatones|Señal de prohibido parar/);
  assert.match(stopReveal, new RegExp(`data-target="${restricted.id}"[^>]+data-selected="true"[^>]+data-selection-state="wrong"`));

  const legal = stop.targets.find(target => target.kind === 'legal-stop');
  assert.doesNotMatch(
    renderManoeuvreSurface(stop, 'en', { reveal: true, selectedTargetId: legal.id }),
    /surface-restriction-label/
  );
});

test('reveal distinguishes correct and wrong selections without marking a correct selection as wrong', () => {
  const model = generateManoeuvreSurface(command('park', 'parking-v1'), 10);
  const correct = model.targets.find(target => target.resultId === model.expectedResult);
  const wrong = model.targets.find(target => target.resultId !== model.expectedResult);

  const correctMarkup = renderManoeuvreSurface(model, 'en', { reveal: true, selectedTargetId: correct.id });
  const correctButton = targetButtonMarkup(correctMarkup, correct.id);
  assert.match(correctButton, /data-selected="true" data-selection-state="correct"/);
  assert.match(correctButton, /aria-pressed="true"/);
  assert.match(correctButton, /aria-label="Select this space — Correct selection"/);
  assert.doesNotMatch(correctButton, /aria-describedby|class="sr-status"/);
  assert.match(correctButton, /class="target-status-marker correct"[^>]*>✓</);
  assert.doesNotMatch(correctButton, /data-selection-state="wrong"|target-status-marker wrong/);

  const wrongMarkup = renderManoeuvreSurface(model, 'es', { reveal: true, selectedTargetId: wrong.id });
  const wrongButton = targetButtonMarkup(wrongMarkup, wrong.id);
  const revealedCorrectButton = targetButtonMarkup(wrongMarkup, correct.id);
  assert.match(wrongButton, /data-selected="true" data-selection-state="wrong"/);
  assert.match(wrongButton, /aria-pressed="true"/);
  assert.match(wrongButton, /aria-label="Seleccione este espacio — Selección incorrecta"/);
  assert.doesNotMatch(wrongButton, /aria-describedby|class="sr-status"/);
  assert.match(wrongButton, /class="target-status-marker wrong"[^>]*>×</);
  assert.match(revealedCorrectButton, /class="target-status-marker correct"[^>]*>✓</);
  assert.match(revealedCorrectButton, /aria-pressed="false"/);
});

test('parking and stopping templates render distinct audited prohibition signs', () => {
  const parking = modelForTemplate('park', 'parking-v1', 'curb-bays-clear-space');
  const parkingTarget = parking.targets.find(target => target.feature === 'no-parking-sign');
  assert.equal(parkingTarget.resultId, 'signed-no-parking');
  assert.equal(parkingTarget.explanationKey, 'surface.restricted.noParkingSign');
  const parkingMarkup = renderManoeuvreSurface(parking, 'en', {
    reveal: true,
    selectedTargetId: parkingTarget.id
  });
  assert.match(parkingMarkup, /data-road-sign="no-parking"/);
  assert.equal((parkingMarkup.match(/class="road-sign-prohibition"/g) ?? []).length, 1);
  assert.match(parkingMarkup, /No-parking sign/);
  assert.doesNotMatch(parkingMarkup, /data-road-sign="no-stopping"/);

  const stopping = modelForTemplate('voluntary-stop', 'stopping-v1', 'no-stopping-curb-clear');
  const stoppingTarget = stopping.targets.find(target => target.feature === 'no-stopping-sign');
  assert.equal(stoppingTarget.resultId, 'signed-no-stopping');
  assert.equal(stoppingTarget.explanationKey, 'surface.restricted.noStoppingSign');
  const stoppingMarkup = renderManoeuvreSurface(stopping, 'es', {
    reveal: true,
    selectedTargetId: stoppingTarget.id
  });
  assert.match(stoppingMarkup, /data-road-sign="no-stopping"/);
  assert.equal((stoppingMarkup.match(/class="road-sign-prohibition"/g) ?? []).length, 2);
  assert.match(stoppingMarkup, /Señal de prohibido parar/);
  assert.doesNotMatch(stoppingMarkup, /data-road-sign="no-parking"/);
});

test('manoeuvre target styles preserve the target model dimensions and reveal states', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.manoeuvre-target\s*\{[^}]*position:\s*absolute[^}]*min-width:\s*44px[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.manoeuvre-target\[aria-current="true"\]/);
  assert.match(styles, /\.manoeuvre-target\[data-selection-state="wrong"\]/);
  assert.doesNotMatch(styles, /\.manoeuvre-target\[data-selected="true"\]\s*\{[^}]*border-style:\s*dashed/s);
  assert.match(styles, /\.target-status-marker\s*\{/);
  assert.match(styles, /\.surface-restriction-label\s*\{/);
});

test('production activation includes every eligible manoeuvre and only three semantic exceptions', async () => {
  for (const surfaceId of MANOEUVRE_SURFACE_IDS) {
    assert.equal(SUPPORTED_SURFACE_IDS.includes(surfaceId), true);
  }

  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const expectedActive = {
    'c-sentido': 'u-turn-v1',
    'c-adel': 'overtake-v1',
    'c-est': 'parking-v1',
    'c-parada': 'stopping-v1',
    'c-adapte': 'option-grid-v1',
    'c-detencion': 'option-grid-v1',
    'c-final': 'option-grid-v1'
  };
  for (const [id, surfaceId] of Object.entries(expectedActive)) {
    assert.equal(commands.find(item => item.id === id).surfaceId, surfaceId);
  }

  assert.deepEqual(supportedCommands(commands), commands);
});

function targetButtonMarkup(markup, targetId) {
  const escaped = targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markup.match(new RegExp(`<button[^>]+data-target="${escaped}"[^>]*>[\\s\\S]*?</button>`));
  assert.ok(match, `missing target button ${targetId}`);
  return match[0];
}

function modelForTemplate(action, surfaceId, templateId) {
  for (let seed = 0; seed < 100; seed += 1) {
    const model = generateManoeuvreSurface(command(action, surfaceId), seed);
    if (model.geometry.templateId === templateId) return model;
  }
  throw new Error(`No seed produced ${templateId}`);
}
