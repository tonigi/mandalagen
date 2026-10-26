import { readFileSync } from 'node:fs';
import { getHexVertices } from '../../svg-engine.js';
// Read the shipped template, including its decoration, instead of an ideal grid.
const svg = readFileSync(new URL('../../data/onepage_model.svg', import.meta.url), 'utf8');
export const paths = [...svg.matchAll(/<path\b[\s\S]*?\/>/g)].map(([tag]) => {
  const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
  return {
    setAttribute: (key, value) => { attrs[key] = value; },
    getAttribute: key => attrs[key] || null,
    getBoundingClientRect() {
      const points = getHexVertices(this);
      const [a, b, c, d, e, f] = attrs.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
      const xs = points.map(p => a * p.x + c * p.y + e);
      const ys = points.map(p => b * p.x + d * p.y + f);
      return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
  };
});

export function measureNodes(cells) {
  return cells.map(path => {
    const rect = path.getBoundingClientRect();
    return { path, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}
