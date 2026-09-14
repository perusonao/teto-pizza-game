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

  it("defaults pitzBalance to 0 when none is given", () => {
    const state = createInitialGameState();
    expect(state.pitzBalance).toBe(0);
  });

  it("carries a hydrated pitzBalance through into the initial state", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 120);
    expect(state.pitzBalance).toBe(120);
  });

  it("starts with no claimed Mission run", () => {
    const state = createInitialGameState();
    expect(state.lastClaimedMissionRunId).toBeNull();
  });
});

describe("pitzBalance carry-over (Phase 3C-5)", () => {
  it("PLAY_AGAIN carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "PLAY_AGAIN" });
    expect(state.pitzBalance).toBe(75);
  });

  it("MISSION_RESET_ORDER carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(state.pitzBalance).toBe(75);
  });

  it("MISSION_NEXT_ORDER carries pitzBalance forward unchanged", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 75);
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    expect(state.pitzBalance).toBe(75);
  });
});

describe("PURCHASE_INGREDIENT (reducer)", () => {
  // Every real production ingredient is Starter Set (already OWNED, see
  // STARTER_INGREDIENT_IDS) -- Phase 3C-5 adds no purchasable ingredient to production data
  // (SSOT: Recipe #7/salami stays out of scope). The reducer's happy-path transaction itself
  // (LOCKED/AVAILABLE_TO_BUY/insufficient funds/success) is exhaustively covered against mock
  // ingredients by the pure `purchaseIngredient` function's own tests (src/logic/economy.test.ts)
  // and by the purchase -> OWNED -> recipe-available integration tests
  // (src/state/progression.test.ts) -- these tests only cover this reducer's own wiring/guards.

  it("purchasing an already-OWNED (starter) ingredient is a complete no-op", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "tomato-sauce" });
    expect(after).toBe(state);
  });

  it("purchasing an unknown ingredient id is a no-op and never throws", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    expect(() =>
      gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "not-a-real-ingredient" }),
    ).not.toThrow();
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "not-a-real-ingredient" });
    expect(after).toBe(state);
  });

  it("a no-op purchase never changes pitzBalance or ownedIngredientIds", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 500);
    const after = gameReducer(state, { type: "PURCHASE_INGREDIENT", ingredientId: "mozzarella" });
    expect(after.pitzBalance).toBe(500);
    expect(after.ownedIngredientIds).toEqual(state.ownedIngredientIds);
  });
});

describe("CLAIM_MISSION_REWARD (reducer, Phase 3C-5)", () => {
  it("adds the reward amount to pitzBalance and records the claimed runId", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(after.pitzBalance).toBe(180);
    expect(after.lastClaimedMissionRunId).toBe(1);
  });

  it("granting the same runId a second time is a complete no-op (no double grant)", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const first = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    const second = gameReducer(first, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(second).toBe(first);
    expect(second.pitzBalance).toBe(180);
  });

  it("granting the same runId many times (simulating rerenders/StrictMode) never compounds", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    for (let i = 0; i < 10; i++) {
      state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 5, amount: 90 });
    }
    expect(state.pitzBalance).toBe(90);
  });

  it("a retry (fresh runId) after a claimed run grants a new reward on top of the previous one", () => {
    let state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(state.pitzBalance).toBe(80);
    // Retrying re-dispatches the *previous* run's id once more before the new run's own claim
    // fires (mirrors the shape of App.tsx's granting effect across a retry) -- must still be a
    // no-op even interleaved with the new run's claim.
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(state.pitzBalance).toBe(80);
    state = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 2, amount: 60 });
    expect(state.pitzBalance).toBe(140);
    expect(state.lastClaimedMissionRunId).toBe(2);
  });

  it("a 0-amount grant still records the runId as claimed (so a later duplicate dispatch is a no-op)", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 0 });
    expect(after.pitzBalance).toBe(0);
    expect(after.lastClaimedMissionRunId).toBe(1);
  });

  it("never applies a negative amount even if one is somehow dispatched", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 100);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: -50 });
    expect(after.pitzBalance).toBe(100);
  });

  it("claiming a reward never touches Dex or ownedIngredientIds", () => {
    const state = createInitialGameState(EMPTY_DEX, STARTER_INGREDIENT_IDS, 0);
    const after = gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: 80 });
    expect(after.dex).toEqual(state.dex);
    expect(after.ownedIngredientIds).toEqual(state.ownedIngredientIds);
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

