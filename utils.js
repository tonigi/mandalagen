export function normalizeHex(hex) {
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

export function hexToRgb(hex) {
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

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function hashString(input) {
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

export function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mod(n, m) {
  return ((n % m) + m) % m;
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

export function getPathCenterInViewBox(path, svgRoot, viewBox) {
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
