import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLumpySquareDough } from "../logic/pan/squareDoughFixtures";
import { createInitialSquareDough, SQUARE_DOUGH_GRID, type SquareDough } from "../logic/pan/squareDough";
import { resetPreviewPanShapeForTest } from "../preview/panShapePreview";
import { createEmptyPizza } from "./pizzaState";
import { gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";

/**
 * #535 B1: COMMIT_SQUARE_DOUGH through the real reducer. A no-op everywhere except the DOUGH step of a square-pan round with a valid
 * grid; and a round pizza never gets a `squareDough` key at all.
 */
const MARGHERITA_ONLY_OWNED = ["tomato-sauce", "mozzarella", "basil"];

function dough(): GameState {
  let state = createGuidedInitialState("margherita", { ownedIngredientIds: MARGHERITA_ONLY_OWNED });
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  expect(state.phase).toBe("PREPARE");
  expect(state.makingStep).toBe("DOUGH");
  return state;
}

/** The same round, but its recipe uses the square pan (what #521 E will make true for grandma-pizza). */
function squareDough(): GameState {
  const state = dough();
  return { ...state, recipe: { ...state.recipe, panShape: "square" } };
}

function setSearch(search: string): void {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewPanShapeForTest();
}
beforeEach(() => setSearch(""));
afterEach(() => setSearch(""));

describe("COMMIT_SQUARE_DOUGH", () => {
  it("replaces pizza.squareDough in a square-pan round's DOUGH step, and touches nothing else", () => {
    const before = squareDough();
    const grid = createLumpySquareDough();
    const after = gameReducer(before, { type: "COMMIT_SQUARE_DOUGH", dough: grid });
    expect(after.pizza.squareDough).toBe(grid);
    expect({ ...after, pizza: { ...after.pizza, squareDough: undefined } }).toEqual({ ...before, pizza: { ...before.pizza, squareDough: undefined } });
  });

  it("a later commit replaces the earlier one (the whole grid each time)", () => {
    let state = squareDough();
    state = gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough: createLumpySquareDough() });
    const second = createInitialSquareDough();
    state = gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough: second });
    expect(state.pizza.squareDough).toBe(second);
  });

  it("works under the Preview / DEV switch too (?pan=square makes the margherita round square)", () => {
    setSearch("?pan=square");
    const grid = createLumpySquareDough();
    const after = gameReducer(dough(), { type: "COMMIT_SQUARE_DOUGH", dough: grid });
    expect(after.pizza.squareDough).toBe(grid);
  });

  it("is a no-op in a round pan's round -- a round pizza never gets a squareDough", () => {
    const state = dough();
    const after = gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough: createLumpySquareDough() });
    expect(after).toBe(state);
    expect("squareDough" in after.pizza).toBe(false);
  });

  it("is a no-op outside PREPARE / DOUGH", () => {
    const state = squareDough();
    const grid = createLumpySquareDough();
    const atSauce = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
    expect(atSauce.makingStep).not.toBe("DOUGH");
    expect(gameReducer(atSauce, { type: "COMMIT_SQUARE_DOUGH", dough: grid })).toBe(atSauce);
    expect(gameReducer({ ...state, phase: "BAKE" }, { type: "COMMIT_SQUARE_DOUGH", dough: grid }).pizza.squareDough).toBeUndefined();
    expect(gameReducer({ ...state, phase: "RESULT" }, { type: "COMMIT_SQUARE_DOUGH", dough: grid }).pizza.squareDough).toBeUndefined();
  });

  it("rejects an invalid grid in full, leaving the state as it was", () => {
    const state = squareDough();
    const bad: SquareDough[] = [
      { thickness: [] },
      { thickness: new Array(SQUARE_DOUGH_GRID * SQUARE_DOUGH_GRID).fill(NaN) },
      { thickness: createLumpySquareDough().thickness.map((t, i) => (i === 100 ? 2 : t)) },
      { thickness: createLumpySquareDough().thickness.map((t, i) => (i === 0 ? 0.5 : t)) }, // dough off the pan
    ];
    for (const dough of bad) expect(gameReducer(state, { type: "COMMIT_SQUARE_DOUGH", dough })).toBe(state);
  });

  it("leaves the round pizza's own state alone: createEmptyPizza() has no squareDough key, and COMMIT_DOUGH_STRETCH is unaffected", () => {
    expect("squareDough" in createEmptyPizza()).toBe(false);
    const state = squareDough();
    const stretched = gameReducer(state, { type: "COMMIT_DOUGH_STRETCH", shape: state.pizza.doughShape });
    expect(stretched.pizza.doughShape).toEqual(state.pizza.doughShape);
    expect("squareDough" in stretched.pizza).toBe(false);
  });
});
