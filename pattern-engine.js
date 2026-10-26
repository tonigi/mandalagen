import { getSymmetryConfig, getSymmetryCoordinates } from './symmetry-engine.js';
import { motifRegion, createMotifParameters } from './motifs.js';
import { RANDOM_MOTIFS } from './constants.js';
import { hashString, mulberry32, mod, clamp01 } from './utils.js';
import { buildFixedPalette } from './color-engine.js';

export function getMetricsForNode(node, center, maxRadius, symmetry) {
  const dx = node.x - center.x, dy = node.y - center.y;
  const radial = clamp01(Math.hypot(dx, dy) / maxRadius);
  const coords = getSymmetryCoordinates(Math.atan2(dy, dx), symmetry);
  return { radial, theta: coords.angleNorm * 2 * Math.PI / symmetry.order };
}

export function resolveRandomFill(metrics, motifKind, parameters, colorPalette, whiteness) {
  if (!colorPalette.length) return '#ffffff';
  const region = motifRegion(motifKind, metrics, parameters);
  const outlineWidth = whiteness * 0.014;
  if (region.blank || (whiteness > 0 && region.edge < outlineWidth && metrics.radial > 0.1)) return '#ffffff';
  // Limit each design to a deliberate subset, rather than using every peg color.
  const count = Math.min(colorPalette.length, parameters.colorCount);
  const offset = Math.floor(parameters.paletteVariation * colorPalette.length);
  const index = mod(region.band, count);
  return colorPalette[(offset + index) % colorPalette.length].hex;
}

// Rendering is independent of controls: state supplies all pattern settings.
export function generatePattern(board, settings) {
  const { seed, motif, palette, contrast, whiteness } = settings;
  const symmetry = getSymmetryConfig(settings.symmetry);
  const rng = mulberry32(hashString(`${seed}|${palette}|${motif}|${symmetry.value}|${contrast}|${whiteness}`)());
  const motifKind = motif === 'auto' ? RANDOM_MOTIFS[1 + Math.floor(rng() * (RANDOM_MOTIFS.length - 1))] : motif;
  const parameters = createMotifParameters(rng, contrast);
  const colorPalette = buildFixedPalette(palette).filter(entry => entry.hex !== '#ffffff');
  const orbits = board.getOrbits(symmetry);
  const painted = new Set();
  board.clearHistory();
  for (const node of board.nodes) {
    if (painted.has(node.path)) continue;
    const metrics = getMetricsForNode(node, board.center, board.maxRadius, symmetry);
    const fill = resolveRandomFill(metrics, motifKind, parameters, colorPalette, whiteness);
    for (const partner of orbits.get(node.path)) {
      board.setColor(partner, fill);
      painted.add(partner);
    }
  }
  return motifKind;
}
