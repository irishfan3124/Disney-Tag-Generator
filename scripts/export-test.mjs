import fs from 'node:fs';
import ot from 'opentype.js';
import { buildTag, bedFit } from '../src/geometry.js';
import { extrude } from '../src/mesh.js';
import { bambu3mf, stl } from '../src/export.js';
import { DEFAULTS } from '../src/defaults.js';
import { TEMPLATE } from '../src/template.js';
const load = (p, w) => { const b = fs.readFileSync(`node_modules/@fontsource/${p}/files/${p}-latin-${w}-normal.woff`); return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const sf = load('pacifico', 400); const fonts = { name: load('chewy', 400), top: sf, bottom: sf };
const o = { ...DEFAULTS, ...JSON.parse(process.argv[3] || '{}') };
const r = buildTag(o, fonts);
const meshes = r.bodies.map((b) => ({ name: b.label, slot: b.slot, ...extrude(b.polys, b.z0, b.z1) }));
// watertight check: every directed edge must have its reverse
for (const m of meshes) {
  const e = new Map(); const ix = m.indices;
  for (let t = 0; t < ix.length; t += 3) for (let k = 0; k < 3; k++) { const a = ix[t + k], b = ix[t + (k + 1) % 3]; const key = a + ',' + b; e.set(key, (e.get(key) || 0) + 1); }
  let bad = 0; for (const [key, c] of e) { const [a, b] = key.split(','); if (c !== 1 || e.get(b + ',' + a) !== 1) bad++; }
  console.log(m.name, 'tris', ix.length / 3, 'bad edges', bad);
}
const fit = bedFit(TEMPLATE.outline.map(([x, y]) => [x * o.width / TEMPLATE.width, y * o.width / TEMPLATE.width]), o.bed);
console.log('bed fit', fit);
const blob = await bambu3mf(meshes, { title: 'Test Tag', colors: o.colors, bed: o.bed, rotation: fit.deg });
fs.writeFileSync(process.argv[2], Buffer.from(await blob.arrayBuffer()));
fs.writeFileSync(process.argv[2].replace('.3mf', '.stl'), Buffer.from(await stl(meshes).arrayBuffer()));
console.log('wrote', process.argv[2]);
