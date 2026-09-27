import { parse } from 'opentype.js';

// Bundled Google Fonts (SIL Open Font License) from @fontsource. Vite turns
// each import into a URL; a font is only downloaded when someone picks it.
import u0 from '@fontsource/chewy/files/chewy-latin-400-normal.woff?url';
import u1 from '@fontsource/grandstander/files/grandstander-latin-800-normal.woff?url';
import u2 from '@fontsource/luckiest-guy/files/luckiest-guy-latin-400-normal.woff?url';
import u3 from '@fontsource/titan-one/files/titan-one-latin-400-normal.woff?url';
import u4 from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff?url';
import u5 from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url';
import u6 from '@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff?url';
import u7 from '@fontsource/sniglet/files/sniglet-latin-800-normal.woff?url';
import u8 from '@fontsource/bubblegum-sans/files/bubblegum-sans-latin-400-normal.woff?url';
import u9 from '@fontsource/henny-penny/files/henny-penny-latin-400-normal.woff?url';
import u10 from '@fontsource/mountains-of-christmas/files/mountains-of-christmas-latin-700-normal.woff?url';
import u11 from '@fontsource/bangers/files/bangers-latin-400-normal.woff?url';
import u12 from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff?url';
import u13 from '@fontsource/lobster/files/lobster-latin-400-normal.woff?url';
import u14 from '@fontsource/kaushan-script/files/kaushan-script-latin-400-normal.woff?url';
import u15 from '@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff?url';
import u16 from '@fontsource/satisfy/files/satisfy-latin-400-normal.woff?url';
import u17 from '@fontsource/cookie/files/cookie-latin-400-normal.woff?url';
import u18 from '@fontsource/yellowtail/files/yellowtail-latin-400-normal.woff?url';
import u19 from '@fontsource/sriracha/files/sriracha-latin-400-normal.woff?url';

const FILES = {
  'chewy-400': u0,
  'grandstander-800': u1,
  'luckiest-guy-400': u2,
  'titan-one-400': u3,
  'lilita-one-400': u4,
  'fredoka-700': u5,
  'baloo-2-800': u6,
  'sniglet-800': u7,
  'bubblegum-sans-400': u8,
  'henny-penny-400': u9,
  'mountains-of-christmas-700': u10,
  'bangers-400': u11,
  'pacifico-400': u12,
  'lobster-400': u13,
  'kaushan-script-400': u14,
  'dancing-script-700': u15,
  'satisfy-400': u16,
  'cookie-400': u17,
  'yellowtail-400': u18,
  'sriracha-400': u19,
};

const fileFor = (pkg, weight) => FILES[`${pkg}-${weight}`];

export const FONTS = [
  // Playful display faces for the name tiles
  { id: 'chewy', name: 'Chewy', pkg: 'chewy', weight: 400, group: 'Playful' },
  { id: 'grandstander', name: 'Grandstander', pkg: 'grandstander', weight: 800, group: 'Playful' },
  { id: 'luckiest-guy', name: 'Luckiest Guy', pkg: 'luckiest-guy', weight: 400, group: 'Playful' },
  { id: 'titan-one', name: 'Titan One', pkg: 'titan-one', weight: 400, group: 'Playful' },
  { id: 'lilita-one', name: 'Lilita One', pkg: 'lilita-one', weight: 400, group: 'Playful' },
  { id: 'fredoka', name: 'Fredoka', pkg: 'fredoka', weight: 700, group: 'Playful' },
  { id: 'baloo-2', name: 'Baloo 2', pkg: 'baloo-2', weight: 800, group: 'Playful' },
  { id: 'sniglet', name: 'Sniglet', pkg: 'sniglet', weight: 800, group: 'Playful' },
  { id: 'bubblegum-sans', name: 'Bubblegum Sans', pkg: 'bubblegum-sans', weight: 400, group: 'Playful' },
  { id: 'henny-penny', name: 'Henny Penny', pkg: 'henny-penny', weight: 400, group: 'Playful' },
  { id: 'mountains-of-christmas', name: 'Mountains of Christmas', pkg: 'mountains-of-christmas', weight: 700, group: 'Playful' },
  { id: 'bangers', name: 'Bangers', pkg: 'bangers', weight: 400, group: 'Playful' },
  // Scripts for "The" / "Family"
  { id: 'pacifico', name: 'Pacifico', pkg: 'pacifico', weight: 400, group: 'Script' },
  { id: 'lobster', name: 'Lobster', pkg: 'lobster', weight: 400, group: 'Script' },
  { id: 'kaushan-script', name: 'Kaushan Script', pkg: 'kaushan-script', weight: 400, group: 'Script' },
  { id: 'dancing-script', name: 'Dancing Script', pkg: 'dancing-script', weight: 700, group: 'Script' },
  { id: 'satisfy', name: 'Satisfy', pkg: 'satisfy', weight: 400, group: 'Script' },
  { id: 'cookie', name: 'Cookie', pkg: 'cookie', weight: 400, group: 'Script' },
  { id: 'yellowtail', name: 'Yellowtail', pkg: 'yellowtail', weight: 400, group: 'Script' },
  { id: 'sriracha', name: 'Sriracha', pkg: 'sriracha', weight: 400, group: 'Script' },
];

for (const f of FONTS) f.url = fileFor(f.pkg, f.weight);

const cache = new Map();

export function loadFont(id) {
  if (cache.has(id)) return cache.get(id);
  const def = FONTS.find((f) => f.id === id);
  if (!def) return Promise.reject(new Error(`Unknown font ${id}`));
  const p = fetch(def.url)
    .then((r) => {
      if (!r.ok) throw new Error(`Could not download ${def.name}`);
      return r.arrayBuffer();
    })
    .then((buf) => parse(buf));
  cache.set(id, p);
  p.catch(() => cache.delete(id));
  return p;
}

// Register a user-supplied .ttf/.otf/.woff and return its id.
export async function addCustomFont(file) {
  const buf = await file.arrayBuffer();
  const font = parse(buf);
  const id = `custom:${file.name}`;
  const n = font.names || {};
  const family = n.fontFamily || n.windows?.fontFamily || n.macintosh?.fontFamily || {};
  const name = family.en || Object.values(family)[0] || file.name.replace(/\.[^.]+$/, '');
  if (!FONTS.some((f) => f.id === id)) FONTS.push({ id, name, group: 'Your fonts' });
  cache.set(id, Promise.resolve(font));
  return id;
}
