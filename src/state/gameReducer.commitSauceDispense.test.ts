import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_DEX } from "./dex";
import type { SauceDeposit } from "./pizzaState";

/**
 * Phase 4A-1A (Post-Codex-Fix): COMMIT_SAUCE_DISPENSE reducer tests. Replaces the old
 * DEPOSIT_SAUCE action entirely (Codex Broad Review MUST FIX 7 -- Cancel Transaction: a
 * whole gesture commits atomically, never tick by tick) and adds the reducer-level scope
 * guard MUST FIX 2 explicitly asked for -- every condition below is enforced independently
 * of whatever PizzaStage/App.tsx intended, so a stale/late/malformed/wrong-context action
 * can never mutate canonical pizza state.
 */

function preparedMargheritaState(ownedIngredientIds: readonly string[] = STARTER_INGREDIENT_IDS): GameState {
  const state = createInitialGameState(EMPTY_DEX, ownedIngredientIds, 0);
  expect(state.recipe.id).toBe("margherita"); // createInitialGameState always starts here
  return gameReducer(state, { type: "BEGIN_PREPARE" });
}

function deposit(x: number, y: number, amount: number): SauceDeposit {
  return { x, y, amount };
}

describe("COMMIT_SAUCE_DISPENSE: happy path", () => {
  it("commits a batch of deposits in one atomic step, setting sauceIds/sauceOrigin/sauceToken", () => {
    const state = preparedMargheritaState();
    const deposits = [deposit(10, 10, 0.02), deposit(20, 20, 0.02), deposit(30, 30, 0.02)];
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(after.pizza.sauceOrigin).toEqual({ x: 10, y: 10 });
    expect(after.pizza.sauceToken).toBe(state.pizza.sauceToken + 1);
    expect(after.pizza.sauceDeposits).toEqual(deposits);
  });

  it("a second commit (a later stroke) appends to the deposit log without bumping sauceToken/sauceOrigin again", () => {
    const state = preparedMargheritaState();
    const first = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(10, 10, 0.02)],
    });
    const second = gameReducer(first, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(60, 60, 0.02)],
    });
    expect(second.pizza.sauceOrigin).toEqual({ x: 10, y: 10 }); // unchanged from the first stroke
    expect(second.pizza.sauceToken).toBe(first.pizza.sauceToken);
    expect(second.pizza.sauceDeposits).toHaveLength(3);
  });

  it("does not touch toppings, phase, score, dex, or pitzBalance", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.05)],
    });
    expect(after.pizza.toppings).toEqual(state.pizza.toppings);
    expect(after.phase).toBe(state.phase);
    expect(after.score).toBe(state.score);
    expect(after.dex).toBe(state.dex);
    expect(after.pitzBalance).toBe(state.pitzBalance);
  });
});

describe("COMMIT_SAUCE_DISPENSE: reducer scope guard (Codex MUST FIX 2)", () => {
  const deposits = [deposit(50, 50, 0.05)];

  it("rejects when phase is ORDER", () => {
    const orderState = createInitialGameState();
    expect(orderState.phase).toBe("ORDER");
    const after = gameReducer(orderState, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(orderState);
  });

  it("rejects when phase is BAKE", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, { type: "START_BAKE" });
    expect(state.phase).toBe("BAKE");
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(state);
  });

  it("rejects when phase is RESULT", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.5), deposit(40, 50, 0.3)],
    });
    state = gameReducer(state, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 40,
      y: 50,
    });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    expect(state.phase).toBe("RESULT");
    const before = state;
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(before);
  });

  it("rejects for a non-Margherita recipe (no Reference Pizza exists for it)", () => {
    const owned = ["tomato-sauce", "garlic", "oregano"]; // marinara-owning set
    let state = createInitialGameState(EMPTY_DEX, owned);
    for (let i = 0; i < 20 && state.recipe.id !== "marinara"; i += 1) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("marinara");
    // Force back out of the Mission round this loop used to reach marinara -- free play only.
    state = { ...state, isMissionRound: false };
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(state);
    expect(after.pizza.sauceDeposits).toEqual([]);
  });

  it("rejects for any ingredient other than tomato-sauce, even on Margherita", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "olive-oil",
      deposits,
    });
    expect(after).toBe(state);
  });

  it("rejects for an unowned ingredient", () => {
    // Removing tomato-sauce from the *starting* ownership would also make margherita
    // itself unavailable for order selection (see availableRecipeIds), so prepare
    // margherita normally first, then strip ownership directly -- isolating the ownership
    // guard from order-selection eligibility, same technique gameReducer.test.ts's own
    // "Ownership boundary" suite uses.
    const prepared = preparedMargheritaState();
    const state: GameState = {
      ...prepared,
      ownedIngredientIds: prepared.ownedIngredientIds.filter((id) => id !== "tomato-sauce"),
    };
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(state);
  });

  it("rejects an empty deposits array", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [],
    });
    expect(after).toBe(state);
  });

  it("rejects the whole batch if any deposit has a non-finite x/y (NaN)", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(NaN, 50, 0.02)],
    });
    expect(after).toBe(state);
  });

  it("rejects the whole batch if any deposit has a non-finite x/y (Infinity)", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(Infinity, 50, 0.02)],
    });
    expect(after).toBe(state);
  });

  it("rejects the whole batch if any deposit has a non-finite amount", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(51, 51, NaN)],
    });
    expect(after).toBe(state);
  });

  it("rejects the whole batch if any deposit has a zero or negative amount", () => {
    const state = preparedMargheritaState();
    const afterZero = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(51, 51, 0)],
    });
    expect(afterZero).toBe(state);

    const afterNegative = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.02), deposit(51, 51, -0.01)],
    });
    expect(afterNegative).toBe(state);
  });

  it("rejects during a Mission round even though the recipe/ingredient/phase would otherwise be valid", () => {
    let state = createInitialGameState(); // margherita, isMissionRound: false
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" }); // -> isMissionRound: true
    expect(state.isMissionRound).toBe(true);
    // MISSION_RESET_ORDER can land on any available recipe -- force it back to margherita.
    for (let i = 0; i < 20 && state.recipe.id !== "margherita"; i += 1) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("margherita");
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    expect(state.phase).toBe("PREPARE");

    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits,
    });
    expect(after).toBe(state);
    expect(after.pizza.sauceDeposits).toEqual([]);
  });
});

describe("COMMIT_SAUCE_DISPENSE interacting with other actions", () => {
  it("RESET_PIZZA clears a previously committed deposit log along with everything else", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.1)],
    });
    expect(state.pizza.sauceDeposits.length).toBeGreaterThan(0);

    const reset = gameReducer(state, { type: "RESET_PIZZA" });
    expect(reset.pizza.sauceDeposits).toEqual([]);
    expect(reset.pizza.sauceIds).toEqual([]);
  });

  it("a plain APPLY_SAUCE (the legacy path every other recipe/ingredient still uses) clears a committed deposit log", () => {
    let state = preparedMargheritaState();
    state = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "tomato-sauce",
      deposits: [deposit(50, 50, 0.1)],
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
});
