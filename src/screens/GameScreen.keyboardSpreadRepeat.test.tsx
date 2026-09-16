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
 * PR #26 Final P2 Follow-up #2 (discussion_r4021268603, discussion_r4021268607): the Codex
 * review of `56bbf2b` found two problems in `PizzaStage`'s `handleKeyDown`, both on the same
 * `onTap(50, 50)` call:
 *
 * 1. A SPREAD ingredient (tomato-sauce, the Margherita Reference sauce) has no real keyboard
 *    interaction. `onTap` unconditionally routed to `APPLY_SAUCE` (App.tsx's `handleTapPizza`),
 *    which always sets `sauceDeposits: []` -- but the Reference sauce visualization only ever
 *    renders from `sauceDeposits`, and Sauce Metrics are derived from the same deposits. A
 *    keyboard Enter/Space therefore silently mutated `pizza.sauceIds` while showing no sauce and
 *    leaving every metric at zero. Per the product decision for this PR, the fix is to not
 *    expose a "placement" for SPREAD ingredients via the generic keyboard path at all (no new
 *    keyboard Sauce painter here) -- `PizzaStage` reuses its own existing `isPaintMode =
 *    activeIngredient?.placement === "spread"` (already used for the pointer paint-vs-scatter
 *    branch) rather than hardcoding `ingredientId === "tomato-sauce"`.
 * 2. Holding Enter/Space auto-repeats `keydown`, and every repeat called `onTap` again, so a
 *    held key could dispatch many `PLACE_TOPPING`s from one physical press. Fixed with
 *    `event.repeat`.
 *
 * This harness is the same real `GameScreen` + real `gameReducer` + App.tsx-equivalent
 * `handleTapPizza` wiring as `GameScreen.keyboardOverlay.test.tsx` (which this file does not
 * modify or duplicate), just retargeted at these two findings.
 */

const referencePizza = getReferencePizza("margherita");
if (!referencePizza) throw new Error("Margherita reference fixture missing");

function Harness({ category, ingredientId }: { category: IngredientCategory; ingredientId: string }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" }),
  );
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
      <button type="button" onClick={() => setSelectedIngredientId(ingredientId)}>
        Select {ingredientId}
      </button>
      <span data-testid="sauce-count">{state.pizza.sauceIds.length}</span>
      <span data-testid="sauce-deposit-count">{state.pizza.sauceDeposits.length}</span>
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
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={false}
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
        onChangeCategory={setActiveCategory}
        onSelectIngredient={(ingredient) => setSelectedIngredientId(ingredient.id)}
        onTapPizza={handleTapPizza}
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

function sauceCount(): number {
  return Number(screen.getByTestId("sauce-count").textContent);
}

function sauceDepositCount(): number {
  return Number(screen.getByTestId("sauce-deposit-count").textContent);
}

function toppingCount(): number {
  return Number(screen.getByTestId("topping-count").textContent);
}

// The dough's aria-label is now conditional on whether a real keyboard action exists for the
// selected ingredient (see PizzaStage's `isKeyboardPlaceable`), so this test file -- like
// GameScreen.keyboardOverlay.test.tsx -- looks the dough up by its stable data attribute rather
// than by an aria-label that legitimately differs between a SPREAD and a scatter ingredient.
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

describe("SPREAD ingredients have no generic keyboard center-tap activation (PR #26 Final P2 Follow-up #2)", () => {
  it("Reference tomato sauce selected + Enter: no sauce state change at all", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");
    expect(sauceCount()).toBe(0);

    fireEvent.keyDown(getDough(), { key: "Enter" });

    // Not just "no visible sauce" -- no APPLY_SAUCE dispatch happened at all, so sauceIds
    // (and sauceDeposits, which APPLY_SAUCE would otherwise reset to []) are both untouched.
    expect(sauceCount()).toBe(0);
    expect(sauceDepositCount()).toBe(0);
  });

  it("Reference tomato sauce selected + Space: same", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");

    fireEvent.keyDown(getDough(), { key: " " });

    expect(sauceCount()).toBe(0);
    expect(sauceDepositCount()).toBe(0);
  });

  it("the dough is removed from the tab order while a SPREAD ingredient is selected", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");

    // Don't advertise a keyboard activation that does nothing (Codex's ARIA/tabIndex concern):
    // the dough must not be a Tab stop while tomato-sauce (SPREAD) is the active ingredient.
    expect(getDough().getAttribute("tabindex")).toBe("-1");
  });

  it("selecting a scatter topping afterward restores the keyboard Tab stop", () => {
    render(<Harness category="sauce" ingredientId="tomato-sauce" />);
    selectIngredient("tomato-sauce");
    expect(getDough().getAttribute("tabindex")).toBe("-1");

    fireEvent.click(screen.getByRole("button", { name: "トッピング" }));
    fireEvent.click(screen.getByRole("button", { name: /にんにく/ }));
    expect(getDough().getAttribute("tabindex")).toBe("0");
  });

  it("mouse/touch sauce application is completely unaffected (olive oil, a SPREAD ingredient)", () => {
    render(<Harness category="sauce" ingredientId="olive-oil" />);
    selectIngredient("olive-oil");
    const dough = getDough();
    // jsdom never lays out elements -- stub the rect the same way the existing pointer-tap
    // regression test in GameScreen.keyboardOverlay.test.tsx does.
    dough.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;

    fireEvent.pointerDown(dough, { pointerId: 1, isPrimary: true, pointerType: "mouse", clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { pointerId: 1, clientX: 150, clientY: 150 });

    expect(sauceCount()).toBe(1);
  });
});

describe("Keyboard auto-repeat places at most one piece per physical key press (PR #26 Final P2 Follow-up #2)", () => {
  it("Enter with repeat=false places exactly one topping", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");

    fireEvent.keyDown(getDough(), { key: "Enter", repeat: false });

    expect(toppingCount()).toBe(1);
  });

  it("a repeated Enter (repeat=true) does not place a second topping", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    const dough = getDough();

    fireEvent.keyDown(dough, { key: "Enter", repeat: false });
    expect(toppingCount()).toBe(1);

    // Simulates the browser's own auto-repeat keydown stream from one held key.
    fireEvent.keyDown(dough, { key: "Enter", repeat: true });
    fireEvent.keyDown(dough, { key: "Enter", repeat: true });

    expect(toppingCount()).toBe(1);
  });

  it("Space with repeat=false places exactly one topping", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");

    fireEvent.keyDown(getDough(), { key: " ", repeat: false });

    expect(toppingCount()).toBe(1);
  });

  it("a repeated Space (repeat=true) does not place a second topping", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    const dough = getDough();

    fireEvent.keyDown(dough, { key: " ", repeat: false });
    expect(toppingCount()).toBe(1);

    fireEvent.keyDown(dough, { key: " ", repeat: true });
    expect(toppingCount()).toBe(1);
  });

  it("releasing and pressing the key again (a genuine second physical press) places a second topping", () => {
    render(<Harness category="topping" ingredientId="garlic" />);
    selectIngredient("garlic");
    const dough = getDough();

    fireEvent.keyDown(dough, { key: "Enter", repeat: false });
    fireEvent.keyUp(dough, { key: "Enter" });
    expect(toppingCount()).toBe(1);

    // A fresh, non-repeated press (keyup happened first) is a genuine second placement, not an
    // auto-repeat -- repeat suppression must not over-block real key presses.
    fireEvent.keyDown(dough, { key: "Enter", repeat: false });
    fireEvent.keyUp(dough, { key: "Enter" });

    expect(toppingCount()).toBe(2);
  });
});
