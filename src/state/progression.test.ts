import { describe, expect, it } from "vitest";
import {
  availableRecipeIds,
  ingredientState,
  isRecipeAvailable,
  recipeUnlocked,
  recipesUnlockedByIngredient,
} from "./progression";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient, type Ingredient } from "../data/ingredients";
import { RECIPES, getRecipe, type Recipe } from "../data/recipes";
import { purchaseIngredient } from "../logic/economy";
import { EMPTY_DEX, registerScoreToDex, type DexState } from "./dex";
import type { QualityStars } from "../logic/scoring";

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
 *  recipe available" derivation end to end, independent of the real `fugazza` recipe below.
 *  No `unlockCondition` of its own, so its recipe-unlock axis is always satisfied -- this mock
 *  is specifically for the *ingredient-ownership* axis integration test below. */
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

/** Builds a Dex where `recipeIds` are discovered at `stars` each, in order -- a shorthand for
 *  simulating "played through the chain up to here" in the tests below. */
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

// This describe block exercises the pure `ingredientState` derivation only -- LOCKED/
// AVAILABLE_TO_BUY/OWNED stay meaningful states for onion regardless of EP4's
// `starterGrantOnly` flag (../data/ingredients.ts), which only gates the Shop UI/
// `purchaseIngredient` transaction (see ../logic/economy.test.ts), never this function.
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

  it("is OWNED once in ownedIngredientIds (e.g. via its Starter Grant), regardless of totalStars", () => {
    expect(ingredientState(onion, [...STARTER_INGREDIENT_IDS, "onion"], 0)).toBe("OWNED");
  });
});

describe("recipeUnlocked (Economy & Progression 1.0 EP1: chain + totalStars gate)", () => {
  const margherita = getRecipe("margherita")!;
  const funghi = getRecipe("funghi")!;
  const marinara = getRecipe("marinara")!;
  const bismarck = getRecipe("bismarck")!;
  const genovese = getRecipe("genovese")!;
  const quattroFormaggi = getRecipe("quattro-formaggi")!;
  const fugazza = getRecipe("fugazza")!;

  it("margherita has no unlockCondition and is always unlocked, even on an empty Dex", () => {
    expect(margherita.unlockCondition).toBeUndefined();
    expect(recipeUnlocked(margherita, EMPTY_DEX)).toBe(true);
  });

  it("every other recipe is locked on a fresh save (empty Dex)", () => {
    for (const recipe of [funghi, marinara, bismarck, genovese, quattroFormaggi, fugazza]) {
      expect(recipeUnlocked(recipe, EMPTY_DEX)).toBe(false);
    }
  });

  it("the Chapter 1 chain unlocks one recipe at a time as the previous one is discovered, at any quality (★1 floor)", () => {
    expect(recipeUnlocked(funghi, EMPTY_DEX)).toBe(false);

    const afterMargherita = dexDiscovering(["margherita"], 1 as QualityStars);
    expect(recipeUnlocked(funghi, afterMargherita)).toBe(true);
    expect(recipeUnlocked(marinara, afterMargherita)).toBe(false);

    const afterFunghi = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    expect(recipeUnlocked(marinara, afterFunghi)).toBe(true);
  });

  it("quattro-formaggi requires both genovese discovered AND totalStars >= 8 (AND, not OR)", () => {
    // Chain satisfied (genovese discovered), but totalStars only 5 (five ★1 discoveries) --
    // below the 8 floor.
    const chainOnlyDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      1 as QualityStars,
    );
    expect(recipeUnlocked(genovese, chainOnlyDex)).toBe(true);
    expect(recipeUnlocked(quattroFormaggi, chainOnlyDex)).toBe(false);

    // totalStars satisfied (5 discoveries at ★5 = 25 >= 8) and chain satisfied.
    const bothDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese"],
      5 as QualityStars,
    );
    expect(recipeUnlocked(quattroFormaggi, bothDex)).toBe(true);
  });

  it("quattro-formaggi stays locked when totalStars is met but genovese itself hasn't been discovered", () => {
    // Four other recipes at ★5 = 20 totalStars (>= 8), but genovese was never played.
    const dex = dexDiscovering(["margherita", "funghi", "marinara", "bismarck"], 5 as QualityStars);
    expect(recipeUnlocked(quattroFormaggi, dex)).toBe(false);
  });

  it("fugazza requires quattro-formaggi discovered AND totalStars >= 12", () => {
    const allSixAtOneStar = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      1 as QualityStars,
    );
    // 6 discoveries at ★1 = 6 totalStars, below fugazza's 12 floor even though the chain holds.
    expect(recipeUnlocked(fugazza, allSixAtOneStar)).toBe(false);

    const allSixAtFiveStars = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    expect(recipeUnlocked(fugazza, allSixAtFiveStars)).toBe(true);
  });

  it("no recipe before #6 (quattro-formaggi) has any totalStars requirement", () => {
    for (const recipe of [funghi, marinara, bismarck, genovese]) {
      expect(recipe.unlockCondition?.minTotalStars).toBeUndefined();
    }
  });
});

