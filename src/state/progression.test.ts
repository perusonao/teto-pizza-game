import { describe, expect, it } from "vitest";
import {
  availableRecipeIds,
  ingredientState,
  isRecipeAvailable,
  recipesUnlockedByIngredient,
} from "./progression";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient, type Ingredient } from "../data/ingredients";
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
 *  ingredient -- defined only in this test file. Exercises the "owned ingredient -> dependent
 *  recipe available" derivation end to end, independent of the real `fugazza` recipe below. */
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
  baseRewardPitz: 100,
};

describe("ingredientState", () => {
  it("every existing starter ingredient is OWNED for a fresh player (empty owned list)", () => {
    for (const id of STARTER_INGREDIENT_IDS) {
      const ingredient = getIngredient(id)!;
      expect(ingredientState(ingredient, [], 0)).toBe("OWNED");
    }
  });

  it("a starter ingredient never becomes LOCKED, even if missing from ownedIngredientIds", () => {
    const firstStarter = getIngredient(STARTER_INGREDIENT_IDS[0])!;
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

describe("ingredientState -- onion (Phase 3C-6 production data, not a mock)", () => {
  const onion = INGREDIENTS.find((i) => i.id === "onion")!;
  const threshold = onion.unlockCondition!.minTotalStars;

  it("is not part of the Starter Set", () => {
    expect(STARTER_INGREDIENT_IDS).not.toContain("onion");
  });

  it("has a minTotalStars unlock condition and a positive integer price", () => {
    expect(onion.unlockCondition).toBeDefined();
    expect(threshold).toBeGreaterThan(0);
    expect(Number.isInteger(onion.pricePitz)).toBe(true);
    expect(onion.pricePitz).toBeGreaterThan(0);
  });

  it("is LOCKED on a fresh save (0 totalStars, not owned)", () => {
    expect(ingredientState(onion, STARTER_INGREDIENT_IDS, 0)).toBe("LOCKED");
  });

  it("is LOCKED one star below threshold", () => {
    expect(ingredientState(onion, STARTER_INGREDIENT_IDS, threshold - 1)).toBe("LOCKED");
  });

  it("is AVAILABLE_TO_BUY at exactly the threshold", () => {
    expect(ingredientState(onion, STARTER_INGREDIENT_IDS, threshold)).toBe("AVAILABLE_TO_BUY");
  });

  it("is AVAILABLE_TO_BUY above the threshold", () => {
    expect(ingredientState(onion, STARTER_INGREDIENT_IDS, threshold + 10)).toBe("AVAILABLE_TO_BUY");
  });

  it("is OWNED once purchased, regardless of totalStars", () => {
    expect(ingredientState(onion, [...STARTER_INGREDIENT_IDS, "onion"], 0)).toBe("OWNED");
  });
});

describe("recipesUnlockedByIngredient (Shop 'これを買うと' preview, Phase 3C-6)", () => {
  it("fugazza is listed as unlocked by onion before it's owned", () => {
    expect(recipesUnlockedByIngredient("onion", STARTER_INGREDIENT_IDS)).toEqual(["fugazza"]);
  });

  it("returns empty once onion is already owned (fugazza is already available)", () => {
    expect(recipesUnlockedByIngredient("onion", [...STARTER_INGREDIENT_IDS, "onion"])).toEqual(
      [],
    );
  });

  it("a Starter ingredient unlocks nothing (every Starter recipe is already available)", () => {
    expect(recipesUnlockedByIngredient("mozzarella", STARTER_INGREDIENT_IDS)).toEqual([]);
  });
});

describe("isRecipeAvailable", () => {
  it("every Starter Set recipe (all except fugazza) is available when only the Starter Set is owned", () => {
    const starterRecipes = RECIPES.filter((r) => r.id !== "fugazza");
    expect(starterRecipes).toHaveLength(6);
    for (const recipe of starterRecipes) {
      expect(isRecipeAvailable(recipe, STARTER_INGREDIENT_IDS)).toBe(true);
    }
  });

  it("fugazza is not available when only the Starter Set is owned (Phase 3C-6: needs onion)", () => {
    const fugazza = RECIPES.find((r) => r.id === "fugazza")!;
    expect(isRecipeAvailable(fugazza, STARTER_INGREDIENT_IDS)).toBe(false);
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
  it("returns exactly the 6 Starter Set recipes for a fresh player (fugazza excluded)", () => {
    const starterRecipeIds = RECIPES.filter((r) => r.id !== "fugazza").map((r) => r.id);
    expect(availableRecipeIds(STARTER_INGREDIENT_IDS).sort()).toEqual(starterRecipeIds.sort());
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

    // Every real Starter Set recipe stays available; fugazza (needs the unrelated `onion`
    // ingredient, untouched by this purchase) stays unavailable -- purchasing one ingredient
    // must never leak into a *different* recipe's availability.
    for (const recipe of RECIPES) {
      const expected = recipe.id !== "fugazza";
      expect(isRecipeAvailable(recipe, result.nextOwnedIngredientIds)).toBe(expected);
    }
  });
});
