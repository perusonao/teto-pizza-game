import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { buildSelectableHintModel, selectableHintPresentation } from "../discovery/selectableHint";
import type { HintSheetView } from "../../state/discoveryHint";
import { disclosedHintsFromSheetView } from "./hintDisclosure";

function selectableView(
  recipeId: string,
  purchased: readonly string[],
  deduction: Extract<HintSheetView, { kind: "SELECTABLE" }>["deduction"] = null,
): HintSheetView {
  const model = buildSelectableHintModel(recipeId, { discoveredCount: 5 })!;
  return {
    kind: "SELECTABLE",
    existenceText: "",
    presentation: selectableHintPresentation(model, purchased, 999),
    grandfatheredSteps: [],
    outcome: null,
    deduction,
  };
}

describe("disclosedHintsFromSheetView (B-3: only what the sheet shows)", () => {
  it("returns exactly the revealed chips -- the free key only, before any purchase", () => {
    for (const recipe of RECIPES) {
      const model = buildSelectableHintModel(recipe.id, { discoveredCount: 5 })!;
      const view = selectableView(recipe.id, []);
      expect(disclosedHintsFromSheetView(view).namedIngredientIds).toEqual(model.freeFacts.map((f) => f.ingredientId));
    }
  });

  it("P-3: an unrevealed (unpurchased) fact never appears, and the Rule W reserve never appears", () => {
    for (const recipe of RECIPES) {
      const model = buildSelectableHintModel(recipe.id, { discoveredCount: 5 })!;
      const bought = model.purchasableFacts.slice(0, 1).map((f) => f.id);
      const named = disclosedHintsFromSheetView(selectableView(recipe.id, bought)).namedIngredientIds;
      const shown = new Set([...model.freeFacts, ...model.purchasableFacts.slice(0, 1)].map((f) => f.ingredientId));
      expect(named.every((id) => shown.has(id))).toBe(true);
      for (const hidden of model.purchasableFacts.slice(1)) {
        if (!shown.has(hidden.ingredientId)) expect(named).not.toContain(hidden.ingredientId);
      }
      if (model.reservedIngredientId) expect(named).not.toContain(model.reservedIngredientId);
    }
  });

  it("reads named TARGET (onboarding) steps and ignores empty views", () => {
    const view: HintSheetView = {
      kind: "TARGET",
      steps: [
        { level: 0, axis: "EXISTENCE", textJa: "" },
        { level: 1, axis: "KEY", textJa: "", namedIngredientId: "basil" },
      ],
      canRevealMore: true,
      next: null,
      pitzBalance: 0,
    };
    expect(disclosedHintsFromSheetView(view).namedIngredientIds).toEqual(["basil"]);
    expect(disclosedHintsFromSheetView({ kind: "REFILL" }).namedIngredientIds).toEqual([]);
    expect(disclosedHintsFromSheetView(null).namedIngredientIds).toEqual([]);
  });

  it("DH4-2B deduction lines (structure / attribute text) never become named ingredients", () => {
    for (const recipe of RECIPES) {
      const plain = disclosedHintsFromSheetView(selectableView(recipe.id, []));
      const withDeduction = disclosedHintsFromSheetView(
        selectableView(recipe.id, [], {
          structureLines: ["材料は全部で4種類"],
          attributeLines: ["肉の仲間があるよ"],
          legacyStructure: false,
          structureOwned: true,
          attributeOwned: true,
          nextPrice: 10,
          paidCount: 2,
          affordable: true,
        }),
      );
      expect(withDeduction).toEqual(plain);
    }
  });
});
