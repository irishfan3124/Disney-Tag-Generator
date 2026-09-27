import ClipperLib from 'clipper-lib';
import { TEMPLATE } from './template.js';
import { PATTERNS, LAYOUTS } from './patterns.js';

// All 2D work happens in Clipper's integer space (micrometres). Layout maths is
// done in "template millimetres" (the original tag's size) and multiplied by
// k = chosen width / original width on the way in, so everything scales together.

const SC = 1000;
const C = ClipperLib;
const FILL = C.PolyFillType.pftNonZero;

const toC = (contours) =>
  contours.map((pts) => pts.map(([x, y]) => ({ X: Math.round(x * SC), Y: Math.round(y * SC) })));

function run(type, subject, clip = [], strict = false) {
  const c = new C.Clipper();
  c.StrictlySimple = strict;
  c.AddPaths(subject, C.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, C.PolyType.ptClip, true);
  const out = [];
  c.Execute(type, out, FILL, FILL);
  return out;
}
const union = (a, b = []) => run(C.ClipType.ctUnion, a, b);
const diff = (a, b) => (b.length ? run(C.ClipType.ctDifference, a, b) : a);
const inter = (a, b) => run(C.ClipType.ctIntersection, a, b);

function offset(paths, mm) {
  if (!mm || !paths.length) return paths;
  const co = new C.ClipperOffset(2, 0.01 * SC);
  co.AddPaths(paths, C.JoinType.jtRound, C.EndType.etClosedPolygon);
  const out = [];
  co.Execute(out, mm * SC);
  return out;
}

// Round the convex corners of a shape by shrinking then growing it.
const roundCorners = (paths, r) => (r > 0 ? offset(offset(paths, -r), r) : paths);

// Final clean-up: merge, drop slivers, and split into outer + holes.
function toExPolygons(paths) {
  const c = new C.Clipper();
  c.StrictlySimple = true;
  c.AddPaths(C.JS.Clean(paths, 0.005 * SC), C.PolyType.ptSubject, true);
  const tree = new C.PolyTree();
  c.Execute(C.ClipType.ctUnion, tree, FILL, FILL);
  const minArea = 0.05 * SC * SC;
  return C.JS.PolyTreeToExPolygons(tree)
    .filter((ex) => Math.abs(C.Clipper.Area(ex.outer)) > minArea)
    .map((ex) => ({
      outer: ex.outer.map((p) => [p.X / SC, p.Y / SC]),
      holes: ex.holes
        .filter((h) => Math.abs(C.Clipper.Area(h)) > minArea)
        .map((h) => h.map((p) => [p.X / SC, p.Y / SC])),
    }));
}

// ---------- plain float contour helpers ----------

function bbox(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of contours) for (const [x, y] of c) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

// Scale about (ox, oy), rotate (degrees), mirror in X, then move to (tx, ty).
function place(contours, { s = 1, ox = 0, oy = 0, rot = 0, mirror = false, tx = 0, ty = 0 }) {
  const a = (rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  return contours.map((c) => {
    const out = c.map(([x, y]) => {
      let px = (x - ox) * s, py = (y - oy) * s;
      if (mirror) px = -px;
      return [tx + px * cos - py * sin, ty + px * sin + py * cos];
    });
    return mirror ? out.reverse() : out;
  });
}

const scaleAll = (contours, k) => contours.map((c) => c.map(([x, y]) => [x * k, y * k]));

// ---------- text ----------

// Convert an opentype.js path into polygons (Y flipped so +Y is up).
function flatten(path, tol) {
  const contours = [];
  let cur = null, px = 0, py = 0;
  const seg = (n, fn) => {
    for (let i = 1; i <= n; i++) cur.push(fn(i / n));
  };
  const steps = (len) => Math.max(2, Math.min(32, Math.ceil(len / tol)));
  for (const c of path.commands) {
    if (c.type === 'M') {
      cur = [[c.x, c.y]];
      contours.push(cur);
    } else if (c.type === 'L') {
      cur.push([c.x, c.y]);
    } else if (c.type === 'Q') {
      const n = steps(Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x - c.x1, c.y - c.y1));
      const x0 = px, y0 = py;
      seg(n, (t) => {
        const u = 1 - t;
        return [u * u * x0 + 2 * u * t * c.x1 + t * t * c.x, u * u * y0 + 2 * u * t * c.y1 + t * t * c.y];
      });
    } else if (c.type === 'C') {
      const n = steps(
        Math.hypot(c.x1 - px, c.y1 - py) + Math.hypot(c.x2 - c.x1, c.y2 - c.y1) + Math.hypot(c.x - c.x2, c.y - c.y2),
      );
      const x0 = px, y0 = py;
      seg(n, (t) => {
        const u = 1 - t;
        return [
          u * u * u * x0 + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * y0 + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ];
      });
    }
    if (c.type !== 'Z') { px = c.x; py = c.y; }
  }
  return contours.filter((c) => c.length > 2).map((c) => c.map(([x, y]) => [x, -y]));
}

// Text as polygons at a 100-unit font size; caller scales it into place.
function textContours(font, text) {
  const path = font.getPath(text, 0, 0, 100, { kerning: true });
  return flatten(path, 1.5);
}

