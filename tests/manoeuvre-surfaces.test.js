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
  ['join-traffic', 'join-traffic-v1', 'join-traffic'],
  ['park', 'parking-v1', 'parking'],
  ['voluntary-stop', 'stopping-v1', 'stopping']
]);

test('manoeuvre surfaces expose only explicit stable IDs and named audited templates', () => {
  assert.deepEqual(MANOEUVRE_SURFACE_IDS, [
    'u-turn-v1',
    'overtake-v1',
    'join-traffic-v1',
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
      'curbside-safe-merge',
      'marked-bays-clear-entry',
      'curb-bays-clear-space',
      'urban-curb-clear'
    ]
  );

  for (const templates of Object.values(MANOEUVRE_TEMPLATES)) {
    assert.ok(templates.length > 0);
    for (const template of templates) {
      assert.ok(template.features.length > 0, `${template.id} must declare visible features`);
      assert.ok(template.targets.length > 1, `${template.id} must declare accepted and rejected targets`);
      assert.ok(template.targets.some(target => target.resultId === template.expectedResult));
    }
  }
});

test('join-traffic presents a curb start with correct-lane, parked, and wrong-lane choices', () => {
  for (let seed = 0; seed < 64; seed += 1) {
    const model = generateManoeuvreSurface(command('join-traffic', 'join-traffic-v1'), seed);
    const accepted = model.targets.find(target => target.resultId === 'join-traffic');
    const parked = model.targets.find(target => target.resultId === 'stay-parked');
    const wrongLane = model.targets.find(target => target.resultId === 'wrong-lane');

    assert.equal(model.family, 'join-traffic');
    assert.equal(model.expectedResult, 'join-traffic');
    assert.equal(model.geometry.sceneId, 'join-traffic-photo-v1');
    assert.deepEqual(model.geometry.learnerVehicle, { x: 68, y: 60, width: 20, height: 28 });
    assert.ok(accepted.x >= 47 && accepted.x <= 53 && accepted.y >= 37 && accepted.y <= 43,
      'accepted target must sit in the correct travel lane ahead of the parked car');
    assert.ok(parked.x >= 66 && parked.x <= 72 && parked.y >= 52 && parked.y <= 58,
      'stay-parked target must remain at the right curb');
    assert.ok(wrongLane.x >= 28 && wrongLane.x <= 34 && wrongLane.y >= 37 && wrongLane.y <= 43,
      'wrong-lane target must sit clearly across the centre line');
    assertNonOverlappingTargets(model.targets);

    const route = model.geometry.correctRoute;
    assert.ok(route[0].x >= 64 && route[0].y >= 38,
      'reveal route must begin at the front of the curbside learner car');
    assert.ok(route.some(point => point.x === accepted.x && point.y === accepted.y),
      'reveal route must join the lane at the accepted target');
    // The manoeuvre ends with the car driving away, not parked on the target:
    // the route carries past it toward the vanishing point.
    assert.ok(route.at(-1).y < accepted.y - 10,
      'reveal route must carry on into the distance past the accepted target');
    assert.ok(route.every((point, index) => index === 0 || point.x <= route[index - 1].x),
      'reveal route must merge progressively left from the curb into the lane');
    // Turning the nose back down the frame is what read as a U-turn. The
    // accepted target sits level with the car's nose and jitters by up to
    // 1.5, so the lateral merge may sag by that much; everything after the
    // target must climb away without exception.
    assert.ok(route.every((point, index) => index === 0 || point.y - route[index - 1].y <= 1.5),
      'reveal route must never double back toward the camera');
    const joinIndex = route.findIndex(point => point.x === accepted.x && point.y === accepted.y);
    const departure = route.slice(joinIndex);
    assert.ok(departure.length >= 3, 'the departure must be drawn as a curve, not a single corner');
    assert.ok(departure.every((point, index) => index === 0 || point.y < departure[index - 1].y),
      'every segment after the join must travel away from the camera');
  }

  const model = generateManoeuvreSurface(command('join-traffic', 'join-traffic-v1'), 9);
  const markup = renderManoeuvreSurface(model, 'en');
  assert.match(markup, /class="surface-stage manoeuvre join-traffic driving-photo-stage"/);
  assert.match(markup, /data-surface="join-traffic-v1"/);
  assert.match(markup, /data-scene="join-traffic-photo-v1"/);
  assert.match(markup, /src="\.\/assets\/driving\/join-traffic-photo-v1\.webp"/);
  assert.match(markup, /class="surface-instruction">Select this road</);
  assert.doesNotMatch(markup, /data-correct-route/);
  assert.match(renderManoeuvreSurface(model, 'es', { reveal: true }), /data-correct-route/);
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

    assert.ok(learnerVehicle.y >= 78, 'learner vehicle must enter at the bottom');
    assert.ok(learnerVehicle.x >= 57 && learnerVehicle.x <= 61,
      'learner geometry must match the blue car in the photo');
    assert.ok(leadVehicle.x >= 51 && leadVehicle.x <= 55,
      'lead geometry must match the silver car in the photo');
    assert.ok(leadVehicle.y >= 23 && leadVehicle.y <= 29,
      'lead geometry must match the silver car in the photo');
    assert.ok(leadVehicle.y < follow.y);
    assert.ok(follow.x >= 54 && follow.x <= 60 && follow.y >= 45 && follow.y <= 58,
      'safe-follow target must sit on open asphalt between the photographed cars');
    assert.ok(follow.y + follow.height / 2 < learnerVehicle.y - learnerVehicle.height / 2,
      'safe-follow target must not overlap the learner car');
    assert.ok(passing.x >= 40 && passing.x <= 46 && passing.y >= 29 && passing.y <= 43,
      'passing target must sit on the visible opposing lane beside the lead car');
    assert.ok(model.geometry.correctRoute.some(point => point.x < 50), 'passing route must enter the opposing lane');
    assert.ok(model.geometry.correctRoute[0].y <= learnerVehicle.y - learnerVehicle.height / 2,
      'the reveal route must begin ahead of the learner car rather than crossing it');
    assert.ok(model.geometry.correctRoute.some(point => point.x === passing.x && point.y === passing.y),
      'the reveal route must pass through the selected passing space');
    const routeEnd = model.geometry.correctRoute.at(-1);
    assert.ok(routeEnd.x > 50 && routeEnd.y < leadVehicle.y - leadVehicle.height / 2,
      'the reveal route must pass the lead car and return to the right lane');

    const markup = renderManoeuvreSurface(model, 'en');
    assert.equal(model.geometry.sceneId, 'overtaking-photo-v1');
    assert.match(markup, /class="driving-scene-image"[^>]+data-scene="overtaking-photo-v1"/);
    assert.match(markup, /src="\.\/assets\/driving\/overtaking-photo-v1\.webp"/);
    assert.match(markup, /<svg viewBox="0 0 100 100" preserveAspectRatio="none"/);
    assert.doesNotMatch(markup, /class="scenario-vehicle (?:learner|lead)-vehicle"/);
  }
});

