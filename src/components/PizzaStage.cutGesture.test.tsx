import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { PizzaStage } from "./PizzaStage";
import type { CutLine } from "../logic/cut/types";

/**
 * Pizza Cutting 1.0 Phase 2 (docs/design/TETO_PIZZA-CUTTING_1.0.md §2.2): PizzaStage's own CUT
 * edge-to-edge drag gesture -- mirrors PizzaStage.doughStretch.test.tsx's own real-reducer
 * Harness/DOUGH_RECT pattern exactly, driving `ADD_CUT_LINE` through the real gesture handlers
 * (pointerdown/pointermove/pointerup/pointercancel) rather than dispatching it directly.
 */

const DOUGH_RECT = {
  left: 0,
  top: 0,
  width: 300,
  height: 300,
  right: 300,
  bottom: 300,
} as DOMRect;

/** margherita, fresh off CONFIRM_BAKE -- POST_BAKE, makingStep "CUT", zero committed lines. */
function preparedCutState(): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // DOUGH -> SAUCE
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // SAUCE -> CHEESE
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" }); // CHEESE -> TOPPING
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return state;
}

function Harness() {
  const [state, dispatch] = useReducer(gameReducer, undefined, preparedCutState);
  return (
    <div>
      <span data-testid="line-count">{state.cutState.lines.length}</span>
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={null}
        bakeProgress={state.pizza.bakeResult}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={state.cutState}
        onAddCutLine={(line: CutLine) => dispatch({ type: "ADD_CUT_LINE", line })}
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

const POINTER_BASE = { isPrimary: true, pointerType: "touch" as const };

afterEach(() => {
  cleanup();
});

describe("Pizza Cutting 1.0 Phase 2: PizzaStage CUT gesture", () => {
  it("6. a real edge-to-edge drag commits exactly one CutLine via ADD_CUT_LINE", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 1;
    // Left rim to right rim -- a clean horizontal diameter, well past DRAG_THRESHOLD_PX (10px).
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 15, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("1");
  });

  it("7. a preview line becomes visible during the drag, before release", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 2;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 15, clientY: 150 });
    const preview = document.querySelector<SVGLineElement>(".pizza-cut-preview-line");
    expect(preview).toBeInTheDocument();
    expect(preview?.style.opacity).toBe("0"); // not yet dragging -- no movement past the pointerdown
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(preview?.style.opacity).toBe("1");
    // The preview reflects the real rim-to-rim chord the drag would commit right now, not the
    // raw un-clamped pointer coordinates.
    expect(Number(preview?.getAttribute("x1"))).toBeLessThan(5);
    expect(Number(preview?.getAttribute("x2"))).toBeGreaterThan(95);
    // No commit yet -- still mid-gesture.
    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });

  it("8. pointercancel discards the in-progress drag without committing", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 3;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 15, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    fireEvent.pointerCancel(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");
    const preview = document.querySelector<SVGLineElement>(".pizza-cut-preview-line");
    expect(preview?.style.opacity).toBe("0");
    // A later pointerup from the same (now-cancelled) pointer must not somehow still commit.
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });

  it("9. a short drag/tap (below DRAG_THRESHOLD_PX) never commits a degenerate line", () => {
    render(<Harness />);
    const dough = getDough();

    // A true tap -- no movement at all.
    const tapId = 4;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: tapId, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: tapId, clientX: 150, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");

    // A tiny jitter well under the 10px drag threshold.
    const jitterId = 5;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: jitterId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: jitterId, clientX: 153, clientY: 151 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: jitterId, clientX: 153, clientY: 151 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });

  it("a press starting outside the dough never starts a CUT gesture", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 6;
    // Far outside the 300x300 dough circle's own bounding box.
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -50, clientY: -50 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");
  });

  it("committed lines render as permanent .pizza-cut-line elements, one per commit", () => {
    render(<Harness />);
    const dough = getDough();
    for (const [startX, startY, endX, endY] of [
      [15, 150, 285, 150],
      [150, 15, 150, 285],
    ]) {
      const pointerId = Math.floor(Math.random() * 1_000_000);
      fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: startX, clientY: startY });
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: endX, clientY: endY });
      fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: endX, clientY: endY });
    }
    expect(screen.getByTestId("line-count").textContent).toBe("2");
    expect(document.querySelectorAll(".pizza-cut-line")).toHaveLength(2);
  });
});
