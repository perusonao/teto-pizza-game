import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER, W1_25_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { materialOffer } from "../logic/materialShop";
import { ingredientCollectionCount, obtainableIngredientIds } from "./materialEntitlement";

/**
 * Progression 2.0 W1 I5a-3 / I5b-3: the "所持 N/M種" denominator is derived from what this build can
 * actually unlock (starters + current Discovery Ladder materials), never from the raw catalog
 * length. I5a kept it at 22 while the 7 W1 materials were catalog-only; the 25-recipe ladder (I5b-3)
 * grew it to 29 with no other change.
 */

const W1 = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"];

describe("obtainableIngredientIds", () => {
  it("is the 3 starters + the 26 current ladder materials = the whole 29-row catalog, in catalog order", () => {
    const ids = obtainableIngredientIds();
    expect(DISCOVERY_LADDER).toBe(W1_25_DISCOVERY_LADDER);
    expect(ids).toHaveLength(29);
    expect(new Set(ids)).toEqual(new Set([...STARTER_INGREDIENT_IDS, ...materialIdsOfSteps(DISCOVERY_LADDER.steps)]));
    expect(ids).toEqual(INGREDIENTS.map((i) => i.id));
    for (const id of W1) expect(ids).toContain(id);
  });

  it("parity with the current ladder: every obtainable finite material is exactly what the Shop can offer", () => {
    const finite = obtainableIngredientIds().filter((id) => !STARTER_INGREDIENT_IDS.includes(id));
    const offered = INGREDIENTS.filter((i) => materialOffer(i) !== null).map((i) => i.id);
    expect(finite).toEqual(offered);
  });

  it("parity: equals every ingredient the production recipes use", () => {
    const used = new Set<string>(RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    expect(new Set(obtainableIngredientIds())).toEqual(used);
  });

  it("the shipped-15 ladder (I4b-I5a) still yields the old 22 -- the count follows the ladder, nothing else", () => {
    const ids = obtainableIngredientIds(SHIPPED_15_DISCOVERY_LADDER);
    expect(ids).toHaveLength(22);
    for (const id of W1) expect(ids).not.toContain(id);
  });

  it("an empty ladder leaves only the starters", () => {
    expect(obtainableIngredientIds({ populationId: "empty", steps: [] })).toEqual([...STARTER_INGREDIENT_IDS]);
  });
});

describe("ingredientCollectionCount", () => {
  it("a fresh save reads 3/29", () => {
    expect(ingredientCollectionCount([...STARTER_INGREDIENT_IDS])).toEqual({ owned: 3, total: 29 });
  });

  it("counts owned obtainable ingredients, W1 materials included", () => {
    expect(ingredientCollectionCount([...STARTER_INGREDIENT_IDS, "egg", "clam"])).toEqual({ owned: 5, total: 29 });
  });

  it("a save with every material plus unknown ids never reads above the total", () => {
    expect(ingredientCollectionCount([...obtainableIngredientIds(), "calabresa", "future-thing"])).toEqual({
      owned: 29,
      total: 29,
    });
  });
});
