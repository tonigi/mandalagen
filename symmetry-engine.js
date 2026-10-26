// Work in rendered board coordinates so nested SVG transforms are respected.
// Match only actual hex centers; do not snap to unrelated cells at the boundary.
export function buildSymmetryOrbits(paths, symmetry) {
  const nodes = paths.map(path => {
    const rect = path.getBoundingClientRect();
    return { path, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  if (!nodes.length) return new Map();
  const center = {
    x: (Math.min(...nodes.map(n => n.x)) + Math.max(...nodes.map(n => n.x))) / 2,
    y: (Math.min(...nodes.map(n => n.y)) + Math.max(...nodes.map(n => n.y))) / 2,
  };
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
