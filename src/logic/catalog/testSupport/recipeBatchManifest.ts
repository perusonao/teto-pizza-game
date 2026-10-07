/**
 * Recipe Expansion speed-up Phase 1: the batch manifest the Recipe Batch Validator reads
 * (`recipeBatchValidator.ts`). TEST SUPPORT ONLY. A batch PR flips `status` to "landed" and fills the explicit
 * declarations (`ladderCredit` / `lunchRush` / `cut` / `hint`) of each recipe; the validator then checks them
 * against the data. Nothing here is authority for the recipes themselves (RECIPES / the ladder stay the SSOT).
 */
import type { RecipeBatchManifest } from "./recipeBatchValidator";

/** The next 3-recipe batch (33 -> 36). PLANNED: none of these recipes / materials exist yet. */
export const NEXT_RECIPE_BATCH: RecipeBatchManifest = {
  batchId: "expansion-batch-4",
  status: "planned",
  afterRecipeId: "pesto-trapanese",
  recipes: [
    { recipeId: "baba-ganoush-pizza", keyIngredientId: "pine-nuts" },
    { recipeId: "prosciutto-funghi", keyIngredientId: "prosciutto-crudo" },
    { recipeId: "veggie-supreme-pizza", keyIngredientId: "green-pepper" },
  ],
};

export const RECIPE_BATCHES: readonly RecipeBatchManifest[] = [NEXT_RECIPE_BATCH];
