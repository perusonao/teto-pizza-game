import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX, registerScoreToDex } from "./dex";
import { scorePizza } from "../logic/scoring";
import { missionScore, averageQualityScore } from "../logic/missionScoring";
import { totalStars } from "../logic/mastery";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza } from "./pizzaState";

/**
 * Phase 4A-1A regression suite (SSOT section 10/13's "Scope Guard"): confirms the Phase
 * 4A-1A additions (DEPOSIT_SAUCE, PizzaState.sauceDeposits, the Reference/shadow-scoring
 * modules) cannot influence anything they aren't explicitly wired into -- authoritative
 * scoring, Dex, Mission, non-Margherita sauce, or a reducer phase transition.
 */

function preparedState(recipeIdOwned: readonly string[]): GameState {
  const state = createInitialGameState(EMPTY_DEX, recipeIdOwned, 0);
  return gameReducer(state, { type: "BEGIN_PREPARE" });
}

describe("Regression: legacy scoring untouched by sauceDeposits", () => {
  it("scorePizza ignores PizzaState.sauceDeposits entirely -- same score with or without a deposit log", () => {
    const withoutDeposits = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], bakeResult: 70 };
    const withDeposits = {
      ...withoutDeposits,
      sauceDeposits: [
        { x: 50, y: 50, amount: 0.3 },
        { x: 20, y: 80, amount: 0.9 }, // even a wildly overflowing deposit log
      ],
    };
    const recipeState = preparedState(STARTER_INGREDIENT_IDS);
    expect(scorePizza(recipeState.recipe, withoutDeposits)).toEqual(
      scorePizza(recipeState.recipe, withDeposits),
    );
  });

  it("createEmptyPizza's shape addition (sauceDeposits: []) doesn't change any other field's default", () => {
    const pizza = createEmptyPizza();
    expect(pizza.sauceIds).toEqual([]);
    expect(pizza.sauceOrigin).toBeNull();
    expect(pizza.sauceToken).toBe(0);
    expect(pizza.toppings).toEqual([]);
    expect(pizza.bakeResult).toBeNull();
    expect(pizza.sauceDeposits).toEqual([]);
  });
});

describe("Regression: Dex BEST/★ semantics untouched", () => {
  it("registerScoreToDex behaves exactly as before, independent of DEPOSIT_SAUCE ever having run", () => {
    const score = { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 95, stars: 5 as const };
    const { dex, wasNewDiscovery, isNewBest } = registerScoreToDex(EMPTY_DEX, "margherita", score);
    expect(wasNewDiscovery).toBe(true);
    expect(isNewBest).toBe(true);
    expect(dex.find((e) => e.recipeId === "margherita")?.bestStars).toBe(5);
    expect(totalStars(dex)).toBe(5);
  });
});

describe("Regression: Mission scoring untouched", () => {
  it("missionScore/averageQualityScore are pure functions of MissionMetrics, unaware sauceDeposits exists", () => {
    const metrics = { servedCount: 3, totalQualityScore: 240, bestQualityScore: 90 };
    expect(missionScore(metrics)).toBe(missionScore({ ...metrics }));
    expect(averageQualityScore(metrics)).toBeCloseTo(80);
  });
});

describe("Regression: non-Margherita sauce interaction", () => {
  it("APPLY_SAUCE for marinara's tomato-sauce still works exactly as before (single commit, no deposits)", () => {
    const owned = ["tomato-sauce", "garlic", "oregano"]; // marinara only
    let state = createInitialGameState(EMPTY_DEX, owned);
    for (let i = 0; i < 20 && state.recipe.id !== "marinara"; i += 1) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("marinara");
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    expect(state.pizza.sauceIds).toEqual(["tomato-sauce"]);
    expect(state.pizza.sauceDeposits).toEqual([]);
  });

  it("DEPOSIT_SAUCE is never dispatched by any code path for a non-tomato-sauce/non-Margherita ingredient -- the reducer still accepts it if sent, but nothing in the app wires that up (App.tsx's referenceModeEnabled/isTomatoSauceReference gate)", () => {
    // Direct reducer probe only, to prove the reducer's own guardrails (ownership) still
    // apply identically to this new action -- not a claim that the UI ever sends this.
    const state = preparedState(["olive-oil"]);
    const after = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "olive-oil",
      x: 50,
      y: 50,
      amount: 0.02,
    });
    expect(after.pizza.sauceIds).toEqual(["olive-oil"]);
  });
});

describe("Regression: no direct invalid state transition", () => {
  it("DEPOSIT_SAUCE never changes `phase`, whatever phase it's dispatched from", () => {
    const orderState = createInitialGameState();
    expect(orderState.phase).toBe("ORDER");
    const after = gameReducer(orderState, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.02,
    });
    expect(after.phase).toBe("ORDER"); // unchanged -- matches APPLY_SAUCE's own lack of a phase gate
  });

  it("REGISTER_TO_DEX is still a no-op outside RESULT even with deposits on the pizza", () => {
    let state = preparedState(STARTER_INGREDIENT_IDS);
    state = gameReducer(state, {
      type: "DEPOSIT_SAUCE",
      ingredientId: "tomato-sauce",
      x: 50,
      y: 50,
      amount: 0.02,
    });
    expect(state.phase).toBe("PREPARE");
    const after = gameReducer(state, { type: "REGISTER_TO_DEX" });
    expect(after).toBe(state);
  });
});
