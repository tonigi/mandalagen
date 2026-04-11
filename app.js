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

const RANDOM_MOTIFS = ["auto", "flower", "star", "ribbons", "diamonds", "petals", "mosaic"];
const RANDOM_SYMMETRIES = [
  { value: "c6-mirror-vertex", label: "C6 mirrored through vertices", order: 6, offset: 0, mirror: true },
  { value: "c6-mirror-side", label: "C6 mirrored through sides", order: 6, offset: Math.PI / 6, mirror: true },
  { value: "c6", label: "C6 rotational", order: 6, offset: 0, mirror: false },
  { value: "c3-vertex", label: "C3 through vertices", order: 3, offset: 0, mirror: true },
  { value: "c3-side", label: "C3 through sides", order: 3, offset: Math.PI / 3, mirror: true },
  { value: "c3", label: "C3 rotational", order: 3, offset: 0, mirror: false },
  { value: "c2-vertex", label: "C2 through vertices", order: 2, offset: 0, mirror: true },
  { value: "c2-side", label: "C2 through sides", order: 2, offset: Math.PI / 6, mirror: true },
  { value: "c2", label: "C2 rotational", order: 2, offset: 0, mirror: false },
  { value: "none", label: "No enforced symmetry", order: 1, offset: 0, mirror: false },
];
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

function hashString(input) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function clamp01(v) {
  return clamp(v, 0, 1);
}

function randomMotifValue(kind, metrics, phases) {
  const { radial, angleNorm, mirrorNorm, ring, q, r, theta } = metrics;
  const [p1, p2, p3, p4] = phases;

  const flower =
    0.62 * Math.cos(mirrorNorm * Math.PI * 3 + p1) +
    0.45 * Math.sin(radial * 11 + p2) +
    0.25 * Math.cos(ring * 0.82 + p3);

  const star =
    0.72 * Math.cos(angleNorm * Math.PI * 2 + p1) * (1 - radial * 0.6) +
    0.35 * Math.sin(radial * 14 + p2) +
    0.2 * Math.cos(ring * 0.75 + p3);

  const ribbons =
    0.45 * Math.sin((q - r) * 0.82 + p1) +
    0.4 * Math.cos((q + 2 * r) * 0.55 + p2) +
    0.3 * Math.sin(angleNorm * Math.PI * 5 + radial * 8 + p3);

  const diamonds =
    0.45 * Math.cos((q + r) * 0.82 + p1) +
    0.45 * Math.cos((q - r) * 0.82 + p2) +
    0.32 * Math.cos(mirrorNorm * Math.PI * 6 + radial * 7 + p3);

  const petals =
    0.62 * Math.cos(mirrorNorm * Math.PI * 5 + p1) * (1 - radial * 0.35) +
    0.4 * Math.cos(radial * 9 + p2) +
    0.25 * Math.cos(angleNorm * Math.PI * 4 + p3);

  const mosaic =
    0.35 * Math.sin(q * 0.92 + p1) +
    0.35 * Math.cos(r * 0.9 + p2) +
    0.2 * Math.sin((q + r) * 0.63 + p3) +
    0.18 * Math.cos(radial * 15 + p4);

  if (kind === "flower") return flower;
  if (kind === "star") return star;
  if (kind === "ribbons") return ribbons;
  if (kind === "diamonds") return diamonds;
  if (kind === "petals") return petals;
  if (kind === "mosaic") return mosaic;

  return 0.32 * flower + 0.28 * star + 0.2 * ribbons + 0.2 * diamonds;
}

function inferHexGridCoordinates(nodes) {
  const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  let rowIndex = -1;
  let currentRowY = Number.NEGATIVE_INFINITY;
  const rowTolerance = viewBox.height * 0.006;

  for (const node of sorted) {
    if (Math.abs(node.y - currentRowY) > rowTolerance) {
      rowIndex += 1;
      currentRowY = node.y;
    }
    node.r = rowIndex;
  }

  const rows = new Map();
  for (const node of sorted) {
    if (!rows.has(node.r)) rows.set(node.r, []);
    rows.get(node.r).push(node);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.x - b.x);
    row.forEach((node, index) => {
      node.q = index - Math.floor(row.length / 2);
    });
  }
}

