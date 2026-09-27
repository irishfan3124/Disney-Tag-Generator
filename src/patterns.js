import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { TEMPLATE } from './template.js';

// Every pattern is a list of polygons in a unit box: centred on the origin and
// reaching radius ~1, so it can be dropped into any cutout position.

function circle(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function star(points, inner) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? inner : 1;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

function heart() {
  const pts = [];
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 17, (y + 2.5) / 17]);
  }
  return pts;
}

export const PATTERNS = {
  sparkle: { name: 'Sparkles (original)', polys: () => [TEMPLATE.sparkle] },
  star: { name: 'Stars', polys: () => [star(5, 0.45)], scale: 0.8 },
  heart: { name: 'Hearts', polys: () => [heart()], scale: 0.75 },
  mickey: {
    name: 'Mickey heads',
    polys: () => [circle(0, -0.22, 0.6), circle(-0.58, 0.5, 0.36), circle(0.58, 0.5, 0.36)],
    scale: 0.85,
  },
  circle: { name: 'Dots', polys: () => [circle(0, 0, 1)], scale: 0.55 },
  diamond: { name: 'Diamonds', polys: () => [[[0, 1], [-0.6, 0], [0, -1], [0.6, 0]]] },
  none: { name: 'None', polys: () => [] },
};

// Layouts are in template millimetres; left-ear shapes are mirrored.
const RIGHT_EAR_TRIO = TEMPLATE.cutouts.filter((c) => !c.mirror);
const EAR = TEMPLATE.ears[1];

function mirrorAll(list) {
  return [...list.map((c) => ({ ...c, cx: -c.cx, mirror: true })), ...list];
}

export const LAYOUTS = {
  original: { name: 'Three per ear (original)', spots: () => TEMPLATE.cutouts },
  single: {
    name: 'One per ear',
    spots: () => mirrorAll([{ cx: EAR.cx + 12, cy: EAR.cy + 4, r: 20 }]),
  },
  scattered: {
    name: 'Scattered (six per ear)',
    spots: () =>
      mirrorAll([
        ...RIGHT_EAR_TRIO,
        { cx: EAR.cx + 2, cy: EAR.cy - 24, r: 9 },
        { cx: EAR.cx + 26, cy: EAR.cy - 26, r: 6.5 },
        { cx: EAR.cx - 12, cy: EAR.cy - 2, r: 6 },
      ]),
  },
};

// Turn an uploaded SVG into unit polygons (outer contours only: holes inside a
// cutout would leave loose islands that fall out of the print).
export function parseSvgPattern(text) {
  const data = new SVGLoader().parse(text);
  const polys = [];
  for (const path of data.paths) {
    for (const shape of SVGLoader.createShapes(path)) {
      const pts = shape.extractPoints(16).shape.map((p) => [p.x, -p.y]);
      if (pts.length > 2) polys.push(pts);
    }
  }
  if (!polys.length) throw new Error('No filled shapes found in that SVG.');
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const s = 2 / Math.max(maxX - minX, maxY - minY);
  return polys.map((p) => p.map(([x, y]) => [(x - cx) * s, (y - cy) * s]));
}