describe("recipesUnlockedByIngredient (Shop 'これを買うと' preview, Phase 3C-6)", () => {
  // EP4: fugazza also needs olive-oil/oregano owned (both non-Starter since EP4 -- in
  // production these arrive via quattro-formaggi's/marinara's own Starter Grant, well before
  // fugazza's own chain/stars gate can ever hold) -- `onion` remains the one ingredient this
  // suite is deliberately testing as "the only thing still missing."
  const FUGAZZA_OTHER_INGREDIENTS_OWNED = [...STARTER_INGREDIENT_IDS, "olive-oil", "oregano"];

  it("fugazza is listed as unlocked by onion once its recipe-level chain/stars gate already holds", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    expect(
      recipesUnlockedByIngredient("onion", dex, FUGAZZA_OTHER_INGREDIENTS_OWNED),
    ).toEqual(["fugazza"]);
  });

  it("does not list fugazza while its recipe-level unlockCondition is still unmet, even hypothetically owning onion", () => {
    expect(
      recipesUnlockedByIngredient("onion", EMPTY_DEX, FUGAZZA_OTHER_INGREDIENTS_OWNED),
    ).toEqual([]);
  });

  it("returns empty once onion is already owned (fugazza is already available)", () => {
    const dex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    expect(
      recipesUnlockedByIngredient("onion", dex, [...FUGAZZA_OTHER_INGREDIENTS_OWNED, "onion"]),
    ).toEqual([]);
  });

  it("a Starter ingredient unlocks nothing (no recipe is gated on ownership of a Starter ingredient)", () => {
    expect(recipesUnlockedByIngredient("mozzarella", EMPTY_DEX, STARTER_INGREDIENT_IDS)).toEqual(
      [],
    );
  });
});

describe("isRecipeAvailable (two-axis AND: recipeUnlocked && ingredients owned)", () => {
  it("margherita is available on a fresh save (Starter Set owned, empty Dex)", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    expect(isRecipeAvailable(margherita, EMPTY_DEX, STARTER_INGREDIENT_IDS)).toBe(true);
  });

  it("every other recipe is unavailable on a fresh save, even with every ingredient owned (recipe-unlock axis blocks it)", () => {
    const others = RECIPES.filter((r) => r.id !== "margherita");
    expect(others).toHaveLength(12);
    const ownedEverything = [
      ...STARTER_INGREDIENT_IDS,
      "onion",
      "sausage",
      "pepperoni",
      "anchovy",
      "tuna",
      "rosemary",
      "bacon",
    ];
    for (const recipe of others) {
      expect(isRecipeAvailable(recipe, EMPTY_DEX, ownedEverything)).toBe(false);
    }
  });

  it("is false when a required ingredient is missing, even once the recipe-unlock axis is satisfied", () => {
    const margherita = RECIPES.find((r) => r.id === "margherita")!;
    const withoutBasil = STARTER_INGREDIENT_IDS.filter((id) => id !== "basil");
    expect(isRecipeAvailable(margherita, EMPTY_DEX, withoutBasil)).toBe(false);
  });

  it("is true once the recipe-unlock axis holds and every required ingredient is owned", () => {
    const funghi = RECIPES.find((r) => r.id === "funghi")!;
    const dex = dexDiscovering(["margherita"], 1 as QualityStars);
    // EP4: `mushroom` is no longer trivially Starter-owned (in production it arrives via
    // funghi's own Starter Grant the instant this same Dex change unlocks it) -- own it
    // explicitly here to keep testing this test's own claim (recipeUnlocked && ingredientsOwned
    // -> available), independent of the Starter Grant mechanism itself (covered in
    // starterStock.test.ts).
    expect(isRecipeAvailable(funghi, dex, [...STARTER_INGREDIENT_IDS, "mushroom"])).toBe(true);
  });

  it("fugazza needs both axes: chain/stars unlocked AND onion owned", () => {
    const fugazza = RECIPES.find((r) => r.id === "fugazza")!;
    const chainDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    // EP4: olive-oil/oregano are also no longer trivially Starter-owned -- own them explicitly
    // (as if already Starter-Granted by quattro-formaggi/marinara) so `onion` is the one
    // ingredient this test is deliberately isolating.
    const ownedExceptOnion = [...STARTER_INGREDIENT_IDS, "olive-oil", "oregano"];
    // Chain/stars satisfied, but onion not owned yet -- still unavailable.
    expect(isRecipeAvailable(fugazza, chainDex, ownedExceptOnion)).toBe(false);
    // Onion owned, but chain/stars not yet satisfied -- still unavailable.
    expect(isRecipeAvailable(fugazza, EMPTY_DEX, [...ownedExceptOnion, "onion"])).toBe(false);
    // Both axes satisfied -- available.
    expect(isRecipeAvailable(fugazza, chainDex, [...ownedExceptOnion, "onion"])).toBe(true);
  });
});

