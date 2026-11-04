import "@testing-library/jest-dom/vitest";
import { useReducer } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act as rtlAct, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { gameReducer, type GameState, type MakingStep } from "../state/gameReducer";
import { startGuidedPrepare } from "../state/testSupport/guidedRound";
import { getIngredient } from "../data/ingredients";
import { PizzaStage } from "./PizzaStage";
import type { DoughPoint } from "../logic/pizzaCoordinates";
import { SQUEEZE_MAX_LENGTH, trailLength } from "../logic/squeeze";

/**
 * Mayo squeeze (Issue #708 / PR #716, plan A): PizzaStage's own squeeze gesture, driven through the real pointer handlers and the
 * real reducer (the CUT / dough gesture tests' Harness pattern). One traced stroke = one PLACE_TOPPING with a trail; a tap = one drop.
 */
const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
const POINTER = { isPrimary: true, pointerType: "touch" as const };

function toppingState(): GameState {
  let s = startGuidedPrepare("potato-mayo-pizza");
  for (let i = 0; i < 6 && s.makingStep !== "TOPPING"; i += 1) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  return s;
}

interface HarnessProps {
  ingredientId?: string;
  makingStep?: MakingStep;
  placeable?: boolean;
  onTapSpy?: (x: number, y: number) => void;
  onSqueezeSpy?: (x: number, y: number, trail: readonly DoughPoint[]) => void;
}

