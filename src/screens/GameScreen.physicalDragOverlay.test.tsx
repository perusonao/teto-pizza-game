import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getReferencePizza } from "../data/referencePizza";
import { getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * Independent Review P2-A (PR #26, discussion_r4017018600): `physicalDragEnabled` only ever
 * watched the Reference popover (`isReferencePopoverOpen`), so a second pointer opening the Dex
 * or Shop overlay mid-drag left the first pointer's physical-drag session alive -- IngredientTray's
 * window-level pointerup/pointercancel listeners fire regardless of what overlay is visually on
 * top. The fix threads a new `isGlobalOverlayOpen` prop (App.tsx's `isDexOpen || isShopOpen`)
 * into the same gate GameScreen already builds for Reference.
 *
 * This harness renders the real `GameScreen` (not a mock of it) wired to the real gameReducer,
 * with a `resolvePhysicalDrop` fixture matching the pattern already used by
 * IngredientTray.physicalDragReset.test.tsx / IngredientTray.palette.test.tsx (jsdom gives every
 * element a 0x0 `getBoundingClientRect`, which `resolvePieceDrop` would otherwise always read as
 * a miss regardless of this fix). `isGlobalOverlayOpen` is driven by a harness checkbox standing
 * in for App.tsx's own `isDexOpen`/`isShopOpen` state, toggled mid-drag exactly like a second
 * pointer tapping Dex or Shop would.
 */

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300 } as DOMRect;
const INSIDE_CLIENT = { x: 150, y: 150 };
const referencePizza = getReferencePizza("margherita");
if (!referencePizza) throw new Error("Margherita reference fixture missing");

function Harness({ category }: { category: IngredientCategory }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" }),
  );
  const [isGlobalOverlayOpen, setGlobalOverlayOpen] = useState(false);

  function resolvePhysicalDrop(clientX: number, clientY: number): DoughPoint | null {
    return resolvePieceDrop(clientX, clientY, DOUGH_RECT);
  }

  function handlePhysicalDrop(ingredient: Ingredient, point: DoughPoint) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

  return (
    <div>
      <button type="button" onClick={() => setGlobalOverlayOpen(true)}>
        Open Dex/Shop
      </button>
      <button type="button" onClick={() => setGlobalOverlayOpen(false)}>
        Close Dex/Shop
      </button>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={category}
        selectedIngredientId={null}
        bakeProgress={null}
        referenceModeEnabled
        referencePizza={referencePizza}
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={isGlobalOverlayOpen}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        onGoHome={() => {}}
        onOpenDex={() => {}}
        onOpenShop={() => {}}
        onBeginPrepare={() => {}}
        onShowMissionIntro={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onStartBake={() => {}}
        onShowHint={() => {}}
        onChangeCategory={() => {}}
        onSelectIngredient={() => {}}
        onTapPizza={() => {}}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRegisterToDex={() => {}}
        onPlayAgain={() => {}}
        onMissionServeNext={() => {}}
        onMissionStart={() => {}}
        onMissionExitToFree={() => {}}
        onMissionCloseIntro={() => {}}
        onReferencePopoverChange={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={handlePhysicalDrop}
      />
    </div>
  );
}

function toppingCount(): number {
  return Number(screen.getByTestId("topping-count").textContent);
}

function findChip(ingredientId: string): HTMLElement {
  const ingredient = getIngredient(ingredientId);
  if (!ingredient) throw new Error(`Unknown ingredient fixture: ${ingredientId}`);
  return screen.getByRole("button", { name: new RegExp(ingredient.nameJa) });
}

function startDrag(chip: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(chip, {
    pointerId,
    isPrimary: true,
    pointerType: "mouse",
    clientX: 20,
    clientY: 20,
  });
  fireEvent.pointerMove(chip, { pointerId, clientX: 40, clientY: 20 });
}

afterEach(() => {
  cleanup();
});

describe("Physical drag aborts under a global overlay (Independent Review P2-A)", () => {
  it("Mozzarella: drag start -> Dex/Shop opens -> stale pointerup places nothing", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    expect(toppingCount()).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("Basil: drag start -> Dex/Shop opens -> stale pointerup places nothing", () => {
    render(<Harness category="topping" />);
    const chip = findChip("basil");

    startDrag(chip, 1);
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(0);
  });

  it("closing the overlay restores normal physical drag", () => {
    render(<Harness category="cheese" />);
    const openButton = screen.getByRole("button", { name: "Open Dex/Shop" });
    const closeButton = screen.getByRole("button", { name: "Close Dex/Shop" });

    // First drag is aborted by the overlay, exactly like the case above.
    const chip = findChip("mozzarella");
    startDrag(chip, 1);
    fireEvent.click(openButton);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    expect(toppingCount()).toBe(0);

    // Overlay closes; a brand new drag on the same chip must work normally again.
    fireEvent.click(closeButton);
    startDrag(chip, 2);
    fireEvent.pointerUp(chip, { pointerId: 2, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });
    expect(toppingCount()).toBe(1);
  });

  it("a drag that finishes before any overlay opens still places normally (fix doesn't over-cancel)", () => {
    render(<Harness category="cheese" />);
    const chip = findChip("mozzarella");

    startDrag(chip, 1);
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: INSIDE_CLIENT.x, clientY: INSIDE_CLIENT.y });

    expect(toppingCount()).toBe(1);
  });
});
