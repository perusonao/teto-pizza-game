import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInitialSquareDough } from "../logic/pan/squareDough";
import { createLumpySquareDough } from "../logic/pan/squareDoughFixtures";
import { resetPreviewPanShapeForTest } from "../preview/panShapePreview";
import { createEmptyPizza } from "./pizzaState";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Square Dough F4-b (#538): SELECT_PAN through the real reducer. No catalog recipe requires the tray, so in Production the affordance
 * is closed; the Preview / DEV query `?panSwitch=open` opens it for these tests (it opens the switch only -- the rest is the real path).
 */
function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewPanShapeForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

function freeCookDough(): GameState {
  const state = gameReducer(createInitialGameState(), { type: "START_FREE_COOK", now: 0 });
  const prepared = gameReducer(state, { type: "BEGIN_PREPARE", now: 0 });
  expect(prepared.phase).toBe("PREPARE");
  expect(prepared.makingStep).toBe("DOUGH");
  return prepared;
}

describe("SELECT_PAN", () => {
  it("is a no-op while the affordance is closed (Production: no recipe requires the tray)", () => {
    const state = freeCookDough();
    expect(gameReducer(state, { type: "SELECT_PAN", pan: "tray" })).toBe(state);
  });

  describe("with the switch open", () => {
    beforeEach(() => setSearch("?panSwitch=open"));

    it("tray sets only pizza.pan (and drops no dough); round removes the key again", () => {
      const start = freeCookDough();
      const tray = gameReducer(start, { type: "SELECT_PAN", pan: "tray" });
      expect(tray.pizza.pan).toBe("tray");
      expect(tray.pizza.doughShape).toBe(start.pizza.doughShape);
      const back = gameReducer(tray, { type: "SELECT_PAN", pan: "round" });
      expect("pan" in back.pizza).toBe(false);
      expect(back).toEqual(start);
    });

    it("selecting the pan already chosen changes nothing (same state object)", () => {
      const start = freeCookDough();
      expect(gameReducer(start, { type: "SELECT_PAN", pan: "round" })).toBe(start);
      const tray = gameReducer(start, { type: "SELECT_PAN", pan: "tray" });
      expect(gameReducer(tray, { type: "SELECT_PAN", pan: "tray" })).toBe(tray);
    });

    it("keeps both doughs across ○→□→○→□ (a committed round shape and a committed square grid survive)", () => {
      const start = freeCookDough();
      const shape = start.pizza.doughShape;
      let state = gameReducer(start, { type: "COMMIT_DOUGH_STRETCH", shape });
      state = gameReducer(state, { type: "SELECT_PAN", pan: "tray" });
      const grid = createLumpySquareDough();
      state = gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough: grid });
      state = gameReducer(state, { type: "SELECT_PAN", pan: "round" });
      expect(state.pizza.squareDough).toBe(grid);
      expect(state.pizza.doughShape).toBe(shape);
      state = gameReducer(state, { type: "SELECT_PAN", pan: "tray" });
      expect(state.pizza.squareDough).toBe(grid);
    });

    it("a round pizza still refuses COMMIT_SQUARE_DOUGH; a tray pizza accepts it", () => {
      const start = freeCookDough();
      const dough = createInitialSquareDough();
      expect(gameReducer(start, { type: "COMMIT_SQUARE_DOUGH", dough })).toBe(start);
      const tray = gameReducer(start, { type: "SELECT_PAN", pan: "tray" });
      expect(gameReducer(tray, { type: "COMMIT_SQUARE_DOUGH", dough }).pizza.squareDough).toBe(dough);
    });

    it("the cooking profile follows the pan: a tray round has no CUT; back to round restores the recipe's own profile", () => {
      const start = freeCookDough();
      const tray = gameReducer(start, { type: "SELECT_PAN", pan: "tray" });
      expect(tray.cookingProfile.steps).not.toContain("CUT");
      expect(tray.cookingProfile.cutConfig).toBeUndefined();
      const back = gameReducer(tray, { type: "SELECT_PAN", pan: "round" });
      expect(back.cookingProfile).toEqual(start.cookingProfile);
      expect(back.cutState).toEqual(start.cutState);
    });

    it("「次へ」 settles it: after the DOUGH step no choice is accepted (O-7), and the tray stays", () => {
      const tray = gameReducer(freeCookDough(), { type: "SELECT_PAN", pan: "tray" });
      const next = gameReducer(tray, { type: "CONFIRM_MAKING_STEP" });
      expect(next.makingStep).not.toBe("DOUGH");
      expect(gameReducer(next, { type: "SELECT_PAN", pan: "round" })).toBe(next);
      expect(next.pizza.pan).toBe("tray");
    });

    it("RESET_PIZZA discards the choice with the pizza and restores the round profile", () => {
      const start = freeCookDough();
      const tray = gameReducer(start, { type: "SELECT_PAN", pan: "tray" });
      const reset = gameReducer(tray, { type: "RESET_PIZZA" });
      expect(reset.pizza).toEqual(createEmptyPizza());
      expect(reset.cookingProfile).toEqual(start.cookingProfile);
    });

    it("is a no-op in a guided round, whatever the Dex says", () => {
      let state = createGuidedInitialState("margherita");
      state = gameReducer(state, { type: "BEGIN_PREPARE" });
      expect(state.freeCook).toBe(false);
      expect(gameReducer(state, { type: "SELECT_PAN", pan: "tray" })).toBe(state);
    });

    it("is a no-op outside PREPARE", () => {
      const order: GameState = { ...freeCookDough(), phase: "ORDER" };
      expect(gameReducer(order, { type: "SELECT_PAN", pan: "tray" })).toBe(order);
    });

    it("a recipe whose own pan is square has no choice (Preview ?pan=square)", () => {
      setSearch("?panSwitch=open&pan=square");
      const state = freeCookDough();
      expect(gameReducer(state, { type: "SELECT_PAN", pan: "tray" })).toBe(state);
    });
  });
});
