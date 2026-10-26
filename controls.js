import { RANDOM_MOTIFS, RANDOM_MOTIF_DESCRIPTIONS, RANDOM_SYMMETRIES } from './constants.js';
import { createDrawingControls } from './drawing-engine.js';

export function createControls({ state, svgLayer, overlayCanvas, getBoard, onChange, onModeChange, generate, reset, download, print }) {
  const controls = document.querySelector('.controls');
  const paletteSelect = document.getElementById('paletteSelect');
  const imagePanel = document.createElement('div');
  imagePanel.id = 'imageTabPanel';
  imagePanel.className = 'tab-panel';
  while (controls.firstChild) imagePanel.appendChild(controls.firstChild);
  const randomPanel = document.createElement('div');
  randomPanel.id = 'randomTabPanel';
  randomPanel.className = 'tab-panel';
  randomPanel.innerHTML = `
    <fieldset id="randomPatternControls" class="control">
      <legend>Random pattern generator</legend>
    <label>
      <span>Seed</span>
      <input type="text" id="randomSeedInput" value="mandala-random-001" />
    </label>
    <label>
      <span>Motif family</span>
      <select id="randomMotifSelect">
        ${RANDOM_MOTIFS.map((motif) => `<option value="${motif}">${motif}</option>`).join("")}
      </select>
      <p class="status" id="randomMotifDescription"></p>
    </label>
    <label>
      <span>Symmetry</span>
      <select id="randomSymmetrySelect">
        ${RANDOM_SYMMETRIES.map((symmetry) => `<option value="${symmetry.value}">${symmetry.label}</option>`).join("")}
      </select>
    </label>
    <label>
      <span>Palette</span>
      <select id="randomPaletteSelect">
        ${Array.from(paletteSelect.options)
          .map((option) => `<option value="${option.value}">${option.textContent}</option>`)
          .join("")}
      </select>
    </label>
    <label>
      <span>Contrast <strong class="value" id="randomContrastValue">6</strong></span>
      <input type="range" id="randomContrastInput" min="1" max="10" step="1" value="6" />
    </label>
    <label>
      <span>White accents <strong class="value" id="randomWhitenessValue">4</strong></span>
      <input type="range" id="randomWhitenessInput" min="0" max="10" step="1" value="4" />
    </label>
    <div class="buttons">
      <button id="generatePatternBtn" type="button">Generate</button>
      <button id="randomPatternBtn" type="button">Randomize</button>
      <button id="resetRandomBtn" type="button">Reset SVG</button>
      <button id="downloadRandomBtn" type="button">Download SVG</button>
      <button id="printRandomBtn" type="button">Print/Download</button>
    </div>
    </fieldset>
  `;
  const drawing = createDrawingControls({ svgLayer, getBoard, state, onChange, downloadSvg: download, print });
  const panels = { image: imagePanel, random: randomPanel, draw: drawing.panel };
  const tabs = document.createElement('div');
  tabs.id = 'controlTabs';
  tabs.className = 'buttons';
  for (const name of Object.keys(panels)) {
    const button = document.createElement('button');
    button.id = `${name}TabBtn`;
    button.type = 'button';
    button.textContent = name[0].toUpperCase() + name.slice(1);
    button.addEventListener('click', () => state.set({ activeTab: name }));
    tabs.appendChild(button);
  }
  controls.append(tabs, ...Object.values(panels));

  const bindings = [
    ['randomSeedInput', 'seed', 'input', String],
    ['randomMotifSelect', 'motif', 'change', String],
    ['randomSymmetrySelect', 'symmetry', 'change', String],
    ['randomPaletteSelect', 'palette', 'change', String],
    ['paletteSelect', 'palette', 'change', String],
    ['randomContrastInput', 'contrast', 'input', Number],
    ['randomWhitenessInput', 'whiteness', 'input', Number],
  ].map(([id, key, event, convert]) => ({ element: document.getElementById(id), key, event, convert }));
  for (const { element, key, event, convert } of bindings) {
    element.addEventListener(event, () => state.set({ [key]: convert(element.value) }));
  }
  state.subscribe((value, previous) => {
    if (value.activeTab !== previous.activeTab) {
      drawing.finishStroke();
      onModeChange();
    }
    for (const { element, key } of bindings) {
      if (element.value !== String(value[key])) element.value = value[key];
    }
    for (const [name, panel] of Object.entries(panels)) {
      panel.hidden = value.activeTab !== name;
      document.getElementById(`${name}TabBtn`).setAttribute('aria-pressed', String(value.activeTab === name));
    }
    overlayCanvas.style.display = value.activeTab === 'image' ? '' : 'none';
    svgLayer.classList.toggle('drawing', value.activeTab === 'draw');
    document.getElementById('randomContrastValue').textContent = value.contrast;
    document.getElementById('randomWhitenessValue').textContent = value.whiteness;
    document.getElementById('randomMotifDescription').textContent = RANDOM_MOTIF_DESCRIPTIONS[value.motif] || '';
  });
  document.getElementById('generatePatternBtn').addEventListener('click', generate);
  document.getElementById('randomPatternBtn').addEventListener('click', () => {
    state.set({ seed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` });
    generate();
  });
  document.getElementById('resetRandomBtn').addEventListener('click', reset);
  document.getElementById('downloadRandomBtn').addEventListener('click', download);
  document.getElementById('printRandomBtn').addEventListener('click', print);
  return drawing;
}
