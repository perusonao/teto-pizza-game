/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Batch 8b (60 -> 61 recipes; shiso + whitebait are the materials of step 54, whitebait the last-unlocking one = shirasu-pizza's Research cohort key; OD-B8-1/2): the manifest the validator checks. A single-member
 *  cohort, so no existing recipe changes its Research letter (no `acceptedLetterShifts`). Batch 8a (the three zero-material recipes, #557), 7a and Batches 1-6 (landed) are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "batch-8b",
  status: "landed",
  afterRecipeId: "frango-catupiry",
  recipes: [
    { recipeId: "shirasu-pizza", keyIngredientId: "whitebait", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
