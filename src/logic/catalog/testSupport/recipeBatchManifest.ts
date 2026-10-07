/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 5 (51 -> 53 recipes: ricotta / hot-dog key materials): the manifest the validator checks. Batches 1-4 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-8",
  status: "landed",
  afterRecipeId: "pizza-moscow",
  recipes: [
    { recipeId: "pizza-bianca-ricotta", keyIngredientId: "ricotta", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pizza-overload", keyIngredientId: "hot-dog", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
