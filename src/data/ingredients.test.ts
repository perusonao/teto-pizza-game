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
});

describe("Starter Set is unchanged (regression)", () => {
  it("still has exactly 13 Starter ingredients", () => {
    expect(STARTER_INGREDIENT_IDS).toHaveLength(13);
  });

  it("total production ingredient count is 14 (13 Starter + onion)", () => {
    expect(INGREDIENTS).toHaveLength(14);
  });
});
