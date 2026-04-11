import { RANDOM_SYMMETRIES } from './constants.js';
import { mod, clamp01 } from './utils.js';

export function randomMotifValue(kind, metrics, phases) {
  const { radial, angleNorm, mirrorNorm, ring, q, r } = metrics;
  const [p1, p2, p3, p4] = phases;

  const flower =
    0.62 * Math.cos(mirrorNorm * Math.PI * 3 + p1) +
    0.45 * Math.sin(radial * 11 + p2) +
    0.25 * Math.cos(ring * 0.82 + p3);

  const star =
    0.72 * Math.cos(angleNorm * Math.PI * 2 + p1) * (1 - radial * 0.6) +
    0.35 * Math.sin(radial * 14 + p2) +
    0.2 * Math.cos(ring * 0.75 + p3);

  const ribbons =
    0.45 * Math.sin((q - r) * 0.82 + p1) +
    0.4 * Math.cos((q + 2 * r) * 0.55 + p2) +
    0.3 * Math.sin(angleNorm * Math.PI * 5 + radial * 8 + p3);

  const diamonds =
    0.45 * Math.cos((q + r) * 0.82 + p1) +
    0.45 * Math.cos((q - r) * 0.82 + p2) +
    0.32 * Math.cos(mirrorNorm * Math.PI * 6 + radial * 7 + p3);

  const petals =
    0.62 * Math.cos(mirrorNorm * Math.PI * 5 + p1) * (1 - radial * 0.35) +
    0.4 * Math.cos(radial * 9 + p2) +
    0.25 * Math.cos(angleNorm * Math.PI * 4 + p3);

  const mosaic =
    0.35 * Math.sin(q * 0.92 + p1) +
    0.35 * Math.cos(r * 0.9 + p2) +
    0.2 * Math.sin((q + r) * 0.63 + p3) +
    0.18 * Math.cos(radial * 15 + p4);

  if (kind === "flower") return flower;
  if (kind === "star") return star;
  if (kind === "ribbons") return ribbons;
  if (kind === "diamonds") return diamonds;
  if (kind === "petals") return petals;
  if (kind === "mosaic") return mosaic;

  return 0.32 * flower + 0.28 * star + 0.2 * ribbons + 0.2 * diamonds;
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

export function getSymmetryKey(node, center, maxRadius, symmetry) {
  if (symmetry.value === "none") {
    return `${node.q}:${node.r}`;
  }
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const theta = Math.atan2(dy, dx);
  const radialBucket = Math.round((Math.hypot(dx, dy) / maxRadius) * 120);
  const coords = getSymmetryCoordinates(theta, symmetry);
  const angleBucket = Math.round(coords.angleNorm * 120);
  return `${radialBucket}:${angleBucket}`;
}

export function getMetricsForNode(node, center, maxRadius, symmetry) {
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const theta = Math.atan2(dy, dx);
  const radial = clamp01(Math.hypot(dx, dy) / maxRadius);
  if (symmetry.value === "none") {
    return {
      radial,
      angleNorm: mod(theta, Math.PI * 2) / (Math.PI * 2),
      mirrorNorm: mod(theta, Math.PI * 2) / (Math.PI * 2),
      ring: Math.hypot(node.q, node.r),
      q: node.q,
      r: node.r,
      theta,
    };
  }
  const coords = getSymmetryCoordinates(theta, symmetry);
  const radialBucket = Math.round(radial * 120);
  const angleBucket = Math.round(coords.angleNorm * 120);
  const angleNorm = clamp01(angleBucket / 120);
  const mirrorNorm = symmetry.mirror ? clamp01(angleNorm * 2) : angleNorm;
  const ring = radialBucket;
  const q = Math.round(angleNorm * 30);
  const r = radialBucket - q;
  return {
    radial: clamp01(radialBucket / 120),
    angleNorm,
    mirrorNorm,
    ring,
    q,
    r,
    theta: angleNorm * ((Math.PI * 2) / symmetry.order),
  };
}

export function resolveRandomFill(metrics, motifKind, phases, biases, colorPalette, contrast, whiteness) {
  const { radial, angleNorm, mirrorNorm, ring } = metrics;
  const value = randomMotifValue(motifKind, metrics, phases);
  const bias =
    0.15 * Math.cos(radial * 10 * biases.ring + phases[0]) +
    0.15 * Math.sin(angleNorm * Math.PI * 4 * biases.angle + phases[1]);
  const normalized = clamp01(0.5 + 0.5 * Math.tanh((value + bias) * (1.15 + contrast * 0.18)));
  const colorIndex = Math.min(colorPalette.length - 1, Math.floor(normalized * colorPalette.length));
  const accentField =
    Math.abs(
      Math.sin(ring * 0.95 * biases.accent + mirrorNorm * Math.PI * 5 + phases[2]) +
        0.35 * Math.cos(radial * 18 + phases[3])
    ) / 1.35;
  const makeWhite = radial < 0.08 || (radial < 0.93 && accentField > 0.84 - whiteness * 0.035);
  return makeWhite ? "#ffffff" : colorPalette[colorIndex].hex;
}
