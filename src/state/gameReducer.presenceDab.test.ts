import { describe, expect, it, vi } from "vitest";

vi.mock("../data/ingredients", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../data/ingredients")>();
  const yogurt = {
    id: "yogurt-sauce",
    category: "sauce" as const,
    nameJa: "ヨーグルトソース",
    color: "#f7f3e8",
    emoji: "",
    placement: "spread" as const,
  };
  return {
    ...actual,
    getIngredient: (id: string) => id === yogurt.id ? yogurt : actual.getIngredient(id),
  };
});

import { createGuidedInitialState } from "./testSupport/guidedRound";
import { gameReducer, type GameState } from "./gameReducer";
import { createEmptyPizza } from "./pizzaState";

function sauceStepState(): GameState {
  return {
    ...createGuidedInitialState("margherita", {
      ownedIngredientIds: ["tomato-sauce", "yogurt-sauce"],
    }),
    phase: "PREPARE",
    makingStep: "SAUCE",
    pizza: createEmptyPizza(),
  };
}

describe("T25 I-7 reducer boundary", () => {
  it("rejects legacy APPLY_SAUCE so yogurt cannot replace an existing tomato layer with a zero-deposit sauce", () => {
    const state = sauceStepState();
    state.pizza = {
      ...state.pizza,
      sauceIds: ["tomato-sauce"],
      sauceDeposits: [{ x: 50, y: 50, amount: 0.2 }],
    };

    const after = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "yogurt-sauce", x: 40, y: 60 });
    expect(after).toBe(state);
    expect(after.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(after.pizza.sauceDeposits).toEqual([{ x: 50, y: 50, amount: 0.2 }]);
  });

  it("accepts one exact starter dab, but rejects a same-press multi-deposit batch and a later second commit", () => {
    const initial = sauceStepState();
    const dab = { x: 40, y: 60, amount: 0.02 };

    const samePress = gameReducer(initial, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "yogurt-sauce",
      deposits: [dab, { ...dab, x: 41 }],
    });
    expect(samePress).toBe(initial);

    const first = gameReducer(initial, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "yogurt-sauce",
      deposits: [dab],
    });
    expect(first).not.toBe(initial);
    expect(first.pizza.sauceIds).toEqual(["yogurt-sauce"]);
    expect(first.pizza.sauceDeposits).toEqual([dab]);

    const second = gameReducer(first, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "yogurt-sauce",
      deposits: [{ ...dab, x: 70 }],
    });
    expect(second).toBe(first);
    expect(second.pizza.sauceDeposits).toEqual([dab]);
  });
});
