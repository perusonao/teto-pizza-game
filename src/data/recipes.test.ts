import { describe, expect, it } from "vitest";
import { RECIPES, getRecipe } from "./recipes";
import { ORDERS } from "./orders";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { isRecipeAvailable } from "../state/progression";

const STARTER_RECIPE_IDS = [
  "margherita",
  "marinara",
  "quattro-formaggi",
  "genovese",
  "bismarck",
  "funghi",
];

describe("RECIPES (Phase 3C-6: salami-pizza is Recipe #7)", () => {
  it("has exactly 7 recipes total", () => {
    expect(RECIPES).toHaveLength(7);
  });

  it("the current Starter 6 are unchanged", () => {
    expect(RECIPES.filter((r) => r.id !== "salami-pizza").map((r) => r.id).sort()).toEqual(
      [...STARTER_RECIPE_IDS].sort(),
    );
  });

  describe("salami-pizza", () => {
    const recipe = getRecipe("salami-pizza");

    it("exists and has the expected display name", () => {
      expect(recipe).toBeDefined();
      expect(recipe?.nameJa).toBe("サラミピザ");
    });

    it("requires exactly tomato-sauce + mozzarella + salami", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["mozzarella", "salami", "tomato-sauce"].sort(),
      );
    });

    it("requires salami (its only non-Starter, gating ingredient)", () => {
      const salamiReq = recipe?.requiredIngredients.find((r) => r.ingredientId === "salami");
      expect(salamiReq).toBeDefined();
      expect(salamiReq?.minCount).toBeGreaterThan(0);
    });

    it("has a bake target that is a natural (start < end, positive) range", () => {
      expect(recipe?.bakeTarget.start).toBeLessThan(recipe?.bakeTarget.end ?? -1);
      expect(recipe?.bakeTarget.start).toBeGreaterThan(0);
      expect(recipe?.bakeTarget.end).toBeLessThan(100);
    });

    it("is unavailable while salami is not owned (Starter Set only)", () => {
      expect(isRecipeAvailable(recipe!, STARTER_INGREDIENT_IDS)).toBe(false);
    });

    it("becomes available once salami is owned", () => {
      expect(isRecipeAvailable(recipe!, [...STARTER_INGREDIENT_IDS, "salami"])).toBe(true);
    });
  });

  it("recipe/order id integrity: every order's recipeId points at a real recipe", () => {
    const recipeIds = new Set(RECIPES.map((r) => r.id));
    for (const order of ORDERS) {
      expect(recipeIds.has(order.recipeId)).toBe(true);
    }
  });

  it("recipe/order id integrity: every recipe has exactly one order", () => {
    for (const recipe of RECIPES) {
      const matching = ORDERS.filter((o) => o.recipeId === recipe.id);
      expect(matching).toHaveLength(1);
    }
  });

  it("recipe/order id integrity: order-salami-pizza exists and targets salami-pizza", () => {
    const order = ORDERS.find((o) => o.id === "order-salami-pizza");
    expect(order).toBeDefined();
    expect(order?.recipeId).toBe("salami-pizza");
  });
});
