/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Batch 6 PR-2 (53 -> 55 recipes: goat-cheese / spinach are the last-unlocking (star-gated) key materials of steps 50 / 51; avocado / artichoke unlock on the Ladder alone): the manifest the validator checks. Batches 1-5 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "batch-6-pr-2",
  status: "landed",
  afterRecipeId: "pizza-overload",
  recipes: [
    { recipeId: "california-style-pizza", keyIngredientId: "goat-cheese", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "spinach-artichoke-pizza", keyIngredientId: "spinach", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
