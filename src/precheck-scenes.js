const ICONS = Object.freeze({
  oil: '<span class="precheck-icon precheck-icon-oil" aria-hidden="true">🛢️</span>',
  coolant: '<span class="precheck-icon precheck-icon-coolant" aria-hidden="true"><span>🌡️</span><span>💧</span></span>',
  battery: '<span class="precheck-icon precheck-icon-battery" aria-hidden="true">🔋</span>',
  washer: '<span class="precheck-icon precheck-icon-washer" aria-hidden="true"><span>🪟</span><span>💦</span></span>'
});

export const PRECHECK_SCENES = deepFreeze({
  'generic-engine-bay': {
    id: 'generic-engine-bay',
    asset: 'assets/precheck/generic-engine-bay.png',
    altKey: 'surface.precheck.scene.engineBay',
    provenance: 'generic-illustrative-photo',
    reference: 'Generic conventional vehicle — illustrative AI-generated photo',
    targets: {
      'engine-oil': {
        resultId: 'locate-oil-check',
        x: 73.2,
        y: 73,
        width: 12,
        height: 18,
        kind: 'fluid-location',
        interaction: 'locate',
        iconKey: 'oil',
        labelKey: 'surface.yaris.engineOil',
        labelPlacement: { x: 72, y: 86, width: 30 },
        anchorDescription: 'Centred on the yellow engine-oil dipstick handle'
      },
      coolant: {
        resultId: 'locate-coolant-check',
        x: 13.5,
        y: 37.5,
        width: 12,
        height: 18,
        kind: 'fluid-location',
        interaction: 'locate',
        iconKey: 'coolant',
        labelKey: 'surface.yaris.coolant',
        labelPlacement: { x: 23, y: 23, width: 32 },
        anchorDescription: 'Centred on the coolant reservoir cap'
      },
      'battery-under-rear-right-seat': {
        resultId: 'locate-battery',
        x: 74,
        y: 44.5,
        width: 12,
        height: 18,
        kind: 'under-bonnet-battery',
        interaction: 'locate',
        iconKey: 'battery',
        labelKey: 'surface.yaris.battery',
        labelPlacement: { x: 73, y: 29, width: 36 },
        anchorDescription: 'Centred over the conventional under-bonnet battery'
      },
      'washer-fluid': {
        resultId: 'locate-washer-fluid',
        x: 14.7,
        y: 61.5,
        width: 12,
        height: 18,
        kind: 'fluid-location',
        interaction: 'locate',
        iconKey: 'washer',
        labelKey: 'surface.yaris.washerFluid',
        labelPlacement: { x: 23, y: 77, width: 34 },
        anchorDescription: 'Centred on the blue windscreen-washer fluid cap'
      }
    }
  }
});

export const PRECHECK_COMMAND_SCENES = Object.freeze({
  'c-pre-aceite': 'generic-engine-bay',
  'c-pre-refrigerante': 'generic-engine-bay',
  'c-pre-bateria': 'generic-engine-bay'
});

export function precheckSceneForCommand(commandId) {
  const sceneId = PRECHECK_COMMAND_SCENES[commandId];
  if (!sceneId) throw new Error(`Unsupported precheck command: ${commandId}`);
  return PRECHECK_SCENES[sceneId];
}

export function renderPrecheckIcon(iconKey) {
  const icon = ICONS[iconKey];
  if (!icon) throw new Error(`Unsupported precheck icon: ${iconKey}`);
  return icon;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
