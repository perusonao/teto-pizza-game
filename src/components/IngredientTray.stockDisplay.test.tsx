import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { canUndoPlacement } from "../state/undoPlacement";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { RECIPES, type Recipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { hasPostBakeRequirement } from "../state/finishEngine";
import { createEmptyPizza } from "../state/pizzaState";

/**
 * Tray stock display (PR #716, Owner decision 2026-11-01): the tray chip's `×N` before the bake is "persisted stock - pieces already placed".
 * Driven through the REAL reducer (placements and 「1つ戻す」), rendering the real tray -- the exact iPhone HV sequence: place a mayo line, press
 * 「1つ戻す」, place again. `inventory`, the reducer and the save are untouched (asserted below).
 */
const STROKE: DoughPoint[] = [{ x: 30, y: 30 }, { x: 38, y: 36 }, { x: 46, y: 30 }, { x: 54, y: 36 }];
const strokeAt = (dy: number): GameAction => ({ type: "PLACE_TOPPING", ingredientId: "mayo", x: 42, y: 33 + dy, trail: STROKE.map((p) => ({ x: p.x, y: p.y + dy })) });
const tap = (ingredientId: string, x: number, y: number): GameAction => ({ type: "PLACE_TOPPING", ingredientId, x, y });

function toppingStep(stock: number): GameState {
  let state = startGuidedPrepare("potato-mayo-pizza", { inventory: { potato: stock, bacon: 9, corn: 9, mayo: stock } });
  for (let i = 0; i < 6 && state.makingStep !== "TOPPING"; i += 1) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  return state;
}

function margheritaToppingStep(): GameState {
  let state = startGuidedPrepare("margherita");
  for (let i = 0; i < 6 && state.makingStep !== "TOPPING"; i += 1) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  return state;
}

/** The real tray over a real reducer; the buttons stand in for the pizza stage (which dispatches the same actions). */
function Harness({ stock = 7, finish = false, initial }: { stock?: number; finish?: boolean; initial?: () => GameState }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, initial ?? (() => toppingStep(stock)));
  return (
    <div>
      <button type="button" data-testid="place-stroke" onClick={() => dispatch(strokeAt(state.pizza.toppings.length * 4))} />
      <button type="button" data-testid="place-basil" onClick={() => dispatch(tap("basil", 30 + state.pizza.toppings.length * 9, 70))} />
      <button type="button" data-testid="place-potato" onClick={() => dispatch(tap("potato", 20 + state.pizza.toppings.length * 11, 60))} />
      <button type="button" data-testid="undo" disabled={!canUndoPlacement(state)} onClick={() => dispatch({ type: "UNDO_LAST_PLACEMENT" })} />
      <span data-testid="inv-mayo">{state.inventory.mayo ?? "none"}</span>
      <span data-testid="inv-potato">{state.inventory.potato ?? "none"}</span>
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={state.ownedIngredientIds}
        recipe={state.recipe}
        inventory={state.inventory}
        pizza={state.pizza}
        finish={finish}
      />
    </div>
  );
}

const chip = (name: RegExp) => screen.getAllByRole("button").find((b) => name.test(b.textContent ?? "") && b.classList.contains("ingredient-chip"))! as HTMLButtonElement;
const stockText = (name: RegExp) => chip(name).querySelector(".ingredient-chip__stock")?.textContent ?? null;
const click = (id: string) => fireEvent.click(screen.getByTestId(id));

afterEach(() => cleanup());

