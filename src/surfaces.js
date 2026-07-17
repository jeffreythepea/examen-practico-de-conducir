const DIAGRAM_CATEGORIES = new Set(['dir', 'rot']);
export const SUPPORTED_SURFACE_IDS = Object.freeze([
  'junction-v1',
  'roundabout-v1',
  'option-grid-v1',
  'yaris-manual-v1-eng',
  'yaris-manual-v1-dash',
  'yaris-manual-v1-light',
  'yaris-manual-v1-body'
]);

const SUPPORTED_SURFACES = new Set(SUPPORTED_SURFACE_IDS);

export function supportedCommands(commands, onUnsupported = () => {}) {
  return commands.filter(command => {
    const supported = SUPPORTED_SURFACES.has(command.surfaceId);
    if (!supported) onUnsupported(`Excluded ${command.id}: unsupported surface ${command.surfaceId}`);
    return supported;
  });
}

/**
 * Select honest Stage 1 response choices without crossing the command phase.
 * Same-category confusions are selected before generic choices. Diagram
 * surfaces are deliberately limited to the category they depict.
 */
export function surfaceOptions(command, pool, rng = Math.random) {
  if (!command || !Array.isArray(pool)) throw new Error('Command and pool are required');
  const phasePool = uniqueByResult(pool.filter(candidate => candidate.phase === command.phase));
  const target = phasePool.find(candidate => candidate.id === command.id) ?? command;
  const sameCategory = shuffle(
    phasePool.filter(candidate => candidate.id !== command.id && candidate.category === command.category),
    rng
  );
  const categoryOnly = DIAGRAM_CATEGORIES.has(command.category) || command.category.startsWith('pre-');
  const selected = categoryOnly
    ? [target, ...sameCategory]
    : [
        target,
        ...sameCategory.slice(0, 3),
        ...shuffle(
          phasePool.filter(candidate => candidate.id !== command.id && candidate.category !== command.category),
          rng
        ).slice(0, Math.max(0, 3 - sameCategory.length))
      ];
  return shuffle(selected, rng);
}

export function renderSurface(command, options, locale, { disabled = false } = {}) {
  if (command.surfaceId === 'junction-v1') return renderJunction(options, locale, disabled);
  if (command.surfaceId === 'roundabout-v1') return renderRoundabout(options, locale, disabled);
  if (command.surfaceId.startsWith('yaris-manual-v1-')) {
    if (!SUPPORTED_SURFACES.has(command.surfaceId)) throw new Error(`Unsupported surface: ${command.surfaceId}`);
    return renderPrecheck(command.surfaceId, options, locale, disabled);
  }
  if (command.surfaceId === 'option-grid-v1') {
    return `<div class="surface-grid" data-surface="${escapeAttribute(command.surfaceId)}">
      ${options.map(option => optionButton(option, locale, disabled)).join('')}
    </div>`;
  }
  throw new Error(`Unsupported surface: ${command.surfaceId}`);
}

function renderJunction(options, locale, disabled) {
  const positions = {
    'turn-right': [86, 50],
    'turn-left': [14, 50],
    'steering-straight': [50, 10],
    'change-direction': [50, 88]
  };
  return `<div class="surface-stage junction" data-surface="junction-v1">
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <path d="M128 0h44v300h-44zM0 128h300v44H0z" fill="#555d58"/>
      <path d="M150 12v276M12 150h276" stroke="#f8efc7" stroke-width="2" stroke-dasharray="10 9"/>
      <path d="M150 278l-11-20h22z" fill="#f3c75f"/>
    </svg>
    ${options.map(option => positionedButton(option, locale, positions[option.acceptedResult] ?? [50, 50], disabled)).join('')}
  </div>`;
}

function renderRoundabout(options, locale, disabled) {
  const positions = {
    'roundabout-exit-1': [88, 50],
    'roundabout-exit-2': [76, 20],
    'roundabout-exit-3': [50, 8],
    'roundabout-exit-4': [24, 20],
    'roundabout-exit-5': [12, 50]
  };
  return `<div class="surface-stage roundabout" data-surface="roundabout-v1">
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <path d="M150 230v70M220 150h80M199 101l51-51M150 80V0M101 101L50 50M80 150H0" stroke="#555d58" stroke-width="42"/>
      <circle cx="150" cy="150" r="78" fill="#555d58"/>
      <circle cx="150" cy="150" r="56" fill="#2f7650"/>
      <circle cx="150" cy="150" r="42" fill="#448e61"/>
      <path d="M195 105a64 64 0 0 0-90 0" fill="none" stroke="#fff" stroke-width="4" opacity=".65"/>
      <path d="M150 286l-11-20h22z" fill="#f3c75f"/>
    </svg>
    ${options.map(option => positionedButton(option, locale, positions[option.acceptedResult] ?? [50, 50], disabled)).join('')}
  </div>`;
}

