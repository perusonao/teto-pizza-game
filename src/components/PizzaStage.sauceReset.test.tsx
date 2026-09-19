import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getIngredient, INGREDIENTS } from "../data/ingredients";
import { ORDERS } from "../data/orders";
import { getRecipe, type RecipeId } from "../data/recipes";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { createEmptyPizza, type SauceDeposit } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";

const DOUGH_RECT = {
  left: 0,
  top: 0,
  width: 300,
  height: 300,
  right: 300,
  bottom: 300,
} as DOMRect;

// EP4: several recipes' own ingredients (pesto/olive-oil among them) are no longer trivially
// Starter-owned or unconditionally in stock -- this suite is about sauce reset/gesture-
// invalidation mechanics, not ownership/Stock Gate gating, so it owns every ingredient outright
// and seeds each finite one with generous stock rather than tracking each recipe's own subset.
const ALL_INGREDIENT_IDS = INGREDIENTS.map((i) => i.id);
const GENEROUS_INVENTORY = Object.fromEntries(
  INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 999]),
);

function preparedRecipeState(recipeId: RecipeId, isMissionRound: boolean): GameState {
  const base = createInitialGameState(undefined, ALL_INGREDIENT_IDS, 0, GENEROUS_INVENTORY);
  const recipe = getRecipe(recipeId);
  const order = ORDERS.find((candidate) => candidate.recipeId === recipeId);
  if (!recipe || !order) throw new Error(`Missing fixture for ${recipeId}`);
  return {
    ...base,
    phase: "PREPARE",
    recipe,
    order,
    pizza: createEmptyPizza(),
    // Issue #33 D1: createInitialGameState now starts at "DOUGH" -- this fixture is
    // specifically for the SAUCE gesture-reset contract, so force it to SAUCE explicitly.
    makingStep: "SAUCE",
    isMissionRound,
  };
}

function Harness({
  recipeId,
  isMissionRound = false,
  onCommitAttempt,
}: {
  recipeId: RecipeId;
  isMissionRound?: boolean;
  onCommitAttempt?: () => void;
}) {
  const [state, dispatch] = useReducer(
    gameReducer,
    undefined,
    () => preparedRecipeState(recipeId, isMissionRound),
  );
  const [resetToken, setResetToken] = useState(0);
  const profile = getRecipeSauceProfile(recipeId);
  const ingredient = getIngredient(profile.ingredientId);
  if (!ingredient) throw new Error(`Missing ingredient fixture for ${profile.ingredientId}`);

  function handleReset() {
    // Mirrors GameScreen's canonical reset wiring: the same generation invalidates local
    // interactions while RESET_PIZZA clears reducer state.
    setResetToken((token) => token + 1);
    dispatch({ type: "RESET_PIZZA" });
  }

  function handleCommit(ingredientId: string, deposits: SauceDeposit[]) {
    onCommitAttempt?.();
    dispatch({ type: "COMMIT_SAUCE_DISPENSE", ingredientId, deposits });
  }

  return (
    <div>
      <button type="button" onClick={handleReset}>
        やり直す
      </button>
      {/* Issue #33 D1: RESET_PIZZA now returns to DOUGH (the new first step), not SAUCE --
          this dedicated button lets a test explicitly re-confirm DOUGH -> SAUCE after a reset
          (mirroring the real DOUGH step being confirmed by the player), for the specific tests
          below that exercise "a fresh gesture after reset paints normally" rather than the
          stale-gesture-discard contract. */}
      <button
        type="button"
        onClick={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
      >
        次へ
      </button>
      <span data-testid="sauce-id-count">{state.pizza.sauceIds.length}</span>
      <span data-testid="deposit-count">{state.pizza.sauceDeposits.length}</span>
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={ingredient}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={recipeId === "margherita" && !isMissionRound}
        resetToken={resetToken}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={handleCommit}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
      />
    </div>
  );
}

function dough(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!element) throw new Error("Pizza dough missing");
  element.getBoundingClientRect = () => DOUGH_RECT;
  return element;
}

