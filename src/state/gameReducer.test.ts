import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { registerScoreToDex, EMPTY_DEX } from "./dex";
import type { ScoreBreakdown, QualityStars } from "../logic/scoring";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";

function scoreOf(total: number, stars: QualityStars): ScoreBreakdown {
  return {
    matchScore: total,
    ingredientScore: total,
    placementScore: total,
    bakeScore: total,
    total,
    stars,
  };
}

/** Plays through PREPARE -> BAKE -> RESULT for the initial (Margherita) order, placing every
 *  required ingredient so the round scores well, then confirms the bake at `bakeValue`. */
function playToResult(bakeValue: number): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
  return state;
}

describe("REGISTER_TO_DEX (reducer)", () => {
  it("registers a first-ever result into the Dex with the round's score as BEST", () => {
    const resultState = playToResult(70); // 60-80 is Margherita's perfect zone
    expect(resultState.phase).toBe("RESULT");
    expect(resultState.score).not.toBeNull();

    const after = gameReducer(resultState, { type: "REGISTER_TO_DEX" });
    expect(after.phase).toBe("DISCOVERED");
    expect(after.justDiscovered).toBe(true);
    expect(after.justGotNewBest).toBe(true);

    const entry = after.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.timesMade).toBe(1);
    expect(entry?.bestScore).toBe(resultState.score?.total);
    expect(entry?.bestStars).toBe(resultState.score?.stars);
  });

  it("registers the round into the Dex exactly once, even if dispatched twice", () => {
    const resultState = playToResult(70);
    const afterFirst = gameReducer(resultState, { type: "REGISTER_TO_DEX" });

    // A stray/repeated dispatch after the phase has already moved on must be a no-op —
    // this is the atomicity guarantee: one round can never double-count into the Dex.
    const afterSecond = gameReducer(afterFirst, { type: "REGISTER_TO_DEX" });
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.dex.find((e) => e.recipeId === "margherita")?.timesMade).toBe(1);
  });

  it("is a no-op when dispatched outside of RESULT (e.g. before any bake)", () => {
    const orderState = createInitialGameState();
    const after = gameReducer(orderState, { type: "REGISTER_TO_DEX" });
    expect(after).toBe(orderState);
  });
});

describe("createInitialGameState hydration", () => {
  it("always starts at ORDER, with no dex, when given no saved progression", () => {
    const state = createInitialGameState();
    expect(state.phase).toBe("ORDER");
    expect(state.dex).toEqual(EMPTY_DEX);
  });

  it("starts at ORDER even when hydrated with a non-empty Dex (round in progress never persists)", () => {
    const { dex } = registerScoreToDex(EMPTY_DEX, "margherita", scoreOf(91, 5));
    const state = createInitialGameState(dex);
    expect(state.phase).toBe("ORDER");
  });

  it("carries a loaded Dex's BEST and timesMade into the hydrated state", () => {
    let dex = EMPTY_DEX;
    dex = registerScoreToDex(dex, "margherita", scoreOf(72, 3)).dex;
    dex = registerScoreToDex(dex, "margherita", scoreOf(91, 5)).dex;

    const state = createInitialGameState(dex);
    const entry = state.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.bestScore).toBe(91);
    expect(entry?.bestStars).toBe(5);
    expect(entry?.timesMade).toBe(2);
  });

  it("defaults ownedIngredientIds to the full Starter Set when none is given", () => {
    const state = createInitialGameState();
    expect([...state.ownedIngredientIds].sort()).toEqual([...STARTER_INGREDIENT_IDS].sort());
  });

  it("carries a hydrated ownedIngredientIds through into the initial state", () => {
    const owned = ["tomato-sauce", "mozzarella"];
    const state = createInitialGameState(EMPTY_DEX, owned);
    expect(state.ownedIngredientIds).toEqual(owned);
  });
});

describe("order selection availability (Phase 3C-3)", () => {
  it("all 6 current recipes remain reachable when every starter ingredient is owned", () => {
    const seen = new Set<string>();
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS);
    for (let i = 0; i < 60 && seen.size < 6; i++) {
      seen.add(state.recipe.id);
      state = gameReducer(state, { type: "PLAY_AGAIN" });
    }
    expect(seen.size).toBe(6);
  });

  it("never selects a recipe whose required ingredients are not owned", () => {
    // Only margherita's ingredients are owned -- every other recipe needs an ingredient
    // this list doesn't have (mozzarella-only recipes still need their own extra
    // ingredient, e.g. marinara needs garlic/oregano instead of mozzarella at all).
    const marginallyOwned = ["tomato-sauce", "mozzarella", "basil"];
    let state = createInitialGameState(EMPTY_DEX, marginallyOwned);
    for (let i = 0; i < 30; i++) {
      expect(state.recipe.id).toBe("margherita");
      state = gameReducer(state, { type: "PLAY_AGAIN" });
    }
  });

  it("carries ownedIngredientIds forward across PLAY_AGAIN", () => {
    const owned = ["tomato-sauce", "mozzarella", "basil"];
    let state = createInitialGameState(EMPTY_DEX, owned);
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.ownedIngredientIds).toEqual(owned);
  });
});
