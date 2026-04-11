import { palettes } from './constants.js';
import { hexToRgb } from './utils.js';

export function buildFixedPalette(mode) {
  const palette = palettes[mode] || palettes.purple;
  return palette
    .map((entry) => {
      const rgb = hexToRgb(entry.hex);
      return rgb ? { ...entry, ...rgb } : null;
    })
    .filter(Boolean);
}

export function nearestPaletteEntry(r, g, b, activePalette) {
  if (!activePalette || !activePalette.length) {
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
