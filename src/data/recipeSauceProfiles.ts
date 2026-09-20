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
  // Recipe Expansion Batch 1A: all 4 new recipes use tomato-sauce/PAINT, per the Fresh Recipe
  // Master Catalog's own `sauce: "tomato-sauce"` field for each (see ../data/recipes.ts).
  salsiccia: {
    recipeId: "salsiccia",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  pepperoni: {
    recipeId: "pepperoni",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  napoletana: {
    recipeId: "napoletana",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  "tonno-e-cipolla": {
    recipeId: "tonno-e-cipolla",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Recipe Expansion Batch 1B-A: pizza-bianca uses olive-oil (like quattro-formaggi/fugazza
  // above), breakfast-pizza uses tomato-sauce, per the Fresh Recipe Master Catalog's own
  // `sauce` field for each (see ../data/recipes.ts).
  "pizza-bianca": {
    recipeId: "pizza-bianca",
    ingredientId: "olive-oil",
    // TODO: olive-oil -> DRIZZLE candidate.
    interaction: "PAINT_TEMPORARY",
  },
  "breakfast-pizza": {
    recipeId: "breakfast-pizza",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
  // Recipe Expansion Batch 1B-B: capricciosa uses tomato-sauce, per the Fresh Recipe Master
  // Catalog's own `sauce` field (see ../data/recipes.ts).
  capricciosa: {
    recipeId: "capricciosa",
    ingredientId: "tomato-sauce",
    interaction: "PAINT",
  },
};

export function getRecipeSauceProfile(recipeId: RecipeId): RecipeSauceProfile {
  return RECIPE_SAUCE_PROFILES[recipeId];
}
