import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTROL_SURFACE_IDS,
  MANUAL_SECURE_TARGETS,
  WHEEL_CENTER_TOLERANCE_DEGREES,
  generateControlSurface,
  reduceControlResponse,
  renderControlSurface
} from '../src/control-surfaces.js';
import { SUPPORTED_SURFACE_IDS } from '../src/surfaces.js';

function command(action, surfaceId) {
  return {
    id: `command-${action}`,
    actionId: action,
    acceptedResult: action,
    surfaceId
  };
}

test('control surfaces preserve stable IDs while declaring generic manual controls', () => {
  assert.deepEqual(CONTROL_SURFACE_IDS, ['wheel-center-v1', 'secure-yaris-v1']);
  assert.equal(WHEEL_CENTER_TOLERANCE_DEGREES, 5);
  assert.deepEqual(MANUAL_SECURE_TARGETS, ['engine-stop', 'parking-brake', 'manual-gear']);
  assert.ok(Object.isFrozen(CONTROL_SURFACE_IDS));
  assert.ok(Object.isFrozen(MANUAL_SECURE_TARGETS));
});

test('wheel centering completes only inside the centered tolerance', () => {
  const model = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 4);
  assert.equal(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 18 }).complete, false);
  assert.deepEqual(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 2 }), {
    complete: true,
    selectedResult: 'steering-straight',
    selectedTargetId: 'wheel-center',
    wheelDegrees: 2
  });
  assert.equal(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 5 }).complete, true);
  assert.equal(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: -5 }).complete, true);
  assert.equal(reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 5.1 }).complete, false);
});

test('manual immobilization stays reversible and evaluates only after explicit submission', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  let state = reduceControlResponse(model, {}, {
    type: 'select-gear', targetId: 'manual-gear', gear: model.meta.requiredGear
  });
  assert.equal(state.complete, false);
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'engine-stop' });
  assert.equal(state.complete, false);
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'parking-brake' });
  assert.deepEqual(state, {
    complete: false,
    ready: true,
    selectedResult: null,
    selectedTargetId: 'parking-brake',
    engineStopped: true,
    parkingBrakeApplied: true,
    selectedGear: model.meta.requiredGear
  });
  state = reduceControlResponse(model, state, { type: 'submit-secure' });
  assert.equal(state.complete, true);
  assert.equal(state.selectedResult, 'secure-vehicle');
  assert.equal(state.selectedTargetId, 'manual-gear');

  const wrongGear = reduceControlResponse(model, {}, {
    type: 'select-gear', targetId: 'manual-gear', gear: model.meta.requiredGear === 'first' ? 'reverse' : 'first'
  });
  assert.equal(wrongGear.complete, false);
  assert.equal(wrongGear.selectedResult, null);

  let wrongSequence = reduceControlResponse(model, wrongGear, {
    type: 'activate', targetId: 'engine-stop'
  });
  assert.equal(wrongSequence.incorrect, undefined, 'partial input remains unscored');
  wrongSequence = reduceControlResponse(model, wrongSequence, {
    type: 'activate', targetId: 'parking-brake'
  });
  assert.equal(wrongSequence.incorrect, undefined, 'a complete selection remains editable until submitted');
  assert.equal(wrongSequence.ready, true);
  wrongSequence = reduceControlResponse(model, wrongSequence, { type: 'submit-secure' });
  assert.deepEqual(wrongSequence, {
    complete: false,
    incorrect: true,
    ready: true,
    selectedResult: null,
    selectedTargetId: 'manual-gear',
    engineStopped: true,
    parkingBrakeApplied: true,
    selectedGear: model.meta.requiredGear === 'first' ? 'reverse' : 'first'
  });
});

test('every manual immobilization choice can be toggled off before submission', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  let state = reduceControlResponse(model, {}, { type: 'activate', targetId: 'engine-stop' });
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'engine-stop' });
  assert.equal(state.engineStopped, false);
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'parking-brake' });
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'parking-brake' });
  assert.equal(state.parkingBrakeApplied, false);
  state = reduceControlResponse(model, state, { type: 'select-gear', targetId: 'manual-gear', gear: 'first' });
  state = reduceControlResponse(model, state, { type: 'select-gear', targetId: 'manual-gear', gear: 'first' });
  assert.equal(state.selectedGear, null);
  assert.equal(state.ready, false);
});

