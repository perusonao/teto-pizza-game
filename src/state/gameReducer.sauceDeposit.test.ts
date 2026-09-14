import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_DEX } from "./dex";

/** Phase 4A-1A: DEPOSIT_SAUCE reducer tests. APPLY_SAUCE's own extensive coverage
 *  (gameReducer.test.ts) is left untouched -- this file only covers the new action. */

function preparedState(ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS): GameState {
  const state = createInitialGameState(EMPTY_DEX, ownedIngredientIds, 0);
  return gameReducer(state, { type: "BEGIN_PREPARE" });
}

describe("DEPOSIT_SAUCE (reducer)", () => {
  it("is a complete no-op for an unowned ingredient", () => {
    const owned = STARTER_INGREDIENT_IDS.filter((id) => id !== "tomato-sauce");
    const state = preparedState(owned);
    const after = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.1,
    });
    expect(after).toBe(state);
    expect(after.pizza.sauceIds).toEqual([]);
  });

  it("sets sauceIds and appends the first deposit on the first tick", () => {
    const state = preparedState();
    const after = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.02,
    });
    expect(after.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(after.pizza.sauceDeposits).toEqual([{ x: 50, y: 50, amount: 0.02 }]);
  });

  it("sets sauceOrigin and bumps sauceToken only once, on the first tick of a fresh application", () => {
    const state = preparedState();
    const first = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 30,
      y: 40,
      amount: 0.02,
    });
    expect(first.pizza.sauceOrigin).toEqual({ x: 30, y: 40 });
    expect(first.pizza.sauceToken).toBe(state.pizza.sauceToken + 1);

    const second = gameReducer(first, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 60,
      y: 70,
      amount: 0.02,
    });
    // Origin/token don't move with later ticks -- only the deposit log grows.
    expect(second.pizza.sauceOrigin).toEqual({ x: 30, y: 40 });
    expect(second.pizza.sauceToken).toBe(first.pizza.sauceToken);
    expect(second.pizza.sauceDeposits).toHaveLength(2);
  });

  it("accumulates every tick's deposit in order", () => {
    let state = preparedState();
    for (const point of [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ]) {
      state = gameReducer(state, {
        type: "DEPOSIT_SAUCE",
        ingredientId: "tomato-sauce",
        x: point.x,
        y: point.y,
        amount: 0.05,
      });
    }
    expect(state.pizza.sauceDeposits).toEqual([
      { x: 10, y: 10, amount: 0.05 },
      { x: 20, y: 20, amount: 0.05 },
      { x: 30, y: 30, amount: 0.05 },
    ]);
  });

  it("RESET_PIZZA clears the deposit log along with everything else", () => {
    let state = preparedState();
    state = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.1,
    });
    expect(state.pizza.sauceDeposits.length).toBeGreaterThan(0);

    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.pizza.sauceDeposits).toEqual([]);
    expect(reset.pizza.sauceIds).toEqual([]);
  });

  it("a plain APPLY_SAUCE (the legacy path every other recipe/ingredient still uses) clears any stale deposit log", () => {
    let state = preparedState();
    state = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.1,
    });
    expect(state.pizza.sauceDeposits.length).toBeGreaterThan(0);

    const applied = gameReducer(state, {
      type: "APPLY_SAUCE",
      ingredientId: "tomato-sauce",
      x: 20,
      y: 20,
    });
    expect(applied.pizza.sauceDeposits).toEqual([]);
    expect(applied.pizza.sauceOrigin).toEqual({ x: 20, y: 20 });
  });

  it("does not touch toppings, hint, or any other field beyond pizza/hint", () => {
    const state = preparedState();
    const after = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.05,
    });
    expect(after.pizza.toppings).toEqual(state.pizza.toppings);
    expect(after.phase).toBe(state.phase);
    expect(after.score).toBe(state.score);
    expect(after.dex).toBe(state.dex);
    expect(after.pitzBalance).toBe(state.pitzBalance);
  });
});
