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
 * - `clam` has no chosen glyph (OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE); its row keeps #221's 🦪
 *   and `?clam=dedicated` swaps only the drawing (see `activeDedicatedVisuals`).
 * - Dedicated visuals (slice 2) never touch these rows: they are applied at render time by
 *   `W1Glyph.tsx`, keyed by the unchanged ingredient id.
 * - The shop/stock fields mirror the existing Starter-Grant rows' shape purely so the Stock
 *   Gate treats a seeded preview save as finite stock; they are placeholders, not W1 pricing.
 */
import type { Ingredient } from "../../src/data/ingredients";

export const PR221_SOURCE_SHA = "d028844e3a848ebf53cbc45d745784b7695dedf2";

/** Slice 1 (d62e884) compared 🦪 vs 🐚; 🐚 FAILed and is dropped. Slice 2 compares 🦪 (A) with
 *  the dedicated asari visual (B). Neither is chosen (OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE). */
export type ClamGlyphVariant = "oyster" | "dedicated";

export const CLAM_VARIANT_LABEL: Record<ClamGlyphVariant, string> = {
  oyster: "A: \u{1F9AA} OYSTER",
  dedicated: "B: dedicated asari",
};

/** "tomato-slice" = slice 2 candidate (A, read as salami/pepperoni on iPhone);
 *  "tomato-slice-final" = slice 3 Final candidate (B). */
export type DedicatedVisualKey = "tomato-slice" | "tomato-slice-final" | "caper-cluster" | "asari-valve";

export type TomatoVariant = "a" | "b";

/** `?tomato=a` shows the slice 2 candidate; default (or `?tomato=b`) the Final candidate. */
export function tomatoVariantFromLocation(search: string): TomatoVariant {
  return new URLSearchParams(search).get("tomato") === "a" ? "a" : "b";
}

export const TOMATO_VARIANT_LABEL: Record<TomatoVariant, string> = {
  a: "tomato A (slice 2)",
  b: "tomato B (Final)",
};

/** Which ingredient ids render a dedicated (non-emoji) visual in this preview page load.
 *  `?w1visual=emoji` restores slice 1's shared 🍅 / 🟢 for before/after comparison;
 *  `?clam=dedicated` switches clam from A (🦪) to B. Identity never changes -- only the drawing. */
export function activeDedicatedVisuals(search: string): Partial<Record<string, DedicatedVisualKey>> {
  const params = new URLSearchParams(search);
  const active: Partial<Record<string, DedicatedVisualKey>> = {};
  if (params.get("w1visual") !== "emoji") {
    active["fresh-tomato"] = tomatoVariantFromLocation(search) === "a" ? "tomato-slice" : "tomato-slice-final";
    active.capers = "caper-cluster";
  }
  if (clamVariantFromLocation(search) === "dedicated") active.clam = "asari-valve";
  return active;
}

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

export function w1CandidateRows(): Ingredient[] {
  return [
    { id: "capers", category: "topping", nameJa: "ケッパー", color: "#6f7f35", emoji: "\u{1F7E2}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "clam", category: "topping", nameJa: "あさり", color: "#c9b89a", emoji: "\u{1F9AA}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "corn", category: "topping", nameJa: "コーン", color: "#f5cf3a", emoji: "\u{1F33D}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "eggplant", category: "topping", nameJa: "ナス", color: "#62407b", emoji: "\u{1F346}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "fresh-tomato", category: "topping", nameJa: "トマト", color: "#d9432f", emoji: "\u{1F345}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "pineapple", category: "topping", nameJa: "パイナップル", color: "#f3c623", emoji: "\u{1F34D}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
    { id: "potato", category: "topping", nameJa: "じゃがいも", color: "#d9b77e", emoji: "\u{1F954}", placement: "scatter", ...PREVIEW_STOCK_FIELDS },
  ];
}

export function clamVariantFromLocation(search: string): ClamGlyphVariant {
  return new URLSearchParams(search).get("clam") === "dedicated" ? "dedicated" : "oyster";
}

/** The gate's own save key. `vite.config.ts` rewrites production persistence's key to this in
 *  the preview bundle only: the Preview is served from the same `perusonao.github.io` origin as
 *  production (and the other PR previews), so it must never read or write their saves. */
export const W1_GATE_SAVE_KEY = "teto-pizza-w1-visual-gate-save-v1";

/** Toppings the one-tap `?seed=all` save owns: the 7 candidates + every comparator. */
export const W1_GATE_SEED_TOPPINGS = [
  ...W1_CANDIDATE_IDS,
  "garlic",
  "cherry-tomato",
  "egg",
  "mushroom",
  "pepperoni",
  "ham",
  "black-olive",
  "anchovy",
] as const;

export function w1GateSeedSave(owned: readonly string[] = W1_GATE_SEED_TOPPINGS) {
  const finite = ["olive-oil", "pesto", "parmigiano", ...owned.filter((id) => !["olive-oil", "pesto", "parmigiano"].includes(id))];
  return {
    schemaVersion: 2,
    dex: [{ recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 }],
    pitzBalance: 0,
    ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...finite],
    missionBest: {},
    inventory: Object.fromEntries(finite.map((id) => [id, 30])),
    starterGrantClaimedRecipeIds: ["margherita"],
  };
}
