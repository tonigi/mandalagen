import { getColorableHexPaths, getFillValue, setFillValue } from './svg-engine.js';
import { getPathCenterInViewBox, normalizeHex } from './utils.js';
import { buildSymmetryOrbits, getBoardGeometry } from './symmetry-engine.js';

// One model per inserted SVG. Geometry is in viewBox units, so resize/scroll
// cannot invalidate cached symmetry groups. Replacing the SVG replaces history.
export function createBoardModel(svgRoot, viewBox) {
  const cells = getColorableHexPaths(svgRoot);
  const nodes = cells.map(path => ({ path, ...getPathCenterInViewBox(path, svgRoot, viewBox) }));
  return createBoardFromNodes(nodes);
}

export function createBoardFromNodes(nodes) {
  const cells = nodes.map(node => node.path);
  const cellSet = new Set(cells);
  const { center, maxRadius } = getBoardGeometry(nodes);
  const orbitCache = new Map();
  const undoStack = [], redoStack = [];
  let stroke = null;
  function setColor(path, color) {
    if (!cellSet.has(path)) return;
    if (stroke && !stroke.has(path)) stroke.set(path, { path, before: getFillValue(path), after: color });
    if (stroke) stroke.get(path).after = color;
    setFillValue(path, color);
  }
  function finishStroke() {
    if (!stroke) return;
    const changes = [...stroke.values()].filter(change => change.before !== change.after);
    stroke = null;
    if (!changes.length) return;
    undoStack.push(changes);
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }
  function restore(from, to, key) {
    finishStroke();
    const changes = from.pop();
    if (!changes) return;
    for (const change of changes) setFillValue(change.path, change[key]);
    to.push(changes);
  }
  const board = {
    nodes, cells, center, maxRadius,
    has: path => cellSet.has(path),
    setColor,
    getOrbits(symmetry) {
      const key = `${symmetry.order}:${symmetry.offset}:${symmetry.mirror}`;
      if (!orbitCache.has(key)) orbitCache.set(key, buildSymmetryOrbits(nodes, symmetry));
      return orbitCache.get(key);
    },
    beginStroke() { finishStroke(); stroke = new Map(); },
    paint(path, color, symmetry) {
      for (const partner of board.getOrbits(symmetry).get(path) || []) setColor(partner, color);
    },
    finishStroke,
    clear() {
      board.beginStroke();
      for (const path of cells) setColor(path, '#ffffff');
      finishStroke();
    },
    undo() { restore(undoStack, redoStack, 'before'); },
    redo() { restore(redoStack, undoStack, 'after'); },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    clearHistory() { finishStroke(); undoStack.length = redoStack.length = 0; },
    colorCounts() {
      const counts = new Map();
      for (const path of cells) {
        const color = normalizeHex(getFillValue(path));
        if (color) counts.set(color, (counts.get(color) || 0) + 1);
      }
      return counts;
    },
  };
  return board;
}
