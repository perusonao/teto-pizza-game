import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "./ingredients";

describe("onion (Phase 3C-6)", () => {
  const onion = getIngredient("onion");

  it("exists in production data", () => {
    expect(onion).toBeDefined();
  });

  it("is not a Starter ingredient", () => {
    expect(STARTER_INGREDIENT_IDS).not.toContain("onion");
    expect(onion?.unlockCondition).toBeDefined();
  });

  it("has a positive minTotalStars unlock condition", () => {
    expect(onion?.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    expect(Number.isInteger(onion?.unlockCondition?.minTotalStars)).toBe(true);
  });

  it("has a valid (positive integer) pricePitz", () => {
    expect(onion?.pricePitz).toBeGreaterThan(0);
    expect(Number.isInteger(onion?.pricePitz)).toBe(true);
  });

  it("is a topping-category, scatter-placed ingredient (no new placement mechanics)", () => {
    expect(onion?.category).toBe("topping");
    expect(onion?.placement).toBe("scatter");
  });

  // Economy & Progression 1.0 EP4 (finalized product decision, EP4 Result report §7): onion's
  // old Phase 3C-6 manual-purchase path is retired -- exactly like every other EP4 Starter
  // Grant ingredient, its first unit is only ever obtained via its governing recipe's Starter
  // Grant, never a manual Shop purchase.
  it("is starterGrantOnly (its old manual-purchase path is retired)", () => {
    expect(onion?.starterGrantOnly).toBe(true);
  });
});

describe("Starter Set (EP4: shrunk to Margherita's own 3 permanently-unlimited ingredients)", () => {
  it("has exactly 3 Starter ingredients (tomato-sauce/mozzarella/basil)", () => {
    expect(STARTER_INGREDIENT_IDS.slice().sort()).toEqual(
      ["tomato-sauce", "mozzarella", "basil"].sort(),
    );
  });

  it("total production ingredient count is still 14 (3 Starter + 10 EP4 Starter-Grant + onion)", () => {
    expect(INGREDIENTS).toHaveLength(14);
  });
});
