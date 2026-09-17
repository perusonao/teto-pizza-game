import type { Recipe } from "../data/recipes";
import type { QualityStars } from "../logic/scoring";
import { getDexEntry, type DexState } from "./dex";
import { isRecipeAvailable } from "./progression";

/**
 * Pizza Select's per-recipe card state (Issue #39 PS2). Purely derived from the same three
 * inputs `isRecipeAvailable`/Dex/Shop already share (`RECIPES`, `dex`, `ownedIngredientIds`)
 * -- there is no separate persisted "unlocked"/"seen" flag anywhere, so Pizza Select and the
 * Dex overlay can never disagree about what's locked or discovered.
 */
export type RecipeCardState =
  | { kind: "COMPLETED"; recipe: Recipe; bestStars: QualityStars; bestScore: number }
  | { kind: "NEW"; recipe: Recipe }
  | { kind: "LOCKED"; recipe: Recipe };

export function recipeCardState(
  recipe: Recipe,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): RecipeCardState {
  if (!isRecipeAvailable(recipe, ownedIngredientIds)) {
    return { kind: "LOCKED", recipe };
  }
  const entry = getDexEntry(dex, recipe.id);
  if (entry?.discovered) {
    return { kind: "COMPLETED", recipe, bestStars: entry.bestStars, bestScore: entry.bestScore };
  }
  return { kind: "NEW", recipe };
}