test('control generation is deterministic, immutable, serializable, and manual-grounded', () => {
  const wheelCommand = command('steering-straight', 'wheel-center-v1');
  const wheel = generateControlSurface(wheelCommand, 44);
  assert.deepEqual(wheel, generateControlSurface(wheelCommand, 44));
  assert.ok(Math.abs(wheel.geometry.initialWheelDegrees) > WHEEL_CENTER_TOLERANCE_DEGREES);
  assert.equal(wheel.meta.toleranceDegrees, WHEEL_CENTER_TOLERANCE_DEGREES);
  assert.equal(wheel.targets[0].id, 'wheel-center');
  assert.ok(Object.isFrozen(wheel));
  assert.doesNotThrow(() => JSON.stringify(wheel));

  const secure = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 45);
  assert.equal(secure.family, 'secure-manual');
  assert.ok(['uphill', 'downhill'].includes(secure.meta.slope));
  assert.equal(secure.meta.requiredGear, secure.meta.slope === 'uphill' ? 'first' : 'reverse');
  assert.equal(secure.meta.legalReference, 'RGC Article 92');
  assert.deepEqual(secure.targets.map(target => target.id), MANUAL_SECURE_TARGETS);
  assert.equal(secure.targets.find(target => target.id === 'parking-brake').kind, 'hand-parking-brake-lever');

  const variants = new Set(Array.from({ length: 32 }, (_, seed) =>
    generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), seed).meta.slope));
  assert.deepEqual([...variants].sort(), ['downhill', 'uphill']);
});

test('generator and reducer reject incompatible input rather than inventing behavior', () => {
  assert.throws(
    () => generateControlSurface(command('secure-vehicle', 'wheel-center-v1'), 1),
    /Unsupported wheel action: secure-vehicle/
  );
  assert.throws(
    () => generateControlSurface(command('secure-vehicle', 'future-control-v1'), 1),
    /Unsupported control surface: future-control-v1/
  );

  const wheel = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 2);
  assert.throws(
    () => reduceControlResponse(wheel, {}, { type: 'set-wheel', degrees: Number.NaN }),
    /Wheel degrees must be finite/
  );
  const secure = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 3);
  assert.throws(
    () => reduceControlResponse(secure, {}, { type: 'activate', targetId: 'power-switch' }),
    /Unknown secure-vehicle target: power-switch/
  );
  assert.throws(
    () => reduceControlResponse(secure, {}, { type: 'select-gear', targetId: 'manual-gear', gear: 'park' }),
    /Unsupported manual gear: park/
  );
});

test('wheel renderer uses a localized native range and a visible wheel graphic', () => {
  const model = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 4);
  const english = renderControlSurface(model, { wheelDegrees: 18 }, 'en', false);
  const spanish = renderControlSurface(model, { wheelDegrees: -12 }, 'es', true);

  assert.match(english, /data-surface="wheel-center-v1"/);
  assert.match(english, /class="steering-wheel-graphic"/);
  assert.match(english, /class="surface-instruction">Centre the steering wheel</);
  assert.match(english, /<input[^>]+type="range"[^>]+data-control-event="set-wheel"/);
  assert.match(english, /aria-label="Steering wheel position"/);
  assert.match(english, /value="18"/);
  assert.match(spanish, /class="surface-instruction">Centre el volante</);
  assert.match(spanish, /aria-label="Posición del volante"/);
  assert.match(spanish, /value="-12"/);
  assert.match(spanish, / disabled/);
});

