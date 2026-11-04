import { describe, expect, it } from "vitest";
import { DISCOVERY_LADDER } from "./discoveryLadder";
import { RECIPES, type Recipe } from "./recipes";
import { getRecipeSauceProfile, noSauceRecipeIds } from "./recipeSauceProfiles";
import { getReferencePizza } from "./referencePizza";
import { isCutEligible } from "./cookingProfiles";
import { RECIPE_HINT_ROLES } from "./recipeHintRoles";
import { RECIPE_DISCOVERY_TARGET_IDS } from "./discoveryCatalog";
import { getReferenceSlots } from "../logic/pizzaReferenceLayout";

/**
 * B12 (Issue #706): jamaican-jerk-chicken-pizza. PROVISIONAL SPEC: the original pizzadb.jp page was NOT confirmed, and the source sauce field is 'その他' (BASE_SAUCE_UNSPECIFIED), so NO_SAUCE is a
 * GAMEPLAY ASSUMPTION pending an Owner decision. The counts and the generic 58-78 bake window are GAMEPLAY CALIBRATION. No new material, so no ladder step of its own.
 */
const ID = "jamaican-jerk-chicken-pizza";
const recipe = RECIPES.find((r) => r.id === ID)! as Recipe;

describe(ID, () => {
  it("has the matrix ingredient set (chicken / green-pepper / mozzarella / pineapple) with the provisional 8-piece counts", () => {
    expect(Object.fromEntries(recipe.requiredIngredients.map((q) => [q.ingredientId, q.minCount]))).toEqual({ mozzarella: 2, chicken: 3, "green-pepper": 1, pineapple: 2 });
    expect(recipe.requiredIngredients.reduce((n, q) => n + q.minCount, 0)).toBe(8);
  });

  it("is a non-credit, Lunch Rush opt-out, key-free, no-CUT ordinary recipe with the generic bake window and every requirement placed before the bake", () => {
    expect(recipe.ladderCredit).toBe(false);
    expect(recipe.lunchRush).toBe(false);
    expect(isCutEligible(ID)).toBe(false);
    expect(recipe.bakeTarget).toEqual({ start: 58, end: 78 });
    expect(recipe.baseRewardPitz).toBe(100);
    expect(recipe.requiredIngredients.every((q) => !("applicationPhase" in q))).toBe(true);
    expect(RECIPE_HINT_ROLES[ID]).toEqual({ keyFree: true });
  });

  it("is NO_SAUCE (the existing `null` mapping) and its Reference has no sauce", () => {
    expect(getRecipeSauceProfile(ID)).toBeNull();
    expect(noSauceRecipeIds().includes(ID)).toBe(true);
    expect(getReferencePizza(ID)!.sauce).toBeNull();
  });

  it("its Reference has 8 pieces on the RT-01 ring in requiredIngredients order, matching the required counts", () => {
    const ref = getReferencePizza(ID)!;
    expect(ref.pieceGroups.flatMap((g) => g.positions)).toEqual(getReferenceSlots(8).map(({ x, y }) => ({ x, y })));
    for (const g of ref.pieceGroups) expect(g.positions.length).toBe(recipe.requiredIngredients.find((q) => q.ingredientId === g.ingredientId)!.minCount);
  });

  it("targets the 172 evidence row, and no other recipe has this ingredient set or is a subset / superset of it", () => {
    expect((RECIPE_DISCOVERY_TARGET_IDS as Record<string, string>)[ID]).toBe("jamaican-jerk-chicken-pizza-pizzadb-p3");
    const mine = new Set<string>(recipe.requiredIngredients.map((q) => q.ingredientId));
    for (const r of RECIPES) {
      if (r.id === ID) continue;
      const theirs = new Set<string>(r.requiredIngredients.map((q) => q.ingredientId));
      const inter = [...mine].filter((i) => theirs.has(i)).length;
      expect(inter === mine.size || inter === theirs.size, `${r.id} is a subset / superset`).toBe(false);
    }
  });

  it("adds no ladder step: green-pepper (step 32) stays keyed to veggie-supreme-pizza", () => {
    expect(DISCOVERY_LADDER.steps.some((s) => s.keyRecipeId === ID)).toBe(false);
    expect(DISCOVERY_LADDER.steps.find((s) => s.ingredientIds.includes("green-pepper"))).toMatchObject({ step: 32, keyRecipeId: "veggie-supreme-pizza" });
  });
});
