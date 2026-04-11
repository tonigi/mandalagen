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
export const RANDOM_SYMMETRIES = [
  { value: "c6-mirror-vertex", label: "C6 mirrored through vertices", order: 6, offset: 0, mirror: true },
  { value: "c6-mirror-side", label: "C6 mirrored through sides", order: 6, offset: Math.PI / 6, mirror: true },
  { value: "c6", label: "C6 rotational", order: 6, offset: 0, mirror: false },
  { value: "c3-vertex", label: "C3 through vertices", order: 3, offset: 0, mirror: true },
  { value: "c3-side", label: "C3 through sides", order: 3, offset: Math.PI / 3, mirror: true },
  { value: "c3", label: "C3 rotational", order: 3, offset: 0, mirror: false },
  { value: "c2-vertex", label: "C2 through vertices", order: 2, offset: 0, mirror: true },
  { value: "c2-side", label: "C2 through sides", order: 2, offset: Math.PI / 6, mirror: true },
  { value: "c2", label: "C2 rotational", order: 2, offset: 0, mirror: false },
  { value: "none", label: "No enforced symmetry", order: 1, offset: 0, mirror: false },
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
