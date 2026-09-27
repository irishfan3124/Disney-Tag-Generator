import fs from 'node:fs';
import ot from 'opentype.js'; const { parse } = ot;
import { buildTag, bedFit } from '../src/geometry.js';
import { DEFAULTS } from '../src/defaults.js';
const load = (p, w) => { const b = fs.readFileSync(`node_modules/@fontsource/${p}/files/${p}-latin-${w}-normal.woff`); return parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const sf = load('pacifico', 400); const fonts = { name: load('chewy', 400), top: sf, bottom: sf };
for (const over of [{}, { name: 'Montgomery-Smith' }, { tileStyle: 'sticker' }, { tileStyle: 'none', pattern: 'heart', layout: 'scattered' }, { name: "O'Brien", pattern: 'mickey', width: 200 }]) {
  const t0 = Date.now();
  const r = buildTag({ ...DEFAULTS, ...over }, fonts);
  console.log(JSON.stringify(over), `${Date.now() - t0}ms`, r.width.toFixed(2), r.height.toFixed(2), r.warnings.join(';'));
  for (const b of r.bodies) console.log('  ', b.id, b.polys.length, 'polys', b.polys.reduce((a, p) => a + p.holes.length, 0), 'holes', b.z0, b.z1);
}
