import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer } from "../state/gameReducer";
import { isHintSheetVisible } from "../state/discoveryHint";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B): the Free Cooking hint sheet inside the real GameScreen
 * and reducer, with `isGlobalOverlayOpen` computed the way App.tsx computes it (the sheet joins
 * the existing overlay gate -- no second lock). Dex 0, so the round is Free Cooking; the harness
 * starts at CHEESE with mozzarella selected.
 */
function Harness() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    let initial = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    while (initial.makingStep !== "CHEESE") initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    return initial;
  });
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>("cheese");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>("mozzarella");

  function resolvePhysicalDrop(clientX: number, clientY: number): DoughPoint | null {
    return resolvePieceDrop(clientX, clientY, { left: 0, top: 0, width: 300, height: 300 } as DOMRect);
  }
  function handlePhysicalDrop(ingredient: Ingredient, point: DoughPoint) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }
  function handleTapPizza(x: number, y: number) {
    const ingredient = selectedIngredientId ? getIngredient(selectedIngredientId) : undefined;
    if (!ingredient) return;
    if (ingredient.placement === "spread") dispatch({ type: "APPLY_SAUCE", ingredientId: ingredient.id, x, y });
    else dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
  }

  return (
    <div>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <span data-testid="free-cook">{String(state.freeCook)}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={activeCategory}
        selectedIngredientId={selectedIngredientId}
        bakeProgress={null}
        referenceModeEnabled={false}
        referencePizza={null}
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={isHintSheetVisible(state)}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        showDoughShape
        doughShapeComplete={false}
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => dispatch({ type: "SHOW_HINT" })}
        onUnlockHint={(level) => dispatch({ type: "PURCHASE_DISCOVERY_HINT", level })}
        onCloseHint={() => dispatch({ type: "CLOSE_HINT" })}
        onChangeCategory={setActiveCategory}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        onTapPizza={handleTapPizza}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRetrySameRecipe={() => {}}
        onBackToPizzaSelect={() => {}}
        onMissionServeNext={() => {}}
        onMissionStart={() => {}}
        onMissionExitToFree={() => {}}
        onMissionCloseIntro={() => {}}
        onShowRanking={() => {}}
        onReferencePopoverChange={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        onAddCutLine={() => {}}
        onUndoCutLine={() => {}}
        cutRejectionMessage={null}
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={handlePhysicalDrop}
      />
    </div>
  );
}

const toppingCount = () => Number(screen.getByTestId("topping-count").textContent);
const hintButton = () => document.querySelector(".prepare-bake-bar")!.querySelector("button[aria-haspopup='dialog']") as HTMLElement;
function getDough(): HTMLElement {
  const dough = document.querySelector('[data-pizza-drop-target="true"]') as HTMLElement | null;
  if (!dough) throw new Error("PizzaStage dough element not found");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  return dough;
}
function tapDough() {
  const dough = getDough();
  fireEvent.pointerDown(dough, { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 });
  fireEvent.pointerUp(dough, { pointerId: 1, clientX: 150, clientY: 150 });
}

afterEach(() => cleanup());

describe("Free Cooking hint sheet in GameScreen (229-B)", () => {
  it("the 「ヒント」 button opens the sheet; next reveals one more step (Dex 0: free)", () => {
    render(<Harness />);
    expect(screen.getByTestId("free-cook")).toHaveTextContent("true");
    expect(hintButton()).toHaveTextContent("ヒント");
    fireEvent.click(hintButton());
    const dialog = screen.getByRole("dialog", { name: /ヒント/ });
    expect(dialog.querySelectorAll(".hint-sheet__step")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "次のヒントを見る" }));
    expect(dialog.querySelectorAll(".hint-sheet__step")).toHaveLength(2);
  });

  it("while open, keyboard placement on the dough is blocked", () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    fireEvent.keyDown(getDough(), { key: "Enter" });
    fireEvent.keyDown(getDough(), { key: " " });
    expect(toppingCount()).toBe(0);
  });

  it("while open, a pointer tap on the dough places nothing", () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    tapDough();
    expect(toppingCount()).toBe(0);
  });

  it("closing restores cooking input and returns focus to 「ヒント」", () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hintButton()).toHaveFocus();
    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(toppingCount()).toBe(1);
    tapDough();
    expect(toppingCount()).toBe(2);
  });

  it("Escape inside the sheet closes it too", () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hintButton()).toHaveFocus();
  });

  it("the order-card line does not change when the sheet opens (no double hint)", () => {
    render(<Harness />);
    const line = () => document.querySelector(".order-card--free-cook .order-card__hint")?.textContent;
    const before = line();
    fireEvent.click(hintButton());
    fireEvent.click(screen.getByRole("button", { name: "次のヒントを見る" }));
    expect(line()).toBe(before);
  });
});