test('parking, stopping, and U-turn use reviewed photo scenes', () => {
  const parking = generateManoeuvreSurface(command('park', 'parking-v1'), 10);
  assert.equal(parking.geometry.sceneId, 'parallel-parking-gap-photo-v1');
  const parkingMarkup = renderManoeuvreSurface(parking, 'es');
  assert.match(parkingMarkup, /class="surface-stage manoeuvre parking driving-photo-stage"/);
  assert.match(parkingMarkup, /data-scene="parallel-parking-gap-photo-v1"/);
  assert.match(parkingMarkup, /src="\.\/assets\/driving\/parallel-parking-gap-photo-v1\.webp"/);
  assert.match(parkingMarkup, /alt="[^"]{20,}"/);
  assert.doesNotMatch(parkingMarkup, /class="manoeuvre-road-fill"/);

  const stopping = generateManoeuvreSurface(command('voluntary-stop', 'stopping-v1'), 10);
  assert.equal(stopping.geometry.sceneId, 'urban-roadside-photo-v2');
  const stoppingMarkup = renderManoeuvreSurface(stopping, 'es');
  assert.match(stoppingMarkup, /class="surface-stage manoeuvre stopping driving-photo-stage"/);
  assert.match(stoppingMarkup, /data-scene="urban-roadside-photo-v2"/);
  assert.match(stoppingMarkup, /src="\.\/assets\/driving\/urban-roadside-photo-v2\.webp"/);
  assert.match(stoppingMarkup, /alt="[^"]{20,}"/);
  assert.doesNotMatch(stoppingMarkup, /class="manoeuvre-road-fill"/);

  const uTurn = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), 10);
  assert.equal(uTurn.geometry.sceneId, 'u-turn-photo-v1');
  const uTurnMarkup = renderManoeuvreSurface(uTurn, 'en');
  assert.match(uTurnMarkup, /class="surface-stage manoeuvre u-turn driving-photo-stage"/);
  assert.match(uTurnMarkup, /data-scene="u-turn-photo-v1"/);
  assert.match(uTurnMarkup, /src="\.\/assets\/driving\/u-turn-photo-v1\.webp"/);
  assert.match(uTurnMarkup, /<svg viewBox="0 0 100 100" preserveAspectRatio="none"/);
  assert.doesNotMatch(uTurnMarkup, /class="manoeuvre-road"|class="manoeuvre-side-road"|class="road-marking"/);
});

