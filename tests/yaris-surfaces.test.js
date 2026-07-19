import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertNonOverlappingTargets } from '../src/surface-geometry.js';
import {
  YARIS_COMMAND_CONTRACT,
  YARIS_DIAGRAMS,
  YARIS_SURFACE_IDS,
  generateYarisSurface,
  reduceYarisResponse,
  renderYarisSurface
} from '../src/yaris-surfaces.js';
import {
  SUPPORTED_SURFACE_IDS,
  YARIS_SURFACE_IDS as EXPORTED_YARIS_SURFACE_IDS
} from '../src/surfaces.js';

const commands = JSON.parse(await readFile(new URL('../data/commands.json', import.meta.url), 'utf8'));
const precheckCommands = commands.filter(command => command.phase === 'precheck');

const EXPECTED_YARIS_COMMANDS = Object.freeze({
  'c-pre-aceite': Object.freeze({ diagramId: 'yaris-engine-bay-v2', hotspotId: 'engine-oil', responseMode: 'locate' }),
  'c-pre-refrigerante': Object.freeze({ diagramId: 'yaris-engine-bay-v2', hotspotId: 'coolant', responseMode: 'locate' }),
  'c-pre-bateria': Object.freeze({ diagramId: 'yaris-body-v2', hotspotId: 'battery-under-rear-right-seat', responseMode: 'locate' }),
  'c-pre-capo': Object.freeze({ diagramId: 'yaris-body-v2', hotspotId: 'bonnet-release', responseMode: 'operate' }),
  'c-pre-combustible': Object.freeze({ diagramId: 'yaris-dashboard-v2', hotspotId: 'fuel-gauge', responseMode: 'locate' }),
  'c-pre-temperatura': Object.freeze({ diagramId: 'yaris-dashboard-v2', hotspotId: 'temperature-gauge', responseMode: 'locate' }),
  'c-pre-bloquear-elevalunas': Object.freeze({ diagramId: 'yaris-door-v2', hotspotId: 'window-lock', responseMode: 'operate' }),
  'c-pre-desbloquear-elevalunas': Object.freeze({ diagramId: 'yaris-door-v2', hotspotId: 'window-lock', responseMode: 'operate' }),
  'c-pre-desempanar-delantera': Object.freeze({ diagramId: 'yaris-climate-v2', hotspotId: 'front-demist', responseMode: 'operate' }),
  'c-pre-desempanar-trasera': Object.freeze({ diagramId: 'yaris-climate-v2', hotspotId: 'rear-demist', responseMode: 'operate' }),
  'c-pre-largo-alcance': Object.freeze({ diagramId: 'yaris-dashboard-v2', hotspotId: 'high-beam', responseMode: 'operate' }),
  'c-pre-niebla-delantera': Object.freeze({ diagramId: 'yaris-dashboard-v2', hotspotId: 'front-fog', responseMode: 'operate' }),
  'c-pre-niebla-trasera': Object.freeze({ diagramId: 'yaris-dashboard-v2', hotspotId: 'rear-fog', responseMode: 'operate' }),
  'c-pre-maletero': Object.freeze({ diagramId: 'yaris-body-v2', hotspotId: 'boot-release', responseMode: 'operate' })
});

function byId(id) {
  return commands.find(command => command.id === id);
}

const EXPECTED_REVEAL_LABEL_LAYOUT = Object.freeze({
  'yaris-dashboard-v2': Object.freeze({
    'temperature-gauge': Object.freeze({ x: 22, y: 17, width: 30 }),
    'fuel-gauge': Object.freeze({ x: 78, y: 17, width: 30 }),
    'high-beam': Object.freeze({ x: 72, y: 88, width: 26 }),
    'front-fog': Object.freeze({ x: 44, y: 88, width: 28 }),
    'rear-fog': Object.freeze({ x: 16, y: 88, width: 26 })
  }),
  'yaris-climate-v2': Object.freeze({
    'front-demist': Object.freeze({ x: 70, y: 29, width: 30 }),
    'rear-demist': Object.freeze({ x: 70, y: 81, width: 30 })
  })
});

