import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState, type MakingStep } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getReferencePizza } from "../data/referencePizza";
import { getIngredient, INGREDIENTS, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * Issue #476 (S1): tray drag-and-drop belongs to the ROUND, not to a Reference. Guided (Margherita and a recipe
 * that is not Margherita), Free Cooking, Research (a Free Cooking round that carries a research target) and Dinner can
 * drag every scatter piece; Lunch Rush cannot. The real GameScreen is wired to the real reducer, so a drop goes through
 * PLACE_TOPPING (category-for-step / stock gates) and 1つ戻す through UNDO_LAST_PLACEMENT.
 *
 * Dinner / Research are built from the real Free Cooking round (`START_FREE_COOK`, the sentinel `free-cook` recipe both
 * of them run on in PREPARE -- see gameReducer.ts `buildOrderState`) with the round kind of the mode; the real routes
 * are covered end to end by e2e/topping-drag-unified-476.spec.ts.
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
const INSIDE = { x: 150, y: 150 };
const FINITE_STOCK = Object.fromEntries(INGREDIENTS.filter((i) => i.unlockCondition).map((i) => [i.id, 99]));
const ALL_OWNED = INGREDIENTS.map((i) => i.id);


type Mode = "guided-margherita" | "guided-other" | "free" | "research" | "dinner" | "lunch-rush";

function freeRound(): GameState {
  const base = createInitialGameState([], ALL_OWNED, 0, FINITE_STOCK);
  return gameReducer(base, { type: "START_FREE_COOK", now: 0 });
}

function stateFor(mode: Mode, step: MakingStep, inventory: Record<string, number> = FINITE_STOCK): GameState {
  let state: GameState;
  switch (mode) {
    case "guided-margherita":
      state = createGuidedInitialState("margherita", { ownedIngredientIds: ALL_OWNED, inventory });
      state = gameReducer(state, { type: "BEGIN_PREPARE" });
      break;
    case "guided-other":
      state = createGuidedInitialState("salsiccia", { ownedIngredientIds: ALL_OWNED, inventory });
      state = gameReducer(state, { type: "BEGIN_PREPARE" });
      break;
    case "free":
      state = { ...freeRound(), inventory };
      break;
    case "research":
      state = { ...freeRound(), inventory, researchTargetId: "pesto-pollo" };
      break;
    case "dinner":
      state = { ...freeRound(), inventory, roundKind: "DINNER" };
      break;
    case "lunch-rush":
      state = createGuidedInitialState("salsiccia", { ownedIngredientIds: ALL_OWNED, inventory });
      state = { ...gameReducer(state, { type: "BEGIN_PREPARE" }), roundKind: "LUNCH_RUSH", isMissionRound: true };
      break;
  }
  return { ...state, makingStep: step };
}

interface HarnessProps {
  initial: GameState;
  category: IngredientCategory;
  referencePopoverOpen?: boolean;
  abandonRequested?: boolean;
}

function Harness({ initial, category, referencePopoverOpen = false, abandonRequested = false }: HarnessProps) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const shown: GameState = abandonRequested
    ? ({ ...state, dinner: { abandonRequested: true } } as unknown as GameState)
    : state;
  const reference = state.recipe.id === "margherita" ? getReferencePizza("margherita") : null;

  return (
    <div>
      <button type="button" onClick={() => setOverlayOpen(true)}>
        Open Dex/Shop
      </button>
      <span data-testid="piece-count">{state.pizza.toppings.length}</span>
      <span data-testid="piece-ids">{state.pizza.toppings.map((t) => t.ingredientId).join(",")}</span>
      <GameScreen
        state={shown}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={category}
        selectedIngredientId={null}
        bakeProgress={null}
        referenceModeEnabled={reference !== null}
        referencePizza={reference}
        isReferencePopoverOpen={referencePopoverOpen}
        isGlobalOverlayOpen={overlayOpen}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        showDoughShape
        doughShapeComplete
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onUndoPlacement={() => dispatch({ type: "UNDO_LAST_PLACEMENT" })}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => {}}
        onChangeCategory={() => {}}
        onSelectIngredient={() => {}}
        onTapPizza={() => {}}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRetrySameRecipe={() => {}}
        onBackToPizzaSelect={() => {}}
        onMissionServeNext={() => {}}
        onMissionSkipOrder={() => {}}
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
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={(x: number, y: number): DoughPoint | null => resolvePieceDrop(x, y, DOUGH_RECT)}
        onPhysicalDrop={(ingredient: Ingredient, point: DoughPoint) =>
          dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y })
        }
      />
    </div>
  );
}

