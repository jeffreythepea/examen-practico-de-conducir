const ICONS = Object.freeze({
  oil: '<span class="precheck-icon precheck-icon-oil" aria-hidden="true">🛢️</span>',
  coolant: '<span class="precheck-icon precheck-icon-coolant" aria-hidden="true"><span>🌡️</span><span>💧</span></span>',
  battery: '<span class="precheck-icon precheck-icon-battery" aria-hidden="true">🔋</span>',
  washer: '<span class="precheck-icon precheck-icon-washer" aria-hidden="true"><span>🪟</span><span>💦</span></span>',
  fuel: '<span class="precheck-icon precheck-icon-fuel" aria-hidden="true">⛽</span>',
  temperature: '<span class="precheck-icon precheck-icon-temperature" aria-hidden="true">🌡️</span>',
  speedometer: '<span class="precheck-icon precheck-icon-speedometer" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0M12 14l4-5M7 17h10"/></svg></span>',
  'window-lock': '<span class="precheck-icon precheck-icon-window-lock" aria-hidden="true"><span>🪟</span><span>🚫</span></span>',
  'door-lock': '<span class="precheck-icon precheck-icon-door-lock" aria-hidden="true">🔒</span>',
  window: '<span class="precheck-icon precheck-icon-window" aria-hidden="true">🪟</span>',
  'front-demist': '<span class="precheck-icon precheck-icon-front-demist" aria-hidden="true"><span>◡</span><span>♨</span></span>',
  'rear-demist': '<span class="precheck-icon precheck-icon-rear-demist" aria-hidden="true"><span>▭</span><span>♨</span></span>',
  fan: '<span class="precheck-icon precheck-icon-fan" aria-hidden="true">🌀</span>'
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
  },
  'generic-instrument-cluster': {
    id: 'generic-instrument-cluster',
    asset: 'assets/precheck/generic-instrument-cluster.png',
    altKey: 'surface.precheck.scene.instrumentCluster',
    provenance: 'generic-illustrative-photo',
    reference: 'Generic manual hatchback instrument cluster — illustrative AI-generated photo',
    targets: {
      'temperature-gauge': {
        resultId: 'locate-engine-temperature', x: 25, y: 52.5, width: 12, height: 18,
        kind: 'gauge-location', interaction: 'locate', iconKey: 'temperature',
        labelKey: 'surface.yaris.temperatureGauge', labelPlacement: { x: 25, y: 31, width: 34 },
        anchorDescription: 'Centred on the separate engine-coolant-temperature gauge face'
      },
      'fuel-gauge': {
        resultId: 'locate-fuel-level', x: 75.1, y: 52.7, width: 12, height: 18,
        kind: 'gauge-location', interaction: 'locate', iconKey: 'fuel',
        labelKey: 'surface.yaris.fuelGauge', labelPlacement: { x: 75, y: 31, width: 28 },
        anchorDescription: 'Centred on the separate fuel gauge face and pump symbol'
      },
      speedometer: {
        resultId: 'locate-speedometer', x: 50, y: 48.8, width: 12, height: 18,
        kind: 'gauge-location', interaction: 'locate', iconKey: 'speedometer',
        labelKey: 'surface.yaris.speedometer', labelPlacement: { x: 50, y: 26, width: 28 },
        anchorDescription: 'Centred on the large central speedometer face'
      }
    }
  },
  'generic-driver-door': {
    id: 'generic-driver-door',
    asset: 'assets/precheck/generic-driver-door.png',
    altKey: 'surface.precheck.scene.driverDoor',
    provenance: 'generic-illustrative-photo',
    reference: 'Generic manual hatchback driver-door controls — illustrative AI-generated photo',
    targets: {
      'window-lock': {
        resultId: 'lock-rear-windows', x: 25.6, y: 58.3, width: 12, height: 18,
        kind: 'window-lock-button', interaction: 'operate', iconKey: 'window-lock',
        labelKey: 'surface.yaris.windowLock', labelPlacement: { x: 23, y: 78, width: 34 },
        stateKind: 'locked', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the separate crossed-window passenger-window lock switch'
      },
      'door-lock': {
        resultId: 'lock-doors', x: 60.5, y: 44.5, width: 12, height: 18,
        kind: 'door-lock-button', interaction: 'operate', iconKey: 'door-lock',
        labelKey: 'surface.yaris.doorLock', labelPlacement: { x: 61, y: 25, width: 26 },
        stateKind: 'locked', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the separate door lock and unlock button pair'
      },
      'window-switch': {
        resultId: 'operate-window', x: 47.5, y: 57.2, width: 12, height: 18,
        kind: 'window-switch', interaction: 'operate', iconKey: 'window',
        labelKey: 'surface.yaris.windowSwitch', labelPlacement: { x: 46, y: 78, width: 28 },
        stateKind: 'power', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the rear-right power-window rocker switch'
      }
    }
  },
  'generic-climate-panel': {
    id: 'generic-climate-panel',
    asset: 'assets/precheck/generic-climate-panel.png',
    altKey: 'surface.precheck.scene.climatePanel',
    provenance: 'generic-illustrative-photo',
    reference: 'Generic manual hatchback climate controls — illustrative AI-generated photo',
    targets: {
      'front-demist': {
        resultId: 'front-demist', x: 43, y: 31, width: 11, height: 16,
        kind: 'climate-button', interaction: 'operate', iconKey: 'front-demist',
        labelKey: 'surface.yaris.frontDemist', labelPlacement: { x: 36, y: 15, width: 32 },
        stateKind: 'power', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the front-windscreen demist button'
      },
      'rear-demist': {
        resultId: 'rear-demist', x: 55.5, y: 31, width: 11, height: 16,
        kind: 'climate-button', interaction: 'operate', iconKey: 'rear-demist',
        labelKey: 'surface.yaris.rearDemist', labelPlacement: { x: 63, y: 15, width: 32 },
        stateKind: 'power', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the rear-window demist button'
      },
      fan: {
        resultId: 'operate-fan', x: 49.5, y: 53.5, width: 12, height: 18,
        kind: 'climate-dial', interaction: 'operate', iconKey: 'fan',
        labelKey: 'surface.yaris.fan', labelPlacement: { x: 50, y: 72, width: 24 },
        stateKind: 'power', initialState: false, desiredState: true,
        anchorDescription: 'Centred on the fan-speed rotary dial'
      }
    }
  }
});

export const PRECHECK_COMMAND_SCENES = Object.freeze({
  'c-pre-aceite': 'generic-engine-bay',
  'c-pre-refrigerante': 'generic-engine-bay',
  'c-pre-bateria': 'generic-engine-bay',
  'c-pre-combustible': 'generic-instrument-cluster',
  'c-pre-temperatura': 'generic-instrument-cluster',
  'c-pre-bloquear-elevalunas': 'generic-driver-door',
  'c-pre-desbloquear-elevalunas': 'generic-driver-door',
  'c-pre-desempanar-delantera': 'generic-climate-panel',
  'c-pre-desempanar-trasera': 'generic-climate-panel'
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
