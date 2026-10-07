import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { RECIPES } from "./recipes";
import { getRecipeSauceProfile, RECIPE_SAUCE_PROFILES } from "./recipeSauceProfiles";

describe("recipe sauce interaction profiles", () => {
  it("covers all 32 recipes and points at each recipe's required sauce (a recipe without one has a null profile)", () => {
    expect(Object.keys(RECIPE_SAUCE_PROFILES).sort()).toEqual(RECIPES.map((r) => r.id).sort());

    for (const recipe of RECIPES) {
      const profile = getRecipeSauceProfile(recipe.id);
      const requiredSauce = recipe.requiredIngredients.find(
        ({ ingredientId }) => getIngredient(ingredientId)?.category === "sauce",
      );

      if (requiredSauce === undefined) {
        expect(profile, recipe.id).toBeNull();
        continue;
      }
      expect(profile!.recipeId).toBe(recipe.id);
      expect(profile!.ingredientId).toBe(requiredSauce.ingredientId);
    }
  });

  it("aussie is the only recipe without a sauce profile (TQ-1D, the Technique no-sauce)", () => {
    expect(RECIPES.filter((r) => getRecipeSauceProfile(r.id) === null).map((r) => r.id)).toEqual(["aussie"]);
  });

  it("uses PAINT for tomato/pesto and explicitly marks olive oil as temporary paint", () => {
    for (const recipe of RECIPES) {
      const profile = getRecipeSauceProfile(recipe.id);
      if (profile === null) continue;
      expect(profile.interaction).toBe(
        profile.ingredientId === "olive-oil" ? "PAINT_TEMPORARY" : "PAINT",
      );
    }
  });
});
