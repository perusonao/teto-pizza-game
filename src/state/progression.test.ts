import { describe, expect, it } from "vitest";
import { availableRecipeIds, ingredientState, isRecipeAvailable } from "./progression";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, type Ingredient } from "../data/ingredients";
import { RECIPES, type Recipe } from "../data/recipes";
import { purchaseIngredient } from "../logic/economy";

/** A hypothetical future ingredient, defined only in this test file -- never added to
 *  src/data/ingredients.ts (Phase 3C-3 adds no new ingredients or recipes). */
const MOCK_FUTURE_INGREDIENT: Ingredient = {
  id: "mock-future-ingredient",
  category: "topping",
  nameJa: "未来の具材（テスト用）",
  color: "#000000",
  emoji: "❓",
  placement: "scatter",
  unlockCondition: { minTotalStars: 10 },
  pricePitz: 100,
};

/** A hypothetical future recipe that depends on `MOCK_FUTURE_INGREDIENT` plus one Starter Set
 *  ingredient -- defined only in this test file (Phase 3C-5 adds no new recipe, per SSOT
 *  section 12/scope: Recipe #7/salami is explicitly out of scope). Exercises the "owned
 *  ingredient -> dependent recipe available" derivation end to end. */
const MOCK_FUTURE_RECIPE: Recipe = {
  // Cast: RecipeId is derived from the real RECIPES array (src/data/recipes.ts) and can't
  // include a test-only id at the type level -- this recipe is only ever passed directly to
  // isRecipeAvailable, never through RECIPES-derived machinery (order selection, etc).
  id: "mock-future-recipe" as Recipe["id"],
  nameJa: "テスト用未来レシピ",
  description: "test only",
  requiredIngredients: [
    { ingredientId: "tomato-sauce", minCount: 1 },
    { ingredientId: MOCK_FUTURE_INGREDIENT.id, minCount: 1 },
  ],
  bakeTarget: { start: 0, end: 100 },
};

describe("ingredientState", () => {
  it("every existing starter ingredient is OWNED for a fresh player (empty owned list)", () => {
    for (const ingredient of INGREDIENTS) {
      expect(ingredientState(ingredient, [], 0)).toBe("OWNED");
    }
  });

  it("a starter ingredient never becomes LOCKED, even if missing from ownedIngredientIds", () => {
    const [firstStarter] = INGREDIENTS;
    expect(ingredientState(firstStarter, [], 0)).not.toBe("LOCKED");
    expect(ingredientState(firstStarter, [], 0)).toBe("OWNED");
  });

  it("a future ingredient below its unlock requirement is LOCKED", () => {
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, [], 0)).toBe("LOCKED");
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, [], 9)).toBe("LOCKED");
  });

  it("a future ingredient meeting its unlock requirement is AVAILABLE_TO_BUY", () => {
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, [], 10)).toBe("AVAILABLE_TO_BUY");
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, [], 20)).toBe("AVAILABLE_TO_BUY");
  });

  it("a future ingredient already in ownedIngredientIds is OWNED regardless of totalStars", () => {
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, [MOCK_FUTURE_INGREDIENT.id], 0)).toBe("OWNED");
  });
});

describe("isRecipeAvailable", () => {
  it("every current recipe is available when only the Starter Set is owned", () => {
    for (const recipe of RECIPES) {
      expect(isRecipeAvailable(recipe, STARTER_INGREDIENT_IDS)).toBe(true);
    }
  });

  it("is false when a required ingredient is missing", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const withoutBasil = STARTER_INGREDIENT_IDS.filter((id) => id !== "basil");
    expect(isRecipeAvailable(margherita, withoutBasil)).toBe(false);
  });

  it("is true once every required ingredient is owned", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const requiredOnly = margherita.requiredIngredients.map((r) => r.ingredientId);
    expect(isRecipeAvailable(margherita, requiredOnly)).toBe(true);
  });
});

describe("availableRecipeIds", () => {
  it("returns all 6 current recipes for a fresh player", () => {
    expect(availableRecipeIds(STARTER_INGREDIENT_IDS).sort()).toEqual(
      RECIPES.map((r) => r.id).sort(),
    );
  });

  it("excludes a recipe whose required ingredient is missing", () => {
    const withoutMozzarella = STARTER_INGREDIENT_IDS.filter((id) => id !== "mozzarella");
    const ids = availableRecipeIds(withoutMozzarella);
    // margherita / quattro-formaggi / genovese / bismarck / funghi all require mozzarella;
    // only marinara does not.
    expect(ids).toEqual(["marinara"]);
  });
});

describe("Phase 3C-5 economy integration: purchase -> OWNED -> dependent recipe available", () => {
  it("a future recipe is unavailable while its mock ingredient is only AVAILABLE_TO_BUY (not yet purchased)", () => {
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, STARTER_INGREDIENT_IDS, 10)).toBe(
      "AVAILABLE_TO_BUY",
    );
    expect(isRecipeAvailable(MOCK_FUTURE_RECIPE, STARTER_INGREDIENT_IDS)).toBe(false);
  });

  it("purchasing the mock ingredient moves it to OWNED and makes the dependent recipe available -- with no separate recipeUnlocked flag involved", () => {
    const result = purchaseIngredient({
      ingredient: MOCK_FUTURE_INGREDIENT,
      ownedIngredientIds: STARTER_INGREDIENT_IDS,
      totalStars: 10,
      pitzBalance: 100,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    // The only thing that changed is ownedIngredientIds -- recipe availability is re-derived
    // from it via isRecipeAvailable, not written or flipped anywhere directly.
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, result.nextOwnedIngredientIds, 10)).toBe("OWNED");
    expect(isRecipeAvailable(MOCK_FUTURE_RECIPE, result.nextOwnedIngredientIds)).toBe(true);
  });

  it("purchasing does not affect any other recipe's availability", () => {
    const result = purchaseIngredient({
      ingredient: MOCK_FUTURE_INGREDIENT,
      ownedIngredientIds: STARTER_INGREDIENT_IDS,
      totalStars: 10,
      pitzBalance: 100,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const recipe of RECIPES) {
      expect(isRecipeAvailable(recipe, result.nextOwnedIngredientIds)).toBe(true);
    }
  });
});
