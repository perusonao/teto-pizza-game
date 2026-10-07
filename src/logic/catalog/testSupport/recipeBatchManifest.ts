/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 3 (41 -> 47 recipes, six NO_SAUCE recipes): the manifest the validator checks. Batches 1-2 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-6",
  status: "landed",
  afterRecipeId: "pesto-salmone",
  recipes: [
    { recipeId: "bacalhau", keyIngredientId: "salt-cod", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "full-english-pizza", keyIngredientId: "baked-beans", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "palmito-pizza", keyIngredientId: "palm-heart", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "polish-kielbasa", keyIngredientId: "sauerkraut", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "porchetta-pizza", keyIngredientId: "pork", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "salsiccia-e-friarielli", keyIngredientId: "friarielli", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