function Harness({ ingredientId = "mayo", makingStep, placeable = true, onTapSpy, onSqueezeSpy }: HarnessProps) {
  const [state, dispatch] = useReducer(gameReducer, undefined, toppingState);
  return (
    <div>
      <span data-testid="mayo-count">{state.pizza.toppings.filter((t) => t.ingredientId === "mayo").length}</span>
      <span data-testid="piece-count">{state.pizza.toppings.length}</span>
      <button type="button" data-testid="undo" onClick={() => dispatch({ type: "UNDO_LAST_PLACEMENT" })} />
      <PizzaStage
        pizza={state.pizza}
        recipe={state.recipe}
        interactive
        activeIngredient={getIngredient(ingredientId) ?? null}
        bakeProgress={null}
        placement={state.placement}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={state.makingStepToken}
        makingStep={makingStep ?? state.makingStep}
        showDoughShape
        onTap={(x, y) => {
          onTapSpy?.(x, y);
          dispatch({ type: "PLACE_TOPPING", ingredientId, x, y });
        }}
        onPlaceTrail={(trail) => {
          const mid = trail[Math.floor(trail.length / 2)];
          onSqueezeSpy?.(mid.x, mid.y, trail);
          dispatch({ type: "PLACE_TOPPING", ingredientId, x: mid.x, y: mid.y, trail });
        }}
        activeIngredientPlaceable={placeable}
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

/** The live stroke preview (the shared paint-trail path in its squeeze look) and the lines of placed pieces. */
const previewPath = () => document.querySelector<SVGPathElement>(".pizza-paint-trail__stroke--squeeze");
const placedLines = () => document.querySelectorAll("svg.pizza-squeeze-trail");

function getDough(): HTMLElement {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () => DOUGH_RECT;
  return dough;
}

/** A zigzag stroke from (90,90)px to about (210,120)px: 40% -> 70% of the dough, clearly longer than the minimum. */
function drawStroke(dough: HTMLElement, pointerId: number, end: "up" | "cancel" | "none" = "up") {
  fireEvent.pointerDown(dough, { ...POINTER, pointerId, clientX: 90, clientY: 90 });
  for (const [x, y] of [[110, 110], [130, 90], [150, 110], [170, 90], [190, 110], [210, 120]]) {
    fireEvent.pointerMove(dough, { ...POINTER, pointerId, clientX: x, clientY: y });
  }
  if (end === "up") fireEvent.pointerUp(dough, { ...POINTER, pointerId, clientX: 210, clientY: 120 });
  if (end === "cancel") fireEvent.pointerCancel(dough, { ...POINTER, pointerId, clientX: 210, clientY: 120 });
}

afterEach(() => {
  cleanup();
});

describe("PizzaStage mayo squeeze gesture (TOPPING, mayo selected)", () => {
  it("a traced stroke places ONE piece drawn as its line; the preview follows the finger and clears on release", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 1, clientX: 90, clientY: 90 });
    expect(previewPath()).not.toBeNull();
    fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: 120, clientY: 110 });
    expect(previewPath()!.getAttribute("d")).toMatch(/^M 30\.00 30\.00 L /);
    for (const [x, y] of [[150, 90], [180, 110], [210, 120]]) fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: x, clientY: y });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });

    expect(onSqueezeSpy).toHaveBeenCalledTimes(1);
    expect(onTapSpy).not.toHaveBeenCalled();
    const [, , trail] = onSqueezeSpy.mock.calls[0];
    expect(trail[0]).toEqual({ x: 30, y: 30 });
    expect(trail[trail.length - 1]).toEqual({ x: 70, y: 40 });
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
    expect(previewPath()!.getAttribute("d")).toBe("");
    expect(placedLines()).toHaveLength(1);
    expect(document.querySelector('[data-ingredient-visual="mayo-drop"]')).toBeNull(); // drawn as its line, not the fixed glyph
  });

  it("a tap places ONE drop (no line) through the ordinary tap path", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 150, clientY: 150 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).toHaveBeenCalledWith(50, 50);
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
    expect(document.querySelector('[data-ingredient-visual="mayo-drop"]')).not.toBeNull();
    expect(placedLines()).toHaveLength(0);
  });

  it("a short wiggle (under the minimum length) is a drop too", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 1, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: 160, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 160, clientY: 150 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
  });

  it("pointercancel and a lost pointer capture discard the stroke: nothing is placed", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    drawStroke(dough, 1, "cancel");
    drawStroke(dough, 2, "none");
    fireEvent.lostPointerCapture(dough, { ...POINTER, pointerId: 2 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 2, clientX: 210, clientY: 120 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("mayo-count").textContent).toBe("0");
    expect(previewPath()!.getAttribute("d")).toBe("");
  });

  it("a release the dough never sees (capture refused, finger lifted elsewhere) discards the stroke: nothing is placed, nothing is left half-drawn", () => {
    const onSqueezeSpy = vi.fn();
    render(<Harness onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    drawStroke(dough, 1, "none");
    fireEvent.pointerUp(window, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("mayo-count").textContent).toBe("0");
    expect(previewPath()!.getAttribute("d")).toBe("");
    // and the next stroke works normally
    drawStroke(dough, 2);
    expect(onSqueezeSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
  });

  it("backgrounding the app mid-stroke (blur) discards it", () => {
    const onSqueezeSpy = vi.fn();
    render(<Harness onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    drawStroke(dough, 1, "none");
    rtlAct(() => {
      window.dispatchEvent(new Event("blur"));
    });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("mayo-count").textContent).toBe("0");
  });

  it("switching to another ingredient mid-stroke discards the stroke: neither a line nor the new ingredient is placed", () => {
    const onSqueezeSpy = vi.fn();
    const onTapSpy = vi.fn();
    const { rerender } = render(<Harness onSqueezeSpy={onSqueezeSpy} onTapSpy={onTapSpy} />);
    const dough = getDough();
    drawStroke(dough, 1, "none");
    rerender(<Harness ingredientId="potato" onSqueezeSpy={onSqueezeSpy} onTapSpy={onTapSpy} />);
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("piece-count").textContent).toBe("0");
    expect(document.querySelector(".pizza-paint-trail__stroke")!.getAttribute("d")).toBe(""); // nothing left half-drawn
  });

  it("a second finger is ignored: it neither starts nor ends anything, and the first finger's stroke is placed once", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 1, clientX: 90, clientY: 90 });
    fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: 150, clientY: 110 });
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 2, isPrimary: false, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(dough, { ...POINTER, pointerId: 2, isPrimary: false, clientX: 220, clientY: 220 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 2, isPrimary: false, clientX: 220, clientY: 220 });
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 210, clientY: 120 });
    expect(onSqueezeSpy).toHaveBeenCalledTimes(1);
    expect(onTapSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
  });

  it("a stroke longer than the limit is cut at 60% of the dough diameter (57.6 dough-percent)", () => {
    const onSqueezeSpy = vi.fn();
    render(<Harness onSqueezeSpy={onSqueezeSpy} />);
    const dough = getDough();
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 1, clientX: 30, clientY: 150 });
    for (let x = 40; x <= 290; x += 10) fireEvent.pointerMove(dough, { ...POINTER, pointerId: 1, clientX: x, clientY: 150 });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 1, clientX: 290, clientY: 150 });
    const trail = onSqueezeSpy.mock.calls[0][2] as DoughPoint[];
    expect(trailLength(trail)).toBeCloseTo(SQUEEZE_MAX_LENGTH, 6);
    expect(trail[trail.length - 1].x).toBeCloseTo(10 + SQUEEZE_MAX_LENGTH, 6);
  });

  it("Undo takes back exactly the last stroke; the first line stays drawn", () => {
    render(<Harness />);
    const dough = getDough();
    drawStroke(dough, 1);
    fireEvent.pointerDown(dough, { ...POINTER, pointerId: 2, clientX: 60, clientY: 210 });
    for (const [x, y] of [[90, 200], [120, 215], [150, 200], [180, 215]]) fireEvent.pointerMove(dough, { ...POINTER, pointerId: 2, clientX: x, clientY: y });
    fireEvent.pointerUp(dough, { ...POINTER, pointerId: 2, clientX: 180, clientY: 215 });
    expect(placedLines()).toHaveLength(2);
    fireEvent.click(screen.getByTestId("undo"));
    const left = placedLines();
    expect(left).toHaveLength(1);
    expect(left[0].querySelector("path")!.getAttribute("d")!.startsWith("M 30.00 30.00")).toBe(true);
    expect(screen.getByTestId("mayo-count").textContent).toBe("1");
  });

  it("with no stock left the press is an ordinary tap (the reducer's refusal shows at once; no line is drawn first)", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness placeable={false} onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    expect(previewPath()).toBeNull(); // not in squeeze mode: the paint trail keeps its ordinary look
    const dough = getDough();
    drawStroke(dough, 1);
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).toHaveBeenCalledTimes(1);
  });

  it("every other ingredient keeps its gesture: a potato drag is still one tap at release, never a squeeze", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness ingredientId="potato" onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    expect(previewPath()).toBeNull(); // not in squeeze mode: the paint trail keeps its ordinary look
    drawStroke(getDough(), 1);
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).toHaveBeenCalledTimes(1);
    expect(onTapSpy).toHaveBeenCalledWith(70, 40);
  });

  it("outside TOPPING (e.g. FINISH) mayo keeps the tap contract", () => {
    const onTapSpy = vi.fn();
    const onSqueezeSpy = vi.fn();
    render(<Harness makingStep="FINISH" onTapSpy={onTapSpy} onSqueezeSpy={onSqueezeSpy} />);
    expect(previewPath()).toBeNull(); // not in squeeze mode: the paint trail keeps its ordinary look
    drawStroke(getDough(), 1);
    expect(onSqueezeSpy).not.toHaveBeenCalled();
    expect(onTapSpy).toHaveBeenCalledTimes(1);
  });
});
