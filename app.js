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

const svgPath = "data/onepage_model.svg";
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const DITHER_STRENGTH = 48;
const palettes = {
  purple: [
    { name: "azure blue", hex: "#1496dc" },
    { name: "royal purple", hex: "#6432aa" },
    { name: "white", hex: "#ffffff" },
    { name: "crimson red", hex: "#eb0000" },
    { name: "vermilion orange", hex: "#ff6e32" },
    { name: "golden yellow", hex: "#ffe100" },
  ],
  blue: [
    { name: "azure blue", hex: "#1496dc" },
    { name: "blue", hex: "#0000ff" },
    { name: "white", hex: "#ffffff" },
    { name: "crimson red", hex: "#eb0000" },
    { name: "vermilion orange", hex: "#ff6e32" },
    { name: "golden yellow", hex: "#ffe100" },
  ],
};
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
let ditheredBuffer = null;
const imageTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

function setStatus(message) {
  statusEl.textContent = message;
}

function parseViewBox(svg) {
  const viewBoxAttr = svg.getAttribute("viewBox");
  if (!viewBoxAttr) {
    return { width: Number(svg.getAttribute("width")) || 0, height: Number(svg.getAttribute("height")) || 0 };
  }
  const parts = viewBoxAttr.split(/\s+/).map(Number);
  return { width: parts[2] || 0, height: parts[3] || 0 };
}

function updateStageAspect() {
  const wrap = document.getElementById("canvasWrap");
  if (viewBox.width && viewBox.height) {
    wrap.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
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

function getFillValue(el) {
  const style = el.getAttribute("style");
  if (style) {
    const parts = style.split(";").map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      const [key, value] = part.split(":");
      if (key && key.trim() === "fill") {
        return value.trim();
      }
    }
  }
  const fill = el.getAttribute("fill");
  return fill ? fill.trim() : "";
}

function setFillValue(el, color) {
  const style = el.getAttribute("style");
  if (style) {
    const parts = style.split(";").map((part) => part.trim()).filter(Boolean);
    let found = false;
    const next = parts.map((part) => {
      const [key, value] = part.split(":");
      if (key && key.trim() === "fill") {
        found = true;
        return `fill:${color}`;
      }
      return value ? `${key}:${value}` : part;
    });
    if (!found) {
      next.push(`fill:${color}`);
    }
    el.setAttribute("style", `${next.join(";")};`);
  } else {
    el.setAttribute("fill", color);
  }
}

function normalizeHex(hex) {
  const value = hex.replace("#", "").trim();
  if (value.length === 3) {
    return `#${value
      .split("")
      .map((part) => part + part)
      .join("")}`.toLowerCase();
  }
  if (value.length === 6) {
    return `#${value}`.toLowerCase();
  }
  return "";
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex).replace("#", "");
  if (!normalized) {
    return null;
  }
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function buildFixedPalette(mode) {
  const palette = palettes[mode] || palettes.purple;
  return palette
    .map((entry) => {
      const rgb = hexToRgb(entry.hex);
      return rgb ? { ...entry, ...rgb } : null;
    })
    .filter(Boolean);
}

function setPalette(mode) {
  activePalette = buildFixedPalette(mode);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nearestPaletteEntry(r, g, b) {
  if (!activePalette.length) {
    return { name: "white", hex: "#ffffff", r: 255, g: 255, b: 255 };
  }
  let closest = activePalette[0];
  let closestDist = Number.POSITIVE_INFINITY;
  for (const color of activePalette) {
    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < closestDist) {
      closestDist = dist;
      closest = color;
    }
  }
  return closest;
}

function orderedDitherOffset(x, y) {
  const size = BAYER_4X4.length;
  const value = BAYER_4X4[y % size][x % size];
  const normalized = value / (size * size) - 0.5;
  return normalized * DITHER_STRENGTH;
}

function buildFloydSteinbergBuffer() {
  const width = canvas.width;
  const height = canvas.height;
  if (!width || !height) {
    return null;
  }
  const data = ctx.getImageData(0, 0, width, height).data;
  const count = width * height;
  const workR = new Float32Array(count);
  const workG = new Float32Array(count);
  const workB = new Float32Array(count);
  const workA = new Uint8ClampedArray(count);
  for (let i = 0; i < count; i += 1) {
    const offset = i * 4;
    workR[i] = data[offset];
    workG[i] = data[offset + 1];
    workB[i] = data[offset + 2];
    workA[i] = data[offset + 3];
  }
  const output = new Uint8ClampedArray(count * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const alpha = workA[idx];
      if (alpha === 0) {
        const outOffset = idx * 4;
        output[outOffset] = 255;
        output[outOffset + 1] = 255;
        output[outOffset + 2] = 255;
        output[outOffset + 3] = 0;
        continue;
      }
      const entry = nearestPaletteEntry(workR[idx], workG[idx], workB[idx]);
      const outOffset = idx * 4;
      output[outOffset] = entry.r;
      output[outOffset + 1] = entry.g;
      output[outOffset + 2] = entry.b;
      output[outOffset + 3] = alpha;
      const errR = workR[idx] - entry.r;
      const errG = workG[idx] - entry.g;
      const errB = workB[idx] - entry.b;
      const right = x + 1;
      const down = y + 1;
      if (right < width) {
        const i1 = idx + 1;
        workR[i1] += errR * (7 / 16);
        workG[i1] += errG * (7 / 16);
        workB[i1] += errB * (7 / 16);
      }
      if (down < height) {
        const i2 = idx + width;
        workR[i2] += errR * (5 / 16);
        workG[i2] += errG * (5 / 16);
        workB[i2] += errB * (5 / 16);
        if (x > 0) {
          const i3 = idx + width - 1;
          workR[i3] += errR * (3 / 16);
          workG[i3] += errG * (3 / 16);
          workB[i3] += errB * (3 / 16);
        }
        if (right < width) {
          const i4 = idx + width + 1;
          workR[i4] += errR * (1 / 16);
          workG[i4] += errG * (1 / 16);
          workB[i4] += errB * (1 / 16);
        }
      }
    }
  }
  return { data: output, width, height };
}

