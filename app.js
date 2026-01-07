const svgLayer = document.getElementById("svgLayer");
const imageInput = document.getElementById("imageInput");
const overlayCanvas = document.getElementById("overlayCanvas");
const opacityInput = document.getElementById("opacityInput");
const paletteSelect = document.getElementById("paletteSelect");
const scaleInput = document.getElementById("scaleInput");
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

const svgPath = "data/onepage clean.svg";
const fixedPalette = [
  { name: "red", hex: "#e53935" },
  { name: "blue", hex: "#1e88e5" },
  { name: "orange", hex: "#fb8c00" },
  { name: "lightblue", hex: "#4fc3f7" },
  { name: "yellow", hex: "#fdd835" },
  { name: "white", hex: "#ffffff" },
];
let originalSvgText = "";
let svgRoot = null;
let viewBox = { width: 0, height: 0 };
let currentImageUrl = "";
let sourceImage = null;
let imageReady = false;
let svgPalette = [];
let paletteRgb = fixedPalette.map((entry) => ({
  ...entry,
  ...hexToRgb(entry.hex),
}));
let layoutReady = false;
let isDragging = false;
let lastPointer = { x: 0, y: 0 };
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

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
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

function parseRgbString(value) {
  const match = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (!match) {
    return null;
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
}

function colorToRgb(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    return hexToRgb(trimmed);
  }
  if (trimmed.toLowerCase().startsWith("rgb")) {
    return parseRgbString(trimmed);
  }
  return null;
}

function buildPaletteFromSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const paths = doc.querySelectorAll("path");
  const colors = new Map();
  paths.forEach((path) => {
    const fill = getFillValue(path);
    if (!fill || fill.toLowerCase() === "none") {
      return;
    }
    const rgb = colorToRgb(fill);
    if (!rgb) {
      return;
    }
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b).toLowerCase();
    colors.set(hex, { name: hex, hex, ...rgb });
  });
  return Array.from(colors.values());
}

function setPalette(mode) {
  if (mode === "svg" && svgPalette.length) {
    paletteRgb = svgPalette;
  } else {
    paletteRgb = fixedPalette
      .map((entry) => {
        const rgb = hexToRgb(entry.hex);
        return rgb ? { ...entry, ...rgb } : null;
      })
      .filter(Boolean);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function nearestPaletteColor(r, g, b) {
  if (!paletteRgb.length) {
    return "#ffffff";
  }
  let closest = paletteRgb[0];
  let closestDist = Number.POSITIVE_INFINITY;
  for (const color of paletteRgb) {
    const dr = r - color.r;
    const dg = g - color.g;
    const db = b - color.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < closestDist) {
      closestDist = dist;
      closest = color;
    }
  }
  return closest.hex;
}

function sampleColorAt(x, y) {
  const ix = Math.max(0, Math.min(Math.round(x), canvas.width - 1));
  const iy = Math.max(0, Math.min(Math.round(y), canvas.height - 1));
  const data = ctx.getImageData(ix, iy, 1, 1).data;
  if (data[3] === 0) {
    return "#ffffff";
  }
  return nearestPaletteColor(data[0], data[1], data[2]);
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
    setStatus("Image loaded. Ready to apply colors.");
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

imageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
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
    svgPalette = buildPaletteFromSvg(originalSvgText);
    setPalette(paletteSelect.value);
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