describe("availableRecipeIds", () => {
  it("returns only margherita for a fresh player (empty Dex, Starter Set owned)", () => {
    expect(availableRecipeIds(EMPTY_DEX, STARTER_INGREDIENT_IDS)).toEqual(["margherita"]);
  });

  it("excludes margherita itself when its own required ingredient is missing", () => {
    const withoutMozzarella = STARTER_INGREDIENT_IDS.filter((id) => id !== "mozzarella");
    expect(availableRecipeIds(EMPTY_DEX, withoutMozzarella)).toEqual([]);
  });

  it("grows one recipe at a time as the Chapter 1 chain is played through", () => {
    expect(availableRecipeIds(EMPTY_DEX, STARTER_INGREDIENT_IDS)).toEqual(["margherita"]);

    // EP4: funghi/marinara's own non-Starter ingredients (mushroom, garlic/oregano) are no
    // longer trivially owned -- own them explicitly here (as production's Starter Grant would
    // have, the instant this same Dex change unlocks each recipe) so this test keeps exercising
    // `availableRecipeIds`'s own chain-growth claim, independent of the grant mechanism itself.
    const afterMargherita = dexDiscovering(["margherita"], 1 as QualityStars);
    expect(
      availableRecipeIds(afterMargherita, [...STARTER_INGREDIENT_IDS, "mushroom"]).sort(),
    ).toEqual(["margherita", "funghi"].sort());

    const afterFunghi = dexDiscovering(["margherita", "funghi"], 1 as QualityStars);
    expect(
      availableRecipeIds(afterFunghi, [
        ...STARTER_INGREDIENT_IDS,
        "mushroom",
        "garlic",
        "oregano",
      ]).sort(),
    ).toEqual(["margherita", "funghi", "marinara"].sort());
  });
});

describe("Phase 3C-5 economy integration: purchase -> OWNED -> dependent recipe available", () => {
  it("a future recipe is unavailable while its mock ingredient is only AVAILABLE_TO_BUY (not yet purchased)", () => {
    expect(ingredientState(MOCK_FUTURE_INGREDIENT, STARTER_INGREDIENT_IDS, 10)).toBe(
      "AVAILABLE_TO_BUY",
    );
    expect(isRecipeAvailable(MOCK_FUTURE_RECIPE, EMPTY_DEX, STARTER_INGREDIENT_IDS)).toBe(false);
  });

  it("purchasing the mock ingredient moves it to OWNED and makes the dependent recipe available -- with no separate recipeUnlocked condition on this mock recipe", () => {
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
    expect(isRecipeAvailable(MOCK_FUTURE_RECIPE, EMPTY_DEX, result.nextOwnedIngredientIds)).toBe(
      true,
    );
  });

  it("purchasing does not affect any real recipe's recipe-unlock axis", () => {
    const result = purchaseIngredient({
      ingredient: MOCK_FUTURE_INGREDIENT,
      ownedIngredientIds: STARTER_INGREDIENT_IDS,
      totalStars: 10,
      pitzBalance: 100,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Every real recipe's availability is unaffected by purchasing an unrelated mock ingredient
    // -- only margherita is available on an otherwise-fresh (empty Dex) save.
    for (const recipe of RECIPES) {
      const expected = recipe.id === "margherita";
      expect(isRecipeAvailable(recipe, EMPTY_DEX, result.nextOwnedIngredientIds)).toBe(expected);
    }
  });
});