test('parking and voluntary-stop feedback trace the learner car into the accepted space', () => {
  for (const [action, surfaceId] of [['park', 'parking-v1'], ['voluntary-stop', 'stopping-v1']]) {
    for (let seed = 1; seed <= 32; seed += 1) {
      const model = generateManoeuvreSurface(command(action, surfaceId), seed);
      const accepted = model.targets.find(target => target.resultId === model.expectedResult);
      const route = model.geometry.correctRoute;

      assert.ok(route, `${model.geometry.templateId} must provide post-answer movement feedback`);
      assert.deepEqual(route.at(-1), { x: accepted.x, y: accepted.y });
      // Each scene's learner car sits at a different depth: parking's route
      // starts mid-frame, stopping's (urban-roadside-photo-v2) just ahead of
      // its lower, larger car.
      const startBand = action === 'park' ? [45, 58, 68, 78] : [44, 50, 52, 58];
      assert.ok(route[0].x >= startBand[0] && route[0].x <= startBand[1]
        && route[0].y >= startBand[2] && route[0].y <= startBand[3],
        `${model.geometry.templateId} route must begin immediately ahead of the learner car`);
      assert.ok(route.at(-1).x > route[0].x, `${model.geometry.templateId} route must move toward the right curb`);

      if (action === 'park') {
        assert.ok(route.some(point => point.x >= 62 && point.y >= 42 && point.y <= 58),
          'parking route must bend through open road before entering the photographed gap');
      } else {
        const driveway = model.targets.find(target => target.feature === 'driveway');
        // v2 scene: the stop sits down-street of the vado on the road while
        // the vado apron is up on the sidewalk; nominal x separation is 15
        // with ±1.5 jitter each, so 12 is the tightest clear guarantee.
        assert.ok(!driveway || route.at(-1).x <= driveway.x - 12,
          'voluntary-stop route must finish clear of the garage vado');
      }

      // The route data survives for the model contract above, while an
      // explicitly playable clip suppresses its static presentation.
      assert.doesNotMatch(renderManoeuvreSurface(model, 'en'), /data-correct-route/);
      assert.doesNotMatch(renderManoeuvreSurface(model, 'en', {
        reveal: true, turnClipWillPlay: true
      }), /data-correct-route/);
    }
  }
});

test('every urban-photo choice is anchored to its visible curb, driveway, crossing, or synthetic restriction', () => {
  const expectedBands = {
    'open-bay': [72, 76, 35, 39],
    'driveway-bay': [84, 88, 13, 17],
    'hatched-bay': [26, 30, 46, 50],
    'clear-curb-bay': [72, 76, 35, 39],
    'crosswalk-bay': [41, 45, 13, 17],
    'no-parking-bay': [83, 87, 84, 88],
    // urban-roadside-photo-v2 (2026-08-14): correct stop at the clip's
    // parked pose before the vado, the vado apron, the right-lane crosswalk
    // (bands = template anchor ±1.5 jitter).
    'clear-curb': [56.5, 59.5, 27.5, 30.5],
    driveway: [71.5, 74.5, 30.5, 33.5],
    crosswalk: [46.5, 49.5, 10.5, 13.5]
  };

  for (const [action, surfaceId] of [['park', 'parking-v1'], ['voluntary-stop', 'stopping-v1']]) {
    for (let seed = 1; seed <= 64; seed += 1) {
      const model = generateManoeuvreSurface(command(action, surfaceId), seed);
      for (const target of model.targets) {
        const [minX, maxX, minY, maxY] = expectedBands[target.id];
        assert.ok(target.x >= minX && target.x <= maxX,
          `${target.id} x=${target.x} must align with the photographed feature`);
        assert.ok(target.y >= minY && target.y <= maxY,
          `${target.id} y=${target.y} must align with the photographed feature`);
      }
    }
  }
});

