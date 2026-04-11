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

export function getColorableHexPaths(svgRoot) {
  if (!svgRoot) return [];
  return Array.from(svgRoot.querySelectorAll("path")).filter((path) => {
    const fill = getFillValue(path);
    return fill && fill.toLowerCase() !== "none";
  });
}

export function inferHexGridCoordinates(nodes, viewBox) {
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
