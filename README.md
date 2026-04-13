# Mandala Color Generator

A web application for creating and color-mapping mandala designs, specifically tailored for the [Quercetti Fantacolor Mandala](https://www.youtube.com/watch?v=VXxuqUFme4g) toy (discontinued?). The toy holds paper maps to guide the placement of colored nails along an hexagonal grid. 

This software  maps raster images to the hexagonal grid as well as procedural pattern generation. The output must be printed at 100% scale (5.16 mm grid spacing).


## Features

### 1. Image-Matched Hex Colors
- **Image Mapping**: Upload, paste, or drag-and-drop an image to overlay it on a hexagonal SVG grid.
- **Precision Controls**: Adjust scale, X/Y translation, and rotation to align your image perfectly.
- **Dithering Algorithms**: Includes "None", "Ordered", and "Floyd-Steinberg" error diffusion for better color representation with limited palettes.
- **Live Preview**: Adjust overlay opacity to see how the image aligns with the hex grid before applying colors.

### 2. Random Pattern Generator
- **Procedural Motifs**: Generate complex designs using motifs like "Flower", "Star", "Ribbons", "Diamonds", "Petals", and "Mosaic".
- **Symmetry Modes**: Support for various rotational and mirror symmetries (C6, C3, C2).
- **Seedable Generation**: Use unique seeds to recreate or share specific patterns.
- **Customizable Aesthetics**: Fine-tune contrast and "white accents" for varied visual styles.

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
