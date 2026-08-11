const SUPPORTED_LOCALES = Object.freeze(['en', 'es']);

const COPY = Object.freeze({
  en: Object.freeze({ skip: 'Skip', skipTransition: 'Skip transition' }),
  es: Object.freeze({ skip: 'Saltar', skipTransition: 'Saltar transición' })
});

export const CONTINUITY_SCENE_FAMILIES = deepFreeze({
  departure: {
    sceneId: 'urban-roadside-photo-v1',
    asset: './assets/driving/urban-roadside-photo-v1.webp',
    camera: { startScale: 1, endScale: 1.05, originX: 66, originY: 84, durationMs: 1900 }
  },
  'urban-cruise': {
    sceneId: 'urban-roadside-photo-v1',
    asset: './assets/driving/urban-roadside-photo-v1.webp',
    camera: { startScale: 1, endScale: 1.06, originX: 66, originY: 84, durationMs: 2000 }
  },
  'rural-cruise': {
    sceneId: 'overtaking-photo-v1',
    asset: './assets/driving/overtaking-photo-v1.webp',
    camera: { startScale: 1, endScale: 1.12, originX: 54, originY: 86, durationMs: 2000 }
  },
  arrival: {
    sceneId: 'urban-roadside-photo-v1',
    asset: './assets/driving/urban-roadside-photo-v1.webp',
    camera: { startScale: 1, endScale: 1.04, originX: 66, originY: 84, durationMs: 1800 }
  },
  parked: {
    sceneId: 'parallel-parking-gap-photo-v1',
    asset: './assets/driving/parallel-parking-gap-photo-v1.webp',
    camera: { startScale: 1, endScale: 1, originX: 65, originY: 84, durationMs: 0 }
  }
});

/**
 * Renders a pure, unscored bridge between simulated-exam commands.
 * The caller owns timing, route state, persistence, and activation handling.
 *
 * @param {{
 *   family: 'departure'|'urban-cruise'|'rural-cruise'|'arrival'|'parked',
 *   sceneId: string,
 *   progressText: string,
 *   motionEnabled: boolean,
 *   sceneTappable?: boolean,
 *   camera?: { startScale: number, endScale: number, originX: number, originY: number, durationMs: number },
 *   intro?: { sceneId: string, asset: string, dx: number, dy: number, scale: number, rotate: number, yawDeg: number, settleDx: number, startScale: number, midScale: number, turnScale: number, originX: number, originY: number, durationMs: number }
 * }} viewModel
 * @param {'en'|'es'} locale
 * @returns {string}
 */
export function renderContinuityTransition(viewModel, locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    throw new Error(`Unsupported continuity locale: ${locale}`);
  }
  const model = validateViewModel(viewModel);
  const scene = CONTINUITY_SCENE_FAMILIES[model.family];
  const copy = COPY[locale];
  const camera = model.camera ?? scene.camera;
  const style = model.motionEnabled ? ` style="${cameraStyle(camera)}"` : '';
  // The intro is a decorative overlay of the answered scene that pans into the
  // chosen road and fades out over the cruise push already running underneath.
  const intro = model.motionEnabled && model.intro
    ? `<span class="continuity-transition-image-frame turn-through-intro" aria-hidden="true" data-turn-through-scene="${escapeAttribute(model.intro.sceneId)}" style="${introStyle(model.intro)}">
          <img src="${escapeAttribute(model.intro.asset)}" alt="" aria-hidden="true">
        </span>`
    : '';
  // While the intro plays, the cruise photo starts counter-offset and settles
  // to centre so the crossfade reads as one continuous camera move.
  const settle = model.motionEnabled && model.intro
    ? ` data-turn-settle="true" style="--settle-dx:${model.intro.settleDx}%;--settle-duration:${model.intro.durationMs}ms"`
    : '';
  const image = `<span class="continuity-transition-image-frame"${style}>
          <img src="${escapeAttribute(scene.asset)}" alt="" aria-hidden="true"${settle}>
        </span>${intro}`;
  const sceneMarkup = model.sceneTappable
    ? `<button type="button" class="continuity-transition-scene" data-action="skip-continuity-transition" aria-label="${escapeAttribute(copy.skipTransition)}">
        ${image}
      </button>`
    : `<div class="continuity-transition-scene" aria-hidden="true">
        ${image}
      </div>`;

  return `<section class="continuity-transition" aria-labelledby="continuity-transition-status" data-continuity-family="${escapeAttribute(model.family)}" data-continuity-scene="${escapeAttribute(model.sceneId)}" data-continuity-motion="${model.motionEnabled}">
    <p id="continuity-transition-status" class="continuity-transition-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(model.progressText)}</p>
    <div class="continuity-transition-stage">
      ${sceneMarkup}
    </div>
    <button type="button" class="continuity-transition-skip" data-action="skip-continuity-transition">${escapeHtml(copy.skip)}</button>
  </section>`;
}

