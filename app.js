import {
  RANDOM_MOTIFS,
  RANDOM_MOTIF_DESCRIPTIONS,
  RANDOM_SYMMETRIES,
  svgPath
} from './constants.js';

import {
  clamp,
  hashString,
  mulberry32,
  getPathCenterInViewBox
} from './utils.js';

import {
  parseViewBox,
  setFillValue,
  getColorableHexPaths,
  inferHexGridCoordinates
} from './svg-engine.js';

import {
  buildFixedPalette
} from './color-engine.js';

import {
  setStatus,
  updateColorCounts
} from './ui-engine.js';

import {
  drawImageToCanvas,
  applyColors
} from './image-engine.js';

import {
  getSymmetryConfig,
  getSymmetryKey,
  getMetricsForNode,
  resolveRandomFill
} from './pattern-engine.js';

// DOM Elements
const svgLayer = document.getElementById("svgLayer");
const imageInput = document.getElementById("imageInput");
const overlayCanvas = document.getElementById("overlayCanvas");
const opacityInput = document.getElementById("opacityInput");
const paletteSelect = document.getElementById("paletteSelect");
const ditherSelect = document.getElementById("ditherSelect");
const scaleInput = document.getElementById("scaleInput");
const canvasWrap = document.getElementById("canvasWrap");
const translateXInput = document.getElementById("translateXInput");
const translateYInput = document.getElementById("translateYInput");
const scaleValue = document.getElementById("scaleValue");
const translateXValue = document.getElementById("translateXValue");
const translateYValue = document.getElementById("translateYValue");
const applyBtn = document.getElementById("applyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const canvas = overlayCanvas;
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const colorCountsEl = document.createElement("div");
colorCountsEl.id = "colorCounts";
colorCountsEl.className = "status";
colorCountsEl.style.display = "flex";
colorCountsEl.style.flexWrap = "wrap";
colorCountsEl.style.justifyContent = "center";
colorCountsEl.style.gap = "8px";
colorCountsEl.style.marginTop = "8px";
statusEl.insertAdjacentElement("afterend", colorCountsEl);

// State
let originalSvgText = "";
let svgRoot = null;
let viewBox = { width: 0, height: 0 };
let currentImageUrl = "";
let sourceImage = null;
let imageReady = false;
let activePalette = [];
let layoutReady = false;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
let applyTimeout = null;
let ditherMode = "none";

const imageTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

// Functions
function updateStageAspect() {
  if (viewBox.width && viewBox.height) {
    canvasWrap.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
  }
}

function insertSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.id = "mandalaSvg";
  viewBox = parseViewBox(svg);
  updateStageAspect();

  svgLayer.innerHTML = "";
  svgRoot = document.importNode(svg, true);
  svgLayer.appendChild(svgRoot);
}

function handleApplyColors() {
  applyColors({
    svgRoot,
    imageReady,
    canvas,
    ctx,
    viewBox,
    ditherMode,
    activePalette,
    sourceImage,
    imageTransform,
    onStatusUpdate: (msg) => setStatus(statusEl, msg),
    onComplete: () => updateColorCounts(svgRoot, colorCountsEl, paletteSelect?.value)
  });
}

function scheduleApplyColors(delayMs = 150) {
  if (applyTimeout) {
    window.clearTimeout(applyTimeout);
  }
  applyTimeout = window.setTimeout(() => {
    applyTimeout = null;
    if (layoutReady) {
      handleApplyColors();
    } else {
      setStatus(statusEl, "Preparing layout...");
      requestAnimationFrame(() => {
        layoutReady = true;
        handleApplyColors();
      });
    }
  }, delayMs);
}

function loadImage(file) {
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }
  const img = new Image();
  currentImageUrl = URL.createObjectURL(file);
  img.onload = () => {
    sourceImage = img;
    canvas.width = viewBox.width;
    canvas.height = viewBox.height;
    scaleInput.value = "1";
    translateXInput.value = "0";
    translateYInput.value = "0";
    imageReady = true;
    updateTransformValues();
    setStatus(statusEl, "Image loaded. Applying colors...");
    scheduleApplyColors(0);
  };
  img.onerror = () => {
    imageReady = false;
    setStatus(statusEl, "Could not load that image.");
  };
  img.src = currentImageUrl;
}

function updateTransformValues() {
  imageTransform.scale = Number(scaleInput.value);
  imageTransform.translateX = Number(translateXInput.value);
  imageTransform.translateY = Number(translateYInput.value);
  scaleValue.textContent = `${Math.round(imageTransform.scale * 100)}%`;
  translateXValue.textContent = `${Math.round(imageTransform.translateX)}`;
  translateYValue.textContent = `${Math.round(imageTransform.translateY)}`;
  if (imageReady) {
    drawImageToCanvas(sourceImage, canvas, ctx, viewBox, imageTransform);
    scheduleApplyColors();
  }
}