// ---------- the tag ----------

const TILE_STYLES = ['alternating', 'uniform', 'sticker', 'none'];

function buildName(o, font, k) {
  const T = TEMPLATE.tiles;
  const text = (o.uppercase ? o.name.toUpperCase() : o.name).trim();
  const tiled = o.tileStyle === 'alternating' || o.tileStyle === 'uniform';
  const uniform = { w: (T.big.w + T.small.w) / 2, h: (T.big.h + T.small.h) / 2 };
  const capH = bbox(textContours(font, 'H')).h || 70;

  const glyphs = [...text]
    .map((ch) => (/\s/.test(ch) ? { space: true } : { ch, g: textContours(font, ch) }))
    .filter((it) => it.space || it.g.length);
  const count = glyphs.filter((it) => !it.space).length;
  // Original pattern: big at both ends, small / medium alternating inside.
  const alternating = (i) =>
    i === 0 || i === count - 1 ? T.big : i % 2 ? T.small : T.medium;

  const cells = [];
  let x = 0, pendingGap = 0, n = 0;
  for (const { space, ch, g } of glyphs) {
    if (space) { pendingGap += T.big.w * 0.35; continue; }
    const gb = bbox(g);
    let cell;
    if (o.tileStyle === 'alternating') cell = { ...alternating(n) };
    else if (o.tileStyle === 'uniform') cell = { ...uniform };
    else cell = { w: 0, h: T.big.h };

    const targetH = cell.h * o.letterFill;
    // Tiles: every glyph fills its tile like the original, but tiny marks
    // (apostrophes, dots) stay near cap size instead of ballooning.
    let s = tiled ? Math.min(targetH / gb.h, (targetH / capH) * 1.15) : targetH / capH;
    if (tiled) {
      const pad = cell.w * 0.08;
      if (gb.w * s > cell.w - 2 * pad) {
        const maxW = cell.w * 1.35;
        cell.w = Math.min(maxW, gb.w * s + 2 * pad);
        s = Math.min(s, (cell.w - 2 * pad) / gb.w);
      }
    } else {
      cell.w = gb.w * s + (o.tileStyle === 'sticker' ? 2 * o.stickerWidth / k : 0.06 * cell.h);
    }
    const gap = tiled ? T.gap : o.tileStyle === 'sticker' ? -o.stickerWidth / k * 0.6 : 0.02 * cell.h;
    if (n > 0) x += gap;
    x += pendingGap;
    pendingGap = 0;
    cells.push({ ...cell, x0: x, glyph: g, gb, s, ch, n });
    x += cell.w;
    n++;
  }
  if (!cells.length) return null;

  const rowW = x;
  const fit = Math.min(1, T.maxRowWidth / rowW);
  const nf = fit * o.nameScale;
  const maxH = Math.max(...cells.map((c) => c.h));

  // Local row coordinates (origin at the row centre) -> template mm -> real mm.
  const toReal = (contours) =>
    scaleAll(place(contours, { s: nf, tx: 0, ty: TEMPLATE.tiles.centerY }), k);

  const tilesA = [], tilesB = [], letters = [];
  for (const c of cells) {
    const cx = c.x0 + c.w / 2 - rowW / 2;
    const bounce = (c.n % 2 ? -1 : 1) * o.bounce * c.h * 0.08;
    const tilt = (c.n % 2 ? -1 : 1) * o.tilt;
    // Non-tiled text sits on a shared baseline; tiles centre each glyph.
    const baseline = tiled ? null : -capH * c.s / 2;
    const g = place(c.glyph, {
      s: c.s,
      ox: c.gb.cx,
      oy: tiled ? c.gb.cy : 0,
      rot: tilt,
      tx: cx,
      ty: (tiled ? 0 : baseline) + bounce,
    });
    letters.push(...toReal(g));
    if (tiled) {
      const w = c.w / 2, h = c.h / 2;
      const rect = [[cx - w, -h], [cx + w, -h], [cx + w, h], [cx - w, h]];
      (c.n % 2 ? tilesB : tilesA).push(...toReal([rect]));
    }
  }

  return {
    letters: union(toC(letters)),
    tilesA: roundCorners(union(toC(tilesA)), o.tileRadius),
    tilesB: roundCorners(union(toC(tilesB)), o.tileRadius),
    // Row top/bottom in template mm, for placing the script lines.
    top: TEMPLATE.tiles.centerY + (nf * maxH) / 2,
    bottom: TEMPLATE.tiles.centerY - (nf * maxH) / 2,
    shrunk: fit,
  };
}

function buildScript(font, text, targetH, maxW, anchorY, fromTop, k) {
  if (!font || !text.trim()) return [];
  const g = textContours(font, text.trim());
  if (!g.length) return [];
  const b = bbox(g);
  const s = Math.min(targetH / b.h, maxW / b.w);
  const ty = fromTop ? anchorY - (b.h * s) / 2 : anchorY + (b.h * s) / 2;
  return toC(scaleAll(place(g, { s, ox: b.cx, oy: b.cy, tx: 0, ty }), k));
}