describe("tray ×N before the bake = persisted stock - pieces on the pizza", () => {
  it("THE iPhone HV SEQUENCE (mayo): ×7 -> place a line ×6 -> 「1つ戻す」 ×7 -> place again ×6; the persisted inventory is 7 throughout", () => {
    render(<Harness stock={7} />);
    expect(stockText(/マヨネーズ/)).toBe("×7");
    click("place-stroke");
    expect(stockText(/マヨネーズ/)).toBe("×6");
    expect(screen.getByTestId("inv-mayo").textContent).toBe("7"); // display only: nothing was consumed or written
    click("undo");
    expect(stockText(/マヨネーズ/)).toBe("×7");
    expect(screen.getByTestId("undo")).toBeDisabled(); // nothing left to take back
    click("place-stroke");
    expect(stockText(/マヨネーズ/)).toBe("×6");
    expect(screen.getByTestId("inv-mayo").textContent).toBe("7");
  });

  it("an ordinary scatter ingredient behaves the same (potato: a tapped piece)", () => {
    render(<Harness stock={7} />);
    expect(stockText(/じゃがいも/)).toBe("×7");
    click("place-potato");
    expect(stockText(/じゃがいも/)).toBe("×6");
    click("place-potato");
    expect(stockText(/じゃがいも/)).toBe("×5");
    click("undo");
    expect(stockText(/じゃがいも/)).toBe("×6");
    expect(screen.getByTestId("inv-potato").textContent).toBe("7");
    expect(stockText(/マヨネーズ/)).toBe("×7"); // another ingredient's chip is not touched
  });

  it("stock limit: with 2 in stock, 2 pieces read ×0 AND the chip is disabled (display and gate agree); 「1つ戻す」 gives it back and re-enables the chip", () => {
    render(<Harness stock={2} />);
    click("place-stroke");
    expect(stockText(/マヨネーズ/)).toBe("×1");
    expect(chip(/マヨネーズ/)).not.toBeDisabled();
    click("place-stroke");
    expect(stockText(/マヨネーズ/)).toBe("×0");
    expect(chip(/マヨネーズ/)).toBeDisabled();
    click("place-stroke"); // the reducer's gate refuses a third; the display stays at 0, never negative
    expect(stockText(/マヨネーズ/)).toBe("×0");
    click("undo");
    expect(stockText(/マヨネーズ/)).toBe("×1");
    expect(chip(/マヨネーズ/)).not.toBeDisabled();
  });

  it("an unlimited (Starter) ingredient is unchanged: basil keeps its marker as pieces are placed and taken back", () => {
    render(<Harness initial={margheritaToppingStep} />);
    const marker = () => chip(/バジル/).querySelector(".ingredient-chip__stock")?.textContent ?? null;
    const before = marker();
    expect(before === "∞" || before === "常備" || before === null).toBe(true);
    expect(before ?? "").not.toMatch(/×/);
    click("place-basil");
    click("place-basil");
    expect(marker()).toBe(before);
    expect(chip(/バジル/)).not.toBeDisabled();
    click("undo");
    expect(marker()).toBe(before);
  });
});

describe("continuity with the bake, and FINISH is untouched", () => {
  it("what the chip read before the bake is what the persisted stock is after it (and 「1つ戻す」 / re-place did not double-consume)", () => {
    let state = toppingStep(7);
    // place, take back, place again, then the recipe's 2 mayo (+ the other required toppings)
    for (const action of [strokeAt(0), { type: "UNDO_LAST_PLACEMENT" } as const, strokeAt(0), strokeAt(30), tap("potato", 20, 60), tap("potato", 70, 60), tap("bacon", 30, 70), tap("corn", 75, 30)]) state = gameReducer(state, action);
    const view = render(<Harness initial={() => state} />);
    expect(stockText(/マヨネーズ/)).toBe("×5"); // 7 - 2 pieces
    expect(stockText(/じゃがいも/)).toBe("×5");
    view.unmount();
    state = gameReducer(gameReducer(state, { type: "START_BAKE" }), { type: "CONFIRM_BAKE", value: 68 });
    expect(state.inventory.mayo).toBe(5); // the bake consumed exactly the 2 pieces on the pizza
    expect(state.inventory.potato).toBe(5);
  });

  it("FINISH keeps its own 「あと a/b」: only the pieces placed in FINISH count (pre-bake pieces of the same ingredient are not charged, and the new ×N is not used)", () => {
    const late = RECIPES.find((r) => hasPostBakeRequirement(r));
    expect(late, "a late (POST_BAKE) recipe exists in this build").toBeDefined();
    const requirements: readonly { ingredientId: string; applicationPhase?: "POST_BAKE" }[] = late!.requiredIngredients;
    const lateId = requirements.find((q) => q.applicationPhase === "POST_BAKE")!.ingredientId;
    const piece = (id: string, stage?: "pre" | "post") => ({ id, ingredientId: lateId, x: 20 + id.length * 3, y: 50, ...(stage ? { stage } : {}) });
    const pizza = { ...createEmptyPizza(), toppings: [piece("a", "pre"), piece("bb", "pre"), piece("ccc", "post")] };
    render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={[...STARTER_INGREDIENT_IDS, lateId]}
        recipe={late as Recipe}
        inventory={{ [lateId]: 3 }}
        pizza={pizza}
        finish
      />,
    );
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと2/3"); // 3 owned - 1 FINISH piece; the 2 pre-bake pieces are not charged again
  });
});
