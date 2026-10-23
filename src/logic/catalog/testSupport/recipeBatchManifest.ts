/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** New Sauces Phase A (#578; 61 -> 62 recipes; fromage-blanc-sauce is the sole material of step 55 = flammkuchen's Research cohort key; the first new sauce): the manifest the validator checks. A single-member cohort, so no existing
 *  recipe changes its Research letter (no `acceptedLetterShifts`). Batch 8b (shirasu-pizza, #580), 8a (the three zero-material recipes, #557), 7a and Batches 1-6 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "new-sauces-a",
  status: "landed",
  afterRecipeId: "shirasu-pizza",
  recipes: [
    { recipeId: "flammkuchen", keyIngredientId: "fromage-blanc-sauce", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
