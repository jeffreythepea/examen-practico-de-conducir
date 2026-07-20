export const DRIVING_SCENE_IDS = Object.freeze([
  'u-turn-photo-v1',
  'overtaking-photo-v1',
  'four-way-intersection-photo-v1',
  'roundabout-four-photo-v1',
  'roundabout-five-photo-v1',
  'parallel-parking-gap-photo-v1',
  'urban-roadside-photo-v1'
]);

export const DRIVING_SCENES = deepFreeze({
  'u-turn-photo-v1': {
    id: 'u-turn-photo-v1',
    asset: './assets/driving/u-turn-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative two-way road with a learner car approaching a broad left-side junction',
      es: 'Carretera ilustrativa de doble sentido con el coche del alumno acercándose a un cruce amplio a la izquierda'
    }
  },
  'overtaking-photo-v1': {
    id: 'overtaking-photo-v1',
    asset: './assets/driving/overtaking-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative rural two-lane road with the learner car behind a lead car',
      es: 'Carretera rural ilustrativa de dos sentidos con el coche del alumno detrás de otro coche'
    }
  },
  'four-way-intersection-photo-v1': {
    id: 'four-way-intersection-photo-v1',
    asset: './assets/driving/four-way-intersection-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative four-way intersection with left, straight, and right roads ahead of the learner car',
      es: 'Intersección ilustrativa de cuatro vías con opciones a la izquierda, de frente y a la derecha ante el coche del alumno'
    }
  },
  'roundabout-four-photo-v1': {
    id: 'roundabout-four-photo-v1',
    asset: './assets/driving/roundabout-four-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative roundabout with a bottom entry and four outgoing exits',
      es: 'Glorieta ilustrativa con entrada inferior y cuatro salidas'
    }
  },
  'roundabout-five-photo-v1': {
    id: 'roundabout-five-photo-v1',
    asset: './assets/driving/roundabout-five-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative roundabout with a bottom entry and five outgoing exits',
      es: 'Glorieta ilustrativa con entrada inferior y cinco salidas'
    }
  },
  'parallel-parking-gap-photo-v1': {
    id: 'parallel-parking-gap-photo-v1',
    asset: './assets/driving/parallel-parking-gap-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative urban road with a clear parallel-parking gap between two cars on the right curb',
      es: 'Calle urbana ilustrativa con un espacio libre para estacionar en paralelo entre dos coches junto al bordillo derecho'
    }
  },
  'urban-roadside-photo-v1': {
    id: 'urban-roadside-photo-v1',
    asset: './assets/driving/urban-roadside-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative urban road with clear curb, driveway, and pedestrian crossing',
      es: 'Calle urbana ilustrativa con bordillo libre, acceso y paso de peatones'
    }
  }
});

export function drivingScene(id) {
  const scene = DRIVING_SCENES[id];
  if (!scene) throw new Error(`Unknown driving scene: ${id}`);
  return scene;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
