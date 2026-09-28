# Stroller Tag for MakerWorld Parametric Model Maker

`stroller-tag.scad` (kept locally and not committed to this public repo) is a single-file
OpenSCAD version of the web generator, built for
Bambu Lab's [Parametric Model Maker](https://makerworld.com/en/makerlab/parametricModelMaker)
(PMM). Buyers or makers can customize the tag on MakerWorld and download a multi-colour 3MF
that opens in Bambu Studio with each part on its own filament.

![Default tag](preview.png)

## Parameters

| Tab | Options |
| --- | --- |
| Text | Family name, all capitals, line above ("The"), line below ("Family") |
| Fonts | Name font and script font, using PMM's font picker (defaults: Chewy and Lobster) |
| Size | Overall width (height follows), plus base, tile, letter, and script thickness |
| Name style | Alternating tiles (the original), same-size tiles, outlined letters, or letters only. Also name size, letter size, tile corner radius, outline width, tilt, bounce, and boldness |
| Cutouts | Sparkles, stars, hearts, Mickey heads, dots, diamonds, an uploaded SVG, or none. Also layout (3 per ear, 1 per ear, scattered), size, rotation, mirroring, and strap slots |
| Colors | Base, tiles 1/3/5, tiles 2/4/6, letters, and script, each with PMM's colour picker |
| Printing | Turn the tag 45° on the plate so a wide tag fits diagonally |

Defaults match the original tag (5.5 mm base, 2.75 mm tiles and letters, in tan `#D3C5A3`,
pink `#F95D73`, and cream `#FCECD6`), except the width: 305 mm instead of 315.8 mm, so the tag
fits a 256 mm plate with some room to spare. Set **tag_width** to 315.8 for the exact original size.

## Uploading to MakerWorld

1. Open MakerWorld → **MakerLab** → **Parametric Model Maker** and start a new OpenSCAD model.
2. Open the **Code** editor and paste the entire contents of `stroller-tag.scad`.
3. Generate a preview to check it, then publish it as a customizable model with `preview.png`
   (or your product photos) as the cover.
4. To offer custom cutouts, mention in the description that makers can upload an SVG and
   choose **Uploaded SVG**. PMM stores the upload as `default.svg`, which the script expects.

## Things to know

- **Plate size.** Tested on MakerWorld with a P2S. At the original 315.8 mm width the tag,
  turned 45°, takes up 256.0 × 255.6 mm. MakerWorld still builds a correct 3MF, centred on the
  plate, but first warns "Model cannot fit on plate. Disable auto arrangement". The 305 mm default
  takes up about 247 × 247 mm. Below about 295 mm (239 × 239 mm) there is plenty of margin.
- **Letter measuring.** The script sizes each letter exactly with OpenSCAD's `textmetrics()`.
  MakerWorld's renderer supports it: its "Smith" output measured 146.1 mm across the tiles, the
  exact-measurement value. On OpenSCAD builds without `textmetrics()`, the script falls back to
  estimated letter widths automatically.
- **Fonts.** Chewy, Lobster, Luckiest Guy, Titan One, Lilita One, Bangers, and Bubblegum Sans
  are in PMM's installed font list. Pacifico (the web app's script default) only appears in
  PMM's wider catalogue, so Lobster is the default here.
- **Colours.** Tested on MakerWorld: the 3MF comes out as one part painted in three filaments
  (tan base and letters, pink odd tiles and script, cream even tiles), with Bambu PLA Basic
  presets already in those colours. Parts that share a colour print with the same filament.
  In "Letters only" style, tan letters switch to the tile colour automatically so they don't
  disappear into the base.

## Testing locally

The script was tested with the OpenSCAD 2026.09 development snapshot (Manifold backend), which is
close to what PMM runs:

```bash
openscad --enable=textmetrics --backend=manifold -o tag.3mf pmm/stroller-tag.scad
```

Leave out `--enable=textmetrics` to test the fallback. Your computer needs the fonts installed, or
point `OPENSCAD_FONT_PATH` at a folder of `.ttf` files.
