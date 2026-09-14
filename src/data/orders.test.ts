import { describe, expect, it } from "vitest";
import { getNextOrder, ORDERS } from "./orders";

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
