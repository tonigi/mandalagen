import { RANDOM_SYMMETRIES } from './constants.js';
import { mod, clamp01 } from './utils.js';

// Geometric regions, rather than mixtures of unrelated waves, define each family.
// Each result carries a color band and distance to its own decorative boundary.
export function motifRegion(kind, metrics, phases, contrast) {
  const { radial: radius, theta } = metrics;
  const variation = phases.map(p => mod(p / (2 * Math.PI), 1));
  const repeats = 6 * (1 + Math.floor(variation[0] * 2));
  const angle = mod(theta * repeats / (2 * Math.PI), 1);
  const folded = Math.min(angle, 1 - angle) * 2;
  const density = 3 + Math.floor(contrast / 3);
  const ring = radius * density;
  let coordinate, band;
  if (kind === 'rings') {
    coordinate = ring;
  } else if (kind === 'flower') {
    // Nested scalloped contours form a single rosette around a colored heart.
    const contour = 0.72 + (0.12 + variation[1] * 0.12) * Math.cos(theta * repeats);
    coordinate = radius / contour * (density - 1);
  } else if (kind === 'star') {
    // Piecewise-linear radial profile gives crisp alternating tips and valleys.
    const contour = 1 - (0.3 + variation[1] * 0.2) * folded;
    coordinate = radius / contour * (density - 1);
  } else if (kind === 'petals') {
    // Separate pointed lenses in successive radial crowns, with white between.
    const crown = Math.floor(radius * 3);
    const stagger = mod(angle + (crown % 2) * 0.5, 1);
    const across = Math.abs(stagger - 0.5) * 2;
    const along = Math.abs(mod(radius * 3, 1) - 0.5) * 2;
    const lens = across * across + along;
    return { band: crown + (lens < 0.45 ? 1 : 0), edge: Math.abs(lens - 0.88), blank: lens > 0.88 && radius > 0.12 };
  } else if (kind === 'ribbons') {
    // Two crossing diagonal strip systems; alternating crossings suggest a weave.
    const x = radius * Math.cos(theta) * density * 1.6;
    const y = radius * Math.sin(theta) * density * 1.6;
    const u = x + y, v = x - y;
    const du = Math.abs(mod(u, 1) - 0.5), dv = Math.abs(mod(v, 1) - 0.5);
    const over = mod(Math.floor(u) + Math.floor(v), 2) === 0;
    band = (du < 0.22 && (dv >= 0.22 || over)) ? 0 : 2;
    return { band, edge: Math.min(Math.abs(du - 0.22), Math.abs(dv - 0.22)), blank: du > 0.22 && dv > 0.22 };
  } else if (kind === 'diamonds') {
    const x = radius * Math.cos(theta) * density * 1.5;
    const y = radius * Math.sin(theta) * density * 1.5;
    const u = x + y, v = x - y;
    const edge = Math.min(mod(u, 1), 1 - mod(u, 1), mod(v, 1), 1 - mod(v, 1));
    return { band: mod(Math.floor(u) + 2 * Math.floor(v), 3), edge, blank: false };
  } else {
    // Annular tiles with alternate rows staggered by half a tile.
    const row = Math.floor(ring);
    const tile = mod(theta * repeats / (2 * Math.PI) + (row % 2) * 0.5, repeats);
    return { band: row + Math.floor(tile), edge: Math.min(mod(ring, 1), 1 - mod(ring, 1), mod(tile, 1), 1 - mod(tile, 1)), blank: false };
  }
  const fraction = mod(coordinate, 1);
  return { band: Math.floor(coordinate), edge: Math.min(fraction, 1 - fraction), blank: false };
}

export function getSymmetryConfig(value) {
  return RANDOM_SYMMETRIES.find((entry) => entry.value === value) || RANDOM_SYMMETRIES[0];
}

export function getSymmetryCoordinates(theta, symmetry) {
  const period = (Math.PI * 2) / symmetry.order;
  const local = mod(theta - symmetry.offset, period);
  const canonical = symmetry.mirror ? Math.min(local, period - local) : local;
  return {
    angleNorm: period ? canonical / period : 0,
    mirrorNorm: symmetry.mirror && period ? canonical / (period / 2) : canonical / period,
  };
}

export function getMetricsForNode(node, center, maxRadius, symmetry) {
  const dx = node.x - center.x, dy = node.y - center.y;
  const radial = clamp01(Math.hypot(dx, dy) / maxRadius);
  const coords = getSymmetryCoordinates(Math.atan2(dy, dx), symmetry);
  return { radial, theta: coords.angleNorm * 2 * Math.PI / symmetry.order };
}

export function resolveRandomFill(metrics, motifKind, phases, colorPalette, contrast, whiteness) {
  if (!colorPalette.length) return '#ffffff';
  const region = motifRegion(motifKind, metrics, phases, contrast);
  const outlineWidth = whiteness * 0.014;
  if (region.blank || (whiteness > 0 && region.edge < outlineWidth && metrics.radial > 0.1)) return '#ffffff';
  // Limit each design to a deliberate subset, rather than using every peg color.
  const count = Math.min(colorPalette.length, 3 + Number(contrast >= 8));
  const offset = Math.floor(mod(phases[3] / (2 * Math.PI), 1) * colorPalette.length);
  const index = mod(region.band, count);
  return colorPalette[(offset + index) % colorPalette.length].hex;
}
