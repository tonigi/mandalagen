import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { paths } from './helpers/template.mjs';
import { getColorableHexPaths, getFillValue } from '../svg-engine.js';

const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMParser = window.DOMParser;
globalThis.requestAnimationFrame = callback => setTimeout(callback, 0);
globalThis.fetch = async () => ({ ok: true, text: async () => readFileSync(new URL('../data/onepage_model.svg', import.meta.url), 'utf8') });
window.HTMLCanvasElement.prototype.getContext = () => ({});
// jsdom supplies DOM/events; geometry comes from the shipped SVG fixture.
const rects = new Map(paths.filter(p => p.getAttribute('id') !== 'path2148' && getColorableHexPaths({ querySelectorAll: () => [p] }).length).map(p => [p.getAttribute('id'), p.getBoundingClientRect()]));
window.Element.prototype.getBoundingClientRect = function () {
  return rects.get(this.id) || { left: 0, top: 0, width: 793.70135, height: 1122.52 };
};
const captures = new Set();
window.Element.prototype.setPointerCapture = id => captures.add(id);
window.Element.prototype.hasPointerCapture = id => captures.has(id);
window.Element.prototype.releasePointerCapture = id => captures.delete(id);
await import('../app.js');
await new Promise(resolve => setTimeout(resolve, 10));
const byId = id => document.getElementById(id);
assert.equal(byId('status').textContent, 'SVG loaded. Upload an image to begin.');
assert.equal(byId('drawSymmetry').value, 'c6-mirror-vertex');
function change(id, value) {
  byId(id).value = value;
  byId(id).dispatchEvent(new window.Event('change', { bubbles: true }));
}
change('randomSymmetrySelect', 'c3');
assert.equal(byId('drawSymmetry').value, 'c3');
change('drawSymmetry', 'c6');
assert.equal(byId('randomSymmetrySelect').value, 'c6');
change('randomPaletteSelect', 'blue');
assert.equal(byId('paletteSelect').value, 'blue');
change('paletteSelect', 'purple');
assert.equal(byId('randomPaletteSelect').value, 'purple');
byId('randomTabBtn').click();
assert.equal(byId('imageTabPanel').hidden, true);
byId('generatePatternBtn').click();
const snapshot = () => getColorableHexPaths(byId('mandalaSvg')).map(getFillValue);
const generated = snapshot();
byId('drawTabBtn').click();
assert.deepEqual(snapshot(), generated, 'Switching mode preserves generated colors');
assert.equal(byId('overlayCanvas').style.display, 'none');
byId('drawClear').click();
assert(snapshot().every(fill => fill === '#ffffff'));
byId('drawUndo').click();
assert.deepEqual(snapshot(), generated);
byId('drawRedo').click();
const blank = snapshot();
const colorButton = [...document.querySelectorAll('#drawColors button')].find(b => b.textContent === 'crimson red');
colorButton.click();
// A noncentral cell gives six rotational copies; dispatch the real gesture handlers.
const target = getColorableHexPaths(byId('mandalaSvg'))[10];
document.elementFromPoint = () => target;
function pointer(type) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, button: 0, clientX: 20, clientY: 20 });
  byId('svgLayer').dispatchEvent(event);
}
pointer('pointerdown');
pointer('pointermove');
pointer('pointerup');
assert.equal(snapshot().filter(fill => fill === '#eb0000').length, 6);
byId('drawUndo').click();
assert.deepEqual(snapshot(), blank);
byId('drawRedo').click();
assert.equal(snapshot().filter(fill => fill === '#eb0000').length, 6);
byId('imageTabBtn').click();
byId('resetBtn').click();
assert(byId('drawUndo').disabled && byId('drawRedo').disabled);
console.log('PASS: application startup, shared controls, tab preservation, generator, pointer painting, and history buttons (DOM-only)');
window.close();
