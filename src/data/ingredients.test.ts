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

describe("Starter Set (Economy & Progression 1.0 EP4: shrinks from 13 to margherita's own 3)", () => {
  it("has exactly 3 Starter ingredients -- margherita's own tomato-sauce/mozzarella/basil, permanently unlimited", () => {
    // Deliberate EP4 change (see docs/design/TETO_ECONOMY-PROGRESSION-1_MATRIX.md sec. 2 and
    // the Fresh Design's own flagged risk, sec. 13): every other ingredient now has an
    // `unlockCondition` and arrives via the starter-grant mechanism instead of being Starter.
    expect(STARTER_INGREDIENT_IDS).toHaveLength(3);
    expect([...STARTER_INGREDIENT_IDS].sort()).toEqual(["basil", "mozzarella", "tomato-sauce"].sort());
  });

  it("total production ingredient count is still 14 (3 Starter + 11 finite, unchanged by EP4)", () => {
    expect(INGREDIENTS).toHaveLength(14);
  });

  it("every non-Starter ingredient now has unlockCondition/pricePitz/restockQuantity (EP4b)", () => {
    const nonStarter = INGREDIENTS.filter((i) => !STARTER_INGREDIENT_IDS.includes(i.id));
    expect(nonStarter).toHaveLength(11);
    for (const ingredient of nonStarter) {
      expect(ingredient.unlockCondition).toBeDefined();
      expect(ingredient.pricePitz).toBeGreaterThan(0);
      expect(ingredient.restockQuantity).toBeGreaterThan(0);
    }
  });
});
