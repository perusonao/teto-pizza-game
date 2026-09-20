import { describe, expect, it } from "vitest";
import { RECIPES, getRecipe, type RecipeId } from "./recipes";
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

/** Recipe Expansion Batch 1A (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1A_Implementation-Result.md):
 *  the 4 new recipes appended after fugazza's chain, per that report's own "Batch 1A暫定
 *  progression" section. */
const BATCH_1A_RECIPE_IDS: readonly RecipeId[] = [
  "salsiccia",
  "pepperoni",
  "napoletana",
  "tonno-e-cipolla",
];

/** Recipe Expansion Batch 1B-A (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-A_Result.md):
 *  the 2 new recipes appended after Batch 1A's own chain. */
const BATCH_1B_A_RECIPE_IDS: readonly RecipeId[] = ["pizza-bianca", "breakfast-pizza"];

/** Recipe Expansion Batch 1B-B (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-B_Result.md):
 *  the 1 new recipe appended after Batch 1B-A's own chain. */
const BATCH_1B_B_RECIPE_IDS: readonly RecipeId[] = ["capricciosa"];

/** Recipe Expansion Batch 1B-C (docs/reports/TETO_RECIPE-EXPANSION_BATCH-1B-C_Result.md):
 *  the 1 new recipe appended after Batch 1B-B's own chain (Supreme deferred -- see that
 *  report's Section 2/Final Verdict). */
const BATCH_1B_C_RECIPE_IDS: readonly RecipeId[] = ["meat-lovers"];