function pointerDown(element: HTMLElement, pointerId = 1) {
  fireEvent.pointerDown(element, {
    pointerId,
    isPrimary: true,
    pointerType: "touch",
    clientX: 120,
    clientY: 120,
  });
}

function pointerMove(element: HTMLElement, pointerId = 1) {
  fireEvent.pointerMove(element, {
    pointerId,
    isPrimary: true,
    pointerType: "touch",
    clientX: 180,
    clientY: 180,
  });
}

function pointerUp(element: HTMLElement, pointerId = 1) {
  fireEvent.pointerUp(element, {
    pointerId,
    isPrimary: true,
    pointerType: "touch",
    clientX: 180,
    clientY: 180,
  });
}

function reset() {
  fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
}

/** Issue #33 D1: RESET_PIZZA returns to DOUGH -- advances DOUGH -> SAUCE via the harness's
 *  own dedicated button so a test can reach "a fresh gesture after reset" the same way a
 *  real player would (confirming DOUGH again first). */
function confirmToSauce() {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
}

function expectSauceEmpty() {
  expect(screen.getByTestId("sauce-id-count")).toHaveTextContent("0");
  expect(screen.getByTestId("deposit-count")).toHaveTextContent("0");
}

function expectSaucePainted() {
  expect(screen.getByTestId("sauce-id-count")).toHaveTextContent("1");
  expect(Number(screen.getByTestId("deposit-count").textContent)).toBeGreaterThan(0);
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(() => {
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PizzaStage Sauce reset invalidation", () => {
  it("tomato: pointerdown -> RESET -> pointerup cannot restore Sauce", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness recipeId="margherita" onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element);
    reset();
    pointerUp(element);

    expectSauceEmpty();
    expect(onCommitAttempt).not.toHaveBeenCalled();
  });

  it("pesto: pointerdown/move -> RESET -> pointerup cannot restore Sauce", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness recipeId="genovese" onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element);
    pointerMove(element);
    reset();
    pointerUp(element);

    expectSauceEmpty();
    expect(onCommitAttempt).not.toHaveBeenCalled();
  });

  it("olive-oil PAINT_TEMPORARY: a new post-reset gesture paints normally", () => {
    render(<Harness recipeId="quattro-formaggi" />);
    const element = dough();

    pointerDown(element, 1);
    reset();
    pointerUp(element, 1);
    expectSauceEmpty();

    confirmToSauce();
    pointerDown(element, 2);
    pointerMove(element, 2);
    pointerUp(element, 2);
    expectSaucePainted();
  });

  it("Lunch Rush uses the same reset invalidation and permits a fresh pesto gesture", () => {
    render(<Harness recipeId="genovese" isMissionRound />);
    const element = dough();

    pointerDown(element, 1);
    pointerMove(element, 1);
    reset();
    pointerUp(element, 1);
    expectSauceEmpty();

    confirmToSauce();
    pointerDown(element, 2);
    pointerUp(element, 2);
    expectSaucePainted();
  });

  it("RESET -> pointercancel -> stale pointerup remains empty without a commit", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness recipeId="genovese" onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element);
    reset();
    fireEvent.pointerCancel(element, { pointerId: 1 });
    pointerUp(element);

    expectSauceEmpty();
    expect(onCommitAttempt).not.toHaveBeenCalled();
  });

  it("RESET -> lostpointercapture -> stale pointerup remains empty without a commit", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness recipeId="quattro-formaggi" onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element);
    reset();
    fireEvent.lostPointerCapture(element, { pointerId: 1 });
    pointerUp(element);

    expectSauceEmpty();
    expect(onCommitAttempt).not.toHaveBeenCalled();
  });

  it("RESET -> blur/visibilitychange -> stale pointerup remains empty without a commit", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness recipeId="margherita" onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element);
    reset();
    fireEvent(window, new Event("blur"));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    pointerUp(element);

    expectSauceEmpty();
    expect(onCommitAttempt).not.toHaveBeenCalled();
  });
});
