import { describe, expect, it } from "vitest";
import { INGREDIENTS, STARTER_INGREDIENT_IDS, getIngredient } from "./ingredients";

describe("salami (Phase 3C-6)", () => {
  const salami = getIngredient("salami");

  it("exists in production data", () => {
    expect(salami).toBeDefined();
  });

  it("is not a Starter ingredient", () => {
    expect(STARTER_INGREDIENT_IDS).not.toContain("salami");
    expect(salami?.unlockCondition).toBeDefined();
  });

  it("has a positive minTotalStars unlock condition", () => {
    expect(salami?.unlockCondition?.minTotalStars).toBeGreaterThan(0);
    expect(Number.isInteger(salami?.unlockCondition?.minTotalStars)).toBe(true);
  });

  it("has a valid (positive integer) pricePitz", () => {
    expect(salami?.pricePitz).toBeGreaterThan(0);
    expect(Number.isInteger(salami?.pricePitz)).toBe(true);
  });

  it("is a topping-category, scatter-placed ingredient (no new placement mechanics)", () => {
    expect(salami?.category).toBe("topping");
    expect(salami?.placement).toBe("scatter");
  });
});

describe("Starter Set is unchanged (regression)", () => {
  it("still has exactly 13 Starter ingredients", () => {
    expect(STARTER_INGREDIENT_IDS).toHaveLength(13);
  });

  it("total production ingredient count is 14 (13 Starter + salami)", () => {
    expect(INGREDIENTS).toHaveLength(14);
  });
});
