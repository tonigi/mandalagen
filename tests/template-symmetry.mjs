import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getHexVertices, getColorableHexPaths } from '../svg-engine.js';
import { buildSymmetryOrbits } from '../symmetry-engine.js';
import { RANDOM_SYMMETRIES } from '../constants.js';

// Read the shipped template, including its decoration, instead of an ideal grid.
const svg = readFileSync(new URL('../data/onepage_model.svg', import.meta.url), 'utf8');
const paths = [...svg.matchAll(/<path\b[\s\S]*?\/>/g)].map(([tag]) => {
  const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  return {
    getAttribute: key => attrs[key] || null,
    getBoundingClientRect() {
      const points = getHexVertices(this);
      const [a, b, c, d, e, f] = attrs.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
      const xs = points.map(p => a * p.x + c * p.y + e);
      const ys = points.map(p => b * p.x + d * p.y + f);
      return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
  };
});
const cells = getColorableHexPaths({ querySelectorAll: () => paths });
assert.equal(cells.length, 1045);
assert(!cells.some(p => p.getAttribute('id') === 'path2148'), 'Scissors artwork is not a peg cell');
for (const symmetry of RANDOM_SYMMETRIES) {
  const orbits = buildSymmetryOrbits(cells, symmetry);
  const sizes = new Set([...orbits.values()].map(orbit => orbit.length));
  const fullSize = symmetry.order * (symmetry.mirror ? 2 : 1);
  assert(sizes.has(fullSize), `${symmetry.label}: no full orbit, sizes ${[...sizes]}`);
  for (const [path, orbit] of orbits) {
    for (const partner of orbit) assert.deepEqual(new Set(orbits.get(partner)), new Set(orbit), `${symmetry.label}: ${path.getAttribute('id')}`);
  }
}
console.log('PASS: all 1045 real template cells have consistent symmetry orbits for all 16 modes; decoration excluded');
