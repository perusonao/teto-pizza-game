export type WalnutState = "raw" | "baked";

/** Provisional palette (PROVISIONAL, not Owner-approved). Exported so tests / the comparison sheet read one source. */
export const WALNUT_PALETTE: Record<WalnutState, { fill: string; light: string; fold: string; outline: string }> = {
  raw: { fill: "#d6ae75", light: "#ecd0a0", fold: "#8a5a2b", outline: "#5a3a1a" },
  baked: { fill: "#a8692c", light: "#c98b45", fold: "#5e3513", outline: "#3a2009" },
};