function renderPrecheck(surfaceId, options, locale, disabled) {
  const category = surfaceId.slice('yaris-manual-v1-'.length);
  const layouts = {
    eng: {
      background: `<path d="M35 185Q45 105 125 82h125q55 6 100 63l20 40z" fill="#d9ded8" stroke="#657168" stroke-width="4"/>
        <path d="M128 91h110l40 51H116z" fill="#b9d6df" stroke="#657168" stroke-width="3"/>
        <circle cx="105" cy="190" r="29" fill="#535a53"/><circle cx="305" cy="190" r="29" fill="#535a53"/>
        <path d="M38 115l77-23-2 53-78 15z" fill="#eef1ea" stroke="#657168" stroke-width="3"/>`,
      positions: {
        'c-pre-aceite': [16, 42], 'c-pre-refrigerante': [26, 35],
        'c-pre-bateria': [64, 44], 'c-pre-capo': [15, 68]
      }
    },
    dash: {
      background: `<path d="M45 50Q200 5 355 50l-20 120H65z" fill="#444d47" stroke="#657168" stroke-width="4"/>
        <circle cx="125" cy="100" r="48" fill="#eef1ea" stroke="#9aa69a" stroke-width="3"/>
        <circle cx="275" cy="100" r="48" fill="#eef1ea" stroke="#9aa69a" stroke-width="3"/>
        <path d="M80 205h240l25 65H55z" fill="#d9ded8" stroke="#657168" stroke-width="4"/>
        <rect x="105" y="225" width="190" height="27" rx="9" fill="#535a53"/>`,
      positions: {
        'c-pre-combustible': [31, 33], 'c-pre-temperatura': [69, 33],
        'c-pre-bloquear-elevalunas': [36, 79], 'c-pre-desbloquear-elevalunas': [64, 79]
      }
    },
    light: {
      background: `<circle cx="92" cy="150" r="55" fill="#444d47" stroke="#657168" stroke-width="4"/>
        <path d="M135 135l210-30q25-2 27 23v44q-2 25-27 23l-210-30z" fill="#d9ded8" stroke="#657168" stroke-width="4"/>
        <rect x="215" y="113" width="22" height="74" rx="8" fill="#eef1ea" stroke="#657168" stroke-width="3"/>
        <rect x="290" y="106" width="22" height="88" rx="8" fill="#eef1ea" stroke="#657168" stroke-width="3"/>
        <path d="M55 77l40-35 40 35" fill="none" stroke="#e4b953" stroke-width="6"/>`,
      positions: {
        'c-pre-largo-alcance': [23, 25], 'c-pre-niebla-delantera': [57, 50],
        'c-pre-niebla-trasera': [75, 50]
      }
    },
    body: {
      background: `<path d="M28 118Q45 65 118 55l92 3q45 7 75 52l50 10 20 55H30z" fill="#d9ded8" stroke="#657168" stroke-width="4"/>
        <path d="M213 69q42 9 65 46l-66-3z" fill="#b9d6df" stroke="#657168" stroke-width="3"/>
        <path d="M52 105L18 78" stroke="#e4b953" stroke-width="6"/>
        <circle cx="100" cy="178" r="27" fill="#535a53"/><circle cx="285" cy="178" r="27" fill="#535a53"/>
        <rect x="72" y="220" width="256" height="55" rx="15" fill="#444d47"/>
        <circle cx="135" cy="247" r="20" fill="#eef1ea"/><circle cx="265" cy="247" r="20" fill="#eef1ea"/>`,
      positions: {
        'c-pre-maletero': [14, 35], 'c-pre-desempanar-delantera': [34, 82],
        'c-pre-desempanar-trasera': [66, 82]
      }
    }
  };
  const layout = layouts[category];
  return `<div class="surface-stage precheck" data-surface="${escapeAttribute(surfaceId)}">
    <svg viewBox="0 0 400 300" aria-hidden="true" focusable="false">${layout.background}</svg>
    ${options.map(option => positionedButton(option, locale, layout.positions[option.id] ?? [50, 50], disabled)).join('')}
  </div>`;
}

function positionedButton(option, locale, [x, y], disabled) {
  return `<button class="surface-option positioned" type="button" data-result="${escapeAttribute(option.acceptedResult)}" ${disabled ? 'disabled' : ''} style="--x:${x}%;--y:${y}%">
    <span class="option-icon" aria-hidden="true">${escapeHtml(option.icon)}</span>
    <span>${escapeHtml(optionLabel(option, locale))}</span>
  </button>`;
}

function optionButton(option, locale, disabled) {
  return `<button class="surface-option" type="button" data-result="${escapeAttribute(option.acceptedResult)}" ${disabled ? 'disabled' : ''}>
    <span class="option-icon" aria-hidden="true">${escapeHtml(option.icon)}</span>
    <span>${escapeHtml(optionLabel(option, locale))}</span>
  </button>`;
}

function optionLabel(option, locale) {
  const phrasing = option.phrasings?.[0];
  return locale === 'es' ? phrasing?.es : phrasing?.en;
}

function uniqueByResult(commands) {
  const seen = new Set();
  return commands.filter(command => {
    if (seen.has(command.acceptedResult)) return false;
    seen.add(command.acceptedResult);
    return true;
  });
}

function shuffle(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value);
}
