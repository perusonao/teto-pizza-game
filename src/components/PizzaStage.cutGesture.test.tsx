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
  const els = document.querySelectorAll(".pizza-cut-mark");
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

  it("committed cuts render as permanent .pizza-cut-mark elements, one per commit", () => {
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
    expect(document.querySelectorAll(".pizza-cut-mark")).toHaveLength(2);
  });

  it("#418: a cut is the straight line from press to lift -- the path in between never bends it", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 20;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 90, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 100 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    expect(screen.getByTestId("line-count").textContent).toBe("1");
    expect(lastCommittedPath()).toBe("30,50 70,50");
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

  it("#418: dragging past the rim clips the cut to the rim on the same line; the end keeps following the finger", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 22;
    const preview = () => document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 400, clientY: 150 });
    expect(preview().getAttribute("points")).toBe("50.00,50.00 98.00,50.00");
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 280 });
    expect(preview().getAttribute("points")).toBe("50.00,50.00 50.00,93.33");
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 280 });
    expect(lastCommittedPath()).toBe("50,50 50,93.33333333333333");
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

  it("#418: a shaky drag is the clean straight line between press and lift", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 40;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 150 });
    for (const [x, y] of [[90, 153], [120, 147], [150, 154], [180, 146], [210, 152], [240, 150]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 150 });
    expect(lastCommittedPath()).toBe("20,50 80,50");
  });

  it("#418: release commits exactly the line that was shown, never a jump to a different lift position", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 41;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 90 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    const shown = document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!.getAttribute("points");
    expect(shown).toBe("20.00,30.00 50.00,50.00");
    // the lift reports somewhere else (e.g. the finger rolled as it left the glass)
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 210 });
    expect(lastCommittedPath()).toBe("20,30 50,50");
  });

  it("#418: the line only appears once it has some length on the pizza (no accidental dots)", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 42;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 156, clientY: 150 });
    const preview = document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line");
    expect(preview?.style.opacity).toBe("0"); // 2 units: a tap-sized wiggle
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 180, clientY: 150 });
    expect(preview?.style.opacity).toBe("1");
    expect(preview?.getAttribute("points")).toBe("50.00,50.00 60.00,50.00");
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

  it("#418: the start is fixed at the press; only the end follows the finger", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 52;
    const preview = () => document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 150 });
    for (const [x, y, expected] of [
      [150, 100, "20.00,50.00 50.00,33.33"],
      [240, 200, "20.00,50.00 80.00,66.67"],
      [200, 60, "20.00,50.00 66.67,20.00"],
    ] as const) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
      expect(preview().getAttribute("points")).toBe(expected);
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 200, clientY: 60 });
    const [a, b] = (lastCommittedPath() ?? "").split(" ").map((q) => q.split(",").map(Number));
    expect(a).toEqual([20, 50]);
    expect(b[0]).toBeCloseTo(66.6667, 3);
    expect(b[1]).toBe(20);
  });

  it("#418: a drag from outside to outside across the pizza commits exactly what was shown", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 53;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -30, clientY: 90 });
    expect(document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!.style.opacity).toBe("0"); // off the pizza
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 210 });
    const shown = document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!.getAttribute("points")!;
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 210 });
    const committed = lastCommittedPath()!.split(" ").map((q) => q.split(",").map(Number));
    const shownPts = shown.split(" ").map((q) => q.split(",").map(Number));
    committed.forEach((pt, i) => {
      expect(pt[0]).toBeCloseTo(shownPts[i][0], 1);
      expect(pt[1]).toBeCloseTo(shownPts[i][1], 1);
    });
  });

  it("#418: horizontal, vertical and diagonal drags commit exactly on their axis", () => {
    render(<Harness />);
    const dough = getDough();
    for (const [id, sx, sy, ex, ey, expected] of [
      [70, 30, 120, 270, 120, "10,40 90,40"],
      [71, 190, 30, 190, 270, "x"],
      [72, 60, 60, 240, 240, "20,20 80,80"],
    ] as const) {
      fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: id, clientX: sx, clientY: sy });
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: id, clientX: ex, clientY: ey });
      fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: id, clientX: ex, clientY: ey });
      if (expected === "x") {
        const [a, b] = (lastCommittedPath() ?? "").split(" ").map((q) => q.split(",").map(Number));
        expect(a[0]).toBe(b[0]); // exactly vertical
        expect(a[0]).toBeCloseTo(63.3333, 3);
        expect([a[1], b[1]]).toEqual([10, 90]);
      } else {
        expect(lastCommittedPath()).toBe(expected);
      }
    }
  });

  it("#418: three cuts in a row -- earlier cuts never move", () => {
    render(<Harness />);
    const dough = getDough();
    const traces: string[] = [];
    for (const [id, sx, sy, ex, ey] of [
      [80, -30, 120, 330, 126],
      [81, 150, -20, 160, 330],
      [82, -20, 240, 320, 60],
    ] as const) {
      fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: id, clientX: sx, clientY: sy });
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: id, clientX: ex, clientY: ey });
      fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: id, clientX: ex, clientY: ey });
      const marks = [...document.querySelectorAll(".pizza-cut-mark")].map((m) => m.getAttribute("data-trace")!);
      expect(marks).toHaveLength(traces.length + 1);
      expect(marks.slice(0, traces.length)).toEqual(traces); // every earlier cut is byte-identical
      traces.push(marks[marks.length - 1]);
    }
    expect(document.querySelectorAll(".pizza-piece").length).toBeGreaterThanOrEqual(6);
  });

  it("#418: a rim-to-rim cut splits the pizza into pieces; nothing is drawn on the seam", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 60;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: -30, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 330, clientY: 150 });
    expect(document.querySelectorAll(".pizza-piece")).toHaveLength(2);
    const mark = document.querySelector(".pizza-cut-mark");
    expect(mark).toHaveClass("pizza-cut-mark--through");
    expect(mark?.querySelector(".pizza-cut-line")).toBeNull();
    expect(mark?.querySelector(".pizza-cut-edge--lit")).toBeNull();
    expect(document.querySelector(".pizza-pieces-shade")).toBeNull(); // no dark under-layer: that was the black line
  });

  it("#418: a partial stroke never separates: no pieces, just a groove with one lit lip", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 61;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 210, clientY: 150 });
    expect(document.querySelector(".pizza-pieces")).toBeNull();
    const mark = document.querySelector(".pizza-cut-mark");
    expect(mark).toHaveClass("pizza-cut-mark--partial");
    expect(mark?.querySelector(".pizza-cut-edge--lit")).toBeInTheDocument();
  });

  it("#418: only the newest cut carries the one-shot flash", () => {
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: -20 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 330 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 70, clientX: 150, clientY: 330 });
    let marks = document.querySelectorAll(".pizza-cut-mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].querySelector(".pizza-cut-flash")).toBeInTheDocument();

    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 71, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 71, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 71, clientX: 210, clientY: 150 });
    marks = document.querySelectorAll(".pizza-cut-mark");
    expect(marks).toHaveLength(2);
    expect(marks[0].querySelector(".pizza-cut-flash")).toBeNull(); // back to a normal cut
    expect(marks[1].querySelector(".pizza-cut-flash")).toBeInTheDocument();
  });
});