function validateViewModel(viewModel) {
  if (!viewModel || typeof viewModel !== 'object' || Array.isArray(viewModel)) {
    throw new Error('Invalid continuity transition view model');
  }
  const scene = CONTINUITY_SCENE_FAMILIES[viewModel.family];
  if (!scene) throw new Error(`Unknown continuity scene family: ${viewModel.family}`);
  if (viewModel.sceneId !== scene.sceneId) throw new Error('Continuity scene does not match family');
  if (typeof viewModel.progressText !== 'string' || viewModel.progressText.trim().length === 0) {
    throw new Error('Continuity progressText must be a non-empty string');
  }
  if (typeof viewModel.motionEnabled !== 'boolean') {
    throw new Error('Continuity motionEnabled must be boolean');
  }
  if (viewModel.sceneTappable !== undefined && typeof viewModel.sceneTappable !== 'boolean') {
    throw new Error('Continuity sceneTappable must be boolean');
  }
  if (viewModel.camera !== undefined) validateCamera(viewModel.camera);
  if (viewModel.intro !== undefined && viewModel.intro !== null) validateIntro(viewModel.intro);

  return {
    family: viewModel.family,
    sceneId: viewModel.sceneId,
    progressText: viewModel.progressText,
    motionEnabled: viewModel.motionEnabled,
    sceneTappable: viewModel.sceneTappable ?? true,
    camera: viewModel.camera,
    intro: viewModel.intro ?? null
  };
}

function validateIntro(intro) {
  if (!intro || typeof intro !== 'object' || Array.isArray(intro)) {
    throw new Error('Invalid turn-through intro');
  }
  if (typeof intro.sceneId !== 'string' || intro.sceneId.length === 0
      || typeof intro.asset !== 'string' || intro.asset.length === 0) {
    throw new Error('Invalid turn-through intro');
  }
  const numbers = [
    intro.dx, intro.dy, intro.scale, intro.rotate, intro.yawDeg, intro.settleDx,
    intro.startScale, intro.midScale, intro.turnScale, intro.originX, intro.originY,
    intro.durationMs
  ];
  if (!numbers.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('Invalid turn-through intro');
  }
  if (intro.scale <= 0 || intro.durationMs <= 0 || intro.durationMs > 10_000) {
    throw new Error('Invalid turn-through intro');
  }
  if (intro.startScale <= 0 || intro.midScale <= 0 || intro.turnScale <= 0
      || intro.originX < 0 || intro.originX > 100
      || intro.originY < 0 || intro.originY > 100) {
    throw new Error('Invalid turn-through intro');
  }
}

function validateCamera(camera) {
  if (!camera || typeof camera !== 'object' || Array.isArray(camera)) {
    throw new Error('Invalid continuity camera');
  }
  const values = [camera.startScale, camera.endScale, camera.originX, camera.originY, camera.durationMs];
  if (!values.every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new Error('Invalid continuity camera');
  }
  if (camera.startScale <= 0 || camera.endScale <= 0
      || camera.originX < 0 || camera.originX > 100
      || camera.originY < 0 || camera.originY > 100
      || camera.durationMs < 0 || camera.durationMs > 10_000) {
    throw new Error('Invalid continuity camera');
  }
}

function introStyle(intro) {
  return [
    `--turn-dx:${intro.dx}%`,
    `--turn-dy:${intro.dy}%`,
    `--turn-scale:${intro.scale}`,
    `--turn-rotate:${intro.rotate}deg`,
    `--turn-yaw:${intro.yawDeg}deg`,
    `--turn-start-scale:${intro.startScale}`,
    `--turn-mid-scale:${intro.midScale}`,
    `--turn-turn-scale:${intro.turnScale}`,
    `--turn-origin-x:${intro.originX}%`,
    `--turn-origin-y:${intro.originY}%`,
    `--turn-duration:${intro.durationMs}ms`
  ].join(';');
}

function cameraStyle(camera) {
  return [
    `--continuity-start-scale:${camera.startScale}`,
    `--continuity-end-scale:${camera.endScale}`,
    `--continuity-origin-x:${camera.originX}%`,
    `--continuity-origin-y:${camera.originY}%`,
    `--continuity-duration:${camera.durationMs}ms`
  ].join(';');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}
