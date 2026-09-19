import { describe, expect, it } from "vitest";
import { MARGHERITA_REFERENCE } from "../data/referencePizza";
import { getRecipe } from "../data/recipes";
import { scorePiecesAgainstReference } from "../logic/referenceScoring";
import { createDefaultSave } from "./persistence";
import { createEmptyPizza } from "./pizzaState";

describe("Regression: Phase 4A-1B remains shadow-only", () => {
  it("reference matching neither mutates pizza state nor changes it as a side effect", () => {
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

    const shadow = scorePiecesAgainstReference(
      pizza.toppings,
      MARGHERITA_REFERENCE.pieceGroups,
    );

    expect(shadow.every((metric) => metric.placementSimilarity === 1)).toBe(true);
    expect(pizza).toEqual(snapshot);
  });

  it("does not add canonical reference or animation fields to the save schema", () => {
    // Save v2 E0 added `inventory` (see docs/reports/TETO_SAVE-V2_INVENTORY_Fresh-Audit.md);
    // Save v3 EP4 added `starterGrantClaimedRecipeIds` (see
    // docs/reports/TETO_ECONOMY-PROGRESSION_EP4_Starter-Stock_Result.md); this pins that Phase
    // 4A-1B Reference/animation work still adds nothing further beyond those two.
    expect(Object.keys(createDefaultSave()).sort()).toEqual([
      "dex",
      "inventory",
      "missionBest",
      "ownedIngredientIds",
      "pitzBalance",
      "schemaVersion",
      "starterGrantClaimedRecipeIds",
    ]);
  });
});
