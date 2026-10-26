import { mod } from './utils.js';

function bandRegion(coordinate) {
  const fraction = mod(coordinate, 1);
  return { band: Math.floor(coordinate), edge: Math.min(fraction, 1 - fraction), blank: false };
}

function rings({ radius, density }) {
  return bandRegion(radius * density);
}

function flower({ radius, theta, repeats, shapeVariation, density }) {
  const contour = 0.72 + (0.12 + shapeVariation * 0.12) * Math.cos(theta * repeats);
  return bandRegion(radius / contour * (density - 1));
}

function star({ radius, angle, shapeVariation, density }) {
  const folded = Math.min(angle, 1 - angle) * 2;
  const contour = 1 - (0.3 + shapeVariation * 0.2) * folded;
  return bandRegion(radius / contour * (density - 1));
}

function petals({ radius, angle }) {
  const crown = Math.floor(radius * 3);
  const stagger = mod(angle + (crown % 2) * 0.5, 1);
  const across = Math.abs(stagger - 0.5) * 2;
  const along = Math.abs(mod(radius * 3, 1) - 0.5) * 2;
  const lens = across * across + along;
  return { band: crown + (lens < 0.45 ? 1 : 0), edge: Math.abs(lens - 0.88), blank: lens > 0.88 && radius > 0.12 };
}

function diagonalCoordinates({ radius, theta, density }, scale) {
  const x = radius * Math.cos(theta) * density * scale;
  const y = radius * Math.sin(theta) * density * scale;
  return { u: x + y, v: x - y };
}

function ribbons(parameters) {
  const { u, v } = diagonalCoordinates(parameters, 1.6);
  const du = Math.abs(mod(u, 1) - 0.5), dv = Math.abs(mod(v, 1) - 0.5);
  const over = mod(Math.floor(u) + Math.floor(v), 2) === 0;
  const band = (du < 0.22 && (dv >= 0.22 || over)) ? 0 : 2;
  return { band, edge: Math.min(Math.abs(du - 0.22), Math.abs(dv - 0.22)), blank: du > 0.22 && dv > 0.22 };
}

function diamonds(parameters) {
  const { u, v } = diagonalCoordinates(parameters, 1.5);
  const edge = Math.min(mod(u, 1), 1 - mod(u, 1), mod(v, 1), 1 - mod(v, 1));
  return { band: mod(Math.floor(u) + 2 * Math.floor(v), 3), edge, blank: false };
}

function mosaic({ radius, theta, repeats, density }) {
  const ring = radius * density;
  const row = Math.floor(ring);
  const tile = mod(theta * repeats / (2 * Math.PI) + (row % 2) * 0.5, repeats);
  return { band: row + Math.floor(tile), edge: Math.min(mod(ring, 1), 1 - mod(ring, 1), mod(tile, 1), 1 - mod(tile, 1)), blank: false };
}

// Each motif returns a color-band index, distance to a boundary, and blank-space flag.
export const MOTIF_REGIONS = { rings, flower, star, petals, ribbons, diamonds, mosaic };

export function motifRegion(kind, metrics, parameters) {
  return (MOTIF_REGIONS[kind] || mosaic)({
    ...parameters, radius: metrics.radial, theta: metrics.theta,
    angle: mod(metrics.theta * parameters.repeats / (2 * Math.PI), 1),
  });
}

export function createMotifParameters(rng, contrast) {
  // Keep the original four-draw seed sequence, including the reserved third draw.
  const sample = () => mod((rng() * Math.PI * 2) / (2 * Math.PI), 1);
  const repeatVariation = sample();
  const shapeVariation = sample();
  sample();
  const paletteVariation = sample();
  return {
    repeats: 6 * (1 + Math.floor(repeatVariation * 2)),
    shapeVariation, paletteVariation,
    density: 3 + Math.floor(contrast / 3),
    colorCount: 3 + Number(contrast >= 8),
  };
}