function getColorableHexPaths() {
  if (!svgRoot) return [];
  return Array.from(svgRoot.querySelectorAll("path")).filter((path) => {
    const fill = getFillValue(path);
    return fill && fill.toLowerCase() !== "none";
  });
}

function getSymmetryConfig(value) {
  return RANDOM_SYMMETRIES.find((entry) => entry.value === value) || RANDOM_SYMMETRIES[0];
}

function getSymmetryCoordinates(theta, symmetry) {
  const period = (Math.PI * 2) / symmetry.order;
  const local = mod(theta - symmetry.offset, period);
  const canonical = symmetry.mirror ? Math.min(local, period - local) : local;
  return {
    angleNorm: period ? canonical / period : 0,
    mirrorNorm: symmetry.mirror && period ? canonical / (period / 2) : canonical / period,
  };
}

function getSymmetryKey(node, center, maxRadius, symmetry) {
  const dx = node.x - center.x;
  const dy = node.y - center.y;
  const theta = Math.atan2(dy, dx);
  const radialBucket = Math.round((Math.hypot(dx, dy) / maxRadius) * 120);
  const coords = getSymmetryCoordinates(theta, symmetry);
  const angleBucket = Math.round(coords.angleNorm * 120);
  return `${radialBucket}:${angleBucket}`;
}

function resolveRandomFillForKey(key, motifKind, phases, biases, colorPalette, contrast, whiteness, symmetry) {
  const [radialBucket, angleBucket] = key.split(":").map(Number);
  const radial = clamp01(radialBucket / 120);
  const angleNorm = clamp01(angleBucket / 120);
  const mirrorNorm = symmetry.mirror ? clamp01(angleNorm * 2) : angleNorm;
  const ring = radialBucket;
  const q = Math.round(angleNorm * 30);
  const r = radialBucket - q;
  const theta = angleNorm * ((Math.PI * 2) / symmetry.order);
  const metrics = { radial, angleNorm, mirrorNorm, ring, q, r, theta };
  const value = randomMotifValue(motifKind, metrics, phases);
  const bias =
    0.15 * Math.cos(radial * 10 * biases.ring + phases[0]) +
    0.15 * Math.sin(angleNorm * Math.PI * 4 * biases.angle + phases[1]);
  const normalized = clamp01(0.5 + 0.5 * Math.tanh((value + bias) * (1.15 + contrast * 0.18)));
  const colorIndex = Math.min(colorPalette.length - 1, Math.floor(normalized * colorPalette.length));
  const accentField =
    Math.abs(
      Math.sin(ring * 0.95 * biases.accent + mirrorNorm * Math.PI * 5 + phases[2]) +
        0.35 * Math.cos(radial * 18 + phases[3])
    ) / 1.35;
  const makeWhite = radial < 0.08 || (radial < 0.93 && accentField > 0.84 - whiteness * 0.035);
  return makeWhite ? "#ffffff" : colorPalette[colorIndex].hex;
}

