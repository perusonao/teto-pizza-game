/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Batch 7a (55 -> 57 recipes: mint is the key material of step 52, sweet-potato the last-unlocking material of step 53 (lamb + sweet-potato); OD-B7-1): the manifest the validator checks. Batches 1-6 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "batch-7a",
  status: "landed",
  afterRecipeId: "spinach-artichoke-pizza",
  recipes: [
    { recipeId: "eggplant-ricotta-pizza", keyIngredientId: "mint", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "new-zealand-lamb-pizza", keyIngredientId: "sweet-potato", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
