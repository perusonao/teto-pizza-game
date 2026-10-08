import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
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
  let state = createGuidedInitialState();
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

function lastCommittedPath(): string | null {
  const els = document.querySelectorAll(".pizza-cut-line");
  return els.length ? els[els.length - 1].getAttribute("data-trace") : null;
}

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
    // The preview is the finger's own trace so far (start -> current point), not an extended chord.
    expect(preview?.getAttribute("points")).toBe("5.00,50.00 95.00,50.00");
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

  it("a press outside the dough that never enters it never cuts", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 6;
    // Far outside the 300x300 dough circle's own bounding box.
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -50, clientY: -50 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: -40, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: -40, clientY: 150 });
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

  it("#418: a curved trace is kept as drawn -- not straightened or extended to the rim", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 20;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 90, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 100 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("1");
    // Starts where the finger pressed (30%,50%), bends through (50%,33.33%), stops at (70%,50%).
    expect(lastCommittedPath()).toBe("30,50 50,33.33333333333333 70,50");
  });

  it("#418: a stroke that stops inside the dough commits as a partial cut, unextended", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 21;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("1");
    expect(lastCommittedPath()).toBe("50,50 70,50");
  });

  it("#418: leaving the dough ends the cut on the rim; later movement is ignored", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 22;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 400, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 280 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 280 });
    expect(lastCommittedPath()).toBe("50,50 98,50");
  });

  it("#418: a second finger is ignored while the first is tracing", () => {
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 30, clientX: 90, clientY: 150 });
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 31, clientX: 150, clientY: 60 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 31, clientX: 150, clientY: 240 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 31, clientX: 150, clientY: 240 });
    expect(screen.getByTestId("line-count").textContent).toBe("0");
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 30, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 30, clientX: 210, clientY: 150 });
    expect(lastCommittedPath()).toBe("30,50 70,50");
  });

  it("#418: there is no undo control in the CUT step", () => {
    render(<Harness />);
    expect(screen.queryByText(/1本戻す/)).toBeNull();
  });

  it("#418: a hand-shaky (slow) straight stroke is committed as a clean straight segment", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 40;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 150 });
    for (const [x, y] of [[90, 153], [120, 147], [150, 154], [180, 146], [210, 152], [240, 150]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 150 });
    // Only start and end remain -- not extended to the rim, not snapped to an ideal angle.
    expect(lastCommittedPath()).toBe("20,50 80,50");
  });

  it("#418: a quick two-sample swipe is a straight segment ending where the finger lifted", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 41;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 90 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 210 });
    expect(lastCommittedPath()).toBe("20,30 80,70");
  });

  it("#418: the cut line starts drawing after only a few pixels of movement", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 42;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 156, clientY: 150 });
    const preview = document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line");
    expect(preview?.style.opacity).toBe("1");
    expect(preview?.getAttribute("points")).toBe("50.00,50.00 52.00,50.00");
  });

  it("#418: a stroke that starts outside the pizza begins at the rim where the finger crossed it", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 50;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -30, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 285, clientY: 150 });
    expect(lastCommittedPath()).toBe("2,50 95,50");
  });

  it("#418: CUT exposes a capture zone that reaches past the pizza", () => {
    render(<Harness />);
    expect(document.querySelector(".pizza-cut-hit-zone")).toBeInTheDocument();
  });

  it("#418: a natural arm arc over a long stroke is committed straight", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 51;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 30, clientY: 150 });
    for (const [x, y] of [[90, 138], [150, 132], [210, 138]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 270, clientY: 150 });
    expect(lastCommittedPath()).toBe("10,50 90,50");
  });

  it("#418: a deliberate bend is kept as a curve", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 52;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 60 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 150 });
    expect(lastCommittedPath()).toBe("20,50 50,20 80,50");
  });

  it("#418: a rim-to-rim cut renders as a groove with lit lips and the through (parted) treatment", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 60;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -30, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 150 });
    const mark = document.querySelector(".pizza-cut-mark");
    expect(mark).toHaveClass("pizza-cut-mark--through");
    expect(mark?.querySelector(".pizza-cut-edge--lit")).toBeInTheDocument();
    expect(mark?.querySelector(".pizza-cut-edge--far")).toBeInTheDocument();
    expect(mark?.querySelector(".pizza-cut-line")).toBeInTheDocument();
  });

  it("#418: a partial stroke is only a groove with one lit lip -- no parted treatment", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 61;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    const mark = document.querySelector(".pizza-cut-mark");
    expect(mark).not.toHaveClass("pizza-cut-mark--through");
    expect(mark?.querySelector(".pizza-cut-edge--lit")).toBeInTheDocument();
    expect(mark?.querySelector(".pizza-cut-edge--far")).toBeNull();
  });

  it("#418: a curved cut stays a curved groove and every cut remains drawn", () => {
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 62, clientX: 60, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 62, clientX: 150, clientY: 60 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 62, clientX: 240, clientY: 150 });
    expect(document.querySelector(".pizza-cut-line")?.getAttribute("data-trace")).toBe("20,50 50,20 80,50");
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 63, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 63, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 63, clientX: 210, clientY: 150 });
    expect(document.querySelectorAll(".pizza-cut-mark")).toHaveLength(2);
  });

  it("#418: only the newest cut carries the one-shot flash; a rim-to-rim cut gets crust details", () => {
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: -20 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 330 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 330 });
    let marks = document.querySelectorAll(".pizza-cut-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveClass("pizza-cut-mark--through");
    expect(marks[0].querySelectorAll(".pizza-cut-crust-crack")).toHaveLength(4); // 2 per end
    expect(marks[0].querySelectorAll(".pizza-cut-crust-shadow")).toHaveLength(2);
    expect(marks[0].querySelector(".pizza-cut-flash")).toBeInTheDocument();

    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 71, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 71, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 71, clientX: 210, clientY: 150 });
    marks = document.querySelectorAll(".pizza-cut-mark");
    expect(marks).toHaveLength(2);
    expect(marks[0].querySelector(".pizza-cut-flash")).toBeNull(); // back to a normal cut
    expect(marks[1].querySelector(".pizza-cut-flash")).toBeInTheDocument();
    expect(marks[1].querySelector(".pizza-cut-crust")).toBeNull(); // partial: no crust details
  });
});