function applyRandomPatternFromControls() {
  if (!originalSvgText) {
    setStatus("SVG not loaded yet.");
    return;
  }
  insertSvg(originalSvgText);

  const seedInput = document.getElementById("randomSeedInput");
  const motifInput = document.getElementById("randomMotifSelect");
  const symmetryInput = document.getElementById("randomSymmetrySelect");
  const contrastInput = document.getElementById("randomContrastInput");
  const whitenessInput = document.getElementById("randomWhitenessInput");
  const seedText = seedInput?.value || "mandala-random-001";
  const motif = motifInput?.value || "auto";
  const symmetry = getSymmetryConfig(symmetryInput?.value || "c6-mirror-vertex");
  const contrast = Number(contrastInput?.value || 6);
  const whiteness = Number(whitenessInput?.value || 4);
  setPalette(paletteSelect?.value || "purple");
  const colorPalette = activePalette.filter((entry) => entry.hex.toLowerCase() !== "#ffffff");
  const hashed = hashString(`${seedText}|${paletteSelect?.value || "purple"}|${motif}|${symmetry.value}|${contrast}|${whiteness}`)();
  const rng = mulberry32(hashed);
  const motifKind = motif === "auto" ? RANDOM_MOTIFS[1 + Math.floor(rng() * (RANDOM_MOTIFS.length - 1))] : motif;
  const phases = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];
  const biases = {
    ring: 0.85 + rng() * 0.45,
    angle: 0.8 + rng() * 0.9,
    accent: 0.55 + rng() * 0.6,
  };
  const paths = getColorableHexPaths();
  if (!paths.length) {
    setStatus("SVG loaded, but no colorable hexagons were found.");
    return;
  }
  const center = { x: viewBox.width / 2, y: viewBox.height / 2 };
  const maxRadius = Math.min(viewBox.width, viewBox.height) * 0.5 || 1;
  const nodes = paths.map((path) => {
    const point = getPathCenterInViewBox(path);
    return { path, x: point.x, y: point.y, q: 0, r: 0 };
  });

  inferHexGridCoordinates(nodes);

  const fillByKey = new Map();
  for (const node of nodes) {
    const key = getSymmetryKey(node, center, maxRadius, symmetry);
    if (!fillByKey.has(key)) {
      fillByKey.set(key, resolveRandomFillForKey(key, motifKind, phases, biases, colorPalette, contrast, whiteness, symmetry));
    }
    setFillValue(node.path, fillByKey.get(key));
  }

  setStatus(`Randomized ${nodes.length} hexagons with ${motifKind} motif.`);
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

// 1. UPDATED: Handle float coordinates for Hex positioning
function orderedDitherOffset(x, y) {
  const size = BAYER_4X4.length;
  // Map screen coordinates to integer pattern coordinates
  const mx = Math.floor(x);
  const my = Math.floor(y);
  
  // Safe modulo for potentially negative coordinates
  const col = ((mx % size) + size) % size;
  const row = ((my % size) + size) % size;
  
  const value = BAYER_4X4[row][col];
  const normalized = value / (size * size) - 0.5;
  return normalized * DITHER_STRENGTH;
}

// 2. REPLACED: Logic now runs on Path list, not Pixel buffer
// Remove 'buildFloydSteinbergBuffer' entirely. It is not used in this approach.

