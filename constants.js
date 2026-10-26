export const RANDOM_MOTIFS = ["auto", "flower", "star", "ribbons", "diamonds", "petals", "mosaic"];
export const RANDOM_MOTIF_DESCRIPTIONS = {
  auto: "Picks one motif family from the seed.",
  flower: "Radial lobes with soft ring variation.",
  star: "Spoke-like rays from the center.",
  ribbons: "Diagonal bands crossing the grid.",
  diamonds: "Lattice-like diamond structure.",
  petals: "Tighter petal lobes with ring accents.",
  mosaic: "Patchy, noisy cell clusters.",
};
// Planar group notation: D_n has n rotations and n reflections (2n operations).
export const RANDOM_SYMMETRIES = [
  { value: "c6-mirror-vertex", label: "D₆ — hexagonal dihedral (6 mirrors)", order: 6, offset: 0, mirror: true },
  { value: "c6", label: "C₆ — sixfold rotational (60°)", order: 6, offset: 0, mirror: false },
  { value: "c3-vertex", label: "D₃ — triangular dihedral (axes 0°, 60°, 120°)", order: 3, offset: 0, mirror: true },
  { value: "c3-side", label: "D₃ — triangular dihedral (axes 30°, 90°, 150°)", order: 3, offset: Math.PI / 6, mirror: true },
  { value: "c3", label: "C₃ — threefold rotational (120°)", order: 3, offset: 0, mirror: false },
  ...[0, 30, 60].map(degrees => ({ value: `d2-${degrees}`, label: `D₂ — dihedral (axes ${degrees}° and ${degrees + 90}°)`, order: 2, offset: degrees * Math.PI / 180, mirror: true })),
  { value: "c2", label: "C₂ — twofold rotational (180°)", order: 2, offset: 0, mirror: false },
  ...[0, 30, 60, 90, 120, 150].map(degrees => ({ value: `mirror-${degrees}`, label: `Cₛ — bilateral reflection (axis ${degrees}°)`, order: 1, offset: degrees * Math.PI / 180, mirror: true })),
  { value: "none", label: "C₁ — identity (free drawing)", order: 1, offset: 0, mirror: false },
];
export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
export const DITHER_STRENGTH = 48;
export const palettes = {
  purple: [
    { name: "azure blue", hex: "#1496dc" },
    { name: "royal purple", hex: "#6432aa" },
    { name: "white", hex: "#ffffff" },
    { name: "crimson red", hex: "#eb0000" },
    { name: "vermilion orange", hex: "#ff6e32" },
    { name: "golden yellow", hex: "#ffe100" },
  ],
  blue: [
    { name: "azure blue", hex: "#1496dc" },
    { name: "blue", hex: "#0000ff" },
    { name: "white", hex: "#ffffff" },
    { name: "crimson red", hex: "#eb0000" },
    { name: "vermilion orange", hex: "#ff6e32" },
    { name: "golden yellow", hex: "#ffe100" },
  ],
};
export const svgPath = "data/onepage_model.svg";
