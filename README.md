# Mandala Color Generator

A web application for creating and color-mapping mandala designs, specifically tailored for the [Quercetti Fantacolor Mandala](https://www.youtube.com/watch?v=VXxuqUFme4g) toy (discontinued?). The toy holds paper maps to guide the placement of colored nails along an hexagonal grid. 

This software maps raster images to the hexagonal grid and supports procedural pattern generation and hand-drawing. The output must be printed at 100% scale (5.16 mm grid spacing).


## Features

### 1. Image-Matched Hex Colors
- **Image Mapping**: Upload, paste, or drag-and-drop an image to overlay it on a hexagonal SVG grid.
- **Precision Controls**: Adjust scale and X/Y translation to align your image perfectly.
- **Dithering Algorithms**: Includes "None", "Ordered", and "Floyd-Steinberg" error diffusion for better color representation with limited palettes.
- **Live Preview**: Adjust overlay opacity to see how the image aligns with the hex grid before applying colors.

### 2. Random Pattern Generator
- **Procedural Motifs**: Generate complex designs using motifs like "Flower", "Star", "Ribbons", "Diamonds", "Petals", and "Mosaic".
- **Symmetry Modes**: Support for various rotational and mirror symmetries (C6, C3, C2).
- **Seedable Generation**: Use unique seeds to recreate or share specific patterns.
- **Customizable Aesthetics**: Fine-tune contrast and "white accents" for varied visual styles.

### 3. Hand-Drawing
- Open **Draw** to paint individual hexagons or drag a stroke using a mouse, pen, or touch.
- Symmetry modes: C₁ (identity), C₂/C₃/C₆ (cyclic rotations), Cₛ (one reflection), and D₂/D₃/D₆ (planar dihedral groups with n rotations and n reflections). Axis orientations are measured clockwise from horizontal; options preserve the hexagonal lattice. Each new stroke and erase is repeated about the board center.
- Choose from both peg palettes; **Erase (white)** restores white hexagons.
- **Undo/Redo** works per stroke. **Clear board** is also undoable.
- Switching tabs preserves your design, so generated and image-mapped designs can be touched up by hand.
- Applying image colors, generating a pattern, or resetting replaces the design and clears drawing history.

## Technical Details

AI-generated code. The application is built using a custom "engine" approach with ES6 modules for clean separation of concerns:
  - `image-engine.js`: Canvas drawing and dithering.
  - `pattern-engine.js`: Procedural generation and symmetry math.
  - `svg-engine.js`: SVG parsing and hex-grid coordinate inference.
  - `color-engine.js`: Palette management and quantization.
  - `ui-engine.js`: Real-time status updates and color legends.

## Running Locally

Due to the use of ES6 modules, the application must be served over HTTP(S). 

1. **Using Python**:
   ```bash
   python -m http.server 8000
   ```
2. **Using Node.js (npx)**:
   ```bash
   npx serve .
   ```
3. Open `http://localhost:8000` (or the provided port) in your browser.

Also hosted at https://tonigi.github.io/mandalagen/ 

## Credits & Data
- **Model SVG**: `data/onepage_model.svg` serves as the base template.
- **Target Hardware**: Designed for generating pegboard templates for Quercetti pixel art sets.

## Browser regression checks

With the local server running on port 8000 and Google Chrome installed:

```bash
uv run --with playwright python tests/browser_smoke.py
```
