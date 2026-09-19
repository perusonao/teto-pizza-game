import { describe, expect, it } from "vitest";
import { getNextOrder, ORDERS } from "./orders";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { availableRecipeIds } from "../state/progression";
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

describe("getNextOrder availability filtering", () => {
  it("never selects a recipe outside availableRecipeIds", () => {
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({ availableRecipeIds: ["margherita", "marinara"] });
      expect(["margherita", "marinara"]).toContain(order.recipeId);
    }
  });

  it("still prioritizes undiscovered recipes within the available subset", () => {
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({
        availableRecipeIds: ["margherita", "marinara", "genovese"],
        dex: ["margherita", "marinara"],
      });
      expect(order.recipeId).toBe("genovese");
    }
  });

  it("falls back to the full order pool instead of crashing when availableRecipeIds is empty", () => {
    for (let i = 0; i < 20; i++) {
      const order = getNextOrder({ availableRecipeIds: [] });
      expect(ORDERS.map((o) => o.recipeId)).toContain(order.recipeId);
    }
  });

  it("falls back to the full order pool when availableRecipeIds matches nothing", () => {
    const order = getNextOrder({ availableRecipeIds: ["not-a-real-recipe"] });
    expect(ORDERS.map((o) => o.recipeId)).toContain(order.recipeId);
  });

  it("preferFirst still returns margherita when it is in the available subset", () => {
    const order = getNextOrder({ preferFirst: true, availableRecipeIds: ["margherita", "funghi"] });
    expect(order.recipeId).toBe("margherita");
  });

  it("omitting availableRecipeIds considers every recipe (backward compatible default)", () => {
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({});
      expect(ORDERS.map((o) => o.recipeId)).toContain(order.recipeId);
    }
  });
});

describe("getNextOrder + real Progression data (Economy & Progression 1.0 EP1: chain unlock)", () => {
  it("FREE (fresh save, Starter Set owned only, empty Dex) only ever selects margherita", () => {
    const ids = availableRecipeIds(EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(ids).toEqual(["margherita"]);
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({ availableRecipeIds: ids });
      expect(order.recipeId).toBe("margherita");
    }
  });

  it("FREE never selects fugazza before its recipe-unlock chain/stars gate and onion ownership both hold", () => {
    const ids = availableRecipeIds(EMPTY_DEX, STARTER_INGREDIENT_IDS);
    expect(ids).not.toContain("fugazza");
  });

  it("once the full Chapter 1 chain is discovered and onion is purchased, fugazza becomes an eligible order candidate", () => {
    const chainDex = dexDiscovering(
      ["margherita", "funghi", "marinara", "bismarck", "genovese", "quattro-formaggi"],
      5 as QualityStars,
    );
    const ids = availableRecipeIds(chainDex, [...STARTER_INGREDIENT_IDS, "onion"]);
    expect(ids).toContain("fugazza");
    // With every other recipe already discovered, fugazza is the sole undiscovered recipe
    // left -- undiscovered-priority (SSOT section 9) must always pick it.
    const discoveredIds = ids.filter((id) => id !== "fugazza");
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({ availableRecipeIds: ids, dex: discoveredIds });
      expect(order.recipeId).toBe("fugazza");
    }
  });
});
