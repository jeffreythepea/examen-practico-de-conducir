export const DRIVING_SCENE_IDS = Object.freeze([
  'u-turn-photo-v1',
  'overtaking-photo-v1',
  'four-way-intersection-photo-v1',
  'roundabout-four-photo-v2',
  'roundabout-five-photo-v1',
  'roundabout-four-photo-v3',
  'parallel-parking-gap-photo-v1',
  'urban-roadside-photo-v1',
  'urban-roadside-photo-v2',
  'join-traffic-photo-v1'
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
  'roundabout-four-photo-v2': {
    id: 'roundabout-four-photo-v2',
    asset: './assets/driving/roundabout-four-photo-v2.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative roundabout with a bottom entry and four clean outgoing exits',
      es: 'Glorieta ilustrativa con entrada inferior y cuatro salidas despejadas'
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
  'roundabout-four-photo-v3': {
    id: 'roundabout-four-photo-v3',
    asset: './assets/driving/roundabout-four-photo-v3.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative roundabout with one bottom entry branch, three numbered exits, and physical lane separators on every branch',
      es: 'Glorieta ilustrativa con un ramal de entrada inferior, tres salidas numeradas y separadores físicos de carril en todos los ramales'
    }
  },
  'parallel-parking-gap-photo-v1': {
    id: 'parallel-parking-gap-photo-v1',
    asset: './assets/driving/parallel-parking-gap-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative urban road with a clear parallel-parking gap between two cars on the right curb and a no-parking sign beside the rear gap',
      es: 'Calle urbana ilustrativa con un espacio libre para estacionar en paralelo entre dos coches junto al bordillo derecho y una señal de estacionamiento prohibido junto al hueco trasero'
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
  },
  // v2 backs the stopping surface only (motion-clip scene, 2026-08-14); v1
  // stays in place for the title screen and continuity-transition stills.
  'urban-roadside-photo-v2': {
    id: 'urban-roadside-photo-v2',
    asset: './assets/driving/urban-roadside-photo-v2.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative urban road with a clear right curb before a garage driveway, a no-parking sign, and a pedestrian crossing ahead',
      es: 'Calle urbana ilustrativa con bordillo derecho libre antes de un vado de garaje, una señal de estacionamiento prohibido y un paso de peatones al frente'
    }
  },
  'join-traffic-photo-v1': {
    id: 'join-traffic-photo-v1',
    asset: './assets/driving/join-traffic-photo-v1.webp',
    provenance: 'ai-generated-illustrative',
    alt: {
      en: 'Illustrative urban road with the learner car parked at the right curb before joining traffic',
      es: 'Calle urbana ilustrativa con el coche del alumno junto al bordillo derecho antes de incorporarse a la circulación'
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
