import type { Recipe } from "../data/recipes";
import type { QualityStars } from "../logic/scoring";
import { getIngredient } from "../data/ingredients";
import { getDexEntry, type DexState } from "./dex";
import { isRecipeAvailable } from "./progression";

/**
 * Pizza Select's per-recipe card state (Issue #39 PS2/PS3). Purely derived from the same
 * inputs `isRecipeAvailable`/Dex/Shop already share (`RECIPES`, `dex`, `ownedIngredientIds`)
 * -- there is no separate persisted "unlocked"/"seen" flag anywhere, so Pizza Select and the
 * Dex overlay can never disagree about what's locked or discovered.
 */
export type RecipeCardState =
  | { kind: "COMPLETED"; recipe: Recipe; bestStars: QualityStars; bestScore: number }
  | { kind: "NEW"; recipe: Recipe }
  | { kind: "LOCKED"; recipe: Recipe; unlockHint: string | null };

/**
 * PS3: a locked card's optional hint, built only from real ingredient data
 * (`Ingredient.unlockCondition`, `../data/ingredients`) -- never an invented condition. `null`
 * whenever the missing ingredient has no `unlockCondition` to report (there is currently
 * exactly one locked recipe, フガッサ, gated on `onion`'s `minTotalStars`).
 */
function unlockHintFor(recipe: Recipe, ownedIngredientIds: readonly string[]): string | null {
  const owned = new Set(ownedIngredientIds);
  const missing = recipe.requiredIngredients
    .map((req) => getIngredient(req.ingredientId))
    .find((ingredient) => ingredient !== undefined && !owned.has(ingredient.id));
  if (!missing?.unlockCondition) return null;
  return `${missing.nameJa}を解放（★${missing.unlockCondition.minTotalStars}）で作れます`;
}

export function recipeCardState(
  recipe: Recipe,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): RecipeCardState {
  if (!isRecipeAvailable(recipe, ownedIngredientIds)) {
    return { kind: "LOCKED", recipe, unlockHint: unlockHintFor(recipe, ownedIngredientIds) };
  }
  const entry = getDexEntry(dex, recipe.id);
  if (entry?.discovered) {
    return { kind: "COMPLETED", recipe, bestStars: entry.bestStars, bestScore: entry.bestScore };
  }
  return { kind: "NEW", recipe };
}
