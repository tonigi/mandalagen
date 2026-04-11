import { BAYER_4X4, DITHER_STRENGTH } from './constants.js';
import { clamp, getPathCenterInViewBox } from './utils.js';
import { getFillValue, setFillValue } from './svg-engine.js';
import { nearestPaletteEntry } from './color-engine.js';

export function orderedDitherOffset(x, y) {
  const size = BAYER_4X4.length;
  const mx = Math.floor(x);
  const my = Math.floor(y);
  const col = ((mx % size) + size) % size;
  const row = ((my % size) + size) % size;
  const value = BAYER_4X4[row][col];
  const normalized = value / (size * size) - 0.5;
  return normalized * DITHER_STRENGTH;
}

export function sampleRawColorAt(x, y, canvas, ctx) {
  const ix = Math.max(0, Math.min(Math.round(x), canvas.width - 1));
  const iy = Math.max(0, Math.min(Math.round(y), canvas.height - 1));
  const data = ctx.getImageData(ix, iy, 1, 1).data;
  if (data[3] === 0) return null;
  return { r: data[0], g: data[1], b: data[2] };
}

export function drawImageToCanvas(sourceImage, canvas, ctx, viewBox, imageTransform) {
  if (!sourceImage || !canvas.width || !canvas.height) {
    return;
  }
  const baseScale = Math.max(
    viewBox.width / sourceImage.width,
    viewBox.height / sourceImage.height
  );
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

export function applyColors({
  svgRoot,
  imageReady,
  canvas,
  ctx,
  viewBox,
  ditherMode,
  activePalette,
  sourceImage,
  imageTransform,
  onStatusUpdate,
  onComplete
}) {
  if (!svgRoot || !imageReady || !canvas.width || !canvas.height) return;

  drawImageToCanvas(sourceImage, canvas, ctx, viewBox, imageTransform);

  const paths = Array.from(svgRoot.querySelectorAll("path"));
  const nodes = [];

  paths.forEach((path) => {
    const fill = getFillValue(path);
    if (!fill || fill.toLowerCase() === "none") return;
    
    setFillValue(path, "#ffffff");
    const center = getPathCenterInViewBox(path, svgRoot, viewBox);
    const raw = sampleRawColorAt(center.x, center.y, canvas, ctx);

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
  
  nodes.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  let gridRadius = 20;
  if (nodes.length > 1) {
    let minD = Infinity;
    for (let i = 0; i < Math.min(nodes.length, 50); i++) {
        const next = nodes[i+1];
        if(!next) break;
        const d = Math.hypot(nodes[i].x - next.x, nodes[i].y - next.y);
        if (d < minD && d > 1) minD = d;
    }
    gridRadius = minD * 1.5;
  }

  let updated = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let r = node.r + node.errR;
    let g = node.g + node.errG;
    let b = node.b + node.errB;

    if (ditherMode === "ordered") {
      const offset = orderedDitherOffset(node.x, node.y);
      r += offset;
      g += offset;
      b += offset;
    }

    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    const entry = nearestPaletteEntry(r, g, b, activePalette);
    setFillValue(node.path, entry.hex);
    updated++;

    if (ditherMode === "floyd-steinberg") {
      const eR = r - entry.r;
      const eG = g - entry.g;
      const eB = b - entry.b;

      for (let j = i + 1; j < nodes.length; j++) {
        const neighbor = nodes[j];
        if (neighbor.y > node.y + gridRadius) break;

        const dx = neighbor.x - node.x;
        const dy = neighbor.y - node.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < gridRadius * gridRadius) {
          let weight = 0;
          if (dx > 0 && Math.abs(dy) < gridRadius / 3) weight = 7 / 16;
          else if (dx < 0 && dy > 0) weight = 3 / 16;
          else if (dy > 0) weight = 5 / 16;
          
          if (weight > 0) {
            neighbor.errR += eR * weight;
            neighbor.errG += eG * weight;
            neighbor.errB += eB * weight;
          }
        }
      }
    }
  }

  if (onStatusUpdate) onStatusUpdate(`Updated ${updated} hexagons.`);
  if (onComplete) onComplete();
}