// 3. UPDATED: Simply samples raw image data (dithering is now handled in applyColors)
function sampleRawColorAt(x, y) {
  const ix = Math.max(0, Math.min(Math.round(x), canvas.width - 1));
  const iy = Math.max(0, Math.min(Math.round(y), canvas.height - 1));
  const data = ctx.getImageData(ix, iy, 1, 1).data;
  
  // Return null if transparent, otherwise object
  if (data[3] === 0) return null;
  return { r: data[0], g: data[1], b: data[2] };
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

// 4. REWRITTEN: Hex-Aware Dithering Implementation
function applyColors() {
  if (!svgRoot || !imageReady || !canvas.width || !canvas.height) return;

  if (!layoutReady) {
    setStatus("Preparing layout...");
    requestAnimationFrame(() => {
      layoutReady = true;
      applyColors();
    });
    return;
  }

  drawImageToCanvas();

  const paths = Array.from(svgRoot.querySelectorAll("path"));
  const nodes = [];

  // Step 1: Extract data and source colors for all relevant paths
  paths.forEach((path) => {
    const fill = getFillValue(path);
    if (!fill || fill.toLowerCase() === "none") return;
    
    // Reset to base
    setFillValue(path, "#ffffff");

    const center = getPathCenterInViewBox(path);
    const raw = sampleRawColorAt(center.x, center.y);

    if (raw) {
      nodes.push({
        path: path,
        x: center.x,
        y: center.y,
        r: raw.r,
        g: raw.g,
        b: raw.b,
        errR: 0, 
        errG: 0, 
        errB: 0
      });
    }
  });
  
  // Step 2: Sort nodes spatially (Top->Bottom, then Left->Right)
  // This mimics the scanline required for Error Diffusion
  nodes.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  // Step 3: Calculate Hex Grid Radius (for finding neighbors)
  // We approximate the grid size by checking the closest distance in a small sample
  let gridRadius = 20; // fallback
  if (nodes.length > 1) {
    let minD = Infinity;
    // Check first 50 nodes to estimate neighbor distance
    for (let i = 0; i < Math.min(nodes.length, 50); i++) {
        const next = nodes[i+1];
        if(!next) break;
        const d = Math.hypot(nodes[i].x - next.x, nodes[i].y - next.y);
        if (d < minD && d > 1) minD = d;
    }
    // Search radius is slightly larger than the distance between hex centers
    gridRadius = minD * 1.5;
  }

  let updated = 0;

  // Step 4: Process Dithering
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    let r = node.r + node.errR;
    let g = node.g + node.errG;
    let b = node.b + node.errB;

    if (ditherMode === "ordered") {
      // Apply Bayer matrix based on screen coordinates of the Hex center
      const offset = orderedDitherOffset(node.x, node.y);
      r += offset;
      g += offset;
      b += offset;
    }

    // Clamp
    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    // Quantize
    const entry = nearestPaletteEntry(r, g, b);
    setFillValue(node.path, entry.hex);
    updated++;

    // Error Diffusion (Floyd-Steinberg adapted for Hex/Irregular grids)
    if (ditherMode === "floyd-steinberg") {
      const eR = r - entry.r;
      const eG = g - entry.g;
      const eB = b - entry.b;

      // Find neighbors in the "future" (down/right) within gridRadius
      // Since array is sorted by Y, we only look forward.
      for (let j = i + 1; j < nodes.length; j++) {
        const neighbor = nodes[j];
        
        // Optimization: Stop searching if Y difference is too large
        if (neighbor.y > node.y + gridRadius) break;

        const dx = neighbor.x - node.x;
        const dy = neighbor.y - node.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < gridRadius * gridRadius) {
          // Distribute error based on direction (Simplified Hex weights)
          let weight = 0;

          // Directly Right
          if (dx > 0 && Math.abs(dy) < gridRadius / 3) weight = 7 / 16;
          // Bottom Left
          else if (dx < 0 && dy > 0) weight = 3 / 16;
          // Bottom / Bottom Right
          else if (dy > 0) weight = 5 / 16; // Combined remaining weight
          
          if (weight > 0) {
            neighbor.errR += eR * weight;
            neighbor.errG += eG * weight;
            neighbor.errB += eB * weight;
          }
        }
      }
    }
  }

  setStatus(`Updated ${updated} hexagons.`);
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
  if (imageReady) {
    canvas.width = viewBox.width;
    canvas.height = viewBox.height;
    drawImageToCanvas();
  }
  setStatus("SVG reset to original colors.");
}

function useOriginalSvgForRandomPattern() {
  if (!originalSvgText) {
    setStatus("SVG not loaded yet.");
    return false;
  }
  insertSvg(originalSvgText);
  layoutReady = false;
  requestAnimationFrame(() => {
    layoutReady = true;
  });
  if (imageReady) {
    canvas.width = viewBox.width;
    canvas.height = viewBox.height;
    drawImageToCanvas();
  }
  return true;
}

function randomizeSeedAndApply() {
  const seedInput = document.getElementById("randomSeedInput");
  if (seedInput) {
    seedInput.value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  applyRandomPatternFromControls();
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
    </label>
    <label>
      <span>Symmetry</span>
      <select id="randomSymmetrySelect">
        ${RANDOM_SYMMETRIES.map((symmetry) => `<option value="${symmetry.value}">${symmetry.label}</option>`).join("")}
      </select>
    </label>
    <label>
      <span>Palette</span>
      <p class="status">Uses the palette selected in the Image tab.</p>
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
      useOriginalSvgForRandomPattern();
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
  document.getElementById("imageTabBtn")?.addEventListener("click", () => setActiveTab("image"));
  document.getElementById("randomTabBtn")?.addEventListener("click", () => setActiveTab("random"));
  document.getElementById("generatePatternBtn")?.addEventListener("click", applyRandomPatternFromControls);
  document.getElementById("randomPatternBtn")?.addEventListener("click", randomizeSeedAndApply);
  document.getElementById("resetRandomBtn")?.addEventListener("click", resetSvg);
  document.getElementById("downloadRandomBtn")?.addEventListener("click", downloadSvg);
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
    createTabbedControls();
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
