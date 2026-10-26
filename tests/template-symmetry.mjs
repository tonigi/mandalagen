import assert from 'node:assert/strict';
import { paths, measureNodes } from './helpers/template.mjs';
import { getColorableHexPaths } from '../svg-engine.js';
import { buildSymmetryOrbits } from '../symmetry-engine.js';
import { RANDOM_SYMMETRIES } from '../constants.js';

const cells = getColorableHexPaths({ querySelectorAll: () => paths });
assert.equal(cells.length, 1045);
assert(!cells.some(p => p.getAttribute('id') === 'path2148'), 'Scissors artwork is not a peg cell');
for (const symmetry of RANDOM_SYMMETRIES) {
  const orbits = buildSymmetryOrbits(measureNodes(cells), symmetry);
  const sizes = new Set([...orbits.values()].map(orbit => orbit.length));
  const fullSize = symmetry.order * (symmetry.mirror ? 2 : 1);
  assert(sizes.has(fullSize), `${symmetry.label}: no full orbit, sizes ${[...sizes]}`);
  for (const [path, orbit] of orbits) {
    for (const partner of orbit) assert.deepEqual(new Set(orbits.get(partner)), new Set(orbit), `${symmetry.label}: ${path.getAttribute('id')}`);
  }
}
console.log('PASS: all 1045 real template cells have consistent symmetry orbits for all 16 modes; decoration excluded');
