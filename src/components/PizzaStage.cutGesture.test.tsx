import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  vi.useRealTimers();
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

  it("#418: a hand-shaky stroke is committed exactly as traced (no straightening)", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 40;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 150 });
    for (const [x, y] of [[90, 153], [120, 147], [150, 154], [180, 146], [210, 152], [240, 150]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 150 });
    // Every sample stays where the finger put it: the traced path is the cut.
    const path = (lastCommittedPath() ?? "").split(" ");
    expect(path.length).toBeGreaterThan(2);
    expect(path[0]).toBe("20,50");
    expect(path).toContain("40,49");
    expect(path[path.length - 1]).toBe("80,50");
  });

  it("#418: a quick swipe keeps its samples and ends where the finger lifted", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 41;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 60, clientY: 90 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 240, clientY: 210 });
    expect(lastCommittedPath()).toBe("20,30 50,50 80,70");
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

  it("#418: a gentle arm arc over a long stroke stays an arc (the cut follows the finger)", () => {
    render(<Harness />);
    const dough = getDough();
    const pointerId = 51;
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId, clientX: 30, clientY: 150 });
    for (const [x, y] of [[90, 138], [150, 132], [210, 138]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId, clientX: x, clientY: y });
    }
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId, clientX: 270, clientY: 150 });
    expect(lastCommittedPath()).toBe("10,50 30,46 50,44 70,46 90,50");
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

  it("#418: a curved cut stays a curved groove and every cut remains drawn", () => {
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 62, clientX: 60, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 62, clientX: 150, clientY: 60 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 62, clientX: 240, clientY: 150 });
    expect(document.querySelector(".pizza-cut-mark")?.getAttribute("data-trace")).toBe("20,50 50,20 80,50");
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 63, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 63, clientX: 210, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 63, clientX: 210, clientY: 150 });
    expect(document.querySelectorAll(".pizza-cut-mark")).toHaveLength(2);
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

describe("#418 explicit straight-line assist (hold still)", () => {
  const preview = () => document.querySelector<SVGPolylineElement>(".pizza-cut-preview-line")!;
  const hold = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
  const swipe = (id: number, dough: ReturnType<typeof getDough>) => {
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: id, clientX: 60, clientY: 150 });
    for (const [x, y] of [[90, 153], [120, 147], [150, 154], [180, 146], [210, 152], [240, 150]]) {
      fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: id, clientX: x, clientY: y });
    }
  };

  it("holding still straightens the line before release; release commits exactly what is shown", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    swipe(80, dough);
    expect(preview().hasAttribute("data-straight")).toBe(false); // not yet: still the traced line
    expect(preview().getAttribute("points")!.split(" ").length).toBeGreaterThan(2);
    hold(399);
    expect(preview().hasAttribute("data-straight")).toBe(false);
    hold(1);
    expect(preview().getAttribute("data-straight")).toBe("true");
    const shown = preview().getAttribute("points");
    expect(shown).toBe("20.00,50.00 80.00,50.00"); // start -> where the finger rests
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 80, clientX: 240, clientY: 150 });
    expect(lastCommittedPath()).toBe("20,50 80,50");
  });

  it("finger wobble within the tolerance neither restarts the hold nor moves the line", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    swipe(81, dough);
    hold(200);
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 81, clientX: 242, clientY: 152 }); // ~0.9 units
    hold(200);
    expect(preview().getAttribute("data-straight")).toBe("true");
    const shown = preview().getAttribute("points"); // ends where the finger rested when it straightened
    expect(shown).toBe("20.00,50.00 80.67,50.67");
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 81, clientX: 243, clientY: 149 });
    expect(preview().getAttribute("points")).toBe(shown); // later wobble does not move the line
    // a lift that wobbled a little still commits the straight line, with no extra tail segment
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 81, clientX: 243, clientY: 149 });
    const path = (lastCommittedPath() ?? "").split(" ").map((q) => q.split(",").map(Number));
    expect(path).toHaveLength(2);
    expect(path[1][0]).toBeCloseTo(80.667, 2);
    expect(path[1][1]).toBeCloseTo(50.667, 2);
  });

  it("moving on before the hold completes means no assist (the trace is kept as drawn)", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    swipe(82, dough);
    hold(300);
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 82, clientX: 255, clientY: 150 }); // moved on: timer restarts
    hold(300);
    expect(preview().hasAttribute("data-straight")).toBe(false);
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 82, clientX: 255, clientY: 150 });
    expect((lastCommittedPath() ?? "").split(" ").length).toBeGreaterThan(2);
  });

  it("after the straightening, moving on carries the stroke on from the tip (no jump back)", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    swipe(83, dough);
    hold(400);
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 83, clientX: 270, clientY: 150 });
    expect(preview().hasAttribute("data-straight")).toBe(false);
    expect(preview().getAttribute("points")).toBe("20.00,50.00 80.00,50.00 90.00,50.00");
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 83, clientX: 270, clientY: 150 });
    expect(lastCommittedPath()).toBe("20,50 80,50 90,50");
  });

  it("a hold in a clearly curved stroke, or in a very short one, changes nothing", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 84, clientX: 60, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 84, clientX: 150, clientY: 60 });
    fireEvent.pointerMove(dough, { ...POINTER_BASE, pointerId: 84, clientX: 240, clientY: 150 });
    hold(800);
    expect(preview().hasAttribute("data-straight")).toBe(false);
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 84, clientX: 240, clientY: 150 });
    expect(lastCommittedPath()).toBe("20,50 50,20 80,50");
    cleanup();

    render(<Harness />);
    const d2 = getDough();
    fireEvent.pointerDown(d2, { ...POINTER_BASE, pointerId: 85, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(d2, { ...POINTER_BASE, pointerId: 85, clientX: 165, clientY: 150 });
    hold(800);
    expect(preview().hasAttribute("data-straight")).toBe(false);
  });

  it("a press that never moves (or a stroke that ended) starts no hold", () => {
    vi.useFakeTimers();
    render(<Harness />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER_BASE, pointerId: 86, clientX: 60, clientY: 150 });
    hold(2000);
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 86, clientX: 60, clientY: 150 });
    expect(document.querySelectorAll(".pizza-cut-mark")).toHaveLength(0);
    swipe(87, dough);
    fireEvent.pointerUp(dough, { ...POINTER_BASE, pointerId: 87, clientX: 240, clientY: 150 });
    const committed = lastCommittedPath();
    hold(2000); // nothing fires after release
    expect(lastCommittedPath()).toBe(committed);
    expect(preview().hasAttribute("data-straight")).toBe(false);
  });
});