function sampleColorAt(x, y) {
  const ix = Math.max(0, Math.min(Math.round(x), canvas.width - 1));
  const iy = Math.max(0, Math.min(Math.round(y), canvas.height - 1));
  if (ditherMode === "floyd-steinberg" && ditheredBuffer) {
    const offset = (iy * ditheredBuffer.width + ix) * 4;
    const alpha = ditheredBuffer.data[offset + 3];
    if (alpha === 0) {
      return "#ffffff";
    }
    const entry = nearestPaletteEntry(
      ditheredBuffer.data[offset],
      ditheredBuffer.data[offset + 1],
      ditheredBuffer.data[offset + 2]
    );
    return entry.hex;
  }
  const data = ctx.getImageData(ix, iy, 1, 1).data;
  if (data[3] === 0) {
    return "#ffffff";
  }
  let r = data[0];
  let g = data[1];
  let b = data[2];
  if (ditherMode === "ordered") {
    const offset = orderedDitherOffset(ix, iy);
    r = clamp(r + offset, 0, 255);
    g = clamp(g + offset, 0, 255);
    b = clamp(b + offset, 0, 255);
  }
  return nearestPaletteEntry(r, g, b).hex;
}

function getPathCenterInViewBox(path) {
  const svgRect = svgRoot.getBoundingClientRect();
  const pathRect = path.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height) {
    return { x: 0, y: 0 };
  }
  const centerX = pathRect.left + pathRect.width / 2;
  const centerY = pathRect.top + pathRect.height / 2;
  const relX = (centerX - svgRect.left) / svgRect.width;
  const relY = (centerY - svgRect.top) / svgRect.height;
  return {
    x: relX * viewBox.width,
    y: relY * viewBox.height,
  };
}

