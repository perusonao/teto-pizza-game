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
  it("the 25 original production recipes all participate; only brazilian-calabresa (PR-4b-B), No.27 pesto-pollo and Expansion Slice 1 pesto-gamberi opt out (and, since TQ-1D, aussie)", () => {
    expect(RECIPES).toHaveLength(32);
    expect((RECIPES as readonly Recipe[]).filter((r) => r.lunchRush === false).map((r) => r.id)).toEqual([
      "brazilian-calabresa",
      "pesto-pollo",
      "pesto-gamberi",
      "vongole",
      "pesto-vegetariana",
      "ratatouille-pizza",
      "aussie",
    ]); // opt-out total = 7
    const original = (RECIPES as readonly Recipe[]).filter((r) => r.lunchRush !== false);
    expect(original).toHaveLength(25);
    expect(original.every((r) => participatesInLunchRush(r.id))).toBe(true);
    expect(participatesInLunchRush("brazilian-calabresa")).toBe(false);
    expect(participatesInLunchRush("pesto-pollo")).toBe(false);
    expect(participatesInLunchRush("pesto-gamberi")).toBe(false);
    expect(participatesInLunchRush("vongole")).toBe(false);
    expect(participatesInLunchRush("pesto-vegetariana")).toBe(false);
    expect(participatesInLunchRush("ratatouille-pizza")).toBe(false);
    expect(participatesInLunchRush("aussie")).toBe(false); // TQ-1D: Lunch Rush never serves a Technique recipe
    expect(missionOrderRecipeIds(inputs).sort()).toEqual(original.map((r) => r.id).sort());
  });

  it("brazilian-calabresa discovered + every ingredient owned + in stock still never enters the pool or a draw", () => {
    expect(inputs.ownedIngredientIds).toEqual(expect.arrayContaining(["tomato-sauce", "sausage", "onion", "black-olive", "oregano"]));
    const pool = missionOrderRecipeIds(inputs);
    expect(pool).not.toContain("brazilian-calabresa");
    for (let i = 0; i < 300; i += 1) {
      expect(pickMissionOrder(pool, pool, undefined)?.recipeId).not.toBe("brazilian-calabresa");
    }
  });

  it("an opted-out recipe never enters the mission order pool, even discovered + owned + in stock", () => {
    const pool = missionOrderRecipeIds(inputs, [], optOut("pizza-bianca"));
    expect(pool).not.toContain("pizza-bianca");
    expect(pool).toHaveLength(RECIPES.length - 8); // pizza-bianca + the calabresa, pesto-pollo, pesto-gamberi, Wave 2's vongole / pesto-vegetariana / ratatouille-pizza and TQ-1D's aussie already opted out (7 + pizza-bianca = 8 total)
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
