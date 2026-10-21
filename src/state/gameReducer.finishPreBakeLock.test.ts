import { describe, expect, it } from "vitest";
import { gameReducer, type GameAction, type GameState } from "./gameReducer";
import { atBake } from "./testSupport/confirmBakeMatrix";
import { FINISH_FIXTURE_RECIPE as FX, preBakePizza } from "./testSupport/finishFixture";
import type { CookingProfile } from "../data/cookingProfiles";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { buildFinishHintLine } from "../data/finishHint";

/**
 * FINISH FIN-B (Issue #294): once the pizza is baked, nothing in FINISH can change what went into the oven -- the
 * pre-bake pieces, the sauce and the dough. Only PLACE_TOPPING adds (stage "post") pieces.
 */
const PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };

function atFinish(): GameState {
  const base = atBake("guided", "margherita");
  const state = gameReducer({ ...base, recipe: FX, cookingProfile: PROFILE, pizza: preBakePizza() }, { type: "CONFIRM_BAKE", value: 70, now: 1_000_000 });
  expect(state.makingStep).toBe("FINISH");
  return state;
}

const preBakeView = (s: GameState) => ({
  pre: s.pizza.toppings.filter((t) => t.stage !== "post"),
  sauceIds: s.pizza.sauceIds,
  sauceDeposits: s.pizza.sauceDeposits,
  doughShape: s.pizza.doughShape,
  squareDough: s.pizza.squareDough,
  pan: s.pizza.pan,
  dough: s.pizza.dough,
});

describe("FINISH leaves the pre-bake pizza unchanged", () => {
  const attempts: GameAction[] = [
    { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: DOUGH_CENTER, y: DOUGH_CENTER },
    { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: [] },
    { type: "COMMIT_DOUGH_STRETCH", shape: { radii: Array(8).fill(30) } as never },
    { type: "SELECT_PAN", pan: "tray" },
    { type: "SELECT_DOUGH", dough: "thin" as never },
    { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: DOUGH_CENTER, y: DOUGH_CENTER },
    { type: "PLACE_TOPPING", ingredientId: "tomato-sauce", x: DOUGH_CENTER, y: DOUGH_CENTER },
    { type: "UNDO_LAST_PLACEMENT" },
    { type: "RESET_PIZZA" },
  ];

  for (const action of attempts) {
    it(`${action.type}${"ingredientId" in action ? ` (${action.ingredientId})` : ""} cannot touch the baked pieces, sauce or dough`, () => {
      const state = atFinish();
      const next = gameReducer(state, action);
      expect(preBakeView(next)).toEqual(preBakeView(state));
      expect(next.phase).toBe("POST_BAKE");
    });
  }

  it("a sequence of late placements adds only stage \"post\" pieces and keeps every pre-bake piece", () => {
    let state = atFinish();
    const before = preBakeView(state);
    for (let i = 0; i < 3; i += 1) {
      state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER - 20 + i * 20, y: DOUGH_CENTER + (i % 2) * 30 });
    }
    expect(preBakeView(state)).toEqual(before);
    const added = state.pizza.toppings.filter((t) => t.stage === "post");
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((t) => t.ingredientId === "parsley")).toBe(true);
  });
});

describe("FINISH hint (SHOW_HINT) is buildFinishHintLine", () => {
  it("names the late ingredient with the count, follows the placements, and changes nothing else", () => {
    const state = atFinish();
    const hinted = gameReducer(state, { type: "SHOW_HINT" });
    expect(hinted.hint).toEqual(buildFinishHintLine(FX, state.pizza, true));
    expect(hinted.hint?.textJa).toBe("パセリをあと2個、仕上げにのせてね。");
    expect({ ...hinted, hint: state.hint }).toEqual(state);
    const placed = gameReducer(hinted, { type: "PLACE_TOPPING", ingredientId: "parsley", x: DOUGH_CENTER, y: DOUGH_CENTER });
    expect(gameReducer(placed, { type: "SHOW_HINT" }).hint?.textJa).toBe("パセリをあと1個、仕上げにのせてね。");
  });
});
