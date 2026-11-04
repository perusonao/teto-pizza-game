import { getIngredient } from "../../data/ingredients";
import { buildIdealSauceFixture } from "../../data/referencePizza";
import { getRecipe, RECIPES, type RecipeId } from "../../data/recipes";
import { buildIdealSquareSauceFixture } from "../pan/squareReference";
import type { SauceDepositLike } from "../sauceField";

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

/** Square Dough E-2: the pizza fields that put a round on the tray when the recipe's own pan is square (`panShape: "square"`, i.e. grandma-pizza); `{}` for every other recipe. */
export function panFieldsFor(recipeId: string): { pan?: "tray" } {
  return getRecipe(recipeId as RecipeId)?.panShape === "square" ? { pan: "tray" } : {};
}

/** The ideal "painted well" sauce deposits on the pan the recipe is cooked on (the square fixture for a square-pan recipe, the round one otherwise). */
export function idealSauceDepositsFor(recipeId: string): SauceDepositLike[] {
  return getRecipe(recipeId as RecipeId)?.panShape === "square" ? buildIdealSquareSauceFixture() : buildIdealSauceFixture();
}

/**
 * Square Dough E-2: the harness player's pan for a build of exactly `ids`. A walk that cooks the full ingredient set of a square-pan recipe (grandma-pizza) cooks it on the
 * tray -- as a player who has the 天板焼き switch would, since a round cook of those ingredients is never a discovery (AC2). Any other build is a round cook (`{}`).
 */
export function trayPanForIds(ids: readonly string[]): { pan?: "tray" } {
  const key = [...new Set(ids)].sort().join("|");
  const square = (RECIPES as readonly { id: string; panShape?: string; requiredIngredients: readonly { ingredientId: string }[] }[]).some(
    (r) => r.panShape === "square" && [...new Set(r.requiredIngredients.map((q) => q.ingredientId))].sort().join("|") === key,
  );
  return square ? { pan: "tray" } : {};
}