test('five original schematic definitions expose stable cited hotspot topology', () => {
  assert.deepEqual(YARIS_SURFACE_IDS, [
    'yaris-dashboard-v2',
    'yaris-climate-v2',
    'yaris-door-v2',
    'yaris-body-v2',
    'yaris-engine-bay-v2'
  ]);
  assert.ok(Object.isFrozen(YARIS_SURFACE_IDS));
  assert.ok(Object.isFrozen(YARIS_DIAGRAMS));

  for (const surfaceId of YARIS_SURFACE_IDS) {
    const diagram = YARIS_DIAGRAMS[surfaceId];
    assert.equal(diagram.viewBox, '0 0 400 300');
    assert.equal(diagram.manualPublication, 'PZ49X-52A96-EN');
    assert.equal(diagram.provenance, 'manual-derived-original-schematic');
    assert.ok(diagram.manualPages.length > 0);
    assert.match(diagram.reference, /Toyota Yaris Hybrid 2019 Owner Manual/);
    assert.match(diagram.art, /<(?:path|rect|circle|line|polyline|ellipse)\b/);
    assert.doesNotMatch(diagram.art, /<(?:image|text)\b|>\s*(?:Toyota|Yaris)\b/i);
    assert.ok(Object.keys(diagram.hotspots).length > 0);
    assertNonOverlappingTargets(Object.entries(diagram.hotspots).map(([id, hotspot]) => ({ id, ...hotspot })));
    assert.ok(Object.isFrozen(diagram));
    assert.ok(Object.isFrozen(diagram.hotspots));
  }
});

test('an independent expected table maps all 14 prechecks to one stable manual-grounded hotspot and mode', () => {
  assert.equal(precheckCommands.length, 14);
  assert.deepEqual(Object.keys(EXPECTED_YARIS_COMMANDS).sort(), precheckCommands.map(command => command.id).sort());
  assert.deepEqual(Object.keys(YARIS_COMMAND_CONTRACT).sort(), Object.keys(EXPECTED_YARIS_COMMANDS).sort());

  for (const command of precheckCommands) {
    const expected = EXPECTED_YARIS_COMMANDS[command.id];
    const contract = YARIS_COMMAND_CONTRACT[command.id];
    const model = generateYarisSurface(command, 7);
    const expectedTarget = model.targets.find(target => target.resultId === command.acceptedResult);

    assert.equal(model.meta.commandId, command.id);
    assert.equal(contract.diagramId, expected.diagramId);
    assert.equal(contract.hotspotId, expected.hotspotId);
    assert.equal(contract.responseMode, expected.responseMode);
    assert.equal(model.meta.diagramId, expected.diagramId);
    assert.equal(model.meta.hotspotId, expected.hotspotId);
    assert.equal(model.meta.responseMode, expected.responseMode);
    assert.deepEqual(model.meta.manualPages, contract.manualPages);
    assert.equal(expectedTarget.id, expected.hotspotId);
    assert.equal(model.expectedResult, command.acceptedResult);
    assert.ok(model.targets.every(target => target.width >= 7 && target.height >= 14.67));
    assertNonOverlappingTargets(model.targets);
    assert.deepEqual(model, generateYarisSurface(command, 7));
    assert.ok(Object.isFrozen(model));
    assert.doesNotThrow(() => JSON.stringify(model));
  }
});

test('manual-cited demister and lighting controls share their real control groups', () => {
  const climate = YARIS_DIAGRAMS['yaris-climate-v2'];
  const frontDemist = climate.hotspots['front-demist'];
  const rearDemist = climate.hotspots['rear-demist'];
  assert.equal(frontDemist.controlGroup, 'right-demister-controls');
  assert.equal(rearDemist.controlGroup, 'right-demister-controls');
  assert.ok(frontDemist.x > 60 && rearDemist.x > 60);
  assert.ok(Math.abs(frontDemist.x - rearDemist.x) <= 2);
  assert.ok(Math.abs(frontDemist.y - rearDemist.y) >= 16);
  assert.match(climate.art, /data-schematic-group="right-demister-controls"/);

  const dashboard = YARIS_DIAGRAMS['yaris-dashboard-v2'];
  const stalkControls = ['high-beam', 'front-fog', 'rear-fog'].map(id => dashboard.hotspots[id]);
  assert.ok(stalkControls.every(control => control.controlGroup === 'left-light-stalk'));
  assert.ok(stalkControls.every(control => control.x < 50));
  assert.ok(new Set(stalkControls.map(control => control.y)).size === 1);
  assert.match(dashboard.art, /data-schematic-group="left-light-stalk"/);
  assertNonOverlappingTargets(stalkControls.map((control, index) => ({ id: `stalk-${index}`, ...control })));
});

