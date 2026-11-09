/** Provisional palette of the B23 dessert glyphs (PROVISIONAL, not Owner-approved). One source for the components, the tests and the comparison sheet. */
export type DessertGlyphId = "apple" | "banana" | "chocolate" | "graham-cracker" | "marshmallow" | "powdered-sugar";

export interface DessertTone {
  /** Body colour. */
  fill: string;
  /** Highlight / inner detail. */
  light: string;
  /** Shadow / seeds / dots. */
  mark: string;
  /** Outline: the darkest tone, keeps the piece readable on baked cheese and pale dough. */
  outline: string;
}

export const DESSERT_PALETTE: Record<DessertGlyphId, DessertTone> = {
  apple: { fill: "#d9453a", light: "#f6e7b8", mark: "#7a2a1c", outline: "#4a1a12" },
  banana: { fill: "#f2d24a", light: "#fbeaa0", mark: "#8a6a1c", outline: "#5a4310" },
  chocolate: { fill: "#6b3f26", light: "#8c5a3a", mark: "#3c2012", outline: "#24120a" },
  "graham-cracker": { fill: "#d9a85f", light: "#ecc88a", mark: "#8a5a26", outline: "#5a3a16" },
  marshmallow: { fill: "#fbf4ee", light: "#ffffff", mark: "#e9b8c4", outline: "#6a4a44" },
  "powdered-sugar": { fill: "#ffffff", light: "#f4f4f4", mark: "#cfcfd6", outline: "#5a5a66" },
};
