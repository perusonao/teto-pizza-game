/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 2 (36 -> 41 recipes): the manifest the validator checks. Batch 1 (landed) is covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-5",
  status: "landed",
  afterRecipeId: "veggie-supreme-pizza",
  recipes: [
    { recipeId: "jamon-serrano-pizza", keyIngredientId: "arugula", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "calabresa-argentina", keyIngredientId: "salami", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "rucola-e-grana", keyIngredientId: "grana-padano", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "vegan-cashew-cheese-pizza", keyIngredientId: "cashew-cheese", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "pesto-salmone", keyIngredientId: "salmon", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
