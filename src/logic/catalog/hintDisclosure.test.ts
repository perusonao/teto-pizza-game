import { describe, expect, it } from "vitest";
import { ATTRIBUTE_FAMILIES } from "../../data/ingredientTaxonomy";
import { RECIPES } from "../../data/recipes";
import { buildSelectableHintModel, reservedIngredientId, selectableHintPresentation } from "../discovery/selectableHint";
import { guardedReserveAttributeAnswer } from "../discovery/deductionGuard";
import { reserveAttributeAnswer } from "../discovery/deductionHint";
import { INGREDIENTS } from "../../data/ingredients";
import { ingredientAttributeFamily } from "../../data/ingredientTaxonomy";
import type { HintSheetView } from "../../state/discoveryHint";
import { disclosedHintsFromSheetView, libraryFilterForAttribute, withDisclosedAttributes } from "./hintDisclosure";

const TAXONOMY = { families: ATTRIBUTE_FAMILIES };

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

  it("DH4-2B deduction lines (structure / attribute text) never become named ingredients or attribute ids", () => {
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

  it("collects disclosed attribute answers verbatim", () => {
    const hints = withDisclosedAttributes(disclosedHintsFromSheetView(null), ["attr:family:meat", 3, "attr:family:meat"]);
    expect(hints.attributeFactIds).toEqual(["attr:family:meat"]);
  });
});

describe("libraryFilterForAttribute (B-4: never finer than the answer)", () => {
  it("P-4: a family answer opens exactly that one family", () => {
    for (const f of ATTRIBUTE_FAMILIES) {
      expect(libraryFilterForAttribute(`attr:family:${f.id}`, TAXONOMY)).toEqual({ kind: "families", families: [f.id] });
    }
  });

  it("P-5: a group answer opens every family of the group, never a single (reserve) family", () => {
    for (const group of new Set(ATTRIBUTE_FAMILIES.map((f) => f.group))) {
      const expected = ATTRIBUTE_FAMILIES.filter((f) => f.group === group).map((f) => f.id);
      expect(libraryFilterForAttribute(`attr:group:${group}`, TAXONOMY)).toEqual({ kind: "families", families: expected });
    }
    expect(libraryFilterForAttribute("attr:group:protein", TAXONOMY)).toEqual({ kind: "families", families: ["meat", "seafood"] });
  });

  it("category / existence / hostile answers never narrow below the answer", () => {
    expect(libraryFilterForAttribute("attr:category:cheese", TAXONOMY)).toEqual({ kind: "category", category: "cheese" });
    for (const bad of ["attr:existence", "attr:family:__proto__", "attr:family", "ing:bacon", "attr:group:x:y", 5, null]) {
      expect(libraryFilterForAttribute(bad, TAXONOMY)).toEqual({ kind: "none" });
    }
  });
});

describe("real DH4 answers (DH4-1 + DH4-2A guard, current main) map at their own granularity", () => {
  const owned = INGREDIENTS.map((i) => i.id);
  const contexts = [owned, owned.filter((_, i) => i % 2 === 0), owned.slice(0, 12)];
  it("family -> exactly that family; group -> every family of the group; category -> category; never the reserve alone", () => {
    let checked = 0;
    const levels = new Set<string>();
    for (const recipe of RECIPES) {
      for (const ownedIngredientIds of contexts) {
        for (const answer of [
          reserveAttributeAnswer(recipe.id, { discoveredCount: 5, ownedIngredientIds }),
          guardedReserveAttributeAnswer(recipe.id, { discoveredCount: 5, ownedIngredientIds }),
        ]) {
          if (!answer) continue;
          checked++;
          levels.add(answer.level);
          const filter = libraryFilterForAttribute(answer.factId, TAXONOMY);
          if (answer.level === "family") expect(filter).toEqual({ kind: "families", families: [answer.family] });
          if (answer.level === "group") {
            expect(filter).toEqual({
              kind: "families",
              families: ATTRIBUTE_FAMILIES.filter((f) => f.group === answer.group).map((f) => f.id),
            });
            // P-5: a group answer never collapses to the reserve's own family.
            const reserveFamily = ingredientAttributeFamily(reservedIngredientId(recipe));
            if (filter.kind === "families") expect(filter.families.length).toBeGreaterThan(1);
            if (reserveFamily && filter.kind === "families") expect(filter.families).toContain(reserveFamily);
          }
          if (answer.level === "category") expect(filter).toEqual({ kind: "category", category: answer.category });
          if (answer.level === "existence") expect(filter).toEqual({ kind: "none" });
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
    // Every answer level is actually exercised (group answers included), so no branch is vacuous.
    expect([...levels].sort()).toEqual(["category", "existence", "family", "group"]);
  });

  it("structure facts (meta:ingredient-total, meta:topping-total) never become a library filter", () => {
    for (const id of ["meta:ingredient-total", "meta:topping-total"]) {
      expect(libraryFilterForAttribute(id, TAXONOMY)).toEqual({ kind: "none" });
    }
  });
});
