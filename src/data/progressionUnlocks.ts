/**
 * Progression 2.0 Phase 3-4A: the Phase 3-4 authority's ingredient unlock table, copied verbatim
 * from `docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json` (Issue #195 /
 * PR #196, OD-01/OD-02 approved). `progressionUnlocks.test.ts` pins every row against that JSON,
 * so a value here can never drift from the authority -- change the JSON (and its generator), not
 * this file.
 *
 * **Not wired yet.** Nothing in the runtime imports this module: the shipped game still uses
 * `src/data/ingredients.ts` (`unlockCondition.minTotalStars`, `pricePitz`, `starterGrantOnly`)
 * and the EP1/EP4 rules. Switching the runtime over is Phase 3-4C, which also waits on OD-03
 * (content projection policy). This table therefore holds the authority values only, never a
 * projected/re-derived gate.
 *
 * Only the 105 `kind: "ingredient"` rows are here. The 23 dough/pan/capability nodes are outside
 * 3-4A (no runtime concept for them yet) and are never purchased as ingredients.
 */

export type ProgressionUnlockTier = "early" | "mid" | "late" | "endgame";

export interface ProgressionIngredientUnlock {
  ingredientId: string;
  /** Authority unlock sequence (1-based, over all 128 nodes). */
  sequence: number;
  tier: ProgressionUnlockTier;
  /** The starter trio: OWNED from the start, UNLIMITED stock, never for sale. */
  initialOwned: boolean;
  /** `CUMULATIVE_STARS` gate on progression stars (`progressionStars`, ../logic/progressionStars.ts).
   *  0 for an initial-owned row. */
  minProgressionStars: number;
  /** First-purchase price in Pitz. 0 for an initial-owned row (not for sale). */
  purchasePricePitz: number;
}

