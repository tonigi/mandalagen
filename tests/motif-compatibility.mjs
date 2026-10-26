import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveRandomFill } from '../pattern-engine.js';
import { createMotifParameters } from '../motifs.js';
import { buildFixedPalette } from '../color-engine.js';
const baseline = JSON.parse(readFileSync(new URL('./fixtures/motif-colors.json', import.meta.url), 'utf8'));
const palette = buildFixedPalette('purple').filter(c => c.hex !== '#ffffff');
for (const [key, expected] of Object.entries(baseline)) {
  const [motif, contrast, whiteness] = key.split('/');
  const samples = [0.8, 2.5, 3.2, 1.7].map(p => p / (2 * Math.PI));
  let index = 0;
  const parameters = createMotifParameters(() => samples[index++], Number(contrast));
  const colors = [];
  for (let i = 0; i < 30; i++) for (let j = 0; j < 24; j++) {
    colors.push(resolveRandomFill({ radial: i / 30, theta: j / 24 * Math.PI / 6 }, motif, parameters, palette, Number(whiteness)));
  }
  assert.equal(createHash('sha256').update(colors.join(',')).digest('hex'), expected, key);
}
console.log('PASS: 63 motif/color configurations match pre-refactor output exactly');
