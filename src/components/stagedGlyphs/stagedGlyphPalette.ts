/**
 * B21/B22 staged-glyph palettes (Issue #417 sublane, Owner P-2 2026-11-08). PROVISIONAL: shape and colour are not Owner-approved
 * until the 390x844 iPhone HV. One source for the components, the tests and the comparison sheet.
 * Rule: outline is the darkest tone, fill < light in darkness ordering is NOT required (some glyphs are dark-on-light), but the outline
 * must stay readable against baked cheese (#e8c15a) and pale dough (#f1dcae) -- checked in the test.
 */
export interface GlyphColors { fill: string; light: string; detail: string; outline: string }

export const STAGED_GLYPH_PALETTE = {
  "cheddar-cubes": { fill: "#f2a33a", light: "#f8c870", detail: "#c97a1a", outline: "#7a420c" },
  "lettuce-leaf": { fill: "#9fd36b", light: "#c6e99c", detail: "#5a9a2e", outline: "#2c5a16" },
  "tortilla-chip-triangles": { fill: "#e3b955", light: "#f1d58a", detail: "#b87a28", outline: "#6b4210" },
  "cabbage-shreds": { fill: "#c9e3a3", light: "#eaf5d3", detail: "#8fb865", outline: "#456b2a" },
  "bonito-flake-curls": { fill: "#c98f5a", light: "#e6bd90", detail: "#9a5f30", outline: "#5a3418" },
  "fennel-slices": { fill: "#e4edc2", light: "#f6f9e2", detail: "#9bbd6a", outline: "#4c6a2a" },
  "orange-slices": { fill: "#f59a1c", light: "#fcd07a", detail: "#d9700e", outline: "#8a4208" },
  "carrot-rounds": { fill: "#ee7d28", light: "#f8aa5c", detail: "#c4571a", outline: "#7a3410" },
  "red-cabbage-shreds": { fill: "#9a4a9e", light: "#dcb6df", detail: "#6a2a70", outline: "#3c1642" },
  "sunflower-kernels": { fill: "#e6d49a", light: "#f4ead0", detail: "#a8914a", outline: "#5e4c1c" },
  "radicchio-leaf": { fill: "#a42a40", light: "#f0d6dc", detail: "#6e1626", outline: "#3c0a16" },
  "truffle-shavings": { fill: "#4a382e", light: "#9a8672", detail: "#2a1d16", outline: "#17100b" },
  "brie-wedge": { fill: "#f6edc6", light: "#fffaf0", detail: "#d8c98a", outline: "#7a6a34" },
} as const satisfies Record<string, GlyphColors>;

export type StagedGlyphId = keyof typeof STAGED_GLYPH_PALETTE;
export const STAGED_GLYPH_IDS = Object.keys(STAGED_GLYPH_PALETTE) as StagedGlyphId[];

/** Ingredient id -> visual id (the `pieceVisual` a wiring PR would register). */
export const STAGED_GLYPH_FOR_INGREDIENT: Record<string, StagedGlyphId> = {
  cheddar: "cheddar-cubes",
  lettuce: "lettuce-leaf",
  "tortilla-chips": "tortilla-chip-triangles",
  cabbage: "cabbage-shreds",
  "bonito-flakes": "bonito-flake-curls",
  fennel: "fennel-slices",
  orange: "orange-slices",
  carrot: "carrot-rounds",
  "red-cabbage": "red-cabbage-shreds",
  "sunflower-seeds": "sunflower-kernels",
  radicchio: "radicchio-leaf",
  truffle: "truffle-shavings",
  brie: "brie-wedge",
};