test('off-centre wheel reveal marks the learner position wrong and shows a centered correct reference', () => {
  const model = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 4);
  const response = {
    complete: true,
    selectedResult: null,
    selectedTargetId: null,
    wheelDegrees: 18,
    reveal: true
  };
  const english = renderControlSurface(model, response, 'en', true);
  const spanish = renderControlSurface(model, { ...response, wheelDegrees: -12 }, 'es', true);

  assert.match(english, /data-wheel-position="learner" data-selection-state="wrong"/);
  assert.match(english, /data-wheel-position="learner"[^]*class="target-status-marker wrong control-marker"[^>]*>×</);
  assert.match(english, /Your final wheel position — Wrong selection/);
  assert.match(english, /data-wheel-position="correct-reference"[^]*style="--wheel-degrees:0deg"/);
  assert.match(english, /Centered correct reference/);
  assert.match(english, /class="target-status-marker correct control-marker"[^>]*>✓</);
  assert.doesNotMatch(english, /data-wheel-position="learner" data-selection-state="correct"/);
  assert.doesNotMatch(english, /<input[^>]+aria-current="true"/);

  assert.match(spanish, /Posición final del volante — Selección incorrecta/);
  assert.match(spanish, /Referencia correcta centrada/);
});

test('centered wheel reveal marks the learner position correct without a second reference', () => {
  const model = generateControlSurface(command('steering-straight', 'wheel-center-v1'), 4);
  const response = reduceControlResponse(model, {}, { type: 'set-wheel', degrees: 2 });
  const markup = renderControlSurface(model, { ...response, reveal: true }, 'en', true);

  assert.match(markup, /data-wheel-position="learner" data-selection-state="correct"/);
  assert.match(markup, /Your final wheel position — Correct selection/);
  assert.match(markup, /class="target-status-marker correct control-marker"[^>]*>✓</);
  assert.doesNotMatch(markup, /data-wheel-position="correct-reference"/);
  assert.match(markup, /<input[^>]+aria-current="true"/);
});

test('manual renderer exposes the slope, engine, parking brake, and H-pattern gear controls', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  const first = reduceControlResponse(model, {}, { type: 'activate', targetId: 'engine-stop' });
  const english = renderControlSurface(model, first, 'en', false);
  const spanish = renderControlSurface(model, first, 'es', true);

  assert.match(english, /data-surface="secure-yaris-v1"/);
  assert.match(english, /data-family="secure-manual"/);
  assert.match(english, new RegExp(`data-slope="${model.meta.slope}"`));
  assert.match(english, /data-target="engine-stop"[^>]+aria-pressed="true"/);
  assert.match(english, /data-target="parking-brake"[^>]+aria-pressed="false"/);
  assert.match(english, /data-control-event="select-gear"[^>]+data-gear="first"/);
  assert.match(english, /data-control-event="select-gear"[^>]+data-gear="reverse"/);
  assert.match(english, /data-control-event="submit-secure"[^>]+disabled/);
  assert.match(english, /class="manual-gear-pattern"/);
  assert.match(english, /class="slope-car"[^>]+viewBox="0 0 64 32"/);
  assert.match(english, /class="slope-car-body"/);
  assert.equal((english.match(/class="slope-car-wheel"/g) ?? []).length, 2);
  assert.match(english, /class="slope-car-front"/);
  assert.match(english, />Stop engine</);
  assert.match(english, />Hand parking-brake lever</);
  assert.doesNotMatch(english, /selector-park|>P<|automatic-hybrid/i);

  assert.match(spanish, />Detenga el motor</);
  assert.match(spanish, />Palanca manual del freno de estacionamiento</);
  assert.match(spanish, /Primera marcha|Marcha atrás/);
});

test('manual answer confirmation enables only after all three sections have a choice', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  let state = reduceControlResponse(model, {}, { type: 'activate', targetId: 'engine-stop' });
  state = reduceControlResponse(model, state, { type: 'activate', targetId: 'parking-brake' });
  state = reduceControlResponse(model, state, {
    type: 'select-gear', targetId: 'manual-gear', gear: model.meta.requiredGear
  });
  const english = renderControlSurface(model, state, 'en', false);
  const spanish = renderControlSurface(model, state, 'es', false);
  assert.match(english, /data-control-event="submit-secure"(?![^>]+disabled)[^>]*>Check answer</);
  assert.match(spanish, /data-control-event="submit-secure"(?![^>]+disabled)[^>]*>Comprobar respuesta</);
});

