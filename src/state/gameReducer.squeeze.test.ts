import { describe, expect, it } from "vitest";
import { gameReducer, type GameState } from "./gameReducer";
import { createGuidedInitialState } from "./testSupport/guidedRound";
import { SQUEEZE_MAX_LENGTH, trailLength } from "../logic/squeeze";

/**
 * Expansion Batch 13 (#708, Owner 案A): PLACE_TOPPING of a squeezable topping (mayo) carries its stroke. The reducer is the boundary: one stroke = ONE piece
 * (anchored at the stroke's midpoint, the only thing scoring reads), capped at 60% of the dough's diameter, kept only for mayo in a pre-bake step.
 */
function toppingState(): GameState {
  let state = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
  for (let i = 0; i < 3; i += 1) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  expect(state.makingStep).toBe("TOPPING");
  return { ...state, ownedIngredientIds: [...state.ownedIngredientIds, "mayo", "mozzarella"], inventory: { ...state.inventory, mayo: 30 } };
}
const stroke = (from: number, to: number, y = 50) => Array.from({ length: 12 }, (_, i) => ({ x: from + ((to - from) * i) / 11, y }));

describe("PLACE_TOPPING with a stroke (mayo)", () => {
  it("a stroke is ONE piece anchored at its midpoint, and keeps the stroke", () => {
    const state = gameReducer(toppingState(), { type: "PLACE_TOPPING", ingredientId: "mayo", x: 1, y: 1, trail: stroke(30, 70) });
    expect(state.pizza.toppings).toHaveLength(1);
    const piece = state.pizza.toppings[0];
    expect(piece.ingredientId).toBe("mayo");
    expect(piece.x).toBeCloseTo(50, 1);
    expect(piece.y).toBeCloseTo(50, 1);
    expect(piece.trail!.length).toBeGreaterThanOrEqual(2);
    expect(trailLength(piece.trail!)).toBeCloseTo(40, 0);
  });

  it("a long stroke is capped at 60% of the dough's diameter, still ONE piece", () => {
    const state = gameReducer(toppingState(), { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: stroke(6, 94) }); // 88 long
    expect(state.pizza.toppings).toHaveLength(1);
    expect(trailLength(state.pizza.toppings[0].trail!)).toBeLessThanOrEqual(SQUEEZE_MAX_LENGTH + 1e-6);
  });

  it("two strokes are two pieces (the recipe's mayo 2); a taken midpoint slides the second piece along ITS OWN line, which stays exactly as drawn", () => {
    let state = gameReducer(toppingState(), { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: stroke(30, 70) });
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: stroke(30, 70) });
    expect(state.pizza.toppings.filter((t) => t.ingredientId === "mayo")).toHaveLength(2);
    const [a, b] = state.pizza.toppings;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(9); // MIN_TOPPING_DISTANCE
    expect(b.y).toBeCloseTo(50, 6); // still on the drawn line
    expect(b.x).toBeGreaterThanOrEqual(30);
    expect(b.x).toBeLessThanOrEqual(70);
    expect(b.trail![0].x).toBeCloseTo(a.trail![0].x, 6); // the line did not move with the piece
    expect(state.placement?.status).toBe("placed");
  });

  it("with no free point on the line the stroke is nudged with its piece (the earlier behaviour)", () => {
    let state = toppingState();
    for (const x of [26, 38, 50, 62, 74]) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x, y: 50 });
    const before = state.pizza.toppings.length;
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: stroke(26, 74) });
    const piece = state.pizza.toppings[before];
    expect(state.pizza.toppings).toHaveLength(before + 1);
    expect(Math.hypot(piece.x - 50, piece.y - 50)).toBeGreaterThan(0);
    expect(piece.trail![0].x - 26).toBeCloseTo(piece.x - 50, 1);
  });

  it("a tap-sized or malformed trail is the ordinary single drop (no trail stored)", () => {
    for (const trail of [undefined, [], [{ x: 50, y: 50 }], [{ x: 50, y: 50 }, { x: 51, y: 50 }], [{ x: NaN, y: 1 }, { x: 5, y: 5 }]]) {
      const state = gameReducer(toppingState(), { type: "PLACE_TOPPING", ingredientId: "mayo", x: 50, y: 50, trail: trail as never });
      expect(state.pizza.toppings).toHaveLength(1);
      expect(state.pizza.toppings[0].trail).toBeUndefined();
      expect(state.pizza.toppings[0]).toMatchObject({ x: 50, y: 50 });
    }
  });

  it("any other ingredient ignores a trail", () => {
    const placed = gameReducer(toppingState(), { type: "PLACE_TOPPING", ingredientId: "basil", x: 50, y: 50, trail: stroke(30, 70) });
    expect(placed.pizza.toppings.every((t) => t.trail === undefined)).toBe(true);
  });

  it("a stroke whose midpoint is off the dough is refused (same state)", () => {
    const state = toppingState();
    const off = Array.from({ length: 10 }, (_, i) => ({ x: 200 + i, y: 200 }));
    const next = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mayo", x: 200, y: 200, trail: off });
    expect(next.pizza.toppings).toHaveLength(0);
  });
});