afterEach(() => cleanup());

const count = () => Number(screen.getByTestId("piece-count").textContent);
const ids = () => screen.getByTestId("piece-ids").textContent;

function chip(ingredientId: string): HTMLElement {
  const ingredient = getIngredient(ingredientId)!;
  return screen.getByRole("button", { name: new RegExp(ingredient.nameJa) });
}

function startDrag(el: HTMLElement, pointerId = 1) {
  fireEvent.pointerDown(el, { pointerId, isPrimary: true, pointerType: "mouse", clientX: 20, clientY: 20 });
  fireEvent.pointerMove(el, { pointerId, clientX: 40, clientY: 20 });
}

function dropAt(el: HTMLElement, x: number, y: number, pointerId = 1) {
  fireEvent.pointerUp(el, { pointerId, clientX: x, clientY: y });
}

function dragToPizza(el: HTMLElement, pointerId = 1) {
  startDrag(el, pointerId);
  dropAt(el, INSIDE.x, INSIDE.y, pointerId);
}

const DRAG_MODES: Mode[] = ["guided-margherita", "guided-other", "free", "research", "dinner"];

// Margherita / Salsiccia list their own required pieces; Free Cooking / Research / Dinner list every owned piece of the
// step, six to a page -- these are all on page 1.
const PIECE_FOR: Record<Mode, { cheese: string; topping: string }> = {
  "guided-margherita": { cheese: "mozzarella", topping: "basil" },
  "guided-other": { cheese: "mozzarella", topping: "sausage" },
  free: { cheese: "mozzarella", topping: "garlic" },
  research: { cheese: "gorgonzola", topping: "oregano" },
  dinner: { cheese: "parmigiano", topping: "egg" },
  "lunch-rush": { cheese: "mozzarella", topping: "sausage" },
};

