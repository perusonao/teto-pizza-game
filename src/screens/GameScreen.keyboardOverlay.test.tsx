import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getReferencePizza } from "../data/referencePizza";
import { getIngredient, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * PR #26 Final P2 (discussion_r4017893706): `GameScreen` passed `interactive={state.phase ===
 * "PREPARE" && !isReferencePopoverOpen}` to `PizzaStage` -- unlike the physical-drag gate a few
 * lines below it, this never looked at `isGlobalOverlayOpen`. Dex/Shop don't trap focus or make
 * the underlying screen inert, so Tab could still reach the dough while either overlay was open,
 * and `PizzaStage`'s own `handleKeyDown` only checks its own `interactive` prop -- so Enter/Space
 * placed sauce/toppings behind the modal.
 *
 * Fix: `GameScreen.tsx`'s `interactive` prop now also requires `!isGlobalOverlayOpen`, matching
 * the existing `physicalDragEnabled={referenceModeEnabled && !isReferencePopoverOpen &&
 * !isGlobalOverlayOpen}` gate exactly. No second overlay-state system introduced.
 *
 * This harness renders the real `GameScreen` wired to the real `gameReducer`, with `onTapPizza`
 * reproducing App.tsx's own `handleTapPizza` (spread ingredients -> APPLY_SAUCE, scatter
 * ingredients -> PLACE_TOPPING) so a keyboard Enter/Space on the dough exercises the exact same
 * dispatch path the real app uses. `isGlobalOverlayOpen` is driven by a harness checkbox standing
 * in for App.tsx's `isDexOpen || isShopOpen`.
 */

const referencePizza = getReferencePizza("margherita");
if (!referencePizza) throw new Error("Margherita reference fixture missing");

// Issue #32 Phase 2: PLACE_TOPPING/APPLY_SAUCE are now gated on `state.makingStep` matching
// the selected ingredient's own category (see gameReducer.ts) -- this harness's `category`
// prop selects which ingredient a test exercises, so the making flow must be advanced to that
// category's own step at mount, via CONFIRM_MAKING_STEP.
const CATEGORY_TO_MAKING_STEP: Record<IngredientCategory, MakingStep> = {
  sauce: "SAUCE",
  cheese: "CHEESE",
  topping: "TOPPING",
};

function Harness({
  category,
  ingredientId,
  initialReferencePopoverOpen = false,
}: {
  category: IngredientCategory;
  ingredientId: string;
  initialReferencePopoverOpen?: boolean;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => {
    let initial = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    while (initial.makingStep !== CATEGORY_TO_MAKING_STEP[category]) {
      initial = gameReducer(initial, { type: "CONFIRM_MAKING_STEP" });
    }
    return initial;
  });
  const [isGlobalOverlayOpen, setGlobalOverlayOpen] = useState(false);
  const [isReferencePopoverOpen, setReferencePopoverOpen] = useState(initialReferencePopoverOpen);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>(category);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);

  function resolvePhysicalDrop(clientX: number, clientY: number): DoughPoint | null {
    return resolvePieceDrop(clientX, clientY, { left: 0, top: 0, width: 300, height: 300 } as DOMRect);
  }

  function handlePhysicalDrop(ingredient: Ingredient, point: DoughPoint) {
    dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x: point.x, y: point.y });
  }

  // Mirrors App.tsx's own handleTapPizza exactly (spread -> APPLY_SAUCE, scatter -> PLACE_TOPPING).
  function handleTapPizza(x: number, y: number) {
    if (!selectedIngredientId) return;
    const ingredient = getIngredient(selectedIngredientId);
    if (!ingredient) return;
    if (ingredient.placement === "spread") {
      dispatch({ type: "APPLY_SAUCE", ingredientId: ingredient.id, x, y });
    } else {
      dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
    }
  }

  return (
    <div>
      <button type="button" onClick={() => setGlobalOverlayOpen(true)}>
        Open Dex/Shop
      </button>
      <button type="button" onClick={() => setGlobalOverlayOpen(false)}>
        Close Dex/Shop
      </button>
      <button type="button" onClick={() => setReferencePopoverOpen(true)}>
        Open Reference Popover
      </button>
      <button type="button" onClick={() => setSelectedIngredientId(ingredientId)}>
        Select {ingredientId}
      </button>
      <span data-testid="sauce-count">{state.pizza.sauceIds.length}</span>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={activeCategory}
        selectedIngredientId={selectedIngredientId}
        bakeProgress={null}
        referenceModeEnabled
        referencePizza={referencePizza}
        isReferencePopoverOpen={isReferencePopoverOpen}
        isGlobalOverlayOpen={isGlobalOverlayOpen}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => {}}
        onChangeCategory={setActiveCategory}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        onTapPizza={handleTapPizza}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRegisterToDex={() => {}}
        onRetrySameRecipe={() => {}}
        onBackToPizzaSelect={() => {}}
        onMissionServeNext={() => {}}
        onMissionStart={() => {}}
        onMissionExitToFree={() => {}}
        onMissionCloseIntro={() => {}}
        onReferencePopoverChange={setReferencePopoverOpen}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={handlePhysicalDrop}
      />
    </div>
  );
}

function sauceCount(): number {
  return Number(screen.getByTestId("sauce-count").textContent);
}

function toppingCount(): number {
  return Number(screen.getByTestId("topping-count").textContent);
}

// PR #26 Final P2 Follow-up #2 (discussion_r4021268603): a SPREAD ingredient (tomato-sauce)
// selected no longer advertises "Enterまたはスペース" in the dough's aria-label (PizzaStage now
// only offers that when a real keyboard action exists), so this looks the dough up by its stable
// data attribute instead of an aria-label that's intentionally conditional on the selected
// ingredient's placement.
function getDough(): HTMLElement {
  const dough = document.querySelector('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("PizzaStage dough element not found");
  return dough as HTMLElement;
}

function selectIngredient(ingredientId: string) {
  fireEvent.click(screen.getByRole("button", { name: `Select ${ingredientId}` }));
}

afterEach(() => {
  cleanup();
});

describe("Keyboard dough input is disabled behind overlays (PR #26 Final P2)", () => {
  it("Dex open + Enter on a selected sauce: no sauce is applied", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));

    expect(sauceCount()).toBe(0);
    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(sauceCount()).toBe(0);
  });

  it("Dex open + Space on a selected topping: no topping is placed", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));

    expect(toppingCount()).toBe(0);
    fireEvent.keyDown(getDough(), { key: " " });
    expect(toppingCount()).toBe(0);
  });

  it("Shop open + Enter on a selected sauce: no sauce is applied", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");
    // The harness's "Open Dex/Shop" button stands in for either overlay -- GameScreen only ever
    // sees the single OR'd `isGlobalOverlayOpen` flag, exactly as App.tsx computes it.
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));

    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(sauceCount()).toBe(0);
  });

  it("Shop open + Space on a selected topping: no topping is placed", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    fireEvent.click(screen.getByRole("button", { name: "Open Dex/Shop" }));

    fireEvent.keyDown(getDough(), { key: " " });
    expect(toppingCount()).toBe(0);
  });

  it("closing the overlay restores keyboard interaction", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    const openButton = screen.getByRole("button", { name: "Open Dex/Shop" });
    const closeButton = screen.getByRole("button", { name: "Close Dex/Shop" });

    fireEvent.click(openButton);
    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(toppingCount()).toBe(0);

    fireEvent.click(closeButton);
    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(toppingCount()).toBe(1);
  });

  it("Reference popover behavior is unchanged: open popover alone still blocks keyboard placement", () => {
    render(<Harness category="topping" ingredientId="garlic" initialReferencePopoverOpen />);
    selectIngredient("garlic");

    fireEvent.keyDown(getDough(), { key: "Enter" });
    expect(toppingCount()).toBe(0);
  });

  it("normal mouse/touch PizzaStage interaction is unaffected when no overlay is open", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    const dough = getDough();
    // jsdom never lays out elements, so PizzaStage's own getBoundingClientRect() read (used for
    // pointer-based tap, unlike the hardcoded onTap(50, 50) of the keyboard path above) would
    // otherwise always be 0x0 and read every point as outside the dough.
    dough.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;

    fireEvent.pointerDown(dough, { pointerId: 1, isPrimary: true, pointerType: "mouse", clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { pointerId: 1, clientX: 150, clientY: 150 });

    expect(toppingCount()).toBe(1);
  });
});
