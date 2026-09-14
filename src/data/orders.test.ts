import { describe, expect, it } from "vitest";
import { getNextOrder, ORDERS } from "./orders";
import { STARTER_INGREDIENT_IDS } from "./ingredients";
import { availableRecipeIds } from "../state/progression";

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

describe("getNextOrder + real Progression data (Phase 3C-6: salami-pizza)", () => {
  it("FREE (Starter Set owned only) never selects salami-pizza", () => {
    const ids = availableRecipeIds(STARTER_INGREDIENT_IDS);
    expect(ids).not.toContain("salami-pizza");
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({ availableRecipeIds: ids });
      expect(order.recipeId).not.toBe("salami-pizza");
    }
  });

  it("once salami is purchased, salami-pizza becomes an eligible order candidate", () => {
    const ids = availableRecipeIds([...STARTER_INGREDIENT_IDS, "salami"]);
    expect(ids).toContain("salami-pizza");
    // With every Starter recipe already discovered, salami-pizza is the sole undiscovered
    // recipe left -- undiscovered-priority (SSOT section 9) must always pick it.
    const dex = ids.filter((id) => id !== "salami-pizza");
    for (let i = 0; i < 50; i++) {
      const order = getNextOrder({ availableRecipeIds: ids, dex });
      expect(order.recipeId).toBe("salami-pizza");
    }
  });
});
