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
        cutState={state.cutState}
        onAddCutLine={() => {}}
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

  it("Issue #33 D2: a single pull spreads to neighboring points (mean rises) without jumping the whole shape to full size", () => {
    render(<Harness />);
    const element = dough();

    // Angle 0 exactly ("east") -- propagates to index 0 (primary), 1/7 (immediate
    // neighbors), 2/6 (next ring); see src/logic/doughShape.test.ts for the exact per-point
    // math this component-level test doesn't re-derive.
    pointerDown(element, clientPoint(50 + 40, 50));
    pointerUp(element, clientPoint(50 + 40, 50));

    const initial = doughSizeProgress(createInitialDoughShape());
    expect(meanProgress()).toBeGreaterThan(initial);
    // Still well short of every point having jumped to the full pull distance.
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

  it("Issue #33 D3A: a drag inward after a drag outward shrinks the shape back down (reversible within one live preview)", () => {
    render(<Harness />);
    const element = dough();

    pointerDown(element, clientPoint(50 + 40, 50));
    pointerUp(element, clientPoint(50 + 40, 50));
    const stretched = meanProgress();
    expect(stretched).toBeGreaterThan(doughSizeProgress(createInitialDoughShape()));

    pointerDown(element, clientPoint(50 + 40, 50));
    pointerMove(element, clientPoint(50 + 12, 50));
    pointerUp(element, clientPoint(50 + 12, 50));

    expect(meanProgress()).toBeLessThan(stretched);
  });

  it("Issue #33 D3A: stretching past the ideal guide-ring size is not hard-stopped", () => {
    render(<Harness />);
    const element = dough();

    // A gesture must *start* inside the DOUGH_RADIUS hit circle (handlePointerDown's own
    // isInsideDough gate, unchanged by D3A), but pointermove is free to continue past it -- so
    // press just inside the rim, then drag on out beyond the old DOUGH_RADIUS ceiling.
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      for (let pull = 0; pull < 5; pull += 1) {
        const startPoint = clientPoint(50 + Math.cos(angle) * 46, 50 + Math.sin(angle) * 46);
        const farPoint = clientPoint(50 + Math.cos(angle) * 57, 50 + Math.sin(angle) * 57);
        pointerDown(element, startPoint, i + 1);
        pointerMove(element, farPoint, i + 1);
        pointerUp(element, farPoint, i + 1);
      }
    }

    // mean(radii)/DOUGH_RADIUS > 1 means the committed shape's average size is already past
    // the ideal/reference boundary the guide ring draws -- and nothing clamped it back.
    expect(meanProgress()).toBeGreaterThan(1);
  });

  it("Issue #33 D3A: an accidental tiny gesture right where the dough already is causes no visible change", () => {
    render(<Harness />);
    const element = dough();

    // First gesture: spike-suppression means the touched point settles well short of the raw
    // touch distance (see doughShape.test.ts's own pinned 40 -> 30.24 fixture) -- so the second
    // touch below targets that *settled* radius, not the original raw touch point, to actually
    // land within DOUGH_TINY_GESTURE_EPSILON of where the shape now is.
    pointerDown(element, clientPoint(50 + 40, 50));
    pointerUp(element, clientPoint(50 + 40, 50));
    const settled = meanProgress();

    pointerDown(element, clientPoint(50 + 30.24, 50));
    pointerMove(element, clientPoint(50 + 30.4, 50));
    pointerUp(element, clientPoint(50 + 30.4, 50));

    expect(meanProgress()).toBeCloseTo(settled, 3);
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
