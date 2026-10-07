import { describe, expect, it } from "vitest";
import { getIngredient } from "./ingredients";
import { RECIPES } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds, RECIPE_SAUCE_PROFILES } from "./recipeSauceProfiles";

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

  it("the NO_SAUCE set (TQ-1D, the Technique no-sauce) is derived from this table and equals the recipes that require no sauce ingredient", () => {
    const requiresNoSauce = RECIPES.filter((r) => !r.requiredIngredients.some(({ ingredientId }) => getIngredient(ingredientId)?.category === "sauce")).map((r) => r.id);
    expect([...noSauceRecipeIds()].sort()).toEqual([...requiresNoSauce].sort());
    expect(noSauceRecipeIds()).toContain("aussie");
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