function downloadSvg() {
  if (!svgRoot) {
    setStatus(statusEl, "SVG not loaded yet.");
    return;
  }
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgRoot);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mandala-colored.svg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(statusEl, "SVG downloaded.");
}

function resetSvg() {
  if (!originalSvgText) {
    setStatus(statusEl, "SVG not loaded yet.");
    return;
  }
  insertSvg(originalSvgText);
  if (imageReady) {
    canvas.width = viewBox.width;
    canvas.height = viewBox.height;
    drawImageToCanvas(sourceImage, canvas, ctx, viewBox, imageTransform);
  }
  setStatus(statusEl, "SVG reset to original colors.");
  updateColorCounts(svgRoot, colorCountsEl, paletteSelect?.value);
}

function applyRandomPatternFromControls() {
  if (!originalSvgText) {
    setStatus(statusEl, "SVG not loaded yet.");
    return;
  }
  insertSvg(originalSvgText);

  const seedInput = document.getElementById("randomSeedInput");
  const motifInput = document.getElementById("randomMotifSelect");
  const symmetryInput = document.getElementById("randomSymmetrySelect");
  const randomPaletteInput = document.getElementById("randomPaletteSelect");
  const contrastInput = document.getElementById("randomContrastInput");
  const whitenessInput = document.getElementById("randomWhitenessInput");
  
  const seedText = seedInput?.value || "mandala-random-001";
  const motif = motifInput?.value || "auto";
  const symmetry = getSymmetryConfig(symmetryInput?.value || "c6-mirror-vertex");
  const paletteMode = randomPaletteInput?.value || paletteSelect?.value || "purple";
  const contrast = Number(contrastInput?.value || 6);
  const whiteness = Number(whitenessInput?.value || 4);
  
  activePalette = buildFixedPalette(paletteMode);
  const colorPalette = activePalette.filter((entry) => entry.hex.toLowerCase() !== "#ffffff");
  const hashed = hashString(`${seedText}|${paletteMode}|${motif}|${symmetry.value}|${contrast}|${whiteness}`)();
  const rng = mulberry32(hashed);
  const motifKind = motif === "auto" ? RANDOM_MOTIFS[1 + Math.floor(rng() * (RANDOM_MOTIFS.length - 1))] : motif;
  const phases = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const biases = {
    ring: 0.85 + rng() * 0.45,
    angle: 0.8 + rng() * 0.9,
    accent: 0.55 + rng() * 0.6,
  };
  
  const paths = getColorableHexPaths(svgRoot);
  if (!paths.length) {
    setStatus(statusEl, "SVG loaded, but no colorable hexagons were found.");
    return;
  }
  const center = { x: viewBox.width / 2, y: viewBox.height / 2 };
  const maxRadius = Math.min(viewBox.width, viewBox.height) * 0.5 || 1;
  const nodes = paths.map((path) => {
    const point = getPathCenterInViewBox(path, svgRoot, viewBox);
    return { path, x: point.x, y: point.y, q: 0, r: 0 };
  });

  inferHexGridCoordinates(nodes, viewBox);

  const fillByKey = new Map();
  for (const node of nodes) {
    const key = getSymmetryKey(node, center, maxRadius, symmetry);
    if (!fillByKey.has(key)) {
      const metrics = getMetricsForNode(node, center, maxRadius, symmetry);
      fillByKey.set(key, resolveRandomFill(metrics, motifKind, phases, biases, colorPalette, contrast, whiteness));
    }
    setFillValue(node.path, fillByKey.get(key));
  }

  setStatus(statusEl, `Randomized ${nodes.length} hexagons with ${motifKind} motif.`);
  updateColorCounts(svgRoot, colorCountsEl, paletteSelect?.value);
}