test('photo-backed physical features do not receive redundant crosswalk, driveway, or restriction-marking drawings', () => {
  for (const [action, surfaceId, templateId] of [
    ['park', 'parking-v1', 'marked-bays-clear-entry'],
    ['park', 'parking-v1', 'curb-bays-clear-space'],
    ['voluntary-stop', 'stopping-v1', 'urban-curb-clear']
  ]) {
    const model = modelForTemplate(action, surfaceId, templateId);
    const markup = renderManoeuvreSurface(model, 'en');
    assert.doesNotMatch(markup, /class="scenario-crosswalk"|class="scenario-driveway"|class="scenario-restriction"/);
  }

  // The no-parking sign is baked into the parking photo (task #14); no
  // synthetic sign may be drawn over it either.
  const signed = modelForTemplate('park', 'parking-v1', 'curb-bays-clear-space');
  assert.doesNotMatch(renderManoeuvreSurface(signed, 'en'), /data-road-sign=/);
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
  const englishLabels = [...english.matchAll(/ aria-label="([^"]+)"/g)].map(([, label]) => label);
  assert.equal(englishLabels.length, park.targets.length);
  assert.ok(englishLabels.every(label => label.length > 0));
  assert.equal(new Set(englishLabels).size, englishLabels.length, 'every target label must be distinct');
  assert.equal((english.match(/ disabled/g) ?? []).length, park.targets.length);
  // Feature-descriptive accessible names (e.g. "Blocked access") are expected
  // pre-reveal now — they describe a fixed visible feature, not the answer.
  // Only the reveal-only result/restriction elements must stay absent.
  assert.doesNotMatch(english, /surface-result-label|surface-restriction-label/);

  const turn = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), 5);
  assert.match(renderManoeuvreSurface(turn, 'es'), /Seleccione esta vía/);
});

test('reveal traces route choices and explains only the selected restricted location', () => {
  const overtake = generateManoeuvreSurface(command('overtake', 'overtake-v1'), 88);
  const routeReveal = renderManoeuvreSurface(overtake, 'en', { reveal: true, turnClipWillPlay: true });
  // A playable clip leaves labels and selection states while suppressing the line.
  assert.doesNotMatch(routeReveal, /data-correct-route/);
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
  assert.match(correctButton, /aria-label="Open parking space — Correct selection"/);
  assert.doesNotMatch(correctButton, /aria-describedby|class="sr-status"/);
  assert.match(correctButton, /class="target-status-marker correct"[^>]*>✓</);
  assert.doesNotMatch(correctButton, /data-selection-state="wrong"|target-status-marker wrong/);

  const wrongMarkup = renderManoeuvreSurface(model, 'es', { reveal: true, selectedTargetId: wrong.id });
  const wrongButton = targetButtonMarkup(wrongMarkup, wrong.id);
  const revealedCorrectButton = targetButtonMarkup(wrongMarkup, correct.id);
  assert.match(wrongButton, /data-selected="true" data-selection-state="wrong"/);
  assert.match(wrongButton, /aria-pressed="true"/);
  assert.match(wrongButton, /aria-label="Acceso bloqueado — Selección incorrecta"/);
  assert.doesNotMatch(wrongButton, /aria-describedby|class="sr-status"/);
  assert.match(wrongButton, /class="target-status-marker wrong"[^>]*>×</);
  assert.match(revealedCorrectButton, /class="target-status-marker correct"[^>]*>✓</);
  assert.match(revealedCorrectButton, /aria-pressed="false"/);
});

