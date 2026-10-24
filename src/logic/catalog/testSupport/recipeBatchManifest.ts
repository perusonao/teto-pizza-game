/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
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
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
