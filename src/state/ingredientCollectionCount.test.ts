import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER, SHIPPED_15_DISCOVERY_LADDER } from "../data/discoveryLadder";
import { RECIPES } from "../data/recipes";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { materialOffer } from "../logic/materialShop";
import { REC04_W1_25_LADDER_FIXTURE } from "../logic/testSupport/discoveryLadderRule";
import { ingredientCollectionCount, obtainableIngredientIds } from "./materialEntitlement";

/**
 * Progression 2.0 W1 Integration I5a-3: the "所持 N/M種" denominator is derived from what this
 * build can actually unlock (starters + current Discovery Ladder materials), never from the raw
 * catalog length -- so registering the 7 W1 materials keeps the player-facing total at 22, and the
 * 25-recipe ladder would grow it to 29 with no other change.
 */

const W1 = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"];

describe("obtainableIngredientIds", () => {
  it("is the 3 starters + the 19 current ladder materials = 22, in catalog order", () => {
    const ids = obtainableIngredientIds();
    expect(ids).toHaveLength(22);
    expect(new Set(ids)).toEqual(new Set([...STARTER_INGREDIENT_IDS, ...materialIdsOfSteps(DISCOVERY_LADDER.steps)]));
    expect(ids).toEqual(INGREDIENTS.map((i) => i.id).filter((id) => ids.includes(id)));
    for (const id of W1) expect(ids).not.toContain(id);
  });

  it("parity with the current ladder: every obtainable finite material is exactly what the Shop can offer", () => {
    const finite = obtainableIngredientIds().filter((id) => !STARTER_INGREDIENT_IDS.includes(id));
    const offered = INGREDIENTS.filter((i) => materialOffer(i) !== null).map((i) => i.id);
    expect(finite).toEqual(offered);
  });

  it("parity: equals every ingredient the shipped recipes use (the pre-I5a catalog of 22)", () => {
    const used = new Set<string>(RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId)));
    expect(new Set(obtainableIngredientIds())).toEqual(used);
    expect(DISCOVERY_LADDER).toBe(SHIPPED_15_DISCOVERY_LADDER);
  });

  it("grows to all 29 with the 25-recipe ladder fixture, without any other change", () => {
    const ids = obtainableIngredientIds(REC04_W1_25_LADDER_FIXTURE);
    expect(ids).toHaveLength(29);
    expect(ids).toEqual(INGREDIENTS.map((i) => i.id));
  });

  it("an empty ladder leaves only the starters", () => {
    expect(obtainableIngredientIds({ populationId: "empty", steps: [] })).toEqual([...STARTER_INGREDIENT_IDS]);
  });
});

describe("ingredientCollectionCount", () => {
  it("a fresh save reads 3/22", () => {
    expect(ingredientCollectionCount([...STARTER_INGREDIENT_IDS])).toEqual({ owned: 3, total: 22 });
  });

  it("counts owned obtainable ingredients", () => {
    expect(ingredientCollectionCount([...STARTER_INGREDIENT_IDS, "egg", "bacon"])).toEqual({ owned: 5, total: 22 });
  });

  it("a future save owning W1 materials or unknown ids never reads above the total", () => {
    expect(ingredientCollectionCount([...obtainableIngredientIds(), ...W1, "calabresa"])).toEqual({
      owned: 22,
      total: 22,
    });
  });

  it("with the 25-recipe ladder fixture the same save reads 29/29", () => {
    expect(ingredientCollectionCount(INGREDIENTS.map((i) => i.id), REC04_W1_25_LADDER_FIXTURE)).toEqual({
      owned: 29,
      total: 29,
    });
  });
});