test('parking keeps its signed no-parking choice without synthetic sign drawings; stopping renders none', () => {
  const parking = modelForTemplate('park', 'parking-v1', 'curb-bays-clear-space');
  const parkingTarget = parking.targets.find(target => target.feature === 'no-parking-sign');
  assert.equal(parkingTarget.resultId, 'signed-no-parking');
  assert.equal(parkingTarget.explanationKey, 'surface.restricted.noParkingSign');
  const parkingMarkup = renderManoeuvreSurface(parking, 'en', {
    reveal: true,
    selectedTargetId: parkingTarget.id
  });
  // The sign lives in the photo raster itself (task #14): the choice keeps
  // its stable IDs and label, but no synthetic sign is drawn over the scene.
  assert.doesNotMatch(parkingMarkup, /data-road-sign=/);
  assert.equal((parkingMarkup.match(/class="road-sign-prohibition"/g) ?? []).length, 0);
  assert.match(parkingMarkup, /No-parking sign/);

  // The stopping scene lost its sign in the 2026-08-12 regen: blocking a vado
  // is illegal without one, so no synthetic sign may be drawn over the photo.
  const stopping = modelForTemplate('voluntary-stop', 'stopping-v1', 'urban-curb-clear');
  const stoppingMarkup = renderManoeuvreSurface(stopping, 'es', { reveal: true });
  assert.doesNotMatch(stoppingMarkup, /data-road-sign=/);
  assert.ok(!stopping.targets.some(target => target.resultId === 'signed-no-stopping'));
});

test('every manoeuvre target exposes a non-empty, distinct, bilingual accessible name that never reveals the answer', () => {
  for (const [action, surfaceId] of CASES) {
    for (let seed = 1; seed <= 12; seed += 1) {
      const model = generateManoeuvreSurface(command(action, surfaceId), seed);
      for (const [locale, correctWord] of [['en', 'correct'], ['es', 'correct']]) {
        const markup = renderManoeuvreSurface(model, locale, { disabled: true });
        const labels = [...markup.matchAll(/ aria-label="([^"]+)"/g)].map(([, label]) => label);
        assert.equal(labels.length, model.targets.length, `${surfaceId} seed ${seed} (${locale}) must label every target`);
        assert.ok(labels.every(label => label.trim().length > 0), `${surfaceId} seed ${seed} (${locale}) labels must be non-empty`);
        assert.equal(
          new Set(labels).size,
          labels.length,
          `${surfaceId} seed ${seed} (${locale}) labels must be pairwise distinct`
        );
        assert.ok(
          labels.every(label => !label.toLowerCase().includes(correctWord)),
          `${surfaceId} seed ${seed} (${locale}) labels must not claim correctness: ${labels.join(', ')}`
        );
      }
    }
  }
});

test('road motion wraps every photo-backed manoeuvre scene with its calibrated transform', () => {
  const cases = [
    ['change-direction', 'u-turn-v1', 'clear-two-way-turnaround', 1.05, 50, 84],
    ['overtake', 'overtake-v1', 'clear-two-lane-pass', 1.18, 54, 86],
    ['park', 'parking-v1', 'curb-bays-clear-space', 1.06, 65, 84],
    ['voluntary-stop', 'stopping-v1', 'urban-curb-clear', 1.06, 66, 84]
  ];

  for (const [actionId, surfaceId, templateId, endScale, originX, originY] of cases) {
    const model = modelForTemplate(actionId, surfaceId, templateId);
    const markup = renderManoeuvreSurface(model, 'en', {
      motion: {
        phase: 'approaching-locked',
        progress: 0.5,
        scale: 1.09,
        endScale,
        origin: Object.freeze({ x: originX, y: originY }),
        locked: true,
        moving: true,
        elapsedMs: 3_000,
        remainingMs: 3_000
      }
    });

    assert.match(markup, new RegExp(`class="surface-stage manoeuvre ${model.family} driving-photo-stage road-motion-stage"`));
    assert.match(markup, /class="road-motion-viewport"/);
    assert.match(markup, /class="road-motion-scene"/);
    assert.match(markup, /data-road-motion="approaching-locked"/);
    assert.match(markup, /data-road-motion-running="true"/);
    assert.match(markup, /--road-motion-scale:1\.09/);
    assert.match(markup, new RegExp(`--road-motion-end-scale:${endScale}`));
    assert.match(markup, new RegExp(`--road-motion-origin-x:${originX}%`));
    assert.match(markup, new RegExp(`--road-motion-origin-y:${originY}%`));
    assert.match(markup, /--road-motion-elapsed:3000ms/);

    const scene = markup.match(/<div class="road-motion-scene"[\s\S]*?<\/div>/)?.[0];
    assert.ok(scene);
    assert.match(scene, /class="driving-scene-image"/);
    assert.match(scene, /<svg/);
    assert.equal((scene.match(/class="manoeuvre-target"/g) ?? []).length, model.targets.length);
  }
});

