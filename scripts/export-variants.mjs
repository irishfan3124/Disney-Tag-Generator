// Export the five example designs (the ones in examples/tags) as multi-colour 3MFs.
// Usage: node scripts/export-variants.mjs [outDir] [widthMm]
import fs from 'node:fs';
import path from 'node:path';
import ot from 'opentype.js';
import { buildTag, bedFit } from '../src/geometry.js';
import { extrude } from '../src/mesh.js';
import { bambu3mf } from '../src/export.js';
import { DEFAULTS } from '../src/defaults.js';
import { TEMPLATE } from '../src/template.js';

const FONT_WEIGHTS = { chewy: 400, pacifico: 400, 'luckiest-guy': 400, lobster: 400, grandstander: 800,
  'dancing-script': 700, 'titan-one': 400, 'kaushan-script': 400, fredoka: 700, yellowtail: 400 };
const load = (id) => {
  const b = fs.readFileSync(`node_modules/@fontsource/${id}/files/${id}-latin-${FONT_WEIGHTS[id]}-normal.woff`);
  return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
};

const VARIANTS = [
  ['1 Classic', { nameFont: 'chewy', scriptFont: 'pacifico', pattern: 'sparkle', layout: 'original' }],
  ['2 Starry', { nameFont: 'luckiest-guy', scriptFont: 'lobster', pattern: 'star', layout: 'scattered' }],
  ['3 Sweetheart', { nameFont: 'grandstander', scriptFont: 'dancing-script', pattern: 'heart', layout: 'original' }],
  ['4 Mickey', { nameFont: 'titan-one', scriptFont: 'kaushan-script', pattern: 'mickey', layout: 'single' }],
  ['5 Polka Dot', { nameFont: 'fredoka', scriptFont: 'yellowtail', pattern: 'circle', layout: 'scattered' }],
];

const outDir = process.argv[2] || 'examples/3mf';
const width = Number(process.argv[3] || 305);
fs.mkdirSync(outDir, { recursive: true });

for (const [label, v] of VARIANTS) {
  const o = { ...DEFAULTS, name: 'Smith', width, ...v };
  const script = load(o.scriptFont);
  const r = buildTag(o, { name: load(o.nameFont), top: script, bottom: script });
  const meshes = r.bodies.map((b) => ({ name: b.label, slot: b.slot, ...extrude(b.polys, b.z0, b.z1) }));
  const k = width / TEMPLATE.width;
  const fit = bedFit(TEMPLATE.outline.map(([x, y]) => [x * k, y * k]), o.bed);
  const title = `Smith Stroller Tag - ${label.replace(/^\d+ /, '')}`;
  const blob = await bambu3mf(meshes, { title, colors: o.colors, bed: o.bed, rotation: fit.deg });
  const file = path.join(outDir, `${label}.3mf`);
  fs.writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  console.log(`${file}: ${r.width.toFixed(1)} x ${r.height.toFixed(1)} mm, ${meshes.length} parts, turned ${fit.deg} deg (worst ${fit.worst.toFixed(1)} mm)`);
}
