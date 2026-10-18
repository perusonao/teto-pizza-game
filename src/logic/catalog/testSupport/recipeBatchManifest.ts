/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Batch 8a (57 -> 60 recipes, zero new materials, all non-credit): chilean-napolitana (step 20, cohort key fresh-tomato), spanish-chorizo-pizza (step 28, bell-pepper: its own single-member cohort, no letter) and frango-catupiry (step 44, catupiry) are branching Research entries
 *  that never advance the ladder, so `keyIngredientId` is the recipe's last-unlocking material (its Research cohort key), not a new ladder step. Chilean and frango join the cohorts of pesto-caprese and brazilian-catupiry-corn-pizza, so those two gain the letter A (the new recipe is B)
 *  (`acceptedLetterShifts`, Owner-approved 2026-10-18). Batch 7a (landed) and Batches 1-6 are covered by the catalog-wide tests. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "batch-8a",
  status: "landed",
  afterRecipeId: "new-zealand-lamb-pizza",
  recipes: [
    { recipeId: "chilean-napolitana", keyIngredientId: "fresh-tomato", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "spanish-chorizo-pizza", keyIngredientId: "bell-pepper", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "frango-catupiry", keyIngredientId: "catupiry", ladderCredit: false, lunchRush: false, cut: false, hint: "key-free" },
  ],
  acceptedLetterShifts: { "pesto-caprese": "-->A", "brazilian-catupiry-corn-pizza": "-->A" },
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
