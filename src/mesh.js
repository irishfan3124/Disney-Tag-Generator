import { ShapeUtils, Vector2 } from 'three';

// Extrude ExPolygons ({outer, holes} in mm) between z0 and z1 into a closed,
// indexed triangle mesh. Walls share vertices with the caps, so the result is
// watertight — which is what slicers want from STL/3MF.
export function extrude(polys, z0, z1) {
  const positions = [];
  const indices = [];

  for (const ex of polys) {
    const outer = orient(ex.outer, true);
    const holes = ex.holes.map((h) => orient(h, false));
    const loops = [outer, ...holes];
    const flat = loops.flat();
    const n = flat.length;
    const base = positions.length / 3;

    for (const [x, y] of flat) positions.push(x, y, z0);
    for (const [x, y] of flat) positions.push(x, y, z1);

    const faces = ShapeUtils.triangulateShape(
      outer.map(([x, y]) => new Vector2(x, y)),
      holes.map((h) => h.map(([x, y]) => new Vector2(x, y))),
    );
    for (let [a, b, c] of faces) {
      // Force counter-clockwise (seen from above) so the top faces up.
      const [ax, ay] = flat[a], [bx, by] = flat[b], [cx, cy] = flat[c];
      if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) [b, c] = [c, b];
      indices.push(base + n + a, base + n + b, base + n + c); // top
      indices.push(base + a, base + c, base + b); // bottom
    }

    let start = 0;
    for (const loop of loops) {
      const m = loop.length;
      for (let i = 0; i < m; i++) {
        const a = base + start + i;
        const b = base + start + ((i + 1) % m);
        indices.push(a, b, b + n, a, b + n, a + n);
      }
      start += m;
    }
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function orient(pts, ccw) {
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  return area > 0 === ccw ? pts : [...pts].reverse();
}
