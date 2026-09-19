import { describe, expect, it } from "vitest";
import { RECIPES, getRecipe } from "./recipes";
import { ORDERS } from "./orders";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { isRecipeAvailable } from "../state/progression";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "../state/dex";
import type { QualityStars } from "../logic/scoring";

/** Builds a Dex where `recipeIds` are discovered at `stars` each -- a shorthand for
 *  simulating "played through the Chapter 1 chain up to here." */
function dexDiscovering(recipeIds: readonly string[], stars: QualityStars): DexState {
  let dex: DexState = EMPTY_DEX;
  for (const recipeId of recipeIds) {
    dex = registerScoreToDex(dex, recipeId, {
      matchScore: 100,
      ingredientScore: 100,
      placementScore: 100,
      bakeScore: 100,
      total: stars * 20,
      stars,
    }).dex;
  }
  return dex;
}

const STARTER_RECIPE_IDS = [
  "margherita",
  "marinara",
  "quattro-formaggi",
  "genovese",
  "bismarck",
  "funghi",
];

describe("RECIPES (Phase 3C-6: fugazza is Recipe #7)", () => {
  it("has exactly 7 recipes total", () => {
    expect(RECIPES).toHaveLength(7);
  });

  it("the current Starter 6 are unchanged", () => {
    expect(RECIPES.filter((r) => r.id !== "fugazza").map((r) => r.id).sort()).toEqual(
      [...STARTER_RECIPE_IDS].sort(),
    );
  });

  describe("fugazza", () => {
    const recipe = getRecipe("fugazza");

    it("exists and has the expected display name", () => {
      expect(recipe).toBeDefined();
      expect(recipe?.nameJa).toBe("フガッサ");
    });

    it("requires exactly olive-oil + onion + oregano (no tomato sauce, no cheese)", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["olive-oil", "onion", "oregano"].sort(),
      );
    });

    it("requires onion (its only non-Starter, gating ingredient)", () => {
      const onionReq = recipe?.requiredIngredients.find((r) => r.ingredientId === "onion");
      expect(onionReq).toBeDefined();
      expect(onionReq?.minCount).toBeGreaterThan(0);
    });

    it("has a bake target that is a natural (start < end, positive) range", () => {
      expect(recipe?.bakeTarget.start).toBeLessThan(recipe?.bakeTarget.end ?? -1);
      expect(recipe?.bakeTarget.start).toBeGreaterThan(0);
      expect(recipe?.bakeTarget.end).toBeLessThan(100);
    });

    it("is unavailable while onion is not owned (Starter Set only), even once its recipe-unlock chain/stars gate holds", () => {
      const chainDex = dexDiscovering(
        ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
        5 as QualityStars,
      );
      expect(isRecipeAvailable(recipe!, chainDex, STARTER_INGREDIENT_IDS)).toBe(false);
    });

    it("is unavailable while its recipe-unlock chain/stars gate isn't met, even once onion is owned", () => {
      expect(isRecipeAvailable(recipe!, EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"])).toBe(
        false,
      );
    });

    it("becomes available once both the recipe-unlock gate and onion ownership hold", () => {
      const chainDex = dexDiscovering(
        ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
        5 as QualityStars,
      );
      expect(isRecipeAvailable(recipe!, chainDex, [...STARTER_INGREDIENT_IDS, "onion"])).toBe(
        true,
      );
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

  it("recipe/order id integrity: order-fugazza exists and targets fugazza", () => {
    const order = ORDERS.find((o) => o.id === "order-fugazza");
    expect(order).toBeDefined();
    expect(order?.recipeId).toBe("fugazza");
  });
});
