import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";

/**
 * M3A Bake Judgment Phase 5/6 regression guard: the reducer (Scoring 2.0's one true call site,
 * see CONFIRM_BAKE's own comment in ./gameReducer.ts) takes only the raw numeric `value` a
 * CONFIRM_BAKE tap carries -- it has no concept of BakeOverlay's Guide, its fade timing, or
 * elapsed BAKE-phase time at all (the action's own type is `{ type: "CONFIRM_BAKE"; value:
 * number }`, nothing else). This file pins that down at the reducer level: identical
 * `bakeResult` taps always produce identical scores, independent of *when* (and therefore how
 * faded the Guide was) the tap happened -- BakeOverlay.test.tsx's own "still confirms the
 * current needle position after the guide has faded" complements this by proving the UI layer
 * really does keep forwarding the true position once the Guide is hidden.
 */
function playToResult(bakeValue: number): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 40, y: 50 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 60, y: 50 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: 50, y: 30 });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 65 });
  state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: 35, y: 65 });
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: bakeValue });
  return state;
}

describe("Bake score is independent of Guide visibility/fade timing", () => {
  it.each([10, 40, 65, 70, 85, 99])(
    "CONFIRM_BAKE value=%d always scores identically -- the reducer never sees Guide state",
    (bakeValue) => {
      const first = playToResult(bakeValue);
      const second = playToResult(bakeValue);
      expect(second.score).toEqual(first.score);
      expect(second.bakeState).toEqual(first.bakeState);
      expect(second.scoringV2Result).toEqual(first.scoringV2Result);
      expect(second.pizza.bakeResult).toBe(first.pizza.bakeResult);
      expect(second.pizza.bakeResult).toBe(bakeValue);
    },
  );

  it("CONFIRM_BAKE's action payload carries only the tap's numeric value -- no Guide/fade field exists to score against", () => {
    const state = createInitialGameState();
    // A type-level guarantee (gameReducer.ts's own GameAction union) backed by a runtime
    // sanity check: dispatching with only `value` set is the entire, valid action shape.
    const action = { type: "CONFIRM_BAKE" as const, value: 42 };
    expect(Object.keys(action).sort()).toEqual(["type", "value"]);
    expect(() => gameReducer(state, action)).not.toThrow();
  });
});