export const PROGRESSION_INGREDIENT_UNLOCKS: readonly ProgressionIngredientUnlock[] = [
  { ingredientId: "basil", sequence: 1, tier: "early", initialOwned: true, minProgressionStars: 0, purchasePricePitz: 0 },
  { ingredientId: "mozzarella", sequence: 2, tier: "early", initialOwned: true, minProgressionStars: 0, purchasePricePitz: 0 },
  { ingredientId: "tomato-sauce", sequence: 3, tier: "early", initialOwned: true, minProgressionStars: 0, purchasePricePitz: 0 },
  { ingredientId: "egg", sequence: 4, tier: "early", initialOwned: false, minProgressionStars: 2, purchasePricePitz: 60 },
  { ingredientId: "bacon", sequence: 5, tier: "early", initialOwned: false, minProgressionStars: 2, purchasePricePitz: 60 },
  { ingredientId: "onion", sequence: 6, tier: "early", initialOwned: false, minProgressionStars: 2, purchasePricePitz: 60 },
  { ingredientId: "pepperoni", sequence: 7, tier: "early", initialOwned: false, minProgressionStars: 6, purchasePricePitz: 60 },
  { ingredientId: "sausage", sequence: 8, tier: "early", initialOwned: false, minProgressionStars: 6, purchasePricePitz: 60 },
  { ingredientId: "ham", sequence: 9, tier: "early", initialOwned: false, minProgressionStars: 6, purchasePricePitz: 60 },
  { ingredientId: "black-olive", sequence: 10, tier: "early", initialOwned: false, minProgressionStars: 10, purchasePricePitz: 60 },
  { ingredientId: "mushroom", sequence: 11, tier: "early", initialOwned: false, minProgressionStars: 10, purchasePricePitz: 60 },
  { ingredientId: "oregano", sequence: 12, tier: "early", initialOwned: false, minProgressionStars: 10, purchasePricePitz: 60 },
  { ingredientId: "fresh-tomato", sequence: 13, tier: "early", initialOwned: false, minProgressionStars: 14, purchasePricePitz: 60 },
  { ingredientId: "olive-oil", sequence: 14, tier: "early", initialOwned: false, minProgressionStars: 14, purchasePricePitz: 60 },
  { ingredientId: "feta", sequence: 15, tier: "early", initialOwned: false, minProgressionStars: 14, purchasePricePitz: 60 },
  { ingredientId: "pesto", sequence: 18, tier: "early", initialOwned: false, minProgressionStars: 18, purchasePricePitz: 60 },
  { ingredientId: "tuna", sequence: 19, tier: "early", initialOwned: false, minProgressionStars: 18, purchasePricePitz: 60 },
  { ingredientId: "bell-pepper", sequence: 20, tier: "early", initialOwned: false, minProgressionStars: 22, purchasePricePitz: 60 },
  { ingredientId: "eggplant", sequence: 21, tier: "early", initialOwned: false, minProgressionStars: 22, purchasePricePitz: 60 },
  { ingredientId: "zucchini", sequence: 22, tier: "early", initialOwned: false, minProgressionStars: 22, purchasePricePitz: 60 },
  { ingredientId: "garlic", sequence: 24, tier: "mid", initialOwned: false, minProgressionStars: 28, purchasePricePitz: 100 },
  { ingredientId: "parmigiano", sequence: 25, tier: "mid", initialOwned: false, minProgressionStars: 28, purchasePricePitz: 100 },
  { ingredientId: "clam", sequence: 26, tier: "mid", initialOwned: false, minProgressionStars: 28, purchasePricePitz: 100 },
  { ingredientId: "prosciutto-crudo", sequence: 27, tier: "mid", initialOwned: false, minProgressionStars: 32, purchasePricePitz: 100 },
  { ingredientId: "arugula", sequence: 28, tier: "mid", initialOwned: false, minProgressionStars: 32, purchasePricePitz: 100 },
  { ingredientId: "burrata", sequence: 31, tier: "mid", initialOwned: false, minProgressionStars: 36, purchasePricePitz: 100 },
  { ingredientId: "anchovy", sequence: 32, tier: "mid", initialOwned: false, minProgressionStars: 40, purchasePricePitz: 100 },
  { ingredientId: "parsley", sequence: 36, tier: "mid", initialOwned: false, minProgressionStars: 44, purchasePricePitz: 100 },
  { ingredientId: "shrimp", sequence: 37, tier: "mid", initialOwned: false, minProgressionStars: 44, purchasePricePitz: 100 },
  { ingredientId: "mussel", sequence: 38, tier: "mid", initialOwned: false, minProgressionStars: 44, purchasePricePitz: 100 },
  { ingredientId: "rosemary", sequence: 39, tier: "mid", initialOwned: false, minProgressionStars: 48, purchasePricePitz: 100 },
  { ingredientId: "pork", sequence: 40, tier: "mid", initialOwned: false, minProgressionStars: 48, purchasePricePitz: 100 },
  { ingredientId: "artichoke", sequence: 42, tier: "mid", initialOwned: false, minProgressionStars: 50, purchasePricePitz: 100 },
  { ingredientId: "chicken", sequence: 43, tier: "mid", initialOwned: false, minProgressionStars: 52, purchasePricePitz: 100 },
  { ingredientId: "catupiry", sequence: 44, tier: "mid", initialOwned: false, minProgressionStars: 52, purchasePricePitz: 100 },
  { ingredientId: "corn", sequence: 45, tier: "mid", initialOwned: false, minProgressionStars: 54, purchasePricePitz: 100 },
  { ingredientId: "green-onion", sequence: 46, tier: "mid", initialOwned: false, minProgressionStars: 56, purchasePricePitz: 100 },
  { ingredientId: "doubanjiang", sequence: 47, tier: "mid", initialOwned: false, minProgressionStars: 56, purchasePricePitz: 100 },
  { ingredientId: "bbq-sauce", sequence: 49, tier: "mid", initialOwned: false, minProgressionStars: 58, purchasePricePitz: 100 },
  { ingredientId: "cilantro", sequence: 50, tier: "mid", initialOwned: false, minProgressionStars: 58, purchasePricePitz: 100 },
  { ingredientId: "ricotta", sequence: 51, tier: "mid", initialOwned: false, minProgressionStars: 60, purchasePricePitz: 100 },
  { ingredientId: "mint", sequence: 52, tier: "mid", initialOwned: false, minProgressionStars: 60, purchasePricePitz: 100 },
  { ingredientId: "pineapple", sequence: 53, tier: "mid", initialOwned: false, minProgressionStars: 62, purchasePricePitz: 100 },
  { ingredientId: "hot-dog", sequence: 54, tier: "mid", initialOwned: false, minProgressionStars: 62, purchasePricePitz: 100 },
  { ingredientId: "honey", sequence: 57, tier: "mid", initialOwned: false, minProgressionStars: 66, purchasePricePitz: 100 },
  { ingredientId: "almond", sequence: 58, tier: "mid", initialOwned: false, minProgressionStars: 68, purchasePricePitz: 100 },
  { ingredientId: "baked-beans", sequence: 59, tier: "mid", initialOwned: false, minProgressionStars: 70, purchasePricePitz: 100 },
  { ingredientId: "capers", sequence: 60, tier: "mid", initialOwned: false, minProgressionStars: 70, purchasePricePitz: 100 },
  { ingredientId: "cashew-cheese", sequence: 61, tier: "mid", initialOwned: false, minProgressionStars: 72, purchasePricePitz: 100 },
  { ingredientId: "caciocavallo", sequence: 63, tier: "late", initialOwned: false, minProgressionStars: 72, purchasePricePitz: 140 },
  { ingredientId: "cherry-tomato", sequence: 64, tier: "late", initialOwned: false, minProgressionStars: 76, purchasePricePitz: 140 },
  { ingredientId: "friarielli", sequence: 70, tier: "late", initialOwned: false, minProgressionStars: 82, purchasePricePitz: 140 },
  { ingredientId: "fromage-blanc-sauce", sequence: 71, tier: "late", initialOwned: false, minProgressionStars: 82, purchasePricePitz: 140 },
  { ingredientId: "grana-padano", sequence: 72, tier: "late", initialOwned: false, minProgressionStars: 84, purchasePricePitz: 140 },
  { ingredientId: "green-pepper", sequence: 73, tier: "late", initialOwned: false, minProgressionStars: 84, purchasePricePitz: 140 },
  { ingredientId: "palm-heart", sequence: 74, tier: "late", initialOwned: false, minProgressionStars: 86, purchasePricePitz: 140 },
  { ingredientId: "pine-nuts", sequence: 75, tier: "late", initialOwned: false, minProgressionStars: 88, purchasePricePitz: 140 },
  { ingredientId: "potato", sequence: 76, tier: "late", initialOwned: false, minProgressionStars: 88, purchasePricePitz: 140 },
  { ingredientId: "salami", sequence: 77, tier: "late", initialOwned: false, minProgressionStars: 90, purchasePricePitz: 140 },
  { ingredientId: "salt-cod", sequence: 78, tier: "late", initialOwned: false, minProgressionStars: 90, purchasePricePitz: 140 },
  { ingredientId: "sauerkraut", sequence: 79, tier: "late", initialOwned: false, minProgressionStars: 92, purchasePricePitz: 140 },
  { ingredientId: "cream-cheese", sequence: 80, tier: "late", initialOwned: false, minProgressionStars: 94, purchasePricePitz: 140 },
  { ingredientId: "jalapeno", sequence: 82, tier: "late", initialOwned: false, minProgressionStars: 94, purchasePricePitz: 140 },
  { ingredientId: "spinach", sequence: 83, tier: "late", initialOwned: false, minProgressionStars: 96, purchasePricePitz: 140 },
  { ingredientId: "lemon", sequence: 84, tier: "late", initialOwned: false, minProgressionStars: 96, purchasePricePitz: 140 },
  { ingredientId: "salmon", sequence: 85, tier: "late", initialOwned: false, minProgressionStars: 96, purchasePricePitz: 140 },
  { ingredientId: "sardine", sequence: 86, tier: "late", initialOwned: false, minProgressionStars: 98, purchasePricePitz: 140 },
  { ingredientId: "salmon-roe", sequence: 87, tier: "late", initialOwned: false, minProgressionStars: 100, purchasePricePitz: 140 },
  { ingredientId: "shiso", sequence: 88, tier: "late", initialOwned: false, minProgressionStars: 100, purchasePricePitz: 140 },
  { ingredientId: "whitebait", sequence: 89, tier: "late", initialOwned: false, minProgressionStars: 100, purchasePricePitz: 140 },
  { ingredientId: "yuzu-kosho", sequence: 90, tier: "late", initialOwned: false, minProgressionStars: 102, purchasePricePitz: 140 },
  { ingredientId: "fontina", sequence: 91, tier: "late", initialOwned: false, minProgressionStars: 102, purchasePricePitz: 140 },
  { ingredientId: "gorgonzola", sequence: 92, tier: "late", initialOwned: false, minProgressionStars: 102, purchasePricePitz: 140 },
  { ingredientId: "walnut", sequence: 93, tier: "late", initialOwned: false, minProgressionStars: 104, purchasePricePitz: 140 },
  { ingredientId: "miso-sauce", sequence: 94, tier: "late", initialOwned: false, minProgressionStars: 106, purchasePricePitz: 140 },
  { ingredientId: "white-sesame", sequence: 95, tier: "late", initialOwned: false, minProgressionStars: 106, purchasePricePitz: 140 },
  { ingredientId: "beef", sequence: 97, tier: "late", initialOwned: false, minProgressionStars: 106, purchasePricePitz: 140 },
  { ingredientId: "yakiniku-sauce", sequence: 98, tier: "late", initialOwned: false, minProgressionStars: 106, purchasePricePitz: 140 },
  { ingredientId: "avocado", sequence: 99, tier: "late", initialOwned: false, minProgressionStars: 108, purchasePricePitz: 140 },
  { ingredientId: "goat-cheese", sequence: 100, tier: "late", initialOwned: false, minProgressionStars: 108, purchasePricePitz: 140 },
  { ingredientId: "lamb", sequence: 103, tier: "endgame", initialOwned: false, minProgressionStars: 110, purchasePricePitz: 180 },
  { ingredientId: "sweet-potato", sequence: 104, tier: "endgame", initialOwned: false, minProgressionStars: 110, purchasePricePitz: 180 },
  { ingredientId: "pomegranate", sequence: 105, tier: "endgame", initialOwned: false, minProgressionStars: 112, purchasePricePitz: 180 },
  { ingredientId: "tahini", sequence: 106, tier: "endgame", initialOwned: false, minProgressionStars: 112, purchasePricePitz: 180 },
  { ingredientId: "soy-sauce", sequence: 107, tier: "endgame", initialOwned: false, minProgressionStars: 112, purchasePricePitz: 180 },
  { ingredientId: "wasabi", sequence: 108, tier: "endgame", initialOwned: false, minProgressionStars: 112, purchasePricePitz: 180 },
  { ingredientId: "cucumber", sequence: 109, tier: "endgame", initialOwned: false, minProgressionStars: 114, purchasePricePitz: 180 },
  { ingredientId: "lettuce", sequence: 110, tier: "endgame", initialOwned: false, minProgressionStars: 114, purchasePricePitz: 180 },
  { ingredientId: "yogurt-sauce", sequence: 111, tier: "endgame", initialOwned: false, minProgressionStars: 114, purchasePricePitz: 180 },
  { ingredientId: "peking-duck", sequence: 112, tier: "endgame", initialOwned: false, minProgressionStars: 114, purchasePricePitz: 180 },
  { ingredientId: "sweet-bean-sauce", sequence: 113, tier: "endgame", initialOwned: false, minProgressionStars: 114, purchasePricePitz: 180 },
  { ingredientId: "cheese-curd", sequence: 114, tier: "endgame", initialOwned: false, minProgressionStars: 116, purchasePricePitz: 180 },
  { ingredientId: "french-fries", sequence: 115, tier: "endgame", initialOwned: false, minProgressionStars: 116, purchasePricePitz: 180 },
  { ingredientId: "gravy-sauce", sequence: 116, tier: "endgame", initialOwned: false, minProgressionStars: 116, purchasePricePitz: 180 },
  { ingredientId: "cod-roe", sequence: 117, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "fresh-cream-sauce", sequence: 118, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "nori", sequence: 119, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "curry-ketchup", sequence: 120, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "paprika-powder", sequence: 121, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "wurstel", sequence: 122, tier: "endgame", initialOwned: false, minProgressionStars: 118, purchasePricePitz: 180 },
  { ingredientId: "halloumi", sequence: 124, tier: "endgame", initialOwned: false, minProgressionStars: 120, purchasePricePitz: 180 },
  { ingredientId: "zaatar", sequence: 125, tier: "endgame", initialOwned: false, minProgressionStars: 120, purchasePricePitz: 180 },
  { ingredientId: "mustard", sequence: 126, tier: "endgame", initialOwned: false, minProgressionStars: 120, purchasePricePitz: 180 },
  { ingredientId: "pickles", sequence: 127, tier: "endgame", initialOwned: false, minProgressionStars: 120, purchasePricePitz: 180 },
  { ingredientId: "swiss-cheese", sequence: 128, tier: "endgame", initialOwned: false, minProgressionStars: 120, purchasePricePitz: 180 },
];

export function getProgressionIngredientUnlock(
  ingredientId: string,
): ProgressionIngredientUnlock | undefined {
  return PROGRESSION_INGREDIENT_UNLOCKS.find((u) => u.ingredientId === ingredientId);
}
