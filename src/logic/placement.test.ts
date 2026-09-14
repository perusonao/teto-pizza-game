import { describe, expect, it } from "vitest";
import { scorePlacement } from "./placement";
import type { PlacedTopping } from "../state/pizzaState";

function topping(id: string, x: number, y: number): PlacedTopping {
  return { id, ingredientId: "mozzarella", x, y };
}

describe("scorePlacement", () => {
  it("gives full marks when there are no toppings to place at all", () => {
    // A recipe with no placeable toppings must never be structurally penalized.
    expect(scorePlacement([])).toBe(100);
  });

  it("gives a single inside topping the max score", () => {
    // A single-topping recipe must still be able to reach a perfect placement score.
    expect(scorePlacement([topping("a", 50, 50)])).toBe(100);
  });

  it("penalizes a single topping placed outside the dough", () => {
    const score = scorePlacement([topping("a", 100, 100)]);
    expect(score).toBeLessThan(100);
  });

  it("penalizes toppings outside the dough relative to an all-inside layout", () => {
    const allInside = scorePlacement([topping("a", 40, 50), topping("b", 60, 50)]);
    const oneOutside = scorePlacement([topping("a", 40, 50), topping("b", 100, 100)]);
    expect(oneOutside).toBeLessThan(allInside);
  });

  it("scores a well-spread layout higher than pathological one-point clustering", () => {
    const spread = scorePlacement([topping("a", 30, 30), topping("b", 70, 30), topping("c", 50, 75)]);
    const clustered = scorePlacement([
      topping("a", 50, 50),
      topping("b", 50.5, 50),
      topping("c", 50, 50.5),
    ]);
    expect(spread).toBeGreaterThan(clustered);
  });

  it("never lets pathological clustering fall below the distribution floor", () => {
    const clustered = scorePlacement([topping("a", 50, 50), topping("b", 50.5, 50)]);
    // Both points are inside (containment = 50) and the floor keeps distribution above 0,
    // so the total must stay comfortably above the containment-only baseline.
    expect(clustered).toBeGreaterThan(50);
    expect(clustered).toBeLessThan(100);
  });
});
