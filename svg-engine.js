export function parseViewBox(svg) {
  const viewBoxAttr = svg.getAttribute("viewBox");
  if (!viewBoxAttr) {
    return { width: Number(svg.getAttribute("width")) || 0, height: Number(svg.getAttribute("height")) || 0 };
  }
  const parts = viewBoxAttr.split(/\s+/).map(Number);
  return { width: parts[2] || 0, height: parts[3] || 0 };
}

export function getFillValue(el) {
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

export function setFillValue(el, color) {
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

// Template artwork also contains a filled scissors icon. Only closed six-sided
// straight-line paths are peg cells; decorative paths must never affect the center.
export function getHexVertices(path) {
  const tokens = (path.getAttribute("d") || "").match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const vertices = [];
  let x = 0, y = 0, command = null, i = 0, closed = false;
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    if (!command || !/^[mMlLhHvVzZ]$/.test(command)) return null;
    if (/^[zZ]$/.test(command)) { closed = true; break; }
    const relative = command === command.toLowerCase();
    const kind = command.toLowerCase();
    const count = kind === 'h' || kind === 'v' ? 1 : 2;
    const values = tokens.slice(i, i + count).map(Number);
    if (values.length !== count || values.some(v => !Number.isFinite(v))) return null;
    i += count;
    if (kind === 'h') x = values[0] + (relative ? x : 0);
    else if (kind === 'v') y = values[0] + (relative ? y : 0);
    else {
      x = values[0] + (relative ? x : 0);
      y = values[1] + (relative ? y : 0);
    }
    vertices.push({ x, y });
    if (kind === 'm') command = relative ? 'l' : 'L';
  }
  if (vertices.length === 7 && Math.hypot(vertices[6].x - vertices[0].x, vertices[6].y - vertices[0].y) < 0.01) vertices.pop();
  return closed && i === tokens.length && vertices.length === 6 ? vertices : null;
}

export function getColorableHexPaths(svgRoot) {
  if (!svgRoot) return [];
  return Array.from(svgRoot.querySelectorAll("path")).filter((path) => {
    const fill = getFillValue(path);
    return fill && fill.toLowerCase() !== "none" && getHexVertices(path) !== null;
  });
}
