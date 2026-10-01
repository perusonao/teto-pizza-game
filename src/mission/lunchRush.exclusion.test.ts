import { describe, expect, it } from "vitest";
import { participatesInLunchRush, RECIPES, type Recipe } from "../data/recipes";
import { discoverAll } from "../logic/testSupport/branchingFixture";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { missionOrderRecipeIds, pickMissionOrder } from "./lunchRush";

/**
 * Discovery 3.0 PR-4b-A (D-4): `lunchRush: false` keeps a recipe out of every Lunch Rush order pool
 * at the one merge point (`missionOrderRecipeIds`), and can be lifted later by removing the field.
 */

const allOwned = [...new Set([...STARTER_INGREDIENT_IDS, ...RECIPES.flatMap((r) => r.requiredIngredients.map((q) => q.ingredientId))])];
const inputs = { dex: discoverAll(RECIPES.map((r) => r.id)), ownedIngredientIds: allOwned, inventory: {} };
const optOut = (id: string): Recipe[] => RECIPES.map((r) => (r.id === id ? { ...r, lunchRush: false as const } : r));

describe("lunchRush: false foundation", () => {
  it("the 25 production recipes all participate (nothing opts out yet)", () => {
    expect(RECIPES).toHaveLength(25);
    expect((RECIPES as readonly Recipe[]).filter((r) => r.lunchRush === false)).toEqual([]);
    expect(RECIPES.every((r) => participatesInLunchRush(r.id))).toBe(true);
    expect(missionOrderRecipeIds(inputs).sort()).toEqual(RECIPES.map((r) => r.id).sort());
  });

  it("an opted-out recipe never enters the mission order pool, even discovered + owned + in stock", () => {
    const pool = missionOrderRecipeIds(inputs, [], optOut("pizza-bianca"));
    expect(pool).not.toContain("pizza-bianca");
    expect(pool).toHaveLength(RECIPES.length - 1);
  });

  it("only the explicit false opts out: absent, unknown id and true-ish values participate", () => {
    expect(participatesInLunchRush("margherita", [{ id: "margherita" }])).toBe(true);
    expect(participatesInLunchRush("not-a-recipe", optOut("margherita"))).toBe(true);
    expect(participatesInLunchRush("margherita", optOut("margherita"))).toBe(false);
  });

  it("it can be lifted later: removing the field puts the recipe straight back", () => {
    expect(missionOrderRecipeIds(inputs, [], optOut("pizza-bianca"))).not.toContain("pizza-bianca");
    expect(missionOrderRecipeIds(inputs, [], RECIPES)).toContain("pizza-bianca");
  });

  it("an order is never drawn for an opted-out recipe (many draws)", () => {
    const pool = missionOrderRecipeIds(inputs, [], optOut("margherita"));
    for (let i = 0; i < 200; i += 1) {
      expect(pickMissionOrder(pool, pool, undefined)?.recipeId).not.toBe("margherita");
    }
  });
});
