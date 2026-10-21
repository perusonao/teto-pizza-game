import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDoughKindPreviewForTest } from "../preview/doughKindPreview";
import { resetPreviewPanShapeForTest } from "../preview/panShapePreview";
import { effectivePanShape } from "../logic/pan/effectivePan";
import { createLumpySquareDough } from "../logic/pan/squareDoughFixtures";
import { signatureOfPizza } from "../logic/discovery/signature";
import { createEmptyPizza } from "./pizzaState";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * Dough Kind P2 (#577): SELECT_DOUGH through the real reducer. No catalog recipe requires the dough technique (P3 is on HOLD), so in
 * Production the affordance is closed; the Preview / DEV query `?doughSwitch=open` opens it for these tests (it opens the chips only).
 */
const PINSA = "material-multigrain-long-ferment";
function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetDoughKindPreviewForTest();
  resetPreviewPanShapeForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

function freeCookDough(): GameState {
  const state = gameReducer(createInitialGameState(), { type: "START_FREE_COOK", now: 0 });
  const prepared = gameReducer(state, { type: "BEGIN_PREPARE", now: 0 });
  expect(prepared.makingStep).toBe("DOUGH");
  return prepared;
}

describe("SELECT_DOUGH", () => {
  it("is a no-op while the affordance is closed (Production: no recipe requires the dough technique)", () => {
    const state = freeCookDough();
    expect(gameReducer(state, { type: "SELECT_DOUGH", dough: PINSA })).toBe(state);
  });

  it("?doughSwitch=open alone opens nothing else: the ○/□ switch stays closed", () => {
    setSearch("?doughSwitch=open");
    const state = freeCookDough();
    expect(gameReducer(state, { type: "SELECT_PAN", pan: "tray" })).toBe(state);
  });

  describe("with the chips open", () => {
    beforeEach(() => setSearch("?doughSwitch=open"));

    it("sets only pizza.dough; the standard chip removes the key again (deep-equal to never chosen)", () => {
      const start = freeCookDough();
      const other = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      expect(other.pizza.dough).toBe(PINSA);
      expect({ ...other, pizza: { ...other.pizza, dough: undefined } }.pizza.doughShape).toBe(start.pizza.doughShape);
      const back = gameReducer(other, { type: "SELECT_DOUGH", dough: "standard" });
      expect("dough" in back.pizza).toBe(false);
      expect(back).toEqual(start);
    });

    it("choosing what is already chosen, or an unknown kind, changes nothing (same state object)", () => {
      const start = freeCookDough();
      expect(gameReducer(start, { type: "SELECT_DOUGH", dough: "standard" })).toBe(start);
      expect(gameReducer(start, { type: "SELECT_DOUGH", dough: "pinsa" as never })).toBe(start);
      const other = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      expect(gameReducer(other, { type: "SELECT_DOUGH", dough: PINSA })).toBe(other);
    });

    it("the identity axis follows the choice, and nothing else about the signature moves", () => {
      const start = freeCookDough();
      const other = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      expect(signatureOfPizza(start.pizza).dimensions.dough.value).toBe("standard");
      expect(signatureOfPizza(other.pizza).dimensions.dough.value).toBe(PINSA);
      expect(signatureOfPizza(other.pizza).dimensions.pan).toEqual(signatureOfPizza(start.pizza).dimensions.pan);
    });

    it("does not touch the cooking profile, the CUT state, the doughs or the pan (PK-6)", () => {
      const start = freeCookDough();
      const other = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      expect(other.cookingProfile).toBe(start.cookingProfile);
      expect(other.cutState).toBe(start.cutState);
      expect(other.pizza.doughShape).toBe(start.pizza.doughShape);
      expect(other.pizza.pan).toBeUndefined();
      expect(other.pizza.squareDough).toBeUndefined();
    });

    it("PK-7: the pan and its profile are the same with and without a dough kind", () => {
      const start = freeCookDough();
      const other = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      expect(effectivePanShape(other.recipe, other.pizza)).toBe(effectivePanShape(start.recipe, start.pizza));
    });

    it("PK-6: with ○/□ also open, neither choice changes the other; ○→□→○ keeps the dough kind and both doughs", () => {
      setSearch("?doughSwitch=open&panSwitch=open");
      const start = freeCookDough();
      let state = gameReducer(start, { type: "SELECT_DOUGH", dough: PINSA });
      state = gameReducer(state, { type: "SELECT_PAN", pan: "tray" });
      expect(state.pizza.dough).toBe(PINSA);
      expect(state.pizza.pan).toBe("tray");
      const grid = createLumpySquareDough();
      state = gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough: grid });
      state = gameReducer(state, { type: "SELECT_PAN", pan: "round" });
      expect(state.pizza.dough).toBe(PINSA);
      expect(state.pizza.squareDough).toBe(grid);
      expect("pan" in state.pizza).toBe(false);
      state = gameReducer(state, { type: "SELECT_DOUGH", dough: "standard" });
      state = gameReducer(state, { type: "SELECT_PAN", pan: "tray" });
      expect(state.pizza.pan).toBe("tray");
      expect("dough" in state.pizza).toBe(false);
    });

    it("「次へ」 settles it: after the DOUGH step no choice is accepted, and the choice stays", () => {
      const other = gameReducer(freeCookDough(), { type: "SELECT_DOUGH", dough: PINSA });
      const next = gameReducer(other, { type: "CONFIRM_MAKING_STEP" });
      expect(next.makingStep).not.toBe("DOUGH");
      expect(gameReducer(next, { type: "SELECT_DOUGH", dough: "standard" })).toBe(next);
      expect(next.pizza.dough).toBe(PINSA);
    });

    it("RESET_PIZZA discards the choice with the pizza", () => {
      const other = gameReducer(freeCookDough(), { type: "SELECT_DOUGH", dough: PINSA });
      expect(gameReducer(other, { type: "RESET_PIZZA" }).pizza).toEqual(createEmptyPizza());
    });

    it("is a no-op in a guided round, outside PREPARE, and in Lunch Rush / Dinner rounds", () => {
      let guided = createGuidedInitialState("margherita");
      guided = gameReducer(guided, { type: "BEGIN_PREPARE" });
      expect(gameReducer(guided, { type: "SELECT_DOUGH", dough: PINSA })).toBe(guided);
      const order: GameState = { ...freeCookDough(), phase: "ORDER" };
      expect(gameReducer(order, { type: "SELECT_DOUGH", dough: PINSA })).toBe(order);
      const mission: GameState = { ...freeCookDough(), isMissionRound: true };
      expect(gameReducer(mission, { type: "SELECT_DOUGH", dough: PINSA })).toBe(mission);
    });
  });
});
