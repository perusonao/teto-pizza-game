import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { createInitialDoughShape, doughSizeProgress } from "../logic/doughShape";
import { DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #33 D1: PizzaStage's own DOUGH radial-stretch gesture -- mirrors
 * PizzaStage.sauceParity.test.tsx/PizzaStage.sauceReset.test.tsx's own DOUGH_RECT/pointer-
 * event fixture pattern (docs/reports/TETO_ISSUE-33_DOUGH-D0_Fresh-Audit.md §10 item 2).
 */

const DOUGH_RECT = {
  left: 0,
  top: 0,
  width: 300,
  height: 300,
  right: 300,
  bottom: 300,
} as DOMRect;

function preparedState(): GameState {
  let state = createInitialGameState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  return state; // makingStep: "DOUGH"
}

function Harness({ onCommitAttempt }: { onCommitAttempt?: () => void }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, preparedState);
  const [resetToken, setResetToken] = useState(0);

  function handleReset() {
    setResetToken((token) => token + 1);
    dispatch({ type: "RESET_PIZZA" });
  }

  return (
    <div>
      <button type="button" onClick={handleReset}>
        やり直す
      </button>
      <button type="button" onClick={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}>
        次へ
      </button>
      <span data-testid="mean-progress">{doughSizeProgress(state.pizza.doughShape).toFixed(4)}</span>
      <span data-testid="sauce-id-count">{state.pizza.sauceIds.length}</span>
      <span data-testid="topping-count">{state.pizza.toppings.length}</span>
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={null}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={resetToken}
        makingStepToken={state.makingStepToken}
        makingStep={state.makingStep}
        showDoughShape
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={(shape) => {
          onCommitAttempt?.();
          dispatch({ type: "COMMIT_DOUGH_STRETCH", shape });
        }}
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

/** Client-space point at dough-percent (x, y), 0-100, against a 300x300 DOUGH_RECT. */
function clientPoint(xPercent: number, yPercent: number) {
  return { clientX: (xPercent / 100) * 300, clientY: (yPercent / 100) * 300 };
}

function pointerDown(element: HTMLElement, point: { clientX: number; clientY: number }, pointerId = 1) {
  fireEvent.pointerDown(element, { pointerId, isPrimary: true, pointerType: "touch", ...point });
}

function pointerMove(element: HTMLElement, point: { clientX: number; clientY: number }, pointerId = 1) {
  fireEvent.pointerMove(element, { pointerId, isPrimary: true, pointerType: "touch", ...point });
}

function pointerUp(element: HTMLElement, point: { clientX: number; clientY: number }, pointerId = 1) {
  fireEvent.pointerUp(element, { pointerId, isPrimary: true, pointerType: "touch", ...point });
}

function meanProgress(): number {
  return Number(screen.getByTestId("mean-progress").textContent);
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

describe("PizzaStage DOUGH radial-stretch gesture", () => {
  it("a drag increases the committed size live (no RAF/tick needed)", () => {
    render(<Harness />);
    const element = dough();
    expect(meanProgress()).toBeCloseTo(doughSizeProgress(createInitialDoughShape()), 4);

    pointerDown(element, clientPoint(50 + 40, 50));
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(meanProgress()).toBeGreaterThan(doughSizeProgress(createInitialDoughShape()));
  });

  it("only the two bracketing control points change from a single pull, not the whole shape", () => {
    render(<Harness />);
    const element = dough();

    // Angle 0 exactly ("east") -- only index 0 should move.
    pointerDown(element, clientPoint(50 + 40, 50));
    pointerUp(element, clientPoint(50 + 40, 50));

    // mean progress increased by roughly 1/8th of the full pull (one of eight points moved).
    const initial = doughSizeProgress(createInitialDoughShape());
    expect(meanProgress()).toBeGreaterThan(initial);
    expect(meanProgress()).toBeLessThan(initial + 40 / DOUGH_RADIUS);
  });

  it("commits only on a successful pointerup, never mid-drag", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element, clientPoint(50 + 40, 50));
    pointerMove(element, clientPoint(50 + 35, 50));
    expect(onCommitAttempt).not.toHaveBeenCalled();

    pointerUp(element, clientPoint(50 + 35, 50));
    expect(onCommitAttempt).toHaveBeenCalledTimes(1);
  });

  it("pointercancel discards the gesture without committing", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();
    const before = meanProgress();

    pointerDown(element, clientPoint(50 + 40, 50));
    fireEvent.pointerCancel(element, { pointerId: 1 });
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(onCommitAttempt).not.toHaveBeenCalled();
    expect(meanProgress()).toBeCloseTo(before, 4);
  });

  it("lostpointercapture discards the gesture without committing", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();
    const before = meanProgress();

    pointerDown(element, clientPoint(50 + 40, 50));
    fireEvent.lostPointerCapture(element, { pointerId: 1 });
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(onCommitAttempt).not.toHaveBeenCalled();
    expect(meanProgress()).toBeCloseTo(before, 4);
  });

  it("blur/visibilitychange discards the gesture without committing", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();
    const before = meanProgress();

    pointerDown(element, clientPoint(50 + 40, 50));
    fireEvent(window, new Event("blur"));
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    fireEvent(document, new Event("visibilitychange"));
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(onCommitAttempt).not.toHaveBeenCalled();
    expect(meanProgress()).toBeCloseTo(before, 4);
  });

  it("a stale pointerup after resetToken bumps commits nothing", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element, clientPoint(50 + 40, 50));
    fireEvent.click(screen.getByRole("button", { name: "やり直す" }));
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(onCommitAttempt).not.toHaveBeenCalled();
    expect(meanProgress()).toBeCloseTo(doughSizeProgress(createInitialDoughShape()), 4);
  });

  it("a stale pointerup after makingStepToken bumps (step confirmed mid-drag) commits nothing", () => {
    const onCommitAttempt = vi.fn();
    render(<Harness onCommitAttempt={onCommitAttempt} />);
    const element = dough();

    pointerDown(element, clientPoint(50 + 40, 50));
    fireEvent.click(screen.getByRole("button", { name: "次へ" })); // DOUGH -> SAUCE
    pointerUp(element, clientPoint(50 + 40, 50));

    expect(onCommitAttempt).not.toHaveBeenCalled();
  });

  it("never falls through to onTap/PLACE_TOPPING/APPLY_SAUCE, even for a tap with no movement", () => {
    render(<Harness />);
    const element = dough();
    const before = { sauce: Number(screen.getByTestId("sauce-id-count").textContent), topping: Number(screen.getByTestId("topping-count").textContent) };

    pointerDown(element, clientPoint(50, 50));
    pointerUp(element, clientPoint(50, 50));

    expect(Number(screen.getByTestId("sauce-id-count").textContent)).toBe(before.sauce);
    expect(Number(screen.getByTestId("topping-count").textContent)).toBe(before.topping);
  });

  it("repeated pulls around the circle reach the D1 completion threshold", () => {
    render(<Harness />);
    const element = dough();

    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const point = clientPoint(50 + Math.cos(angle) * 46, 50 + Math.sin(angle) * 46);
      pointerDown(element, point, i + 1);
      pointerUp(element, point, i + 1);
    }

    expect(meanProgress()).toBeGreaterThanOrEqual(0.75);
  });
});
