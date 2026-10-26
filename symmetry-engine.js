import { RANDOM_SYMMETRIES } from './constants.js';
import { mod } from './utils.js';

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

// Symmetry operates on measured nodes, independent of the DOM or viewport.
export function getBoardGeometry(nodes) {
  if (!nodes.length) return { center: { x: 0, y: 0 }, maxRadius: 1 };
  const center = {
    x: (Math.min(...nodes.map(n => n.x)) + Math.max(...nodes.map(n => n.x))) / 2,
    y: (Math.min(...nodes.map(n => n.y)) + Math.max(...nodes.map(n => n.y))) / 2,
  };
  const maxRadius = Math.max(...nodes.map(n => Math.hypot(n.x - center.x, n.y - center.y))) || 1;
  return { center, maxRadius };
}

export function buildSymmetryOrbits(nodes, symmetry) {
  if (!nodes.length) return new Map();
  const { center } = getBoardGeometry(nodes);
  let spacing = Infinity;
  for (const node of nodes.slice(1)) {
    const distance = Math.hypot(node.x - nodes[0].x, node.y - nodes[0].y);
    if (distance > 0) spacing = Math.min(spacing, distance);
  }
  const tolerance = Number.isFinite(spacing) ? spacing * 0.2 : 0.01;
  const buckets = new Map();
  const bucketKey = (x, y) => `${Math.floor(x / tolerance)}:${Math.floor(y / tolerance)}`;
  for (const node of nodes) {
    const key = bucketKey(node.x, node.y);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(node);
  }
  const orbits = new Map();
  for (const node of nodes) {
    const partners = new Set([node.path]);
    const dx = node.x - center.x, dy = node.y - center.y;
    const radius = Math.hypot(dx, dy), theta = Math.atan2(dy, dx);
    for (let reflected = 0; reflected <= Number(symmetry.mirror); reflected++) {
      const angle = reflected ? 2 * symmetry.offset - theta : theta;
      for (let k = 0; k < symmetry.order; k++) {
        const targetAngle = angle + k * 2 * Math.PI / symmetry.order;
        const x = center.x + radius * Math.cos(targetAngle);
        const y = center.y + radius * Math.sin(targetAngle);
        let closest = null, distance = tolerance;
        const bx = Math.floor(x / tolerance), by = Math.floor(y / tolerance);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          for (const candidate of buckets.get(`${bx + ox}:${by + oy}`) || []) {
            const d = Math.hypot(candidate.x - x, candidate.y - y);
            if (d < distance) { closest = candidate; distance = d; }
          }
        }
        if (closest) partners.add(closest.path);
      }
    }
    orbits.set(node.path, [...partners]);
  }
  return orbits;
}