function buildCutouts(o, k) {
  const pat = o.pattern === 'custom' ? { polys: () => o.customPattern || [], scale: 1 } : PATTERNS[o.pattern];
  const layout = LAYOUTS[o.layout] || LAYOUTS.original;
  if (!pat) return [];
  const unit = pat.polys();
  if (!unit.length) return [];
  const all = [];
  for (const spot of layout.spots()) {
    const s = spot.r * o.patternScale * (pat.scale || 1);
    const rot = spot.mirror ? -o.patternRotation : o.patternRotation;
    all.push(...place(unit, { s, mirror: spot.mirror && o.mirrorPattern, rot, tx: spot.cx, ty: spot.cy }));
  }
  return union(toC(scaleAll(all, k)));
}

/**
 * Build every printable body. Returns real-millimetre ExPolygons plus Z ranges.
 * fonts: { name, top, bottom } opentype.js Font objects.
 */
export function buildTag(o, fonts) {
  const k = o.width / TEMPLATE.width;
  const warnings = [];

  const outline = toC([scaleAll([TEMPLATE.outline], k)[0]]);
  const holes = [];
  if (o.slots) {
    for (const sl of TEMPLATE.slots) {
      const w = (sl.w * o.slotScale) / 2, h = sl.h / 2;
      const r = [[sl.cx - w, sl.cy - h], [sl.cx + w, sl.cy - h], [sl.cx + w, sl.cy + h], [sl.cx - w, sl.cy + h]];
      holes.push(...toC(scaleAll([r], k)));
    }
  }
  holes.push(...buildCutouts(o, k));
  const base = diff(union(outline), union(holes));

  const name = fonts.name && o.name.trim() ? buildName(o, fonts.name, k) : null;
  if (name && name.shrunk < 0.8) warnings.push('Long name: the letters were made smaller to fit.');

  let tilesA = [], tilesB = [], letters = [];
  if (name) {
    if (o.tileStyle === 'sticker') {
      tilesA = inter(union(offset(name.letters, o.stickerWidth)), base);
    } else {
      tilesA = inter(name.tilesA, base);
      tilesB = inter(name.tilesB, base);
    }
    const support = o.tileStyle === 'none' ? base : union(tilesA, tilesB);
    // Letters may never hang past the tile edges (nothing under them to print on).
    letters = inter(offset(name.letters, o.letterBold), support);
  }

  const rowTop = name ? name.top : TEMPLATE.tiles.centerY + TEMPLATE.tiles.big.h / 2;
  const rowBottom = name ? name.bottom : TEMPLATE.tiles.centerY - TEMPLATE.tiles.big.h / 2;
  const top = buildScript(
    fonts.top, o.topText, TEMPLATE.topText.height * o.scriptScale, 120,
    rowTop + TEMPLATE.topText.gapAboveTiles, false, k,
  );
  const bottom = buildScript(
    fonts.bottom, o.bottomText, TEMPLATE.bottomText.height * o.scriptScale, 150,
    rowBottom + TEMPLATE.bottomText.overlapTiles, true, k,
  );
  const tiles = union(tilesA, tilesB);
  const script = diff(inter(offset(union(top, bottom), o.scriptBold), base), tiles);

  const bT = o.baseThickness, tT = o.tileThickness, lT = o.letterThickness, sT = o.scriptThickness;
  const lettersZ = o.tileStyle === 'none' ? bT : bT + tT;
  const bodies = [
    { id: 'base', label: 'Base', slot: o.slotBase, paths: base, z0: 0, z1: bT },
    { id: 'tilesA', label: o.tileStyle === 'sticker' ? 'Letter backing' : 'Tiles (1st, 3rd, …)', slot: o.slotTileA, paths: tilesA, z0: bT, z1: bT + tT },
    { id: 'tilesB', label: 'Tiles (2nd, 4th, …)', slot: o.slotTileB, paths: tilesB, z0: bT, z1: bT + tT },
    { id: 'letters', label: 'Name letters', slot: o.slotLetters, paths: letters, z0: lettersZ, z1: lettersZ + lT },
    { id: 'script', label: 'Script text', slot: o.slotScript, paths: script, z0: bT, z1: bT + sT },
  ]
    .map((b) => ({ ...b, polys: toExPolygons(b.paths) }))
    .filter((b) => b.polys.length && b.z1 > b.z0);

  const baseBox = bbox(bodies[0].polys.map((p) => p.outer));
  return { bodies, width: baseBox.w, height: baseBox.h, warnings };
}

export { TILE_STYLES };

// Smallest bounding box over rotations, to see whether the tag fits the bed.
export function bedFit(outline, bed) {
  // Keep it straight when possible; otherwise take the angle with most margin.
  let best = null;
  for (let deg = 0; deg <= 90; deg += 1) {
    const b = bbox(place([outline], { rot: deg }));
    const worst = Math.max(b.w, b.h);
    const fit = { deg, fits: worst <= bed, worst };
    if (deg === 0 && fit.fits) return fit;
    if (!best || worst < best.worst) best = fit;
  }
  return best;
}
