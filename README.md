# Mandala Color Mapper

This is a small web app that overlays a raster image onto a hexagon SVG grid and applies colors to the filled hexagons by sampling the image at each hex center.

Intended to generate templates for the "Quercetti Fantacolor Mandala" toy.

## How it works
- Load `data/onepage clean.svg` into the page.
- Upload a PNG/JPG image.
- Use scale and X/Y offset to align the image to the grid.
- Click “Apply colors” to fill hexagons based on the sampled colors.
- Choose between the original SVG palette or the fixed 6‑color palette.

## Grid details
- The hex grid spacing is **5.16 mm**.

## Controls
- **Scale**: zooms around the image center.
- **X/Y offset**: translates the image in viewBox units.
- **Palette**: original SVG palette or fixed 6‑color palette (red, blue, orange, lightblue, yellow, white).
- **Opacity**: preview only; does not affect sampling.

## Notes
- Only hexagons that were originally filled are recolored.
- Areas outside the image are forced to white.
- Image smoothing is disabled to avoid interpolation.

## Run locally
Open `index.html` in a browser.
