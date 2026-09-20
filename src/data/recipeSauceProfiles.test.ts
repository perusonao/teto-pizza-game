import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { RECIPES } from "./recipes";
import { getRecipeSauceProfile, RECIPE_SAUCE_PROFILES } from "./recipeSauceProfiles";

describe("recipe sauce interaction profiles", () => {
  it("covers all fifteen recipes and points at each recipe's required sauce", () => {
    expect(Object.keys(RECIPE_SAUCE_PROFILES)).toHaveLength(15);

    for (const recipe of RECIPES) {
      const profile = getRecipeSauceProfile(recipe.id);
      const requiredSauce = recipe.requiredIngredients.find(
        ({ ingredientId }) => getIngredient(ingredientId)?.category === "sauce",
      );

      expect(profile.recipeId).toBe(recipe.id);
      expect(profile.ingredientId).toBe(requiredSauce?.ingredientId);
    }
  });

  it("uses PAINT for tomato/pesto and explicitly marks olive oil as temporary paint", () => {
    for (const recipe of RECIPES) {
      const profile = getRecipeSauceProfile(recipe.id);
      expect(profile.interaction).toBe(
        profile.ingredientId === "olive-oil" ? "PAINT_TEMPORARY" : "PAINT",
      );
    }
  });
});
