import { describe, expect, it } from "vitest";
import { createInitialGameState, gameReducer } from "./gameReducer";

describe("Phase 4A-1B PLACE_TOPPING phase boundary", () => {
  it("rejects a late drag commit while still in ORDER", () => {
    const order = createInitialGameState();
    expect(gameReducer(order, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 50,
      y: 50,
    })).toBe(order);
  });

  it("accepts an owned piece during PREPARE and rejects the same action after BAKE starts", () => {
    let state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    state = gameReducer(state, {
      type: "PLACE_TOPPING",
      ingredientId: "mozzarella",
      x: 50,
      y: 50,
    });
    expect(state.pizza.toppings).toHaveLength(1);
    const baking = gameReducer(state, { type: "START_BAKE" });
    expect(gameReducer(baking, {
      type: "PLACE_TOPPING",
      ingredientId: "basil",
      x: 30,
      y: 30,
    })).toBe(baking);
  });

  it("rejects malformed or outside drop coordinates", () => {
    const state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    for (const point of [
      { x: Number.NaN, y: 50 },
      { x: 50, y: Number.POSITIVE_INFINITY },
      { x: 99, y: 99 },
    ]) {
      expect(gameReducer(state, {
        type: "PLACE_TOPPING",
        ingredientId: "mozzarella",
        ...point,
      })).toBe(state);
    }
  });
});
