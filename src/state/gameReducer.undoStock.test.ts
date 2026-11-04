import { describe, expect, it } from "vitest";
import { gameReducer, type GameAction, type GameState } from "./gameReducer";
import { startGuidedPrepare } from "./testSupport/guidedRound";
import { canPlaceIngredient } from "./inventory";
import { canUndoPlacement } from "./undoPlacement";
import { getIngredient } from "../data/ingredients";

/**
 * PR #716 (Owner decision 2026-11-01, tray stock display): the tray now READS "stock - pieces placed" (../logic/trayStockDisplay.ts), but the
 * stock CONTRACT is unchanged and pinned here: placement is a reservation (`inventory` is not touched by PLACE_TOPPING or UNDO_LAST_PLACEMENT),
 * the reservation gate frees / takes a unit on Undo / re-place, `CONFIRM_BAKE` is the sole consumption and takes exactly the pieces on the pizza
 * (place -> Undo -> re-place neither leaks nor double-consumes), and Lunch Rush has no Undo. Mayo (a squeezed stroke) and an ordinary scatter
 * ingredient (potato) must behave identically.
 */
const act = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);
const STROKE = [{ x: 30, y: 30 }, { x: 38, y: 36 }, { x: 46, y: 30 }, { x: 54, y: 36 }];
function toppingStep(stock: number): GameState {
  let state = startGuidedPrepare("potato-mayo-pizza", { inventory: { potato: stock, bacon: 9, corn: 9, mayo: stock } });
  for (let i = 0; i < 6 && state.makingStep !== "TOPPING"; i += 1) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  expect(state.makingStep).toBe("TOPPING");
  return state;
}
const stroke = (x: number, y: number): GameAction => ({ type: "PLACE_TOPPING", ingredientId: "mayo", x, y, trail: STROKE.map((p) => ({ x: p.x + (x - 42), y: p.y + (y - 33) })) });
const tap = (id: string, x: number, y: number): GameAction => ({ type: "PLACE_TOPPING", ingredientId: id, x, y });
const count = (state: GameState, id: string) => state.pizza.toppings.filter((t) => t.ingredientId === id).length;

describe.each([
  { id: "mayo", place: stroke },
  { id: "potato", place: (x: number, y: number) => tap("potato", x, y) },
])("stock contract: $id place -> Undo -> re-place", ({ id, place }) => {
  it("PLACE_TOPPING and UNDO_LAST_PLACEMENT never touch the persisted inventory", () => {
    let state = toppingStep(7);
    const inventory = state.inventory;
    state = act(state, place(30, 30));
    expect(count(state, id)).toBe(1);
    expect(state.inventory).toBe(inventory); // the same object: nothing was written
    state = act(state, { type: "UNDO_LAST_PLACEMENT" });
    expect(count(state, id)).toBe(0);
    expect(state.inventory).toBe(inventory);
    expect(canUndoPlacement(state)).toBe(false);
    state = act(state, place(30, 30));
    expect(state.inventory).toBe(inventory);
  });

  it("the reservation gate frees a unit on Undo and takes it again on re-place (stock 2: third refused -> Undo -> allowed)", () => {
    let state = toppingStep(2);
    const ingredient = getIngredient(id)!;
    state = act(state, place(25, 25), place(70, 70));
    expect(canPlaceIngredient(ingredient, state.inventory, state.pizza)).toBe(false);
    const refused = act(state, place(25, 70));
    expect(count(refused, id)).toBe(2);
    expect(refused.placement?.status).toBe("rejected");
    state = act(state, { type: "UNDO_LAST_PLACEMENT" });
    expect(canPlaceIngredient(ingredient, state.inventory, state.pizza)).toBe(true);
    state = act(state, place(25, 70));
    expect(count(state, id)).toBe(2);
    expect(state.placement?.status).not.toBe("rejected");
  });

  it("CONFIRM_BAKE consumes exactly the pieces on the pizza: place, Undo, re-place does not leak or double-consume", () => {
    let state = toppingStep(7);
    state = act(state, place(30, 30), { type: "UNDO_LAST_PLACEMENT" }, place(30, 30), place(70, 70));
    expect(count(state, id)).toBe(2);
    const before = state.inventory[id]!;
    expect(before).toBe(7); // still the persisted stock until the bake
    state = act(state, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 });
    expect(before - state.inventory[id]!).toBe(2);
  });
});

describe("Lunch Rush", () => {
  it("has no 「1つ戻す」 (Owner UD-A) even with a piece placed, so the tray display can never need to follow an Undo there; the other round kinds can undo", () => {
    const state = act(toppingStep(7), tap("potato", 30, 30));
    for (const [kind, expected] of [["GUIDED", true], ["FREE_COOK", true], ["DINNER", true], ["LUNCH_RUSH", false]] as const) {
      expect(canUndoPlacement({ ...state, roundKind: kind }), kind).toBe(expected);
    }
  });
});
