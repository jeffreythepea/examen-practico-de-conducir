/**
 * Returns a normalized point at the requested angle, using SVG's positive-down y axis.
 *
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @param {number} degrees
 * @returns {{ x: number, y: number }}
 */
export function polarPoint(cx, cy, radius, degrees) {
  const radians = degrees * Math.PI / 180;
  return { x: cx + Math.cos(radians) * radius, y: cy + Math.sin(radians) * radius };
}

/**
 * Returns a restrained random variation around an angle.
 *
 * @param {number} base
 * @param {number} maximum
 * @param {() => number} rng
 * @returns {number}
 */
export function jitterAngle(base, maximum, rng) {
  return base + (rng() * 2 - 1) * maximum;
}

/**
 * Creates a normalized target box with a minimum 44 by 44 CSS-pixel hit area.
 *
 * @param {string} id
 * @param {string} resultId
 * @param {number} x
 * @param {number} y
 * @param {{ stageWidth: number, stageHeight: number, kind?: string }} stage
 * @returns {{ id: string, resultId: string, x: number, y: number, width: number, height: number, kind: string }}
 */
export function targetBox(id, resultId, x, y, { stageWidth, stageHeight, kind = 'road-exit' }) {
  return {
    id,
    resultId,
    x,
    y,
    width: minimumNormalizedSize(stageWidth),
    height: minimumNormalizedSize(stageHeight),
    kind
  };
}

function minimumNormalizedSize(stageDimension) {
  return Math.ceil((4400 / stageDimension) * 100) / 100;
}

/**
 * @param {{ x: number, y: number, width: number, height: number }} a
 * @param {{ x: number, y: number, width: number, height: number }} b
 * @returns {boolean}
 */
export function boxesOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width && Math.abs(a.y - b.y) * 2 < a.height + b.height;
}

/**
 * @param {Array<{ id: string, x: number, y: number, width: number, height: number }>} targets
 * @returns {true}
 */
export function assertNonOverlappingTargets(targets) {
  for (let left = 0; left < targets.length; left += 1) {
    for (let right = left + 1; right < targets.length; right += 1) {
      if (boxesOverlap(targets[left], targets[right])) {
        throw new Error(`Targets overlap: ${targets[left].id}, ${targets[right].id}`);
      }
    }
  }
  return true;
}

/**
 * Formats normalized road points as an SVG path consisting of straight segments.
 *
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string}
 */
export function svgRoadPath(points) {
  return points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
}
