/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import { pinsaEnabled } from "../../../data/pinsaGate";
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** New Sauces Phase B-1 (#578; 62 -> 63 recipes; doubanjiang + green-onion are the two materials of ONE ordinary step, green-onion the last = sichuan-eggplant-pizza's Research cohort key; the second new sauce): the manifest the validator
 *  checks. A single-member cohort, so no existing recipe changes its Research letter (no `acceptedLetterShifts`). New Sauces Phase A (flammkuchen, #634), Batch 8b (shirasu-pizza, #580), 8a (the three zero-material recipes, #557), 7a and
 *  Batches 1-6 (landed) are covered by the catalog-wide tests. The original PIZZA DB page was not confirmed (green onion before the bake, doubanjiang painted, eggplant not pre-cooked are provisional assumptions, OD-B9-17). */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-b1",
  status: "landed",
  afterRecipeId: "flammkuchen",
  recipes: [
    { recipeId: "sichuan-eggplant-pizza", keyIngredientId: "green-onion", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
  // Square Dough E-2 (#521): grandma-pizza adds no material and no ladder step, so it is not a batch recipe; it is pinned as the tail here.
  followedBy: ["grandma-pizza"],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];

/**
 * Pinsa Romana (#577 P3-b-3, Owner Q7): the manifest the validator checks in a build where the Pinsa gate (src/data/pinsaGate.ts) is OPEN. Deliberately NOT in
 * `RECIPE_BATCHES`: in the shipped (gate closed) build the recipe does not exist, so `RECIPE_BATCHES` is evaluated unchanged. Pinsa adds no material and no ladder step
 * (`ladderCredit: false`), so `keyIngredientId` is only the cohort key it shares (arugula). The single named exception is jamon's Research letter: arugula's
 * cohort becomes {pinsa-romana, jamon-serrano-pizza}, so jamon gains "B" (`-->B`); any other shift stays a failure. Evaluated by `lateCatalog.pinsa.test.ts`.
 */
export const PINSA_ROMANA_BATCH: RecipeBatchManifest = {
  batchId: "pinsa-romana",
  status: "landed",
  afterRecipeId: "yuzu-shrimp-pizza", // (New Sauces Phase B U1: yuzu-shrimp-pizza is appended after ikura, before Pinsa, so Pinsa stays the last late recipe)
  recipes: [{ recipeId: "pinsa-romana", keyIngredientId: "arugula", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" }],
  acceptedLetterShifts: { "jamon-serrano-pizza": "-->B" },
};

/**
 * New Sauces Phase B U1 (#578, late catalog): the manifest of `yuzu-shrimp-pizza`, evaluated by `lateCatalog.yuzu.test.ts` over the full catalog (the late recipes included). Deliberately NOT in
 * `RECIPE_BATCHES`: that list is evaluated over the ordinary catalog. The recipe is credited, so its own late ladder step (after the roe step) unlocks `yuzu-kosho`, its cohort key; a single-member
 * cohort, so no existing recipe changes its Research letter. It is followed by Pinsa only while the Pinsa gate is open. The original PIZZA DB page was not confirmed on the yuzu-kosho PAINT before the
 * bake, the shrimp before the bake or its (absent) pre-cooking: provisional game-design assumptions (Owner 2026-10-25).
 */
export const YUZU_SHRIMP_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-u1-yuzu-shrimp",
  status: "landed",
  afterRecipeId: "ikura-salmon-pizza",
  recipes: [{ recipeId: "yuzu-shrimp-pizza", keyIngredientId: "yuzu-kosho", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" }],
  followedBy: pinsaEnabled() ? ["pinsa-romana"] : [],
};
