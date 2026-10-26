import { RANDOM_SYMMETRIES } from './constants.js';
import { buildSymmetryOrbits } from './symmetry-engine.js';
import { buildFixedPalette } from './color-engine.js';
import { getColorableHexPaths, getFillValue, setFillValue } from './svg-engine.js';

// One history entry per gesture, regardless of how many hexagons it crosses.
export function createDrawingControls({ svgLayer, getSvg, isActive, onChange, onSymmetryChange, downloadSvg, print }) {
  const panel = document.createElement('div');
  panel.className = 'tab-panel';
  panel.id = 'drawTabPanel';
  panel.hidden = true;
  panel.innerHTML = `
    <p>Choose a color, then click or drag across hexagons. Works with a mouse, pen, or touch. Erase paints white.</p>
    <label class="control"><span>Symmetry</span>
      <select id="drawSymmetry">${RANDOM_SYMMETRIES.map(s => `<option value="${s.value}" ${s.value === RANDOM_SYMMETRIES[0].value ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
    </label>
    <p>The symmetry setting is shared with Random. Symmetry repeats each new stroke about the board center. Axes are measured clockwise from horizontal. Cₙ gives n rotations; Dₙ adds n reflections. Existing colors stay unchanged.</p>
    <div class="buttons" id="drawColors" aria-label="Drawing colors"></div>
    <div class="buttons">
      <button type="button" id="drawUndo">Undo</button>
      <button type="button" id="drawRedo">Redo</button>
      <button type="button" id="drawClear">Clear board</button>
      <button type="button" id="drawDownload">Download SVG</button>
      <button type="button" id="drawPrint">Print/Download</button>
    </div>`;
  const symmetrySelect = panel.querySelector('#drawSymmetry');
  symmetrySelect.addEventListener('change', () => {
    finishStroke();
    onSymmetryChange?.(symmetrySelect.value);
  });
  let color = '#ffffff';
  let stroke = null;
  let pointerId = null;
  let lastPoint = null;
  let paths = new Set();
  let orbits = new Map();
  const undo = [], redo = [];
  const undoButton = panel.querySelector('#drawUndo');
  const redoButton = panel.querySelector('#drawRedo');
  function updateButtons() {
    undoButton.disabled = !undo.length;
    redoButton.disabled = !redo.length;
  }
  const palette = [...new Map(['purple', 'blue'].flatMap(buildFixedPalette).map(entry => [entry.hex, entry])).values()];
  for (const entry of palette) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = entry.hex === '#ffffff' ? 'Erase (white)' : entry.name;
    button.style.borderLeft = `18px solid ${entry.hex}`;
    button.setAttribute('aria-pressed', String(entry.hex === color));
    button.addEventListener('click', () => {
      color = entry.hex;
      panel.querySelectorAll('#drawColors button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    });
    panel.querySelector('#drawColors').appendChild(button);
  }
  function paint(path) {
    if (!paths.has(path) || getFillValue(path) === color) return;
    if (!stroke.has(path)) stroke.set(path, { path, before: getFillValue(path), after: color });
    setFillValue(path, color);
  }
  function paintSymmetric(path) {
    for (const partner of orbits.get(path) || []) paint(partner);
  }
  function paintTo(event) {
    const point = { x: event.clientX, y: event.clientY };
    const start = lastPoint || point;
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - start.x, point.y - start.y) / 2));
    for (let i = 1; i <= steps; i++) {
      paintSymmetric(document.elementFromPoint(start.x + (point.x - start.x) * i / steps, start.y + (point.y - start.y) * i / steps));
    }
    lastPoint = point;
  }
  function finishStroke() {
    if (!stroke) return;
    if (stroke.size) {
      undo.push([...stroke.values()]);
      if (undo.length > 100) undo.shift();
      redo.length = 0;
      onChange();
    }
    stroke = null;
    lastPoint = null;
    const id = pointerId;
    pointerId = null;
    if (id !== null && svgLayer.hasPointerCapture(id)) svgLayer.releasePointerCapture(id);
    updateButtons();
  }
  svgLayer.addEventListener('pointerdown', event => {
    if (!isActive() || !getSvg() || event.button !== 0 || stroke) return;
    event.preventDefault();
    paths = new Set(getColorableHexPaths(getSvg()));
    const symmetry = RANDOM_SYMMETRIES.find(s => s.value === symmetrySelect.value);
    orbits = buildSymmetryOrbits([...paths], symmetry);
    stroke = new Map();
    pointerId = event.pointerId;
    svgLayer.setPointerCapture(pointerId);
    paintTo(event);
  });
  svgLayer.addEventListener('pointermove', event => {
    if (!stroke || event.pointerId !== pointerId) return;
    for (const sample of event.getCoalescedEvents?.() || [event]) paintTo(sample);
    paintTo(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    svgLayer.addEventListener(type, event => {
      if (event.pointerId === pointerId) finishStroke();
    });
  }
  function restore(from, to, key) {
    finishStroke();
    const entry = from.pop();
    if (!entry) return;
    for (const change of entry) setFillValue(change.path, change[key]);
    to.push(entry);
    updateButtons();
    onChange();
  }
  undoButton.addEventListener('click', () => restore(undo, redo, 'before'));
  redoButton.addEventListener('click', () => restore(redo, undo, 'after'));
  panel.querySelector('#drawClear').addEventListener('click', () => {
    finishStroke();
    paths = new Set(getColorableHexPaths(getSvg()));
    stroke = new Map();
    const previousColor = color;
    color = '#ffffff';
    paths.forEach(paint);
    color = previousColor;
    finishStroke();
  });
  panel.querySelector('#drawDownload').addEventListener('click', downloadSvg);
  panel.querySelector('#drawPrint').addEventListener('click', print);
  updateButtons();
  return { panel, finishStroke, setSymmetry(value) {
    finishStroke();
    symmetrySelect.value = value;
  }, clearHistory() {
    finishStroke();
    undo.length = redo.length = 0;
    updateButtons();
  } };
}
