import { palettes } from './constants.js';
import { normalizeHex } from './utils.js';
import { buildFixedPalette } from './color-engine.js';

export function setStatus(statusEl, message) {
  statusEl.textContent = message;
}

export function getColorName(hex) {
  const normalized = normalizeHex(hex);
  for (const palette of Object.values(palettes)) {
    const match = palette.find((entry) => normalizeHex(entry.hex) === normalized);
    if (match) return match.name;
  }
  return normalized;
}

export function updateColorCounts(board, colorCountsEl, paletteSelectValue) {
  if (!board) {
    colorCountsEl.textContent = "";
    return;
  }

  const counts = board.colorCounts();

  if (!counts.size) {
    colorCountsEl.textContent = "";
    return;
  }

  const paletteOrder = buildFixedPalette(paletteSelectValue || "purple").map((entry) => entry.hex);
  const orderedColors = [
    ...paletteOrder.filter((hex) => counts.has(hex)),
    ...Array.from(counts.keys())
      .filter((hex) => !paletteOrder.includes(hex))
      .sort(),
  ];

  colorCountsEl.innerHTML = orderedColors
    .map((hex) => {
      const count = counts.get(hex);
      const label = getColorName(hex);
      return `<span style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--panel-edge);border-radius:999px;background:#fff;padding:4px 8px;font-size:12px;"><span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid rgba(0,0,0,0.25);background:${hex};"></span>${label}: ${count}</span>`;
    })
    .join("");
}
