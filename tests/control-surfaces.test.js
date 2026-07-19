import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CONTROL_SURFACE_IDS,
  WHEEL_CENTER_TOLERANCE_DEGREES,
  YARIS_SECURE_SEQUENCE,
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

test('control surfaces export only the declared stable IDs and verified Yaris sequence', () => {
  assert.deepEqual(CONTROL_SURFACE_IDS, ['wheel-center-v1', 'secure-yaris-v1']);
  assert.equal(WHEEL_CENTER_TOLERANCE_DEGREES, 5);
  assert.deepEqual(YARIS_SECURE_SEQUENCE, ['parking-brake', 'selector-park']);
  assert.ok(Object.isFrozen(CONTROL_SURFACE_IDS));
  assert.ok(Object.isFrozen(YARIS_SECURE_SEQUENCE));
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

test('secure vehicle requires the declared Yaris sequence and rejects reversed steps', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  const first = reduceControlResponse(model, {}, { type: 'activate', targetId: model.meta.sequence[0] });
  assert.deepEqual(first, {
    complete: false,
    completedSteps: ['parking-brake'],
    nextStepIndex: 1
  });
  const complete = reduceControlResponse(model, first, { type: 'activate', targetId: model.meta.sequence[1] });
  assert.deepEqual(complete, {
    complete: true,
    selectedResult: 'secure-vehicle',
    selectedTargetId: 'selector-park',
    completedSteps: ['parking-brake', 'selector-park'],
    nextStepIndex: 2
  });
  assert.deepEqual(
    reduceControlResponse(model, {}, { type: 'activate', targetId: model.meta.sequence[1] }),
    {
      complete: false,
      incorrect: true,
      selectedResult: null,
      selectedTargetId: 'selector-park',
      completedSteps: [],
      nextStepIndex: 0
    }
  );
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
  assert.equal(secure.meta.brakePedalHeld, true);
  assert.deepEqual(secure.meta.sequence, YARIS_SECURE_SEQUENCE);
  assert.deepEqual(secure.meta.manualPages, [236, 264, 269]);
  assert.deepEqual(secure.targets.map(target => target.id), YARIS_SECURE_SEQUENCE);
  assert.equal(secure.targets.find(target => target.id === 'parking-brake').kind, 'hand-parking-brake-lever');
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

test('secure renderer exposes held-brake context and two native pressed-state buttons', () => {
  const model = generateControlSurface(command('secure-vehicle', 'secure-yaris-v1'), 5);
  const first = reduceControlResponse(model, {}, { type: 'activate', targetId: 'parking-brake' });
  const english = renderControlSurface(model, first, 'en', false);
  const spanish = renderControlSurface(model, { ...first, incorrect: true }, 'es', true);

  assert.match(english, /data-surface="secure-yaris-v1"/);
  assert.match(english, /data-context="brake-pedal-held"/);
  assert.match(english, />Brake pedal held</);
  assert.match(english, /data-target="parking-brake"[^>]+aria-pressed="true"/);
  assert.match(english, /data-target="selector-park"[^>]+aria-pressed="false"/);
  assert.match(english, />Hand parking-brake lever</);
  assert.match(english, />Selector in P</);
  assert.equal((english.match(/data-control-event="activate"/g) ?? []).length, 2);

  assert.match(spanish, />Pedal de freno pisado</);
  assert.match(spanish, />Palanca manual del freno de estacionamiento</);
  assert.match(spanish, />Selector en P</);
  assert.match(spanish, /role="alert">Orden incorrecto</);
  assert.equal((spanish.match(/ disabled/g) ?? []).length, 2);
});

test('secure prompt hides the ordered answer while reveal discloses the full provisional sequence in both locales', async () => {
  const model = generateControlSurface({
    id: 'c-inmov',
    actionId: 'secure-vehicle',
    acceptedResult: 'secure-vehicle',
    surfaceId: 'secure-yaris-v1'
  }, 5);
  const response = {
    complete: true,
    selectedResult: 'secure-vehicle',
    selectedTargetId: 'selector-park',
    completedSteps: ['parking-brake', 'selector-park'],
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
  assert.match(englishPromptNotice, /provisional automatic-hybrid reference.*confirmation or replacement.*manual test car/i);
  assert.doesNotMatch(englishPromptNotice, /parking|brake|selector|→/i);
  assert.match(spanishPromptNotice, /referencia provisional del híbrido automático.*confirmación o sustitución.*coche manual del examen/i);
  assert.doesNotMatch(spanishPromptNotice, /freno|estacionamiento|selector|→/i);

  assert.match(disclosureText(englishReveal), /parking-brake.*selector-P/i);
  assert.match(disclosureText(spanishReveal), /freno de estacionamiento.*selector P/i);

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
  const response = reduceControlResponse(model, {}, { type: 'activate', targetId: 'selector-park' });
  const markup = renderControlSurface(model, { ...response, reveal: true }, 'en', true);
  assert.match(markup, /data-target="parking-brake"[^>]+aria-current="true"/);
  assert.match(markup, /data-target="selector-park"[^>]+data-selection-state="wrong"/);
  assert.match(markup, /class="target-status-marker correct"[^>]*>✓</);
  assert.match(markup, /class="target-status-marker wrong"[^>]*>×</);
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
