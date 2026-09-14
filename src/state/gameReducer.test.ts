import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";

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
