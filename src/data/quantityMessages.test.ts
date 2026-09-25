import { describe, expect, it } from "vitest";
import { buildQuantityNote } from "./quantityMessages";
import { computeScoringV2 } from "../logic/scoringV2";
import { getRecipe } from "./recipes";
import { buildIdealSauceFixture, getReferencePizza } from "./referencePizza";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";

function funghiWithMushrooms(count: number): PizzaState {
  const reference = getReferencePizza("funghi")!;
  return {
    ...createEmptyPizza(),
    sauceIds: [reference.sauce.ingredientId],
    sauceDeposits: buildIdealSauceFixture(),
    toppings: reference.pieceGroups.flatMap((group, gi) => {
      const positions =
        group.ingredientId === "mushroom"
          ? Array.from({ length: count }, (_, i) => group.positions[i] ?? { x: 30 + i * 5, y: 70 })
          : group.positions;
      return positions.map((p, i) => ({ id: `${gi}-${i}`, ingredientId: group.ingredientId, ...p }));
    }),
    bakeResult: 70,
  };
}

describe("buildQuantityNote (Issue #215)", () => {
  const funghi = getRecipe("funghi")!;

  it.each([
    [2, "マッシュルームがお手本より少なめ（2個／お手本3個）"],
    [1, "マッシュルームがお手本より少なめ（1個／お手本3個）"],
    [4, "マッシュルームがお手本より多め（4個／お手本3個）"],
  ])("%i mushroom -> %s", (count, expected) => {
    expect(buildQuantityNote(computeScoringV2(funghi, funghiWithMushrooms(count)))).toBe(expected);
  });

  it("is null for the ideal quantity, a missing result, or an unavailable quantity component", () => {
    expect(buildQuantityNote(computeScoringV2(funghi, funghiWithMushrooms(3)))).toBeNull();
    expect(buildQuantityNote(null)).toBeNull();
    expect(buildQuantityNote(undefined)).toBeNull();
  });
});
