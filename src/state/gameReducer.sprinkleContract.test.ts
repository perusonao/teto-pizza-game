import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer, type GameState } from "./gameReducer";
import { EMPTY_DEX } from "./dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_INVENTORY } from "./inventory";

/**
 * Issue #825 (parmigiano SPRINKLE Pilot) -- the DATA contract the sprinkle must not change. The sprinkle is only how ONE placed piece is drawn
 * (src/components/placedVisuals): a tap still adds exactly one topping record with the same four fields, spends exactly one unit of stock, and one Undo
 * takes exactly that piece back. These pin that against the real reducer, so a later change that made one tap place several pieces (a rule change that needs
 * its own Owner decision: counts, stock, scoring and Undo would all change) cannot slip in through the drawing.
 */
function toCheeseStep(stock: number): GameState {
  let state = createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "parmigiano"], 0, { ...EMPTY_INVENTORY, parmigiano: stock });
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, { type: "APPLY_SAUCE", ingredientId: "tomato-sauce", x: 50, y: 50 });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  return state;
}

const parmigiano = (state: GameState) => state.pizza.toppings.filter((t) => t.ingredientId === "parmigiano");

describe("parmigiano sprinkle is visual only (the placement contract is unchanged)", () => {
  it("one tap adds exactly one topping record, with only the usual fields and the tapped position", () => {
    let state = toCheeseStep(3);
    expect(state.makingStep).toBe("CHEESE");
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 30 });
    expect(state.pizza.toppings).toHaveLength(1);
    const [piece] = state.pizza.toppings;
    expect(Object.keys(piece).sort()).toEqual(["id", "ingredientId", "x", "y"]);
    expect(piece).toMatchObject({ ingredientId: "parmigiano", x: 50, y: 30 });
    expect(state.placement?.status).toBe("placed");
  });

  it("each tap spends exactly one unit of stock: with 2 in stock the third tap is rejected", () => {
    let state = toCheeseStep(2);
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 68 });
    expect(parmigiano(state)).toHaveLength(2);
    const third = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 30, y: 50 });
    expect(parmigiano(third)).toHaveLength(2);
    expect(third.placement?.status).toBe("rejected");
  });

  it("the minimum spacing between pieces is unchanged (a tap on top of another piece is nudged, never multiplied)", () => {
    let state = toCheeseStep(3);
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 50 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 51, y: 50 });
    expect(parmigiano(state)).toHaveLength(2);
    const [a, b] = parmigiano(state);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(9 - 1e-9);
    expect(state.placement?.status).toBe("adjusted");
  });

  it("one Undo takes back exactly the last piece, and the stock is untouched until the bake", () => {
    let state = toCheeseStep(3);
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 30 });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "parmigiano", x: 50, y: 68 });
    const stockBefore = state.inventory.parmigiano;
    const undone = gameReducer(state, { type: "UNDO_LAST_PLACEMENT" });
    expect(parmigiano(undone)).toHaveLength(1);
    expect(undone.pizza.toppings[0]).toEqual(state.pizza.toppings[0]);
    expect(undone.inventory.parmigiano).toBe(stockBefore);
  });
});