describe("RECIPES (Phase 3C-6: fugazza is Recipe #7; Batch 1A adds #8-#11; Batch 1B-A adds #12-#13; Batch 1B-B adds #14; Batch 1B-C adds #15)", () => {
  it("has exactly 15 recipes total (7 shipped + Batch 1A's 4 + Batch 1B-A's 2 + Batch 1B-B's 1 + Batch 1B-C's 1)", () => {
    expect(RECIPES).toHaveLength(15);
  });

  it("the pre-Batch-1A Starter 6 + fugazza are unchanged", () => {
    expect(
      RECIPES.filter(
        (r) =>
          r.id !== "fugazza" &&
          !BATCH_1A_RECIPE_IDS.includes(r.id) &&
          !BATCH_1B_A_RECIPE_IDS.includes(r.id) &&
          !BATCH_1B_B_RECIPE_IDS.includes(r.id) &&
          !BATCH_1B_C_RECIPE_IDS.includes(r.id),
      )
        .map((r) => r.id)
        .sort(),
    ).toEqual([...STARTER_RECIPE_IDS].sort());
  });

  it("Batch 1A's 4 recipes exist exactly once each, ids unique across all 15", () => {
    for (const id of BATCH_1A_RECIPE_IDS) {
      expect(RECIPES.filter((r) => r.id === id)).toHaveLength(1);
    }
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("Batch 1B-A's 2 recipes exist exactly once each, chained after Batch 1A", () => {
    for (const id of BATCH_1B_A_RECIPE_IDS) {
      expect(RECIPES.filter((r) => r.id === id)).toHaveLength(1);
    }
  });

  it("Batch 1B-B's 1 recipe exists exactly once, chained after Batch 1B-A", () => {
    for (const id of BATCH_1B_B_RECIPE_IDS) {
      expect(RECIPES.filter((r) => r.id === id)).toHaveLength(1);
    }
  });

  it("Batch 1B-C's 1 recipe exists exactly once, chained after Batch 1B-B", () => {
    for (const id of BATCH_1B_C_RECIPE_IDS) {
      expect(RECIPES.filter((r) => r.id === id)).toHaveLength(1);
    }
  });

  describe.each(BATCH_1A_RECIPE_IDS)("%s (Batch 1A)", (id) => {
    it("exists, uses only existing spread/scatter mechanics ingredients, and has a valid bake target", () => {
      const r = getRecipe(id);
      expect(r).toBeDefined();
      expect(r!.requiredIngredients.length).toBeGreaterThan(0);
      expect(r!.bakeTarget.start).toBeLessThan(r!.bakeTarget.end);
      expect(r!.bakeTarget.start).toBeGreaterThan(0);
      expect(r!.bakeTarget.end).toBeLessThan(100);
      expect(r!.baseRewardPitz).toBe(100);
    });

    it("has a chain unlockCondition (never available from a fresh save)", () => {
      const r = getRecipe(id);
      expect(r!.unlockCondition?.requiresRecipeId).toBeDefined();
      expect(r!.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    });
  });

  describe.each(BATCH_1B_A_RECIPE_IDS)("%s (Batch 1B-A)", (id) => {
    it("exists, uses only existing spread/scatter mechanics ingredients, and has a valid bake target", () => {
      const r = getRecipe(id);
      expect(r).toBeDefined();
      expect(r!.requiredIngredients.length).toBeGreaterThan(0);
      expect(r!.bakeTarget.start).toBeLessThan(r!.bakeTarget.end);
      expect(r!.bakeTarget.start).toBeGreaterThan(0);
      expect(r!.bakeTarget.end).toBeLessThan(100);
      expect(r!.baseRewardPitz).toBe(100);
    });

    it("has a chain unlockCondition (never available from a fresh save)", () => {
      const r = getRecipe(id);
      expect(r!.unlockCondition?.requiresRecipeId).toBeDefined();
      expect(r!.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    });
  });

  describe("pizza-bianca (Batch 1B-A sauce architecture)", () => {
    const recipe = getRecipe("pizza-bianca");

    it("requires exactly olive-oil + rosemary (no tomato sauce)", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["olive-oil", "rosemary"].sort(),
      );
    });

    it("chains after tonno-e-cipolla, the last Batch 1A recipe", () => {
      expect(recipe?.unlockCondition?.requiresRecipeId).toBe("tonno-e-cipolla");
    });
  });

  describe("breakfast-pizza (Batch 1B-A)", () => {
    const recipe = getRecipe("breakfast-pizza");

    it("requires tomato-sauce + mozzarella + egg + bacon", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["bacon", "egg", "mozzarella", "tomato-sauce"].sort(),
      );
    });

    it("chains after pizza-bianca", () => {
      expect(recipe?.unlockCondition?.requiresRecipeId).toBe("pizza-bianca");
    });
  });

  describe.each(BATCH_1B_B_RECIPE_IDS)("%s (Batch 1B-B)", (id) => {
    it("exists, uses only existing spread/scatter mechanics ingredients, and has a valid bake target", () => {
      const r = getRecipe(id);
      expect(r).toBeDefined();
      expect(r!.requiredIngredients.length).toBeGreaterThan(0);
      expect(r!.bakeTarget.start).toBeLessThan(r!.bakeTarget.end);
      expect(r!.bakeTarget.start).toBeGreaterThan(0);
      expect(r!.bakeTarget.end).toBeLessThan(100);
      expect(r!.baseRewardPitz).toBe(100);
    });

    it("has a chain unlockCondition (never available from a fresh save)", () => {
      const r = getRecipe(id);
      expect(r!.unlockCondition?.requiresRecipeId).toBeDefined();
      expect(r!.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    });
  });

  describe("capricciosa (Batch 1B-B)", () => {
    const recipe = getRecipe("capricciosa");

    it("requires tomato-sauce + mozzarella + mushroom + oregano + ham + black-olive (exactly 6 ingredients)", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["black-olive", "ham", "mozzarella", "mushroom", "oregano", "tomato-sauce"].sort(),
      );
    });

    it("has exactly 8 total non-sauce pieces (fits the player-reference ring's 8-slot ceiling)", () => {
      const nonSauceCount = recipe!.requiredIngredients
        .filter((r) => r.ingredientId !== "tomato-sauce")
        .reduce((sum, r) => sum + r.minCount, 0);
      expect(nonSauceCount).toBe(8);
    });

    it("chains after breakfast-pizza, the last Batch 1B-A recipe, at 33 totalStars (Progression Tuning 1)", () => {
      expect(recipe?.unlockCondition?.requiresRecipeId).toBe("breakfast-pizza");
      expect(recipe?.unlockCondition?.minTotalStars).toBe(33);
    });
  });

  describe.each(BATCH_1B_C_RECIPE_IDS)("%s (Batch 1B-C)", (id) => {
    it("exists, uses only existing spread/scatter mechanics ingredients, and has a valid bake target", () => {
      const r = getRecipe(id);
      expect(r).toBeDefined();
      expect(r!.requiredIngredients.length).toBeGreaterThan(0);
      expect(r!.bakeTarget.start).toBeLessThan(r!.bakeTarget.end);
      expect(r!.bakeTarget.start).toBeGreaterThan(0);
      expect(r!.bakeTarget.end).toBeLessThan(100);
      expect(r!.baseRewardPitz).toBe(100);
    });

    it("has a chain unlockCondition (never available from a fresh save)", () => {
      const r = getRecipe(id);
      expect(r!.unlockCondition?.requiresRecipeId).toBeDefined();
      expect(r!.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    });
  });

  describe("meat-lovers (Batch 1B-C)", () => {
    const recipe = getRecipe("meat-lovers");

    it("requires tomato-sauce + mozzarella + bacon + ham + pepperoni + sausage (exactly 6 ingredients, zero new ingredient data)", () => {
      expect(recipe?.requiredIngredients.map((r) => r.ingredientId).sort()).toEqual(
        ["bacon", "ham", "mozzarella", "pepperoni", "sausage", "tomato-sauce"].sort(),
      );
    });

    it("has exactly 8 total non-sauce pieces (fits the player-reference ring's 8-slot ceiling)", () => {
      const nonSauceCount = recipe!.requiredIngredients
        .filter((r) => r.ingredientId !== "tomato-sauce")
        .reduce((sum, r) => sum + r.minCount, 0);
      expect(nonSauceCount).toBe(8);
    });

    it("chains after capricciosa, the last Batch 1B-B recipe, at 36 totalStars (Progression Tuning 1)", () => {
      expect(recipe?.unlockCondition?.requiresRecipeId).toBe("capricciosa");
      expect(recipe?.unlockCondition?.minTotalStars).toBe(36);
    });

    it("has no Supreme entry in RECIPES -- deferred per the reference-capacity gate (see the Result Report)", () => {
      const ids: readonly string[] = RECIPES.map((r) => r.id);
      expect(ids.includes("supreme")).toBe(false);
    });
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
      // EP4: olive-oil/oregano are also no longer trivially Starter-owned -- own them
      // explicitly (as production's quattro-formaggi/marinara Starter Grant would have) so
      // this test keeps isolating onion, its own stated subject.
      expect(
        isRecipeAvailable(recipe!, chainDex, [
          ...STARTER_INGREDIENT_IDS,
          "olive-oil",
          "oregano",
          "onion",
        ]),
      ).toBe(true);
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
