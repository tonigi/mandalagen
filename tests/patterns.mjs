import { motifRegion, createMotifParameters } from '../motifs.js';
import assert from 'node:assert/strict';
import { RANDOM_MOTIFS, RANDOM_SYMMETRIES } from '../constants.js';
import { buildFixedPalette } from '../color-engine.js';
import { getMetricsForNode, resolveRandomFill } from '../pattern-engine.js';
import { buildSymmetryOrbits } from '../symmetry-engine.js';

const palette = buildFixedPalette('purple').filter(c => c.hex !== '#ffffff');
const allowed = new Set(['#ffffff', ...palette.map(c => c.hex)]);
const samples = [0.8, 2.5, 3.2, 1.7].map(p => p / (2 * Math.PI));
let sampleIndex = 0;
const parameters = createMotifParameters(() => samples[sampleIndex++], 6);
const signatures = new Set();
for (const motif of RANDOM_MOTIFS.filter(m => m !== 'auto')) {
  const colors = [];
  for (let i = 0; i < 30; i++) for (let j = 0; j < 24; j++) {
    const metrics = { radial: i / 30, theta: j / 24 * Math.PI / 6 };
    const region = motifRegion(motif, metrics, parameters);
    assert(Number.isFinite(region.band) && Number.isFinite(region.edge), motif);
    const fill = resolveRandomFill(metrics, motif, parameters, palette, 4);
    assert(allowed.has(fill), motif);
    assert.equal(fill, resolveRandomFill(metrics, motif, parameters, palette, 4));
    colors.push(fill);
    // Zero white accents must not introduce outlines in solid geometric families.
    if (['rings', 'flower', 'star', 'diamonds', 'mosaic'].includes(motif)) {
      assert.notEqual(resolveRandomFill(metrics, motif, parameters, palette, 0), '#ffffff');
    }
  }
  assert(new Set(colors).size >= 3, `${motif} lacks color structure`);
  signatures.add(colors.join(','));
}
assert.equal(signatures.size, RANDOM_MOTIFS.length - 1, 'Motif families must differ');
const paths = [];
for (let q = -5; q <= 5; q++) for (let r = -5; r <= 5; r++) {
  if (Math.abs(q + r) > 5) continue;
  const x = q + r / 2, y = r * Math.sqrt(3) / 2;
  paths.push({ path: {}, x, y });
}
for (const symmetry of RANDOM_SYMMETRIES) {
  const orbits = buildSymmetryOrbits(paths, symmetry);
  for (const [path, orbit] of orbits) {
    assert(orbit.includes(path));
    for (const partner of orbit) assert.deepEqual(new Set(orbits.get(partner)), new Set(orbit), symmetry.label);
  }
  const metrics = getMetricsForNode({ x: 1, y: 2 }, { x: 0, y: 0 }, 5, symmetry);
  assert(Number.isFinite(metrics.theta));
}
console.log('PASS: seven distinct deterministic motif families, palette bounds, white-accent control, and all symmetry orbits');