test('dashboard and climate reveal labels use explicit non-colliding positions inside the schematic', () => {
  for (const [diagramId, expectedPlacements] of Object.entries(EXPECTED_REVEAL_LABEL_LAYOUT)) {
    const targets = Object.entries(YARIS_DIAGRAMS[diagramId].hotspots).map(([id, hotspot]) => ({ id, ...hotspot }));
    for (const target of targets) {
      const expected = expectedPlacements[target.id];
      assert.ok(expected, `${diagramId}/${target.id} needs an independent reveal-label placement`);
      assert.deepEqual(target.labelPlacement, expected);
      assert.ok(expected.x - expected.width / 2 >= 0, `${target.id} label must remain within the left schematic edge`);
      assert.ok(expected.x + expected.width / 2 <= 100, `${target.id} label must remain within the right schematic edge`);
      assert.ok(expected.y >= 8 && expected.y <= 92, `${target.id} label must remain within the schematic height`);
    }
  }

  const dashboard = EXPECTED_REVEAL_LABEL_LAYOUT['yaris-dashboard-v2'];
  const stalkLabels = ['rear-fog', 'front-fog', 'high-beam'].map(id => dashboard[id]);
  for (let index = 1; index < stalkLabels.length; index += 1) {
    const previous = stalkLabels[index - 1];
    const current = stalkLabels[index];
    assert.ok(previous.x + previous.width / 2 < current.x - current.width / 2, 'stalk reveal labels must not share horizontal space');
  }
  const climate = EXPECTED_REVEAL_LABEL_LAYOUT['yaris-climate-v2'];
  assert.ok(climate['rear-demist'].y - climate['front-demist'].y >= 40);
});

test('locate and operate commands have explicit response modes and verified equipment metadata', () => {
  assert.equal(generateYarisSurface(byId('c-pre-bateria'), 1).meta.responseMode, 'locate');
  assert.equal(generateYarisSurface(byId('c-pre-desempanar-delantera'), 1).meta.responseMode, 'operate');

  const temperature = generateYarisSurface(byId('c-pre-temperatura'), 1);
  assert.equal(temperature.meta.equipmentAmbiguity, true);
  assert.deepEqual(temperature.meta.manualPages, [133, 134]);

  const frontFog = generateYarisSurface(byId('c-pre-niebla-delantera'), 1);
  assert.equal(frontFog.meta.equipmentAmbiguity, true);
  assert.deepEqual(frontFog.meta.manualPages, [270, 276, 277]);
});

test('the stable battery response now resolves to a generic under-bonnet photo target', () => {
  const battery = generateYarisSurface(byId('c-pre-bateria'), 493);
  assert.equal(battery.meta.diagramId, 'yaris-body-v2');
  assert.equal(battery.meta.hotspotId, 'battery-under-rear-right-seat');
  assert.equal(battery.geometry.sceneId, 'generic-engine-bay');
  assert.equal(battery.geometry.photoAsset, 'assets/precheck/generic-engine-bay.png');
  assert.equal(battery.targets.find(target => target.id === 'battery-under-rear-right-seat').kind, 'under-bonnet-battery');
  assert.equal(battery.meta.provenance, 'generic-illustrative-photo');
});

