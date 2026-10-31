import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { getIngredient } from "../data/ingredients";
import { SQUEEZE_MAX_LENGTH, trailLength } from "../logic/squeeze";
import { PizzaStage } from "./PizzaStage";

/**
 * Expansion Batch 13 (#708, Owner 案A): in the TOPPING step one stroke of mayo across the dough = ONE piece (a line); a tap = the single droplet; the stroke is capped at 60% of the
 * dough's diameter; any other ingredient is unchanged. Driven through the real gesture handlers and the real reducer (mirrors PizzaStage.cutGesture.test.tsx).
 */
const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
const POINTER_BASE = { isPrimary: true, pointerType: "touch" as const };

function toppingState(): GameState {
  let state = gameReducer(createGuidedInitialState(), { type: "BEGIN_PREPARE" });
  for (let i = 0; i < 3; i += 1) state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  return { ...state, ownedIngredientIds: [...state.ownedIngredientIds, "mayo"], inventory: { ...state.inventory, mayo: 30 } };
}

function Harness({ ingredientId }: { ingredientId: string }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, toppingState);
  const active = getIngredient(ingredientId)!;
  return (
    <div>
      <span data-testid="count">{state.pizza.toppings.length}</span>
      <span data-testid="trails">{state.pizza.toppings.filter((t) => t.trail).length}</span>
      <span data-testid="len">{state.pizza.toppings[0]?.trail ? trailLength(state.pizza.toppings[0].trail).toFixed(2) : "none"}</span>
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={active}
        bakeProgress={null}
        placement={state.placement}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape
        onTap={(x, y) => dispatch({ type: "PLACE_TOPPING", ingredientId, x, y })}
        onPlaceTrail={(points) => dispatch({ type: "PLACE_TOPPING", ingredientId, x: points[0].x, y: points[0].y, trail: points })}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={state.cutState}
        onAddCutLine={() => {}}
      />
    </div>
  );
}

function getDough(): HTMLElement {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () => DOUGH_RECT;
  return dough;
}
function drag(dough: HTMLElement, pointerId: number, points: [number, number][]) {
  fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: points[0][0], clientY: points[0][1] });
  for (const [x, y] of points.slice(1)) fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
  const [lx, ly] = points[points.length - 1];
  fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: lx, clientY: ly });
}

afterEach(() => cleanup());

describe("PizzaStage: squeezing mayo (Expansion Batch 13)", () => {
  it("one stroke places ONE piece, drawn as a line (not a droplet)", () => {
    render(<Harness ingredientId="mayo" />);
    const dough = getDough();
    drag(dough, 1, [[90, 150], [120, 150], [150, 150], [180, 150], [210, 150]]);
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("trails").textContent).toBe("1");
    expect(document.querySelectorAll(".pizza-squeeze-trail")).toHaveLength(1);
    expect(document.querySelector(".pizza-topping--mayo svg")).toBeNull(); // the stroke replaces the droplet glyph
  });

  it("a tap places the single droplet piece", () => {
    render(<Harness ingredientId="mayo" />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 2, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 2, clientX: 150, clientY: 150 });
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(screen.getByTestId("trails").textContent).toBe("0");
    expect(document.querySelector('.pizza-topping--mayo svg[data-ingredient-visual="mayo-drop"]')).not.toBeNull();
    expect(document.querySelectorAll(".pizza-squeeze-trail")).toHaveLength(0);
  });

  it("a stroke longer than 60% of the dough's diameter is cut at the cap (still one piece)", () => {
    render(<Harness ingredientId="mayo" />);
    const dough = getDough();
    // 20 px .. 280 px across a 300 px dough: far more than 60% of the 96-percent diameter.
    drag(dough, 3, Array.from({ length: 14 }, (_, i) => [20 + i * 20, 150] as [number, number]));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(Number(screen.getByTestId("len").textContent)).toBeLessThanOrEqual(SQUEEZE_MAX_LENGTH + 1e-6);
    expect(Number(screen.getByTestId("len").textContent)).toBeGreaterThan(SQUEEZE_MAX_LENGTH - 3);
  });

  it("the live stroke is previewed while dragging and cleared on release", () => {
    render(<Harness ingredientId="mayo" />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 4, clientX: 90, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 4, clientX: 130, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 4, clientX: 170, clientY: 150 });
    const live = document.querySelector(".pizza-paint-trail__stroke--squeeze");
    expect(live).not.toBeNull();
    expect(live!.getAttribute("d")).toMatch(/^M /);
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 4, clientX: 170, clientY: 150 });
    expect(live!.getAttribute("d") ?? "").toBe("");
  });

  it("any other topping is unchanged: a drag still commits one single point at release (no trail)", () => {
    render(<Harness ingredientId="basil" />);
    const dough = getDough();
    drag(dough, 5, [[90, 150], [130, 150], [170, 150]]);
    expect(document.querySelectorAll(".pizza-squeeze-trail")).toHaveLength(0);
    expect(screen.getByTestId("trails").textContent).toBe("0");
  });
});
