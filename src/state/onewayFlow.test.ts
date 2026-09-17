import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState, type MakingStep } from "./gameReducer";
import { DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import {
  DOUGH_COMPLETION_THRESHOLD,
  applyStretchPoint,
  createInitialDoughShape,
  doughSizeProgress,
  type DoughShape,
} from "../logic/doughShape";

/**
 * Issue #32 Phase 2 / Issue #33 D1: focused reducer-level coverage for the
 * DOUGH -> SAUCE -> CHEESE -> TOPPING making flow contract
 * (docs/reports/TETO_ISSUE-32_ONE-WAY-FLOW_Fresh-Audit.md's "Focused test plan", extended by
 * docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md §10 item 4). Every assertion here goes
 * through `gameReducer` directly -- no UI, no component harness -- because the contract this
 * file exists to pin is "the reducer enforces it, not UI hiding".
 */

const SAUCE_ID = "tomato-sauce";
const CHEESE_ID = "mozzarella";
const TOPPING_ID = "basil";

// Owning only Margherita's own ingredients makes it the sole available recipe (mirrors
// gameReducer.test.ts's own `marginallyOwned` fixture) -- this pins COMMIT_SAUCE_DISPENSE's
// recipe-sauce-profile check to `tomato-sauce` deterministically for both FREE and Lunch Rush,
// instead of leaving it to whichever recipe Lunch Rush's own random pick happens to land on.
const MARGHERITA_ONLY_OWNED = [SAUCE_ID, CHEESE_ID, TOPPING_ID];

/** A fresh PREPARE-phase round -- Issue #33 D1: this now naturally lands at "DOUGH", the new
 *  first step, rather than "SAUCE". */
function preparedState(isMissionRound = false): GameState {
  let state = createInitialGameState(undefined, MARGHERITA_ONLY_OWNED);
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  if (isMissionRound) {
    state = gameReducer(state, { type: "MISSION_RESET_ORDER" });
    state = gameReducer(state, { type: "BEGIN_PREPARE" });
  }
  return state;
}

function confirm(state: GameState): GameState {
  return gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
}

/** Every test below that used to start "at SAUCE" (back when SAUCE was the first step) now
 *  needs one extra CONFIRM_MAKING_STEP (DOUGH -> SAUCE) to reach the same starting point --
 *  centralized here so that single extra step isn't repeated at every call site. */
function preparedAtSauceState(isMissionRound = false): GameState {
  return confirm(preparedState(isMissionRound));
}

function applySauce(state: GameState): GameState {
  return gameReducer(state, { type: "APPLY_SAUCE", ingredientId: SAUCE_ID, x: 50, y: 50 });
}

function placeCheese(state: GameState, x = 40, y = 50): GameState {
  return gameReducer(state, { type: "PLACE_TOPPING", ingredientId: CHEESE_ID, x, y });
}

function placeTopping(state: GameState, x = 50, y = 65): GameState {
  return gameReducer(state, { type: "PLACE_TOPPING", ingredientId: TOPPING_ID, x, y });
}

/** A shape whose mean radius already clears the D1 completion threshold -- used to exercise
 *  COMMIT_DOUGH_STRETCH's happy path without depending on `applyStretchPoint`'s own geometry. */
function completeDoughShape(): DoughShape {
  return { radii: createInitialDoughShape().radii.map(() => DOUGH_RADIUS) };
}

describe.each([
  ["FREE", false],
  ["Lunch Rush", true],
])("Issue #32/#33 one-way making flow (%s)", (_label, isMissionRound) => {
  describe("DOUGH (Issue #33 D1)", () => {
    it("starts a fresh PREPARE round at DOUGH, with a small uniform initial shape", () => {
      const state = preparedState(isMissionRound);
      expect(state.makingStep).toBe("DOUGH");
      expect(state.pizza.doughShape).toEqual(createInitialDoughShape());
      expect(doughSizeProgress(state.pizza.doughShape)).toBeLessThan(DOUGH_COMPLETION_THRESHOLD);
    });

    it("COMMIT_DOUGH_STRETCH replaces doughShape while makingStep is DOUGH", () => {
      const state = preparedState(isMissionRound);
      const shape = applyStretchPoint(state.pizza.doughShape, 50 + 40, 50);
      const after = gameReducer(state, { type: "COMMIT_DOUGH_STRETCH", shape });
      expect(after.pizza.doughShape).toEqual(shape);
    });

    it("rejects an invalid shape payload (wrong length) as a no-op", () => {
      const state = preparedState(isMissionRound);
      const after = gameReducer(state, {
        type: "COMMIT_DOUGH_STRETCH",
        shape: { radii: [1, 2, 3] },
      });
      expect(after).toBe(state);
    });

    it("COMMIT_DOUGH_STRETCH is rejected once makingStep has advanced past DOUGH (stale-event contract)", () => {
      const atSauce = confirm(preparedState(isMissionRound));
      const after = gameReducer(atSauce, {
        type: "COMMIT_DOUGH_STRETCH",
        shape: completeDoughShape(),
      });
      expect(after).toBe(atSauce);
      expect(after.pizza.doughShape).toEqual(createInitialDoughShape());
    });

    it("DOUGH placement/sauce/topping actions are all rejected while makingStep is DOUGH (never falls through to a later step's action)", () => {
      const state = preparedState(isMissionRound);
      expect(applySauce(state)).toBe(state);
      expect(placeCheese(state)).toBe(state);
      expect(placeTopping(state)).toBe(state);
    });

    it("CONFIRM_MAKING_STEP advances DOUGH -> SAUCE, and the reducer never gates it on completion (UI-only gate, per D0 §10 item 3)", () => {
      const state = preparedState(isMissionRound);
      // Deliberately still incomplete (initial shape) -- the reducer's own transition must
      // still succeed; only the UI's CTA disables early advancement, pinned separately at the
      // component level.
      expect(doughSizeProgress(state.pizza.doughShape)).toBeLessThan(DOUGH_COMPLETION_THRESHOLD);
      const after = confirm(state);
      expect(after.makingStep).toBe("SAUCE");
    });

    it("shape is preserved unchanged across the DOUGH -> SAUCE transition", () => {
      const state = preparedState(isMissionRound);
      const shape = applyStretchPoint(state.pizza.doughShape, 50 + 40, 50);
      const stretched = gameReducer(state, { type: "COMMIT_DOUGH_STRETCH", shape });
      const atSauce = confirm(stretched);
      expect(atSauce.pizza.doughShape).toEqual(shape);
    });

    it("shape rides unchanged through every later making step, BAKE and RESULT", () => {
      const state = preparedState(isMissionRound);
      const shape = applyStretchPoint(state.pizza.doughShape, 50 + 45, 50);
      let s = gameReducer(state, { type: "COMMIT_DOUGH_STRETCH", shape });
      s = confirm(s); // -> SAUCE
      s = applySauce(s);
      s = confirm(s); // -> CHEESE
      s = placeCheese(s);
      s = confirm(s); // -> TOPPING
      s = placeTopping(s);
      expect(s.pizza.doughShape).toEqual(shape);
      const baking = gameReducer(s, { type: "START_BAKE" });
      expect(baking.pizza.doughShape).toEqual(shape);
      const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
      expect(result.phase).toBe("RESULT");
      expect(result.pizza.doughShape).toEqual(shape);
      // Scoring 2.0 authority is untouched by DOUGH -- still computed normally alongside it.
      expect(result.score).not.toBeNull();
    });
  });

  describe("SAUCE", () => {
    it("accepts APPLY_SAUCE and COMMIT_SAUCE_DISPENSE while makingStep is SAUCE", () => {
      const state = preparedAtSauceState(isMissionRound);
      const withSauce = applySauce(state);
      expect(withSauce.pizza.sauceIds).toEqual([SAUCE_ID]);

      const withDeposit = gameReducer(state, {
        type: "COMMIT_SAUCE_DISPENSE",
        ingredientId: SAUCE_ID,
        deposits: [{ x: 50, y: 50, amount: 1 }],
      });
      expect(withDeposit.pizza.sauceDeposits).toHaveLength(1);
    });

    it("repaint (re-applying sauce) still works while still in SAUCE", () => {
      const state = preparedAtSauceState(isMissionRound);
      const first = applySauce(state);
      const second = gameReducer(first, {
        type: "APPLY_SAUCE",
        ingredientId: SAUCE_ID,
        x: 30,
        y: 30,
      });
      expect(second.pizza.sauceOrigin).toEqual({ x: 30, y: 30 });
    });

    it("CONFIRM_MAKING_STEP advances SAUCE -> CHEESE", () => {
      const state = confirm(preparedAtSauceState(isMissionRound));
      expect(state.makingStep).toBe("CHEESE");
    });

    it("APPLY_SAUCE is rejected once makingStep has advanced past SAUCE", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const after = applySauce(atCheese);
      expect(after).toBe(atCheese);
      expect(after.pizza.sauceIds).toEqual([]);
    });

    it("COMMIT_SAUCE_DISPENSE is rejected once makingStep has advanced past SAUCE (stale-event contract)", () => {
      // Simulates a dispense gesture whose commit reaches the reducer after the player has
      // already confirmed the step (the UI-side `makingStepToken` abort is what stops this in
      // practice -- this pins the reducer-boundary backstop independent of that UI layer).
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const after = gameReducer(atCheese, {
        type: "COMMIT_SAUCE_DISPENSE",
        ingredientId: SAUCE_ID,
        deposits: [{ x: 50, y: 50, amount: 1 }],
      });
      expect(after).toBe(atCheese);
      expect(after.pizza.sauceDeposits).toEqual([]);
    });
  });

  describe("CHEESE", () => {
    it("rejects cheese placement during SAUCE", () => {
      const state = preparedAtSauceState(isMissionRound);
      const after = placeCheese(state);
      expect(after).toBe(state);
      expect(after.pizza.toppings).toHaveLength(0);
    });

    it("accepts cheese placement once makingStep is CHEESE", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const after = placeCheese(atCheese);
      expect(after.pizza.toppings).toHaveLength(1);
      expect(after.pizza.toppings[0].ingredientId).toBe(CHEESE_ID);
    });

    it("sauce editing is rejected while makingStep is CHEESE", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const after = applySauce(atCheese);
      expect(after).toBe(atCheese);
    });

    it("CONFIRM_MAKING_STEP advances CHEESE -> TOPPING", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      expect(atTopping.makingStep).toBe("TOPPING");
    });

    it("rejects cheese placement once makingStep has advanced to TOPPING", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const after = placeCheese(atTopping);
      expect(after).toBe(atTopping);
      expect(after.pizza.toppings).toHaveLength(0);
    });
  });

  describe("TOPPING", () => {
    it("rejects topping placement during SAUCE", () => {
      const state = preparedAtSauceState(isMissionRound);
      const after = placeTopping(state);
      expect(after).toBe(state);
      expect(after.pizza.toppings).toHaveLength(0);
    });

    it("rejects topping placement during CHEESE", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const after = placeTopping(atCheese);
      expect(after).toBe(atCheese);
      expect(after.pizza.toppings).toHaveLength(0);
    });

    it("accepts topping placement once makingStep is TOPPING, cheese/sauce editing stay rejected", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const withTopping = placeTopping(atTopping);
      expect(withTopping.pizza.toppings).toHaveLength(1);
      expect(withTopping.pizza.toppings[0].ingredientId).toBe(TOPPING_ID);

      expect(placeCheese(withTopping)).toBe(withTopping);
      expect(applySauce(withTopping)).toBe(withTopping);
    });

    it("TOPPING -> BAKE remains valid via the pre-existing START_BAKE transition", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const baking = gameReducer(atTopping, { type: "START_BAKE" });
      expect(baking.phase).toBe("BAKE");
    });

    it("BAKE cannot return to PREPARE (no reducer action moves phase backward)", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const baking = gameReducer(atTopping, { type: "START_BAKE" });
      // Every making-flow action is rejected once phase has left PREPARE -- there is no
      // action in GameAction that sets `phase` back to "PREPARE" from "BAKE".
      expect(gameReducer(baking, { type: "PLACE_TOPPING", ingredientId: TOPPING_ID, x: 50, y: 50 })).toBe(baking);
      expect(gameReducer(baking, { type: "CONFIRM_MAKING_STEP" })).toBe(baking);
      expect(baking.phase).toBe("BAKE");
    });

    it("CONFIRM_BAKE scoring is unaffected by the making-flow gate (existing behavior preserved)", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const withTopping = placeTopping(atTopping);
      const baking = gameReducer(withTopping, { type: "START_BAKE" });
      const result = gameReducer(baking, { type: "CONFIRM_BAKE", value: 70 });
      expect(result.phase).toBe("RESULT");
      expect(result.score).not.toBeNull();
    });
  });

  describe("ORDER (one-way contract)", () => {
    it("CONFIRM_MAKING_STEP never skips a step: DOUGH -> SAUCE, never DOUGH -> CHEESE", () => {
      const afterOneConfirm = confirm(preparedState(isMissionRound));
      expect(afterOneConfirm.makingStep).toBe("SAUCE");
    });

    it("CONFIRM_MAKING_STEP never skips a step: SAUCE -> CHEESE, never SAUCE -> TOPPING", () => {
      const afterOneConfirm = confirm(preparedAtSauceState(isMissionRound));
      expect(afterOneConfirm.makingStep).toBe("CHEESE");
    });

    it("no action can move makingStep backward from CHEESE to SAUCE", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      // CONFIRM_MAKING_STEP is the only action that touches `makingStep` while still in
      // PREPARE (besides RESET_PIZZA, which is the explicit whole-pizza recovery path, not a
      // backward step) -- dispatching it again only ever advances forward.
      const after = confirm(atCheese);
      expect(after.makingStep).toBe("TOPPING");
      expect(after.makingStep).not.toBe("SAUCE");
    });

    it("CONFIRM_MAKING_STEP is a no-op past TOPPING (clamped, never wraps back to DOUGH)", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const after = confirm(atTopping);
      expect(after).toBe(atTopping);
      expect(after.makingStep).toBe("TOPPING");
    });

    it("CONFIRM_MAKING_STEP outside PREPARE is a no-op", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const baking = gameReducer(atTopping, { type: "START_BAKE" });
      expect(confirm(baking)).toBe(baking);
    });

    it("direct hand-built dispatch sequence cannot bypass the contract: confirm DOUGH, confirm SAUCE, confirm CHEESE, then dispatch COMMIT_SAUCE_DISPENSE is rejected purely by the reducer", () => {
      let state = preparedState(isMissionRound);
      state = confirm(state); // DOUGH -> SAUCE
      state = confirm(state); // SAUCE -> CHEESE
      state = confirm(state); // CHEESE -> TOPPING
      const beforeStale = state;
      const afterStaleCommit = gameReducer(state, {
        type: "COMMIT_SAUCE_DISPENSE",
        ingredientId: SAUCE_ID,
        deposits: [{ x: 50, y: 50, amount: 1 }],
      });
      expect(afterStaleCommit).toBe(beforeStale);

      const afterStaleCheese = gameReducer(state, {
        type: "PLACE_TOPPING",
        ingredientId: CHEESE_ID,
        x: 50,
        y: 50,
      });
      expect(afterStaleCheese).toBe(beforeStale);
    });
  });

  describe("RESET (whole-pizza discard/restart)", () => {
    const steps: MakingStep[] = ["DOUGH", "SAUCE", "CHEESE", "TOPPING"];

    it.each(steps)("RESET_PIZZA from makingStep=%s deterministically returns to DOUGH", (targetStep) => {
      let state = preparedState(isMissionRound);
      while (state.makingStep !== targetStep) {
        state = confirm(state);
      }
      const reset = gameReducer(state, { type: "RESET_PIZZA" });
      expect(reset.makingStep).toBe("DOUGH");
      expect(reset.pizza.toppings).toHaveLength(0);
      expect(reset.pizza.sauceIds).toEqual([]);
      expect(reset.pizza.doughShape).toEqual(createInitialDoughShape());
    });

    it("RESET_PIZZA bumps makingStepToken so a pre-reset gesture token can never match again", () => {
      const state = preparedState(isMissionRound);
      const reset = gameReducer(state, { type: "RESET_PIZZA" });
      expect(reset.makingStepToken).toBeGreaterThan(state.makingStepToken);
    });

    it("RESET_PIZZA gives a fresh, independent doughShape object (not shared/mutated with the pre-reset one)", () => {
      const state = preparedState(isMissionRound);
      const stretched = gameReducer(state, {
        type: "COMMIT_DOUGH_STRETCH",
        shape: applyStretchPoint(state.pizza.doughShape, 50 + 40, 50),
      });
      const reset = gameReducer(stretched, { type: "RESET_PIZZA" });
      expect(reset.pizza.doughShape).toEqual(createInitialDoughShape());
      expect(stretched.pizza.doughShape).not.toEqual(createInitialDoughShape());
    });

    it("a fresh sauce application after RESET_PIZZA works normally (not a stale pointer)", () => {
      const atCheese = confirm(preparedAtSauceState(isMissionRound));
      const reset = gameReducer(atCheese, { type: "RESET_PIZZA" });
      const atSauceAgain = confirm(reset); // DOUGH -> SAUCE
      const withSauce = applySauce(atSauceAgain);
      expect(withSauce.pizza.sauceIds).toEqual([SAUCE_ID]);
    });

    it("RESET_PIZZA outside PREPARE is rejected (does not blank a BAKE/RESULT pizza)", () => {
      const atTopping = confirm(confirm(preparedAtSauceState(isMissionRound)));
      const withTopping = placeTopping(atTopping);
      const baking = gameReducer(withTopping, { type: "START_BAKE" });
      const after = gameReducer(baking, { type: "RESET_PIZZA" });
      expect(after).toBe(baking);
      expect(after.pizza.toppings).toHaveLength(1);
    });
  });
});
