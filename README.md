# Mandala Color Mapper

This is a small web app that overlays a raster image onto a hexagon SVG grid and applies colors to the filled hexagons by sampling the image at each hex center.

Intended to generate templates for the "Quercetti Fantacolor Mandala" toy.

## How it works
- Load `data/onepage clean.svg` into the page.
- Upload, paste, or drag/drop a PNG/JPG image.
- Use scale and X/Y offset to align the image to the grid.
- Choose a fixed palette and optional dithering mode.
- Click “Apply colors” to fill hexagons based on the sampled colors.

## Grid details
- The hex grid spacing is **5.16 mm**.

## Controls
- **Scale**: zooms around the image center.
- **X/Y offset**: translates the image in viewBox units.
- **Palette**: two fixed 6‑color palettes:
  - Royal purple: `#1496dc`, `#6432aa`, `#ffffff`, `#eb0000`, `#ff6e32`, `#ffe100`.
  - Blue (replaces purple): `#1496dc`, `#0000ff`, `#ffffff`, `#eb0000`, `#ff6e32`, `#ffe100`.
- **Dithering**: none, ordered, or Floyd-Steinberg error diffusion.
- **Opacity**: preview only; does not affect sampling.

## Notes
- Only hexagons that were originally filled are recolored.
- Areas outside the image are forced to white.
- Image smoothing is disabled to avoid interpolation.
- Drag the preview to pan, or use the mouse wheel to zoom.

## Run locally
Open `index.html` in a browser.
