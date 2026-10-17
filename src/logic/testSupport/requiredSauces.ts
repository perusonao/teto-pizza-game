import { getIngredient } from "../../data/ingredients";
import { getRecipe, type RecipeId } from "../../data/recipes";

/**
 * Every sauce a recipe REQUIRES, in `requiredIngredients` order (one for the single-sauce recipes, none for a NO_SAUCE recipe, two for
 * `grandma-pizza`). Fixtures that build a "finished" pizza for each production recipe use this instead of the Reference (primary) sauce
 * alone, which would leave a two-sauce recipe's secondary sauce unpainted.
 */
export function requiredSauceIds(recipeId: string): string[] {
  const recipe = getRecipe(recipeId as RecipeId);
  return (recipe?.requiredIngredients ?? []).map((r) => r.ingredientId).filter((id) => getIngredient(id)?.category === "sauce");
}

/**
 * The production recipes that REQUIRE TWO SAUCES (Multi-Sauce, Issue #521). The privacy gates (`deductionProduction.gate`, `hint5Production.gate`) allowlist exactly
 * these next to the NO_SAUCE recipes. Adding an id here is the deliberate step that follows re-running those gates and the DH4 privacy sweeps with the new recipe.
 */
export const MULTI_SAUCE_RECIPE_IDS: readonly string[] = ["grandma-pizza"];
