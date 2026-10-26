import { RANDOM_SYMMETRIES } from './constants.js';
import { getSymmetryConfig } from './symmetry-engine.js';
import { buildFixedPalette } from './color-engine.js';

// One history entry per gesture, regardless of how many hexagons it crosses.
export function createDrawingControls({ svgLayer, getBoard, state, onChange, downloadSvg, print }) {
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
    state.set({ symmetry: symmetrySelect.value });
  });
  let color = '#ffffff';
  let strokeBoard = null;
  let pointerId = null;
  let lastPoint = null;
  let strokeSymmetry = null;
  const undoButton = panel.querySelector('#drawUndo');
  const redoButton = panel.querySelector('#drawRedo');
  function updateButtons() {
    undoButton.disabled = !getBoard()?.canUndo;
    redoButton.disabled = !getBoard()?.canRedo;
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
  function paintTo(event) {
    const point = { x: event.clientX, y: event.clientY };
    const start = lastPoint || point;
    const steps = Math.max(1, Math.ceil(Math.hypot(point.x - start.x, point.y - start.y) / 2));
    for (let i = 1; i <= steps; i++) {
      const path = document.elementFromPoint(start.x + (point.x - start.x) * i / steps, start.y + (point.y - start.y) * i / steps);
      strokeBoard.paint(path, color, strokeSymmetry);
    }
    lastPoint = point;
  }
  function finishStroke() {
    if (!strokeBoard) return;
    strokeBoard.finishStroke();
    strokeBoard = null;
    onChange();
    lastPoint = null;
    const id = pointerId;
    pointerId = null;
    if (id !== null && svgLayer.hasPointerCapture(id)) svgLayer.releasePointerCapture(id);
    updateButtons();
  }
  svgLayer.addEventListener('pointerdown', event => {
    if (state.value.activeTab !== 'draw' || !getBoard() || event.button !== 0 || strokeBoard) return;
    event.preventDefault();
    strokeBoard = getBoard();
    strokeSymmetry = getSymmetryConfig(state.value.symmetry);
    strokeBoard.beginStroke();
    pointerId = event.pointerId;
    svgLayer.setPointerCapture(pointerId);
    paintTo(event);
  });
  svgLayer.addEventListener('pointermove', event => {
    if (!strokeBoard || event.pointerId !== pointerId) return;
    for (const sample of event.getCoalescedEvents?.() || [event]) paintTo(sample);
    paintTo(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    svgLayer.addEventListener(type, event => {
      if (event.pointerId === pointerId) finishStroke();
    });
  }
  for (const [button, action] of [[undoButton, 'undo'], [redoButton, 'redo'], [panel.querySelector('#drawClear'), 'clear']]) {
    button.addEventListener('click', () => {
      finishStroke();
      getBoard()?.[action]();
      updateButtons();
      onChange();
    });
  }
  panel.querySelector('#drawDownload').addEventListener('click', downloadSvg);
  panel.querySelector('#drawPrint').addEventListener('click', print);
  state.subscribe((value, previous) => {
    if (value.symmetry !== previous.symmetry || value.activeTab !== previous.activeTab) finishStroke();
    symmetrySelect.value = value.symmetry;
  });
  updateButtons();
  return { panel, finishStroke, updateButtons, clearHistory() {
    finishStroke();
    getBoard()?.clearHistory();
    updateButtons();
  } };
}