function applyColors() {
  if (!svgRoot) {
    setStatus("SVG not loaded yet.");
    return;
  }
  if (!imageReady) {
    setStatus("Load an image before applying colors.");
    return;
  }
  if (!canvas.width || !canvas.height) {
    setStatus("Image not ready yet.");
    return;
  }
  const svgRect = svgRoot.getBoundingClientRect();
  if (!svgRect.width || !svgRect.height || !layoutReady) {
    setStatus("Preparing layout...");
    requestAnimationFrame(() => {
      layoutReady = true;
      applyColors();
    });
    return;
  }
  drawImageToCanvas();
  ditheredBuffer = null;
  if (ditherMode === "floyd-steinberg") {
    ditheredBuffer = buildFloydSteinbergBuffer();
  }

  const paths = svgRoot.querySelectorAll("path");
  const toRecolor = [];
  let updated = 0;

  paths.forEach((path) => {
    const fill = getFillValue(path);
    if (fill && fill.toLowerCase() !== "none") {
      toRecolor.push(path);
    }
    setFillValue(path, "#ffffff");
  });

  toRecolor.forEach((path) => {
    const { x: cx, y: cy } = getPathCenterInViewBox(path);
    const color = sampleColorAt(cx, cy);
    setFillValue(path, color);
    updated += 1;
  });

  setStatus(`Updated ${updated} filled hexagons (white base applied).`);
}

function scheduleApplyColors(delayMs = 150) {
  if (applyTimeout) {
    window.clearTimeout(applyTimeout);
  }
  applyTimeout = window.setTimeout(() => {
    applyTimeout = null;
    applyColors();
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
    setStatus("Image loaded. Applying colors...");
    scheduleApplyColors(0);
  };
  img.onerror = () => {
    imageReady = false;
    setStatus("Could not load that image.");
  };
  img.src = currentImageUrl;
}

function drawImageToCanvas() {
  if (!sourceImage || !canvas.width || !canvas.height) {
    return;
  }
  const baseScale = Math.max(
    viewBox.width / sourceImage.width,
    viewBox.height / sourceImage.height
  );
  const baseWidth = sourceImage.width * baseScale;
  const baseHeight = sourceImage.height * baseScale;
  const centerX = viewBox.width / 2 + imageTransform.translateX;
  const centerY = viewBox.height / 2 + imageTransform.translateY;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(baseScale * imageTransform.scale, baseScale * imageTransform.scale);
  ctx.drawImage(sourceImage, -sourceImage.width / 2, -sourceImage.height / 2);
  ctx.restore();
}

function updateTransformValues() {
  imageTransform.scale = Number(scaleInput.value);
  imageTransform.translateX = Number(translateXInput.value);
  imageTransform.translateY = Number(translateYInput.value);
  scaleValue.textContent = `${Math.round(imageTransform.scale * 100)}%`;
  translateXValue.textContent = `${Math.round(imageTransform.translateX)}`;
  translateYValue.textContent = `${Math.round(imageTransform.translateY)}`;
  if (imageReady) {
    drawImageToCanvas();
    scheduleApplyColors();
  }
}

function downloadSvg() {
  if (!svgRoot) {
    setStatus("SVG not loaded yet.");
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
  setStatus("SVG downloaded.");
}

function resetSvg() {
  if (!originalSvgText) {
    setStatus("SVG not loaded yet.");
    return;
  }
  insertSvg(originalSvgText);
  setStatus("SVG reset to original colors.");
}

opacityInput.addEventListener("input", (event) => {
  overlayCanvas.style.opacity = event.target.value;
});

paletteSelect.addEventListener("change", (event) => {
  setPalette(event.target.value);
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

applyBtn.addEventListener("click", applyColors);
resetBtn.addEventListener("click", resetSvg);
downloadBtn.addEventListener("click", downloadSvg);

async function init() {
  try {
    const response = await fetch(encodeURI(svgPath));
    if (!response.ok) {
      throw new Error("Failed to load SVG.");
    }
    originalSvgText = await response.text();
    insertSvg(originalSvgText);
    setPalette(paletteSelect?.value);
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
    setStatus("SVG loaded. Upload an image to begin.");
  } catch (error) {
    setStatus("Could not load the SVG file.");
  }
}

init();
