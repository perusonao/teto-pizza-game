/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 4 (47 -> 51 recipes: catupiry / jalapeno / feta / sardine key materials): the manifest the validator checks. Batches 1-3 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-7",
  status: "landed",
  afterRecipeId: "salsiccia-e-friarielli",
  recipes: [
    { recipeId: "brazilian-catupiry-corn-pizza", keyIngredientId: "catupiry", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "jalapeno-popper-pizza", keyIngredientId: "jalapeno", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pizza-feta-eliniki", keyIngredientId: "feta", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pizza-moscow", keyIngredientId: "sardine", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