test('secure prompt identifies generic manual practice and reveal cites Article 92', async () => {
  const model = generateControlSurface({
    id: 'c-inmov',
    actionId: 'secure-vehicle',
    acceptedResult: 'secure-vehicle',
    surfaceId: 'secure-yaris-v1'
  }, 5);
  const response = {
    complete: true,
    selectedResult: 'secure-vehicle',
    selectedTargetId: 'manual-gear',
    engineStopped: true,
    parkingBrakeApplied: true,
    selectedGear: model.meta.requiredGear,
    reveal: true
  };
  const englishPrompt = renderControlSurface(model, {}, 'en', false);
  const spanishPrompt = renderControlSurface(model, {}, 'es', false);
  const englishReveal = renderControlSurface(model, response, 'en', true);
  const spanishReveal = renderControlSurface(model, response, 'es', true);

  assert.match(englishPrompt, /class="secure-sequence-disclosure"[^>]+role="note"[^>]+data-command="c-inmov"/);
  assert.match(englishPrompt, /aria-labelledby="secure-sequence-disclosure-title"/);
  assert.match(englishPrompt, /aria-describedby="secure-sequence-disclosure-detail"/);
  const englishPromptNotice = disclosureText(englishPrompt);
  const spanishPromptNotice = disclosureText(spanishPrompt);
  assert.match(englishPromptNotice, /generic manual-car practice.*confirm.*actual test car/i);
  assert.doesNotMatch(englishPromptNotice, /automatic|selector P/i);
  assert.match(spanishPromptNotice, /práctica genérica.*coche manual.*confirme.*vehículo real/i);
  assert.doesNotMatch(spanishPromptNotice, /automático|selector P/i);

  assert.match(disclosureText(englishReveal), /Article 92.*stop the engine.*parking brake/i);
  assert.match(disclosureText(spanishReveal), /artículo 92.*detener el motor.*freno de estacionamiento/i);

  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.secure-sequence-disclosure\s*\{[^}]*border:[^}]*background:[^}]*box-shadow:/s);
});

function disclosureText(markup) {
  const disclosure = markup.match(/<aside class="secure-sequence-disclosure"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(disclosure, 'secure sequence disclosure must be present');
  return disclosure.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

test('control reveal identifies the correct control and selected wrong control without color alone', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  const response = reduceControlResponse(model, {}, { type: 'activate', targetId: 'parking-brake' });
  const markup = renderControlSurface(model, { ...response, reveal: true }, 'en', true);
  assert.match(markup, /data-target="engine-stop"[^>]+aria-current="true"/);
  assert.match(markup, /data-target="parking-brake"[^>]+data-selection-state="correct"/);
  assert.match(markup, /class="target-status-marker correct"[^>]*>✓</);
  assert.match(markup, /class="surface-result-label">Correct control</);
});

test('control styles keep wheel and securing controls touch-sized and inset from iPad edges', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.control-surface\s*\{[^}]*max-width:[^}]*padding-inline:\s*clamp\(/s);
  assert.match(styles, /\.wheel-range\s*\{[^}]*width:\s*calc\(100% - 4rem\)/s);
  assert.match(styles, /\.wheel-range::\-webkit-slider-thumb\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/s);
  assert.match(styles, /\.wheel-reveal-comparison\s*\{[^}]*grid-template-columns:/s);
  assert.match(styles, /\.wheel-control-stage\[data-selection-state="wrong"\]/);
  assert.match(styles, /\.secure-control-button\s*\{[^}]*min-height:\s*88px/s);
  assert.match(styles, /\.secure-control-button\[aria-pressed="true"\]/);
});

test('reduced-motion preference disables steering-wheel interpolation', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.spinner\s*\{[^}]*\}\s*\.steering-wheel-graphic\s*\{[^}]*transition:\s*none;/s
  );
});

test('production activation includes both control surface IDs atomically', async () => {
  for (const surfaceId of CONTROL_SURFACE_IDS) {
    assert.equal(SUPPORTED_SURFACE_IDS.includes(surfaceId), true);
  }
  const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
  assert.equal(commands.find(item => item.id === 'c-volante').surfaceId, 'wheel-center-v1');
  assert.equal(commands.find(item => item.id === 'c-inmov').surfaceId, 'secure-yaris-v1');
});
