/**
 * First promotion candidates (Issue #780, Owner D-7 2026-11-08): taco-pizza and okonomiyaki-style-pizza, prepared in the exact shape the
 * late catalog (src/data/lateCatalog.ts) takes, so the promotion PR is a copy of these rows plus the table rows listed in
 * `PROMOTION_TOUCHES`. STAGED ONLY: nothing here is imported by production code, and promoting it (editing HOT catalog files) needs a
 * separate Owner approval.
 *
 * Placement: LATE catalog, because taco has POST_BAKE garnishes and okonomiyaki uses `nori` (a late-only ingredient; an ordinary recipe
 * may not require a late ingredient, and a late recipe must have a POST_BAKE requirement -- validateLateCatalog). Precedents:
 * bbq-chicken-pizza (POST_BAKE garnish), tarako-cream-pizza (nori POST_BAKE).
 *
 * PROVISIONAL GAME-DESIGN SPEC (original pizzadb.jp NOT confirmed; matrix comparison-table rows only):
 *  - taco-pizza (evidence `taco-pizza-pizzadb`): tomato-sauce 1 (PAINT; the row's salsa, I-1 reuse) / cheddar 2 / beef 3 (the row's ground
 *    beef, I-1 reuse) / fresh-tomato 2 / lettuce 2 + tortilla-chips 2 POST_BAKE (matrix post_bake evidence; R-6 / D-5).
 *  - okonomiyaki-style-pizza (evidence `okonomiyaki-style-pizza-pizzadb-p1`): okonomiyaki-sauce 1 (PAINT) / cabbage 3 / pork 3 / mayo 1 /
 *    bonito-flakes 2 / nori 1 POST_BAKE (the row's 「青のり」, R-7 -> nori). The cabbage is cooked in the dish (its own technique, D-5:
 *    not a raw leafy topping), so it stays pre-bake. No cheese: the row lists none (same rule as B20-A: no added mozzarella).
 *  - GAMEPLAY CALIBRATION (not source): counts follow the late-catalog convention (sauce 1, main protein 3, garnish 1-2), bake 58-78,
 *    baseRewardPitz 100, lunchRush false, key-free Hint, no CUT, ladder-credited with one late step per recipe.
 */

export interface CandidateIngredient {
  readonly id: string;
  readonly category: "sauce" | "cheese" | "topping";
  readonly nameJa: string;
  readonly color: string;
  /** The never-displayed text fallback; unique across the catalog (G18). No dedicated SVG yet (#417 lane). */
  readonly emoji: string;
  readonly placement: "spread" | "scatter";
  readonly unlockCondition: { readonly minTotalStars: number };
}

export interface CandidateRecipe {
  readonly id: string;
  readonly nameJa: string;
  readonly description: string;
  readonly requiredIngredients: readonly { readonly ingredientId: string; readonly minCount: number; readonly applicationPhase?: "POST_BAKE" }[];
  readonly bakeTarget: { readonly start: number; readonly end: number };
  readonly baseRewardPitz: number;
  readonly lunchRush: false;
}

export const CANDIDATE_INGREDIENTS: readonly CandidateIngredient[] = [
  { id: "cheddar", category: "cheese", nameJa: "チェダーチーズ", color: "#f2a33a", emoji: "\u{1F536}", placement: "scatter", unlockCondition: { minTotalStars: 0 } },
  { id: "lettuce", category: "topping", nameJa: "レタス", color: "#9fd36b", emoji: "\u{1FAB4}", placement: "scatter", unlockCondition: { minTotalStars: 0 } },
  { id: "tortilla-chips", category: "topping", nameJa: "トルティーヤチップス", color: "#e8c25a", emoji: "\u{1F53A}", placement: "scatter", unlockCondition: { minTotalStars: 0 } },
  { id: "okonomiyaki-sauce", category: "sauce", nameJa: "お好み焼きソース", color: "#5a3420", emoji: "\u{1F376}", placement: "spread", unlockCondition: { minTotalStars: 0 } },
  { id: "cabbage", category: "topping", nameJa: "キャベツ", color: "#c9e3a3", emoji: "\u{1F96C}", placement: "scatter", unlockCondition: { minTotalStars: 0 } },
  { id: "bonito-flakes", category: "topping", nameJa: "かつお節", color: "#c98f5a", emoji: "\u{1FAB6}", placement: "scatter", unlockCondition: { minTotalStars: 0 } },
];

