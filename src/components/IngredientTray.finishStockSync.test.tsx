import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import type { CookingProfile } from "../data/cookingProfiles";
import { DOUGH_CENTER } from "../logic/pizzaCoordinates";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { createInitialGameState } from "../state/gameReducer";
import { EMPTY_DEX } from "../state/dex";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { createEmptyPizza } from "../state/pizzaState";
import { FINISH_FIXTURE_RECIPE as FX, preBakePizza } from "../state/testSupport/finishFixture";

/**
 * Issue #890: in the FINISH step the tray's 「あと a/b」 must follow a placement immediately (display only; the persisted stock is untouched).
 * Driven through the REAL reducer + the real tray, like IngredientTray.stockDisplay.test.tsx.
 */
const PROFILE: CookingProfile = { steps: ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"] };

function toFinish(stock: number): GameState {
  let state: GameState = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE", now: 0 });
  state = {
    ...state,
    recipe: FX,
    cookingProfile: PROFILE,
    pizza: preBakePizza(),
    inventory: { ...state.inventory, chicken: 9, mozzarella: 9, "tomato-sauce": 9, parsley: stock },
    ownedIngredientIds: [...new Set([...state.ownedIngredientIds, "parsley", "chicken"])],
  };
  for (const now of [5_000, 9_000, 12_000]) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP", now });
  state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 });
  expect(state.makingStep).toBe("FINISH");
  return state;
}

/** The discovery (Free Cooking) round: ham on the pizza before the bake, then more ham in FINISH (the tray offers every owned scatter topping). */
function toFreeFinish(stock: number): GameState {
  let state = createInitialGameState(EMPTY_DEX, ["tomato-sauce", ...STARTER_INGREDIENT_IDS, "ham"], 0, { ham: stock });
  state = gameReducer(gameReducer(state, { type: "START_FREE_COOK", now: 0 }), { type: "BEGIN_PREPARE", now: 0 });
  state = { ...state, pizza: { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], toppings: [{ id: "h0", ingredientId: "ham", x: 40, y: 40 }] } };
  state = gameReducer(state, { type: "START_BAKE", now: 20_000 });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70, now: 25_000 });
  return state;
}

function Harness({ stock, free = false, ing = "parsley" }: { stock: number; free?: boolean; ing?: string }) {
  const [state, dispatch] = useReducer(gameReducer, stock, free ? toFreeFinish : toFinish);
  const placed = state.pizza.toppings.filter((t) => t.stage === "post").length;
  return (
    <div>
      <button type="button" data-testid="place" onClick={() => dispatch({ type: "PLACE_TOPPING", ingredientId: ing, x: DOUGH_CENTER - 30 + placed * 18, y: DOUGH_CENTER - 10 + (placed % 2) * 30 })} />
      <button type="button" data-testid="undo" onClick={() => dispatch({ type: "UNDO_LAST_PLACEMENT" })} />
      <span data-testid="inv-stock">{state.inventory[ing]}</span>
      <span data-testid="step">{`${state.phase}/${state.makingStep}`}</span>
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={state.ownedIngredientIds}
        recipe={state.recipe}
        inventory={state.inventory}
        pizza={state.pizza}
        finish
      />
    </div>
  );
}

afterEach(() => cleanup());

describe("FINISH tray stock follows a placement immediately (Issue #890)", () => {
  it("あと a/b drops right after each placement, returns on undo, and the persisted stock is never touched", () => {
    render(<Harness stock={3} />);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと3/3");
    fireEvent.click(screen.getByTestId("place"));
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと2/3");
    fireEvent.click(screen.getByTestId("place"));
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと1/3");
    expect(screen.getByTestId("inv-stock").textContent).toBe("3");
    fireEvent.click(screen.getByTestId("undo"));
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと2/3");
  });
});

describe("discovery (Free Cooking) FINISH tray follows a placement immediately (Issue #890)", () => {
  it("ham placed in FINISH: あと a/b drops on every placement while the persisted stock stays at its post-bake value", () => {
    render(<Harness stock={19} free ing="ham" />);
    expect(screen.getByTestId("finish-stock")).toHaveTextContent("あと18/18"); // 19 owned - 1 pre-bake piece consumed at CONFIRM_BAKE
    for (const left of [17, 16, 15]) {
      fireEvent.click(screen.getByTestId("place"));
      expect(screen.getByTestId("finish-stock")).toHaveTextContent(`あと${left}/18`);
    }
    expect(screen.getByTestId("inv-stock").textContent).toBe("18");
  });
});
