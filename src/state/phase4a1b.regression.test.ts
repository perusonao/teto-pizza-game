import { describe, expect, it } from "vitest";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";
import { getRecipe } from "../data/recipes";
import { scorePiecesAgainstReference } from "../logic/referenceScoring";
import { scorePizza } from "../logic/scoring";
import { createDefaultSave } from "./persistence";
import { createEmptyPizza } from "./pizzaState";

describe("Regression: Phase 4A-1B remains shadow-only", () => {
  it("reference matching neither mutates pizza state nor changes the authoritative legacy score", () => {
    const pizza = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      toppings: MARGHERITA_REFERENCE.pieceGroups.flatMap((group) =>
        group.positions.map((point, index) => ({
          id: `${group.ingredientId}-${index}`,
          ingredientId: group.ingredientId,
          ...point,
        }))),
      bakeResult: 70,
    };
    const snapshot = structuredClone(pizza);
    const recipe = getRecipe("margherita");
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error("Margherita recipe fixture is missing");
    const legacyBefore = scorePizza(recipe, pizza);

    const shadow = scorePiecesAgainstReference(
      pizza.toppings,
      MARGHERITA_REFERENCE.pieceGroups,
    );

    expect(shadow.every((metric) => metric.placementSimilarity === 1)).toBe(true);
    expect(pizza).toEqual(snapshot);
    expect(scorePizza(recipe, pizza)).toEqual(legacyBefore);
  });

  it("does not add canonical reference or animation fields to save schema v1", () => {
    expect(Object.keys(createDefaultSave()).sort()).toEqual([
      "dex",
      "missionBest",
      "ownedIngredientIds",
      "pitzBalance",
      "schemaVersion",
    ]);
  });
});
