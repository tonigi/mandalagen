import { bindImageControls } from './image-controls.js';
import { svgPath } from './constants.js';
import { parseViewBox } from './svg-engine.js';
import { buildFixedPalette } from './color-engine.js';
import { setStatus, updateColorCounts } from './ui-engine.js';
import { drawImageToCanvas, applyColors } from './image-engine.js';
import { generatePattern } from './pattern-engine.js';
import { createBoardModel } from './board-model.js';
import { createAppState } from './app-state.js';
import { createControls } from './controls.js';

const state = createAppState();
let board = null;

// DOM Elements
const svgLayer = document.getElementById("svgLayer");
const imageInput = document.getElementById("imageInput");
const overlayCanvas = document.getElementById("overlayCanvas");
const opacityInput = document.getElementById("opacityInput");
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
const printBtn = document.getElementById("printBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const canvas = overlayCanvas;
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const colorCountsEl = document.createElement("div");
colorCountsEl.id = "colorCounts";
colorCountsEl.className = "status";
statusEl.insertAdjacentElement("afterend", colorCountsEl);

// State
let originalSvgText = "";
let svgRoot = null;
let viewBox = { width: 0, height: 0 };
let currentImageUrl = "";
let sourceImage = null;
let imageReady = false;
let layoutReady = false;
let applyTimeout = null;
let ditherMode = "none";
let drawing;
let imageLoadVersion = 0;

function cancelPendingApply() {
  window.clearTimeout(applyTimeout);
  applyTimeout = null;
}

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
  board = createBoardModel(svgRoot, viewBox);
  drawing?.updateButtons();
}

function handleApplyColors() {
  if (state.value.activeTab !== "image") return;
  drawing?.clearHistory();
  applyColors({
    board,
    imageReady,
    canvas,
    ctx,
    viewBox,
    ditherMode,
    activePalette: buildFixedPalette(state.value.palette),
    sourceImage,
    imageTransform,
    onStatusUpdate: (msg) => setStatus(statusEl, msg),
    onComplete: () => updateColorCounts(board, colorCountsEl, state.value.palette)
  });
}

function scheduleApplyColors(delayMs = 150) {
  if (applyTimeout) {
    window.clearTimeout(applyTimeout);
  }
  applyTimeout = window.setTimeout(() => {
    applyTimeout = null;
    if (state.value.activeTab !== "image") return;
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
  const version = ++imageLoadVersion;
  cancelPendingApply();
  if (currentImageUrl) {
    URL.revokeObjectURL(currentImageUrl);
  }
  const img = new Image();
  currentImageUrl = URL.createObjectURL(file);
  img.onload = () => {
    if (version !== imageLoadVersion) return;
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
    if (version !== imageLoadVersion) return;
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
  cancelPendingApply();
  drawing?.clearHistory();
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
  updateColorCounts(board, colorCountsEl, state.value.palette);
}

function applyRandomPatternFromControls() {
  cancelPendingApply();
  drawing?.clearHistory();
  if (!originalSvgText) {
    setStatus(statusEl, "SVG not loaded yet.");
    return;
  }
  insertSvg(originalSvgText);

  if (!board.cells.length) {
    setStatus(statusEl, "SVG loaded, but no colorable hexagons were found.");
    return;
  }
  const motifKind = generatePattern(board, state.value);
  setStatus(statusEl, `Randomized ${board.cells.length} hexagons with ${motifKind} motif.`);
  updateColorCounts(board, colorCountsEl, state.value.palette);
}

// UI wiring. Image controls hold only transient pointer state.
const imageControls = bindImageControls({
  overlayCanvas, canvasWrap, imageInput, opacityInput, ditherSelect,
  scaleInput, translateXInput, translateYInput,
  isReady: () => imageReady, getSvg: () => svgRoot, getViewBox: () => viewBox,
  onTransform: updateTransformValues, onImage: loadImage,
  onDither: value => { ditherMode = value; if (imageReady) scheduleApplyColors(); },
});

printBtn.addEventListener("click", () => window.print());

state.subscribe((value, previous) => {
  if (value.palette !== previous.palette && imageReady && value.activeTab === 'image') scheduleApplyColors();
});


applyBtn.addEventListener("click", handleApplyColors);
resetBtn.addEventListener("click", resetSvg);
downloadBtn.addEventListener("click", downloadSvg);

// Init
async function init() {
  try {
    drawing = createControls({
      state, svgLayer, overlayCanvas, getBoard: () => board,
      onChange: () => updateColorCounts(board, colorCountsEl, state.value.palette),
      onModeChange: () => { cancelPendingApply(); imageControls.endDrag(); },
      generate: applyRandomPatternFromControls, reset: resetSvg,
      download: downloadSvg, print: () => window.print(),
    });
    const response = await fetch(encodeURI(svgPath));
    if (!response.ok) {
      throw new Error("Failed to load SVG.");
    }
    originalSvgText = await response.text();
    insertSvg(originalSvgText);
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
    updateColorCounts(board, colorCountsEl, state.value.palette);
  } catch (error) {
    console.error(error);
    setStatus(statusEl, "Could not load the SVG file.");
  }
}

init();
