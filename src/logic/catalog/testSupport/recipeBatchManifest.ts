/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** Expansion Batch 1 (33 -> 36 recipes): LANDED. Declarations are checked against the data by the validator. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-4",
  status: "landed",
  afterRecipeId: "pesto-trapanese",
  recipes: [
    { recipeId: "baba-ganoush-pizza", keyIngredientId: "pine-nuts", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "prosciutto-funghi", keyIngredientId: "prosciutto-crudo", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
    { recipeId: "veggie-supreme-pizza", keyIngredientId: "green-pepper", ladderCredit: true, lunchRush: false, cut: false, hint: "key-free" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
