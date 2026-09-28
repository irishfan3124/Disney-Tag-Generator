# Stroller Tag Generator

A web app for making personalised Mickey-ear stroller tags for 3D printing. Type a family
name, adjust the look, and download a multi-colour 3MF (Bambu Studio / OrcaSlicer) or STL files.

**Try it: https://irishfan3124.github.io/Disney-Tag-Generator/**

The defaults reproduce the original stroller tag model exactly:
315.8 × 131.5 mm, 5.5 mm base, 2.75 mm tiles, and 2.75 mm letters. The design uses three
filaments: tan `#D3C5A3`, pink `#F95D73`, and cream `#FCECD6`.

## Options

| Area | What you can change |
| --- | --- |
| Text | Family name, the line above ("The") and the line below ("Family"), all capitals on or off |
| Fonts | 20 bundled Google Fonts (playful and script faces), or upload your own `.ttf` / `.otf` / `.woff` (for example Waltograph) |
| Size | Overall width (the height follows), plus base, tile, letter, and script thickness |
| Name style | Alternating tiles (the original), same-size tiles, outlined letters, or letters only. Also name size, letter size, tile corner radius, tilt, bounce, and boldness |
| Cutouts | Sparkles (the original), stars, hearts, Mickey heads, dots, diamonds, none, or your own SVG. Also layout (3 per ear, 1 per ear, scattered), size, rotation, and mirroring. Strap slots can be turned off or resized |
| Colours | Four filament slots, each part assignable to any slot |
| Printer | Bed size. Tags that are too wide to fit straight are turned to the best angle in the 3MF, the same 45° you used on the 256 mm bed |

**Copy share link** saves your settings in the URL so someone else can open the same design.
Uploaded fonts and SVG shapes stay in your browser and aren't included in the link.

Name length is handled automatically. Long names shrink the tiles to fit the head, and every
layer is clipped to the part below it, so nothing overhangs or floats.

## Downloads

- **Download 3MF**: one object with a part for each colour, already assigned to filaments 1–4 and placed on the bed. Opens in Bambu Studio and OrcaSlicer.
- **STLs by colour**: a zip with one STL per filament. Use it with PrusaSlicer, Cura, or others, and assign the colours yourself.
- **Single STL**: the whole tag in one file, for single-colour prints.

All meshes are watertight. `scripts/export-test.mjs` checks every edge.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/, host anywhere
```

Every push to `main` rebuilds and publishes the site to GitHub Pages (`.github/workflows/deploy.yml`).

Everything runs in the browser. There's no server and no uploads.

## Project layout

| File | Purpose |
| --- | --- |
| `src/template.js` | Geometry measured from the original 3MF: outline, slots, sparkle shape and positions, tile sizes |
| `src/geometry.js` | Builds the 2D layers with Clipper (text, tiles, cutouts, clipping) |
| `src/mesh.js` | Extrudes the layers into watertight meshes |
| `src/export.js` | STL, zipped STLs, and Bambu-style 3MF writers |
| `src/patterns.js` | Cutout shapes, layouts, and SVG import |
| `src/fonts.js` | Bundled font list and custom font loading |
| `src/main.js` | UI, 3D preview (three.js), share links, and downloads |
| `scripts/*.mjs` | Node checks: `node scripts/smoke.mjs` and `node scripts/export-test.mjs out.3mf` |
| `pmm/` | Notes and preview for the MakerWorld Parametric Model Maker version (see [pmm/README.md](pmm/README.md)). The `.scad` script itself is kept out of this public repo. |
| `examples/` | Example renders, mockup photos, real print photos, and ready-to-print 3MFs for five designs (`node scripts/export-variants.mjs`) |

Fonts are from Google Fonts via @fontsource and are licensed under the SIL Open Font License.
