import { describe, expect, it } from "vitest";
import { prepOfferedIngredient, type PrepOfferInput } from "./prepOffer";

const base: PrepOfferInput = { enabled: true, phase: "PREPARE", makingStep: "TOPPING", roundKind: "GUIDED", active: true, selectedIngredientId: "beef", ownedIngredientIds: ["beef", "mozzarella"] };

describe("prepOfferedIngredient", () => {
  it("is offered for beef in the TOPPING step of a Guided / Free Cooking round", () => {
    expect(prepOfferedIngredient(base)).toBe("beef");
    expect(prepOfferedIngredient({ ...base, roundKind: "FREE_COOK" })).toBe("beef");
  });
  it.each([
    ["flag off", { enabled: false }],
    ["Lunch Rush", { roundKind: "LUNCH_RUSH" as const }],
    ["Dinner", { roundKind: "DINNER" as const }],
    ["not PREPARE", { phase: "BAKE" }],
    ["SAUCE step", { makingStep: "SAUCE" }],
    ["CHEESE step", { makingStep: "CHEESE" }],
    ["stage not accepting input", { active: false }],
    ["nothing selected", { selectedIngredientId: null }],
    ["another ingredient", { selectedIngredientId: "mozzarella" }],
    ["beef not owned", { ownedIngredientIds: ["mozzarella"] }],
  ])("is not offered: %s", (_name, patch) => {
    expect(prepOfferedIngredient({ ...base, ...patch })).toBeNull();
  });
  it("never reads the recipe or a target: the input has no such field", () => {
    expect(Object.keys(base).sort()).toEqual(["active", "enabled", "makingStep", "ownedIngredientIds", "phase", "roundKind", "selectedIngredientId"]);
  });
});
