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
- **Geometric Motifs**: Choose scalloped flower rosettes, nested pointed stars, woven ribbons, diamond tiles, petal crowns, annular mosaics, or concentric rings. Seed variations change proportions and a coordinated subset of palette colors. Contrast controls detail density; white accents add outlines along motif boundaries.
- **Symmetry Modes**: Support for various rotational and mirror symmetries (C6, C3, C2).
- **Seedable Generation**: Use unique seeds to recreate or share specific patterns.
- **Customizable Aesthetics**: Fine-tune contrast and "white accents" for varied visual styles.

### 3. Hand-Drawing
- Open **Draw** to paint individual hexagons or drag a stroke using a mouse, pen, or touch.
- Drawing and Random share the selected symmetry (D₆ by default). Select C₁ explicitly for free drawing. Painting and erasing use the same symmetry, and undo/redo covers all repeated cells in a stroke.
- Symmetry modes: C₁ (identity), C₂/C₃/C₆ (cyclic rotations), Cₛ (one reflection), and D₂/D₃/D₆ (planar dihedral groups with n rotations and n reflections). Axis orientations are measured clockwise from horizontal; options preserve the hexagonal lattice. Each new stroke and erase is repeated about the board center. Random generation uses the same cell symmetry groups as drawing.
- Choose from both peg palettes; **Erase (white)** restores white hexagons.
- **Undo/Redo** works per stroke. **Clear board** is also undoable.
- Switching tabs preserves your design, so generated and image-mapped designs can be touched up by hand.
- Applying image colors, generating a pattern, or resetting replaces the design and clears drawing history.

## Code structure

The app uses browser ES modules without a build step or runtime framework.

- `app.js`: application startup, image loading, and coordinating design replacement and export.
- `app-state.js`: shared mode, symmetry, palette, and pattern settings. Controls subscribe to state rather than updating each other.
- `board-model.js`: the editable cell list, measured geometry, cached symmetry groups, color counts, and stroke undo/redo. A new SVG gets a new model and history.
- `svg-engine.js`: template parsing and hexagon identification; decorative artwork is excluded here.
- `symmetry-engine.js`: pure symmetry calculations on measured cell centers.
- `controls.js`, `drawing-engine.js`, `image-controls.js`: control rendering and DOM/pointer events.
- `pattern-engine.js`: seeded pattern generation. `motifs.js` holds the independent geometric families and named variation parameters.
- `image-engine.js`, `color-engine.js`: image sampling, dithering, and palette matching.
- `ui-engine.js`: status and color-count presentation.

Geometry is measured in SVG viewBox units when the board is created. Resizing or scrolling does not invalidate the cached groups. Drawing, generation, image mapping, and counts all use the same board model.

## Automated checks

```bash
npm ci
npm test
```

These Node checks cover all 1,045 cells in the actual template, all symmetry modes, symmetric painting and erasing, gesture undo/redo, clear and design replacement, shared controls, and application startup. jsdom is used only for DOM/event tests; no browser or Playwright is launched. Motif color fixtures preserve the pre-refactor output across 63 configurations.

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