describe("Mission order actions (Phase 3C-4)", () => {
  it("MISSION_RESET_ORDER picks a fresh available-pool order from any phase, including PREPARE/BAKE mid-round", () => {
    let state = createInitialGameState();
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    expect(state.phase).toBe("PREPARE");

    const reset = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    expect(reset.phase).toBe("ORDER");
    expect(reset.pizza.toppings).toEqual([]);
    expect(reset.pizza.sauceIds).toEqual([]);
  });

  it("MISSION_RESET_ORDER never repeats the just-active recipe when another is available", () => {
    const owned = ["tomato-sauce", "mozzarella", "basil", "garlic", "oregano"]; // margherita + marinara
    let state = createInitialGameState(EMPTY_DEX, owned);
    for (let i = 0; i < 30; i++) {
      const before = state.recipe.id;
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
      expect(state.recipe.id).not.toBe(before);
    }
  });

  it("MISSION_RESET_ORDER only ever selects a recipe from the currently-owned/available pool", () => {
    const marginallyOwned = ["tomato-sauce", "mozzarella", "basil"]; // margherita only
    let state = createInitialGameState(EMPTY_DEX, marginallyOwned);
    for (let i = 0; i < 20; i++) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
      expect(state.recipe.id).toBe("margherita");
    }
  });

  it("MISSION_NEXT_ORDER is a no-op outside of RESULT (mirrors REGISTER_TO_DEX's atomicity guard)", () => {
    const orderState = createInitialGameState();
    expect(gameReducer(orderState, { type: "MISSION_NEXT_ORDER" })).toBe(orderState);
  });

  it("MISSION_NEXT_ORDER registers the round to the Dex (discovery, BEST, timesMade) and advances straight to a fresh ORDER, skipping DISCOVERED", () => {
    const resultState = playToResult(70); // Margherita's perfect zone is 60-80
    expect(resultState.phase).toBe("RESULT");

    const next = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    expect(next.phase).toBe("ORDER"); // never DISCOVERED during Mission

    const entry = next.dex.find((e) => e.recipeId === "margherita");
    expect(entry?.discovered).toBe(true);
    expect(entry?.timesMade).toBe(1);
    expect(entry?.bestScore).toBe(resultState.score?.total);
    expect(entry?.bestStars).toBe(resultState.score?.stars);
  });

  it("MISSION_NEXT_ORDER updates Dex BEST on a repeat play the same way REGISTER_TO_DEX does", () => {
    let state = playToResult(70);
    state = gameReducer(state, { type: "MISSION_NEXT_ORDER" }); // first margherita registered, BEST set

    // Force the Mission loop back onto margherita specifically (MISSION_NEXT_ORDER's own
    // rotation may have picked a different recipe) by forcing a fresh order until it lands on
    // margherita again, then play it through exactly like `playToResult` does.
    for (let i = 0; i < 30 && state.recipe.id !== "margherita"; i++) {
      state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    }
    expect(state.recipe.id).toBe("margherita");

    state = gameReducer(state, { type: "BEGIN_PREPARE" });
    state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
    state = gameReducer(state, { type: "START_BAKE" });
    state = gameReducer(state, { type: "CONFIRM_BAKE", value: 65 }); // still in the perfect zone
    expect(state.phase).toBe("RESULT");

    const beforeEntry = state.dex.find((e) => e.recipeId === "margherita");
    expect(beforeEntry?.timesMade).toBe(1);

    const after = gameReducer(state, { type: "MISSION_NEXT_ORDER" });
    const afterEntry = after.dex.find((e) => e.recipeId === "margherita");
    expect(afterEntry?.timesMade).toBe(2);
  });

  it("MISSION_NEXT_ORDER registers exactly once even if dispatched twice in a row", () => {
    const resultState = playToResult(70);
    const first = gameReducer(resultState, { type: "MISSION_NEXT_ORDER" });
    // The phase has already moved to ORDER, so a stray repeat must be a true no-op (ORDER has
    // no `score`, which is exactly the guard MISSION_NEXT_ORDER shares with REGISTER_TO_DEX).
    const second = gameReducer(first, { type: "MISSION_NEXT_ORDER" });
    expect(second).toBe(first);
  });
});