test('playable manoeuvre clips suppress the static route and every fallback retains it', () => {
  for (const [action, surfaceId, family] of [
    ['park', 'parking-v1', 'parking'],
    ['voluntary-stop', 'stopping-v1', 'stopping']
  ]) {
    const model = generateManoeuvreSurface(command(action, surfaceId), 12);
    // Registry membership is not playback. The controller explicitly says
    // whether this reveal will enter the clip-backed transition.
    const playableClip = renderManoeuvreSurface(model, 'en', {
      disabled: true, reveal: true, turnClipWillPlay: true
    });
    assert.doesNotMatch(playableClip, /data-correct-route/);
    const staticFallback = renderManoeuvreSurface(model, 'en', {
      disabled: true, reveal: true, turnClipWillPlay: false
    });
    assert.match(staticFallback, /data-correct-route/);
    assert.doesNotMatch(staticFallback, /animateMotion/);
  }
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

test('stopping choices use car-sized vertical outlines inside their full touch targets', async () => {
  const model = modelForTemplate('voluntary-stop', 'stopping-v1', 'urban-curb-clear');
  const markup = renderManoeuvreSurface(model, 'en');
  for (const target of model.targets) {
    assert.match(targetButtonMarkup(markup, target.id), new RegExp(`data-feature="${target.feature}"`));
  }
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.surface-stage\.stopping \.manoeuvre-target::before\s*\{[^}]*width:\s*min\(44px, 64%\)[^}]*height:\s*calc\(100% - 4px\)/s);
  assert.match(styles, /\.surface-stage\.stopping \.manoeuvre-target\[data-selection-state="wrong"\]::before/);
  assert.match(styles, /\.surface-stage\.stopping \.manoeuvre-target\[aria-current="true"\]::before/);
});

test('production activation includes every eligible manoeuvre and only three semantic exceptions', async () => {
  for (const surfaceId of MANOEUVRE_SURFACE_IDS) {
    assert.equal(SUPPORTED_SURFACE_IDS.includes(surfaceId), true);
  }

  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  const expectedActive = {
    'c-incorp': 'join-traffic-v1',
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

  assert.deepEqual(supportedCommands(commands), commands.filter(command => command.active !== false));
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

test('the U-turn question offers a third response so it is not a coin flip', () => {
  // Two targets make the question answerable by guessing. The side road is
  // the honest third: "cambio de sentido" means reverse direction, not turn
  // off, and that is the mistake a learner actually makes. Its placement was
  // verified against u-turn-photo-v1 — the mouth of the left branch.
  const seen = new Map();
  for (let seed = 1; seed <= 32; seed += 1) {
    const model = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), seed);
    assert.ok(model.targets.length >= 3, `seed ${seed} offers only ${model.targets.length} responses`);

    const sideRoad = model.targets.find(target => target.resultId === 'side-road');
    assert.ok(sideRoad, `seed ${seed} has no side-road response`);
    assert.notEqual(sideRoad.resultId, model.expectedResult, 'the side road must never be accepted');
    // Left of the road the learner is on, and short of the turnaround gap.
    assert.ok(sideRoad.x < 30, `side road must sit on the left branch (x ${sideRoad.x})`);
    assert.ok(sideRoad.y > 25 && sideRoad.y < 45, `side road must sit at the branch mouth (y ${sideRoad.y})`);
    seen.set(model.geometry.templateId, (seen.get(model.geometry.templateId) ?? 0) + 1);
  }
  assert.equal(seen.size, 2, 'both U-turn templates must be exercised');
});

test('the side road is described by what it is, never by whether it is right', () => {
  const model = generateManoeuvreSurface(command('change-direction', 'u-turn-v1'), 5);
  for (const locale of ['en', 'es']) {
    const markup = renderManoeuvreSurface(model, locale);
    const label = markup.match(/data-result="side-road"[^>]*aria-label="([^"]+)"/)?.[1];
    assert.ok(label, `${locale} side-road target must carry an accessible label`);
    assert.doesNotMatch(label, /correct|incorrect|wrong|correcto|incorrecto/i, label);
  }
  assert.match(renderManoeuvreSurface(model, 'en'), /data-result="side-road"[^>]*aria-label="Side road on the left"/);
  assert.match(renderManoeuvreSurface(model, 'es'), /data-result="side-road"[^>]*aria-label="Vía lateral a la izquierda"/);
});