test('engine prechecks render a packaged photo with clear icons placed on the audited components', () => {
  const model = generateYarisSurface(byId('c-pre-aceite'), 8);
  const hidden = renderYarisSurface(model, {}, 'en', false);
  const revealed = renderYarisSurface(model, { reveal: true, selectedTargetId: 'coolant' }, 'es', true);

  assert.equal(model.geometry.diagramId, 'yaris-engine-bay-v2');
  assert.equal(model.geometry.sceneId, 'generic-engine-bay');
  assert.equal(model.geometry.photoAsset, 'assets/precheck/generic-engine-bay.png');
  assert.equal(model.targets.length, 4);
  assert.match(hidden, /Illustrative vehicle image; the exact layout may differ\./);
  assert.match(hidden, /<img class="precheck-photo"[^>]+src="assets\/precheck\/generic-engine-bay\.png"[^>]+alt="Generic engine compartment"/);
  assert.equal((hidden.match(/class="precheck-icon/g) ?? []).length, 4);
  assert.match(hidden, /data-target="engine-oil"[\s\S]*class="precheck-icon precheck-icon-oil"/);
  assert.doesNotMatch(hidden, /class="yaris-hotspot-label"/);
  assert.match(revealed, /Varilla del aceite del motor/);
  assert.match(revealed, /data-target="coolant"[^>]+data-selection-state="wrong"/);
});

test('locate mode completes on one valid hotspot tap and preserves the selected result', () => {
  const model = generateYarisSurface(byId('c-pre-aceite'), 2);
  assert.deepEqual(reduceYarisResponse(model, {}, { type: 'activate', targetId: 'engine-oil' }), {
    complete: true,
    selectedResult: 'locate-oil-check',
    selectedTargetId: 'engine-oil'
  });
  assert.deepEqual(reduceYarisResponse(model, {}, { type: 'activate', targetId: 'coolant' }), {
    complete: true,
    selectedResult: 'locate-coolant-check',
    selectedTargetId: 'coolant'
  });
});

test('operate mode toggles controls and completes only at the selected control target state', () => {
  const lockModel = generateYarisSurface(byId('c-pre-bloquear-elevalunas'), 3);
  assert.deepEqual(reduceYarisResponse(lockModel, {}, { type: 'activate', targetId: 'window-lock' }), {
    complete: true,
    selectedResult: 'lock-rear-windows',
    selectedTargetId: 'window-lock',
    controlStates: { 'window-lock': true }
  });

  const unlockModel = generateYarisSurface(byId('c-pre-desbloquear-elevalunas'), 4);
  assert.equal(unlockModel.meta.initialState, true);
  assert.equal(unlockModel.meta.desiredState, false);
  assert.deepEqual(reduceYarisResponse(unlockModel, {}, { type: 'activate', targetId: 'window-lock' }), {
    complete: true,
    selectedResult: 'unlock-rear-windows',
    selectedTargetId: 'window-lock',
    controlStates: { 'window-lock': false }
  });
  assert.deepEqual(
    reduceYarisResponse(unlockModel, { controlStates: { 'window-lock': false } }, { type: 'activate', targetId: 'window-lock' }),
    {
      complete: false,
      selectedResult: null,
      selectedTargetId: 'window-lock',
      controlStates: { 'window-lock': true }
    }
  );
});

test('generator and reducer reject unknown or contract-incompatible input', () => {
  assert.throws(
    () => generateYarisSurface({ ...byId('c-pre-bateria'), acceptedResult: 'locate-oil-check' }, 1),
    /Unsupported Yaris result/
  );
  assert.throws(
    () => generateYarisSurface({ ...byId('c-pre-bateria'), surfaceId: 'future-yaris-v3' }, 1),
    /Unsupported Yaris surface/
  );
  assert.throws(
    () => reduceYarisResponse(generateYarisSurface(byId('c-pre-bateria'), 1), {}, { type: 'activate', targetId: 'missing-component' }),
    /Unknown Yaris target/
  );
});

test('renderer keeps visible labels hidden until reveal while exposing localized native controls', () => {
  const model = generateYarisSurface(byId('c-pre-desempanar-delantera'), 5);
  const english = renderYarisSurface(model, {}, 'en', false);
  const spanish = renderYarisSurface(model, { reveal: true, selectedTargetId: 'rear-demist' }, 'es', true);

  assert.match(english, /data-surface="yaris-climate-v2"/);
  assert.equal((english.match(/class="yaris-hotspot(?:\s|\")/g) ?? []).length, model.targets.length);
  assert.match(english, /data-target="front-demist"[^>]+aria-label="Windscreen demister: off"[^>]+aria-pressed="false"/);
  assert.doesNotMatch(english, /class="yaris-hotspot-label"/);
  assert.doesNotMatch(english, />Windscreen demister</);

  assert.match(spanish, /data-target="front-demist"[^>]+aria-label="Desempañador del parabrisas: apagado"/);
  assert.match(spanish, /data-target="rear-demist"[^>]+data-selected="true"[^>]+aria-label="Desempañador de la luneta trasera: apagado — Selección incorrecta"/);
  assert.match(spanish, /class="yaris-hotspot-label"[^>]*>Desempañador del parabrisas</);
  assert.match(spanish, /class="yaris-hotspot-label"[^>]*>Desempañador de la luneta trasera</);
  assert.match(spanish, /class="yaris-hotspot-label" aria-hidden="true" style="--label-x:36%;--label-y:15%;--label-width:32%">Desempañador del parabrisas</);
  assert.equal((spanish.match(/ disabled/g) ?? []).length, model.targets.length);
});

test('reveal adds localized accessible labels for both correct and wrong selections', () => {
  const model = generateYarisSurface(byId('c-pre-aceite'), 5);
  const correct = renderYarisSurface(model, {
    reveal: true,
    selectedTargetId: 'engine-oil'
  }, 'en', true);
  const wrong = renderYarisSurface(model, {
    reveal: true,
    selectedTargetId: 'coolant'
  }, 'es', true);

  assert.match(correct, /data-target="engine-oil"[^>]+data-selection-state="correct"[^>]+aria-label="Engine-oil dipstick — Correct selection"/);
  assert.match(wrong, /data-target="coolant"[^>]+data-selection-state="wrong"[^>]+aria-label="Depósitos de refrigerante del motor — Selección incorrecta"/);
});

test('renderer exposes localized locked/unlocked state and equipment ambiguity without copying manual labels', () => {
  const unlock = generateYarisSurface(byId('c-pre-desbloquear-elevalunas'), 6);
  const english = renderYarisSurface(unlock, {}, 'en', false);
  assert.match(english, /aria-label="Passenger-window lock: locked"/);
  assert.match(english, /aria-pressed="true"/);

  const fog = generateYarisSurface(byId('c-pre-niebla-delantera'), 6);
  const spanish = renderYarisSurface(fog, {}, 'es', false);
  assert.match(spanish, /data-equipment-ambiguity="true"/);
  assert.match(spanish, /los mandos o las pantallas pueden ser diferentes o no estar instalados/);
});

test('Yaris hotspot styles enforce 44px controls, normalized placement, and shape-based reveal states', async () => {
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.yaris-surface\s*\{[^}]*max-width:\s*620px[^}]*padding-inline:\s*clamp\(/s);
  assert.match(styles, /\.yaris-hotspot\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px[^}]*left:\s*var\(--hotspot-x\)[^}]*top:\s*var\(--hotspot-y\)/s);
  assert.match(styles, /\.yaris-hotspot\[aria-current="true"\][^{]*\{[^}]*border-style:\s*solid/s);
  assert.match(styles, /\.yaris-hotspot\[data-selection-state="wrong"\][^{]*\{[^}]*border-style:\s*dashed/s);
  assert.match(styles, /\.surface-stage\.yaris-schematic\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.yaris-hotspot-label\s*\{[^}]*top:\s*var\(--label-y\)[^}]*left:\s*var\(--label-x\)[^}]*width:\s*var\(--label-width\)[^}]*transform:\s*translate\(-50%,\s*-50%\)/s);
});

test('v2 diagram IDs are exported and every precheck is atomically activated', () => {
  assert.deepEqual(EXPORTED_YARIS_SURFACE_IDS, YARIS_SURFACE_IDS);
  for (const surfaceId of YARIS_SURFACE_IDS) assert.equal(SUPPORTED_SURFACE_IDS.includes(surfaceId), true);
  assert.ok(precheckCommands.every(command => YARIS_SURFACE_IDS.includes(command.surfaceId)));
  assert.equal(precheckCommands.some(command => command.surfaceId.startsWith('yaris-manual-v1-')), false);
});

test('documentation records provisional original-schematic provenance and stable photo replacement', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const inventory = await readFile(new URL('../references/fermin-atomic-command-inventory.md', import.meta.url), 'utf8');

  assert.match(readme, /manual-derived original schematics/i);
  assert.match(readme, /PZ49X-52A96-EN/);
  assert.match(readme, /beneath the rear-right seat/i);
  assert.match(readme, /photographs[^.]+retain[^.]+diagram and hotspot IDs/i);

  assert.match(inventory, /Yaris schematic provenance/);
  assert.match(inventory, /PZ49X-52A96-EN/);
  assert.match(inventory, /pages 485-486 and 489/);
  assert.match(inventory, /page 493[^.]+rear-right seat/i);
  assert.match(inventory, /front fog lights[^.]+if equipped/i);
  assert.match(inventory, /color display[^.]+temperature gauge/i);
});