describe("tray drag per round kind (#476 S1)", () => {
  for (const mode of DRAG_MODES) {
    it(`${mode}: a cheese and a topping are dragged onto the pizza and placed`, () => {
      const { cheese, topping } = PIECE_FOR[mode];
      const { unmount } = render(<Harness initial={stateFor(mode, "CHEESE")} category="cheese" />);
      expect(chip(cheese).className).toContain("ingredient-chip--physical");
      dragToPizza(chip(cheese));
      expect(count()).toBe(1);
      expect(ids()).toBe(cheese);
      unmount();

      render(<Harness initial={stateFor(mode, "TOPPING")} category="topping" />);
      expect(chip(topping).className).toContain("ingredient-chip--physical");
      dragToPizza(chip(topping));
      expect(count()).toBe(1);
      expect(ids()).toBe(topping);
    });
  }

  it("lunch-rush: nothing is draggable and a drag places nothing (unchanged)", () => {
    render(<Harness initial={stateFor("lunch-rush", "CHEESE")} category="cheese" />);
    const el = chip(PIECE_FOR["lunch-rush"].cheese);
    expect(el.className).not.toContain("ingredient-chip--physical");
    expect(document.querySelectorAll(".ingredient-chip--physical")).toHaveLength(0);
    dragToPizza(el);
    expect(count()).toBe(0);
  });

  it("the drag does not depend on a Reference: Free Cooking / Research / Dinner have none", () => {
    for (const mode of ["free", "research", "dinner"] as const) {
      const state = stateFor(mode, "TOPPING");
      expect(state.recipe.id).toBe("free-cook");
      expect(getReferencePizza(state.recipe.id)).toBeNull();
      render(<Harness initial={state} category="topping" />);
      expect(document.querySelectorAll(".ingredient-chip--physical").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("a sauce chip is not draggable in any round", () => {
    for (const mode of DRAG_MODES) {
      render(<Harness initial={stateFor(mode, "SAUCE")} category="sauce" />);
      expect(document.querySelectorAll(".ingredient-chip--physical")).toHaveLength(0);
      cleanup();
    }
  });
});

describe("cancel paths stay intact for every draggable round (#476 S1)", () => {
  for (const mode of DRAG_MODES) {
    it(`${mode}: dropping off the pizza places nothing`, () => {
      render(<Harness initial={stateFor(mode, "CHEESE")} category="cheese" />);
      const el = chip(PIECE_FOR[mode].cheese);
      startDrag(el);
      dropAt(el, 900, 900);
      expect(count()).toBe(0);
    });

    it(`${mode}: Escape during a drag cancels it`, () => {
      render(<Harness initial={stateFor(mode, "CHEESE")} category="cheese" />);
      const el = chip(PIECE_FOR[mode].cheese);
      startDrag(el);
      fireEvent.keyDown(window, { key: "Escape" });
      dropAt(el, INSIDE.x, INSIDE.y);
      expect(count()).toBe(0);
    });

    it(`${mode}: pointercancel during a drag cancels it`, () => {
      render(<Harness initial={stateFor(mode, "CHEESE")} category="cheese" />);
      const el = chip(PIECE_FOR[mode].cheese);
      startDrag(el);
      fireEvent.pointerCancel(el, { pointerId: 1 });
      dropAt(el, INSIDE.x, INSIDE.y);
      expect(count()).toBe(0);
    });
  }

  it("a Dex / Shop overlay opening mid-drag aborts it, in Free Cooking too", () => {
    render(<Harness initial={stateFor("free", "CHEESE")} category="cheese" />);
    const el = chip("mozzarella");
    startDrag(el);
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));
    dropAt(el, INSIDE.x, INSIDE.y);
    expect(count()).toBe(0);
  });

  it("an open Reference popover turns the drag off (Guided)", () => {
    render(<Harness initial={stateFor("guided-other", "CHEESE")} category="cheese" referencePopoverOpen />);
    expect(document.querySelectorAll(".ingredient-chip--physical")).toHaveLength(0);
  });

  it("the Dinner abandon dialog turns the drag off", () => {
    render(<Harness initial={stateFor("dinner", "CHEESE")} category="cheese" abandonRequested />);
    expect(document.querySelectorAll(".ingredient-chip--physical")).toHaveLength(0);
  });

  it("outside PREPARE the drag is off", () => {
    render(<Harness initial={{ ...stateFor("free", "TOPPING"), phase: "BAKE" }} category="topping" />);
    expect(document.querySelectorAll(".ingredient-chip--physical")).toHaveLength(0);
  });
});

describe("Undo, stock and tap with unified drag (#476 S1)", () => {
  for (const mode of DRAG_MODES) {
    it(`${mode}: 1つ戻す takes back a dragged piece (the last one only)`, () => {
      const { topping } = PIECE_FOR[mode];
      render(<Harness initial={stateFor(mode, "TOPPING")} category="topping" />);
      dragToPizza(chip(topping), 1);
      // Second drop lands elsewhere so it is not nudged.
      startDrag(chip(topping), 2);
      dropAt(chip(topping), 60, 60, 2);
      expect(count()).toBe(2);
      fireEvent.click(screen.getByRole("button", { name: "1つ戻す" }));
      expect(count()).toBe(1);
    });
  }

  it("lunch-rush has no 1つ戻す at all (unchanged)", () => {
    render(<Harness initial={stateFor("lunch-rush", "CHEESE")} category="cheese" />);
    expect(screen.queryByRole("button", { name: "1つ戻す" })).toBeNull();
  });

  it("stock: a finite ingredient can be dragged only as often as it is in stock; the chip is then disabled", () => {
    // Salsiccia needs 3 sausages (a guided round only starts when it is cookable); Free Cooking can run on 1 egg.
    const cases = [
      ["guided-other", "sausage", 3],
      ["free", "egg", 1],
    ] as const;
    const spots = [[90, 90], [210, 90], [150, 220]] as const;
    for (const [mode, piece, stock] of cases) {
      render(<Harness initial={stateFor(mode, "TOPPING", { ...FINITE_STOCK, [piece]: stock })} category="topping" />);
      for (let i = 0; i < stock; i += 1) {
        startDrag(chip(piece), i + 1);
        dropAt(chip(piece), spots[i][0], spots[i][1], i + 1);
      }
      expect(count()).toBe(stock);
      expect(chip(piece)).toBeDisabled();
      startDrag(chip(piece), 9);
      dropAt(chip(piece), 150, 150, 9);
      expect(count()).toBe(stock);
      cleanup();
    }
  });

  it("the reducer still rejects a drop of a topping during the CHEESE step (category gate)", () => {
    render(<Harness initial={stateFor("free", "CHEESE")} category="topping" />);
    dragToPizza(chip("garlic"));
    expect(count()).toBe(0);
  });

  it("a plain tap on a draggable chip selects it (the tap path is unchanged)", () => {
    const { unmount } = render(<Harness initial={stateFor("free", "TOPPING")} category="topping" />);
    const el = chip("garlic");
    fireEvent.click(el);
    // Harness's onSelectIngredient is a no-op; the point is that a click is not swallowed into a drag.
    expect(count()).toBe(0);
    unmount();
  });
});