function createTabbedControls() {
  const controls = document.querySelector(".controls");
  if (!controls || document.getElementById("controlTabs")) {
    return;
  }

  if (!document.getElementById("randomPrintStyles")) {
    const style = document.createElement("style");
    style.id = "randomPrintStyles";
    style.textContent = `
      @page { size: A4 portrait; margin: 0; }
      @media print {
        .hero, .controls, .status, #overlayCanvas { display: none !important; }
        .page, .panel, .stage, .canvas-wrap { display: block !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; box-shadow: none !important; background: #fff !important; }
        .canvas-wrap { width: 210mm !important; border-radius: 0 !important; overflow: visible !important; }
        #svgLayer svg { width: 210mm !important; height: 297mm !important; }
      }
    `;
    document.head.appendChild(style);
  }

  const imagePanel = document.createElement("div");
  imagePanel.id = "imageTabPanel";
  imagePanel.className = "tab-panel";
  while (controls.firstChild) {
    imagePanel.appendChild(controls.firstChild);
  }

  const randomPanel = document.createElement("div");
  randomPanel.id = "randomTabPanel";
  randomPanel.className = "tab-panel";
  randomPanel.hidden = true;
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
    </div>
    </fieldset>
  `;
  const tabButtons = document.createElement("div");
  tabButtons.id = "controlTabs";
  tabButtons.className = "buttons";
  tabButtons.innerHTML = `
    <button id="imageTabBtn" type="button" aria-pressed="true">Image</button>
    <button id="randomTabBtn" type="button" aria-pressed="false">Random</button>
  `;

  controls.appendChild(tabButtons);
  controls.appendChild(imagePanel);
  controls.appendChild(randomPanel);

  const randomFieldset = document.getElementById("randomPatternControls");
  randomFieldset.style.border = "1px solid var(--panel-edge)";
  randomFieldset.style.borderRadius = "16px";
  randomFieldset.style.padding = "14px";
  randomFieldset.querySelectorAll("label").forEach((label) => {
    label.style.display = "grid";
    label.style.gap = "8px";
    label.style.marginTop = "10px";
  });
  randomFieldset.querySelectorAll("input[type='text'], select").forEach((input) => {
    input.style.border = "1px solid var(--panel-edge)";
    input.style.borderRadius = "12px";
    input.style.padding = "10px 12px";
  });
  tabButtons.querySelectorAll("button").forEach((button) => {
    button.style.background = "var(--panel-edge)";
    button.style.color = "var(--ink)";
  });
  document.getElementById("imageTabBtn").style.background = "var(--accent)";
  document.getElementById("imageTabBtn").style.color = "#fff";

  const setActiveTab = (tab) => {
    const imageActive = tab === "image";
    imagePanel.hidden = !imageActive;
    randomPanel.hidden = imageActive;
    document.getElementById("imageTabBtn").setAttribute("aria-pressed", `${imageActive}`);
    document.getElementById("randomTabBtn").setAttribute("aria-pressed", `${!imageActive}`);
    document.getElementById("imageTabBtn").style.background = imageActive ? "var(--accent)" : "var(--panel-edge)";
    document.getElementById("imageTabBtn").style.color = imageActive ? "#fff" : "var(--ink)";
    document.getElementById("randomTabBtn").style.background = imageActive ? "var(--panel-edge)" : "var(--accent)";
    document.getElementById("randomTabBtn").style.color = imageActive ? "var(--ink)" : "#fff";
    overlayCanvas.style.display = imageActive ? "" : "none";
    if (!imageActive) {
      if (originalSvgText) {
        insertSvg(originalSvgText);
        layoutReady = false;
        requestAnimationFrame(() => {
          layoutReady = true;
        });
        if (imageReady) {
          canvas.width = viewBox.width;
          canvas.height = viewBox.height;
          drawImageToCanvas(sourceImage, canvas, ctx, viewBox, imageTransform);
        }
      }
    }
  };

  const bindValue = (inputId, valueId, format = (value) => value) => {
    const input = document.getElementById(inputId);
    const value = document.getElementById(valueId);
    input?.addEventListener("input", () => {
      value.textContent = format(input.value);
    });
  };

  bindValue("randomContrastInput", "randomContrastValue");
  bindValue("randomWhitenessInput", "randomWhitenessValue");
  const motifSelect = document.getElementById("randomMotifSelect");
  const motifDescription = document.getElementById("randomMotifDescription");
  const updateMotifDescription = () => {
    motifDescription.textContent = RANDOM_MOTIF_DESCRIPTIONS[motifSelect.value] || "";
  };
  motifSelect?.addEventListener("change", updateMotifDescription);
  updateMotifDescription();
  const randomPaletteSelect = document.getElementById("randomPaletteSelect");
  if (randomPaletteSelect) {
    randomPaletteSelect.value = paletteSelect.value;
    randomPaletteSelect.addEventListener("change", (event) => {
      paletteSelect.value = event.target.value;
      activePalette = buildFixedPalette(event.target.value);
    });
  }
  document.getElementById("imageTabBtn")?.addEventListener("click", () => setActiveTab("image"));
  document.getElementById("randomTabBtn")?.addEventListener("click", () => setActiveTab("random"));
  document.getElementById("generatePatternBtn")?.addEventListener("click", applyRandomPatternFromControls);
  document.getElementById("randomPatternBtn")?.addEventListener("click", () => {
    const seedInput = document.getElementById("randomSeedInput");
    if (seedInput) {
      seedInput.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
    applyRandomPatternFromControls();
  });
  document.getElementById("resetRandomBtn")?.addEventListener("click", resetSvg);
  document.getElementById("downloadRandomBtn")?.addEventListener("click", downloadSvg);
}

// Event Listeners
opacityInput.addEventListener("input", (event) => {
  overlayCanvas.style.opacity = event.target.value;
});

paletteSelect.addEventListener("change", (event) => {
  activePalette = buildFixedPalette(event.target.value);
  const randomPaletteSelect = document.getElementById("randomPaletteSelect");
  if (randomPaletteSelect) {
    randomPaletteSelect.value = event.target.value;
  }
  if (imageReady) {
    scheduleApplyColors();
  }
});

ditherSelect.addEventListener("change", (event) => {
  ditherMode = event.target.value;
  if (imageReady) {
    scheduleApplyColors();
  }
});

scaleInput.addEventListener("input", updateTransformValues);
translateXInput.addEventListener("input", updateTransformValues);
translateYInput.addEventListener("input", updateTransformValues);

overlayCanvas.addEventListener("pointerdown", (event) => {
  if (!imageReady) {
    return;
  }
  isDragging = true;
  overlayCanvas.setPointerCapture(event.pointerId);
  overlayCanvas.style.cursor = "grabbing";
  lastPointer = { x: event.clientX, y: event.clientY };
});

overlayCanvas.addEventListener("pointermove", (event) => {
  if (!isDragging || !svgRoot) {
    return;
  }
  const svgRect = svgRoot.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height) {
    return;
  }
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  const dxView = (dx / svgRect.width) * viewBox.width;
  const dyView = (dy / svgRect.height) * viewBox.height;
  const nextX = clamp(
    Number(translateXInput.value) + dxView,
    Number(translateXInput.min),
    Number(translateXInput.max)
  );
  const nextY = clamp(
    Number(translateYInput.value) + dyView,
    Number(translateYInput.min),
    Number(translateYInput.max)
  );
  translateXInput.value = `${nextX}`;
  translateYInput.value = `${nextY}`;
  updateTransformValues();
});

function endDrag(event) {
  if (!isDragging) {
    return;
  }
  isDragging = false;
  overlayCanvas.style.cursor = "grab";
  if (event && overlayCanvas.hasPointerCapture(event.pointerId)) {
    overlayCanvas.releasePointerCapture(event.pointerId);
  }
}

overlayCanvas.addEventListener("pointerup", endDrag);
overlayCanvas.addEventListener("pointercancel", endDrag);
overlayCanvas.addEventListener("pointerleave", endDrag);
overlayCanvas.addEventListener(
  "wheel",
  (event) => {
    if (!imageReady) {
      return;
    }
    event.preventDefault();
    const scaleMin = Number(scaleInput.min);
    const scaleMax = Number(scaleInput.max);
    const current = Number(scaleInput.value);
    const factor = 1 - event.deltaY * 0.001;
    const next = clamp(current * factor, scaleMin, scaleMax);
    scaleInput.value = `${next}`;
    updateTransformValues();
  },
  { passive: false }
);

imageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  loadImage(file);
});

window.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items;
  if (!items) {
    return;
  }
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        loadImage(file);
      }
      break;
    }
  }
});

canvasWrap.addEventListener("dragover", (event) => {
  event.preventDefault();
});

canvasWrap.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file || !file.type.startsWith("image/")) {
    return;
  }
  loadImage(file);
});

applyBtn.addEventListener("click", handleApplyColors);
resetBtn.addEventListener("click", resetSvg);
downloadBtn.addEventListener("click", downloadSvg);

// Init
async function init() {
  try {
    createTabbedControls();
    const response = await fetch(encodeURI(svgPath));
    if (!response.ok) {
      throw new Error("Failed to load SVG.");
    }
    originalSvgText = await response.text();
    insertSvg(originalSvgText);
    activePalette = buildFixedPalette(paletteSelect?.value);
    ditherMode = ditherSelect?.value || "none";
    
    const translateRangeX = Math.round(viewBox.width * 0.35);
    const translateRangeY = Math.round(viewBox.height * 0.35);
    translateXInput.min = -translateRangeX;
    translateXInput.max = translateRangeX;
    translateYInput.min = -translateRangeY;
    translateYInput.max = translateRangeY;
    
    updateTransformValues();
    requestAnimationFrame(() => {
      layoutReady = true;
    });
    setStatus(statusEl, "SVG loaded. Upload an image to begin.");
    updateColorCounts(svgRoot, colorCountsEl, paletteSelect?.value);
  } catch (error) {
    console.error(error);
    setStatus(statusEl, "Could not load the SVG file.");
  }
}

init();
