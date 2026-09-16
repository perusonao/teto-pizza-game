import type { RecipeId } from "./recipes";

/**
 * The player-facing sauce gesture for a recipe. All profiles use the same field-based
 * dispenser/rendering pipeline; the profile changes the ingredient, not the basic action.
 *
 * Olive oil is intentionally explicit rather than being silently treated as tomato sauce.
 * A true line/amount-oriented DRIZZLE gesture is a later interaction family and would expand
 * this parity PR beyond the existing, proven paint controller.
 */
export type SauceInteractionKind = "PAINT" | "PAINT_TEMPORARY";

export interface RecipeSauceProfile {
  recipeId: RecipeId;
  ingredientId: "tomato-sauce" | "pesto" | "olive-oil";
  interaction: SauceInteractionKind;
}

export const RECIPE_SAUCE_PROFILES: Readonly<Record<RecipeId, RecipeSauceProfile>> = {
  margherita: {
    recipeId: "margherita",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  marinara: {
    recipeId: "marinara",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "quattro-formaggi": {
    recipeId: "quattro-formaggi",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  genovese: {
    recipeId: "genovese",
    ingredientId: "pesto",
    interaction: "PAINT",
  },
  bismarck: {
    recipeId: "bismarck",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  funghi: {
    recipeId: "funghi",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  fugazza: {
    recipeId: "fugazza",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
};

export function getRecipeSauceProfile(recipeId: RecipeId): RecipeSauceProfile {
  return RECIPE_SAUCE_PROFILES[recipeId];
}
