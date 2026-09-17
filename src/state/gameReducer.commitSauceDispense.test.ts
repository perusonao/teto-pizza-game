import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_DEX } from "./dex";
import type { SauceDeposit } from "./pizzaState";
import { createEmptyPizza } from "./pizzaState";
import { RECIPES, type RecipeId } from "../data/recipes";
import { ORDERS } from "../data/orders";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";

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
  const prepared = gameReducer(state, { type: "BEGIN_PREPARE" });
  // Issue #33 D1: BEGIN_PREPARE now lands at DOUGH -- every caller in this file exercises
  // SAUCE-step COMMIT_SAUCE_DISPENSE, so advance past DOUGH once here.
  return gameReducer(prepared, { type: "CONFIRM_MAKING_STEP" });
}

function preparedRecipeState(recipeId: RecipeId, isMissionRound = false): GameState {
  const base = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
  const recipe = RECIPES.find((candidate) => candidate.id === recipeId);
  const order = ORDERS.find((candidate) => candidate.recipeId === recipeId);
  if (!recipe || !order) throw new Error(`Missing test data for ${recipeId}`);
  return {
    ...base,
    phase: "PREPARE",
    // Issue #33 D1: this fixture hand-builds a PREPARE state directly (not via BEGIN_PREPARE),
    // so its own `makingStep` must be set explicitly -- every caller exercises SAUCE-step
    // COMMIT_SAUCE_DISPENSE.
    makingStep: "SAUCE",
    order,
    recipe,
    pizza: createEmptyPizza(),
    isMissionRound,
  };
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

  it("accepts the configured sauce for every recipe with an empty starting field", () => {
    for (const recipe of RECIPES) {
      const state = preparedRecipeState(recipe.id);
      expect(state.pizza.sauceIds).toEqual([]);
      expect(state.pizza.sauceDeposits).toEqual([]);

      const profile = getRecipeSauceProfile(recipe.id);
      const after = gameReducer(state, {
        type: "COMMIT_SAUCE_DISPENSE",
        ingredientId: profile.ingredientId,
        deposits,
      });

      expect(after.pizza.sauceIds).toEqual([profile.ingredientId]);
      expect(after.pizza.sauceDeposits).toEqual(deposits);
    }
  });

  it("Issue #32 sauce parity fix: accepts a sauce ingredient other than tomato-sauce on Margherita (off-recipe sauce uses the same dispense path)", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "olive-oil",
      deposits,
    });
    expect(after.pizza.sauceIds).toEqual(["olive-oil"]);
    expect(after.pizza.sauceDeposits).toEqual(deposits);
  });

  it("rejects a non-sauce ingredient (category guard, independent of recipe match)", () => {
    const state = preparedMargheritaState();
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "mozzarella",
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

  it("uses the same recipe sauce profile during a Mission round", () => {
    const state = preparedRecipeState("genovese", true);
    const after = gameReducer(state, {
      type: "COMMIT_SAUCE_DISPENSE",
      ingredientId: "pesto",
      deposits,
    });
    expect(after.isMissionRound).toBe(true);
    expect(after.pizza.sauceIds).toEqual(["pesto"]);
    expect(after.pizza.sauceDeposits).toEqual(deposits);
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