export const CANDIDATE_RECIPES: readonly CandidateRecipe[] = [
  {
    id: "taco-pizza",
    nameJa: "タコピザ",
    description: "牛ひき肉とチェダーに、レタスとトルティーヤチップスをあわせた一枚。",
    requiredIngredients: [
      { ingredientId: "tomato-sauce", minCount: 1 },
      { ingredientId: "cheddar", minCount: 2 },
      { ingredientId: "beef", minCount: 3 },
      { ingredientId: "fresh-tomato", minCount: 2 },
      { ingredientId: "lettuce", minCount: 2, applicationPhase: "POST_BAKE" },
      { ingredientId: "tortilla-chips", minCount: 2, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
  {
    id: "okonomiyaki-style-pizza",
    nameJa: "お好み焼き風ピザ",
    description: "お好み焼きソースにキャベツと豚肉、マヨネーズとかつお節をのせた一枚。",
    requiredIngredients: [
      { ingredientId: "okonomiyaki-sauce", minCount: 1 },
      { ingredientId: "cabbage", minCount: 3 },
      { ingredientId: "pork", minCount: 3 },
      { ingredientId: "mayo", minCount: 1 },
      { ingredientId: "bonito-flakes", minCount: 2 },
      { ingredientId: "nori", minCount: 1, applicationPhase: "POST_BAKE" },
    ],
    bakeTarget: { start: 58, end: 78 },
    baseRewardPitz: 100,
    lunchRush: false,
  },
];

/** Hint 5.0 families of the new toppings (ingredientTaxonomy rows) and their size classes (toppingSizeClass rows). */
export const CANDIDATE_TAXONOMY_ROWS = [["lettuce", "vegetable"], ["tortilla-chips", "other"], ["cabbage", "vegetable"], ["bonito-flakes", "seafood"]] as const;
export const CANDIDATE_TOPPING_SIZE_CLASS = { lettuce: "m", "tortilla-chips": "m", cabbage: "s", "bonito-flakes": "xs" } as const;
/** One late ladder step per recipe (its new materials), key-free Hint roles, discovery target ids (= the matrix evidence ids). */
export const CANDIDATE_LADDER_STEPS = [
  { ingredientIds: ["cheddar", "lettuce", "tortilla-chips"], keyRecipeId: "taco-pizza" },
  { ingredientIds: ["okonomiyaki-sauce", "cabbage", "bonito-flakes"], keyRecipeId: "okonomiyaki-style-pizza" },
] as const;
export const CANDIDATE_HINT_ROLES = { "taco-pizza": { keyFree: true }, "okonomiyaki-style-pizza": { keyFree: true } } as const;
export const CANDIDATE_DISCOVERY_TARGET_IDS = { "taco-pizza": "taco-pizza-pizzadb", "okonomiyaki-style-pizza": "okonomiyaki-style-pizza-pizzadb-p1" } as const;

/**
 * Files the promotion PR would edit (HOT ones marked). Listed so the Owner approves the exact surface; NOT edited here.
 * Merge order kept: PR #783 (Batch 19) -> B20-A -> this promotion.
 */
export const PROMOTION_TOUCHES = [
  "src/data/lateCatalog.ts (LATE_RECIPES / LATE_INGREDIENTS / LATE_LADDER_STEPS / LATE_TAXONOMY_ROWS / LATE_TOPPING_SIZE_CLASS / LATE_DISCOVERY_TARGET_IDS / orders)",
  "src/data/recipeHintRoles.ts (two key-free rows)",
  "src/data/recipeSauceProfiles.ts (okonomiyaki-sauce profile; taco uses the shipped tomato-sauce)",
  "src/data/referencePizza.ts (two Reference layouts)",
  "src/data/catalogLedger.test.ts (recipes +2, credited +2, ingredients +6, toppings +4, ladder steps +2)",
  "src/data/recipes.ts (HOT; only if a type-keyed table must carry the new ids)",
  "golden: lateCatalog.offSurface / hint5 ladders (append only) / recipeBatchManifest",
  "e2e: one Guided + Free Cooking walk per recipe at 390x844 (H-1: all recipes automated + representative iPhone HV)",
] as const;
