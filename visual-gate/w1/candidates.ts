/**
 * W1 Ingredient Visual Preview Gate -- PREVIEW-ONLY candidate rows.
 *
 * NOT production data. This module lives outside `src/` and is only reachable from the
 * visual-gate Vite root (`visual-gate/w1/vite.config.ts`); `npm run build` (root `index.html`
 * -> `src/main.tsx`) never imports it. It exists so the 7 W1 candidate ingredients can be seen
 * in the *real* game UI (tray, pizza, bake, RESULT) without authoring them into
 * `src/data/ingredients.ts`.
 *
 * Values are copied verbatim from PR #221's ingredient authoring matrix
 * (`docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json` @ d028844, read-only
 * input). Identity rules held here:
 * - `fresh-tomato` keeps its own id; it is never aliased to `cherry-tomato`
 *   (OD-TOMATO-REPRESENTATION = TEMPORARY_SHARED_GLYPH shares only the glyph).
 * - `clam` has no chosen glyph (OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE); the preview renders
 *   whichever candidate `?clam=` selects so both can be compared under identical conditions.
 * - The shop/stock fields mirror the existing Starter-Grant rows' shape purely so the Stock
 *   Gate treats a seeded preview save as finite stock; they are placeholders, not W1 pricing.
 */
import type { Ingredient } from "../../src/data/ingredients";

export const PR221_SOURCE_SHA = "d028844e3a848ebf53cbc45d745784b7695dedf2";

export type ClamGlyphVariant = "oyster" | "spiral";

export const CLAM_GLYPH_CANDIDATES: Record<ClamGlyphVariant, { emoji: string; unicodeName: string }> = {
  oyster: { emoji: "\u{1F9AA}", unicodeName: "OYSTER" },
  spiral: { emoji: "\u{1F41A}", unicodeName: "SPIRAL SHELL" },
};

export const W1_CANDIDATE_IDS = [
  "capers",
  "clam",
  "corn",
  "eggplant",
  "fresh-tomato",
  "pineapple",
  "potato",
] as const;

const PREVIEW_STOCK_FIELDS = {
  unlockCondition: { minTotalStars: 0 },
  pricePitz: 90,
  restockQuantity: 9,
  starterGrantOnly: true,
} satisfies Partial<Ingredient>;

export function w1CandidateRows(clam: ClamGlyphVariant): Ingredient[] {
  return [
    { id: "capers", category: "topping", nameJa: "ケッパー", color: "#6f7f35", emoji: "\u{1F7E2}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "clam", category: "topping", nameJa: "あさり", color: "#c9b89a", emoji: CLAM_GLYPH_CANDIDATES[clam].emoji, placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "corn", category: "topping", nameJa: "コーン", color: "#f5cf3a", emoji: "\u{1F33D}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "eggplant", category: "topping", nameJa: "ナス", color: "#62407b", emoji: "\u{1F346}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "fresh-tomato", category: "topping", nameJa: "トマト", color: "#d9432f", emoji: "\u{1F345}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "pineapple", category: "topping", nameJa: "パイナップル", color: "#f3c623", emoji: "\u{1F34D}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "potato", category: "topping", nameJa: "じゃがいも", color: "#d9b77e", emoji: "\u{1F954}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
  ];
}

export function clamVariantFromLocation(search: string): ClamGlyphVariant {
  return new URLSearchParams(search).get("clam") === "spiral" ? "spiral" : "oyster";
}
