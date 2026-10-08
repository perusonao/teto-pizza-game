import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { CutLine } from "../logic/cut/types";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #418: a pizza cut rim to rim is drawn as pieces -- every layer of the pizza body (silhouette,
 * sauce heatmap + overflow canvases, toppings, bake look) is copied per piece, clipped to the piece
 * and nudged apart, instead of one pizza with lines on it. Same structure in CUT and RESULT.
 */

const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function bakedMargheritaAtCut(): GameState {
  let state: GameState = createGuidedInitialState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  state = gameReducer(state, {
    type: "COMMIT_SAUCE_DISPENSE",
    ingredientId: "tomato-sauce",
    deposits: buildIdealMargheritaSauceFixture(),
  });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of MOZZARELLA_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of BASIL_GROUP.positions) {
    state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
  }
  state = gameReducer(state, { type: "START_BAKE" });
  state = gameReducer(state, { type: "CONFIRM_BAKE", value: 70 });
  return state;
}

function through(angleDeg: number, offset = 0): CutLine {
  const a = (angleDeg * Math.PI) / 180;
  const nx = -Math.sin(a) * offset;
  const ny = Math.cos(a) * offset;
  const start = { x: DOUGH_CENTER + nx - Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + ny - Math.sin(a) * DOUGH_RADIUS };
  const end = { x: DOUGH_CENTER + nx + Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + ny + Math.sin(a) * DOUGH_RADIUS };
  return { start, end, path: [start, end] };
}
const partial: CutLine = {
  start: { x: 2, y: 50 },
  end: { x: 98, y: 50 },
  path: [{ x: 40, y: 20 }, { x: 55, y: 35 }],
};

function stage(state: GameState, lines: CutLine[], makingStep: GameState["makingStep"]) {
  return (
    <PizzaStage
      pizza={{ ...state.pizza, doughShape: createIdealDoughShape() }} // a finished dough, as in a real CUT
      recipe={state.recipe}
      interactive={false}
      activeIngredient={null}
      bakeProgress={state.pizza.bakeResult}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={state.makingStepToken}
      makingStep={makingStep}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={{ ...state.cutState, lines }}
      onAddCutLine={() => {}}
    />
  );
}

afterEach(() => cleanup());

describe("PizzaStage cut pieces", () => {
  const state = bakedMargheritaAtCut();
  const toppingCount = state.pizza.toppings.length;

  it("a cut that ends within the crust width of the edge parts the pizza; one that stops further in does not", () => {
    const nearlyThrough: CutLine = { start: { x: 8, y: 50 }, end: { x: 92, y: 50 }, path: [{ x: 8, y: 50 }, { x: 92, y: 50 }] }; // r = 42
    const clearlyPartial: CutLine = { start: { x: 14, y: 50 }, end: { x: 86, y: 50 }, path: [{ x: 14, y: 50 }, { x: 86, y: 50 }] }; // r = 36
    const a = render(stage(state, [nearlyThrough], "CUT"));
    expect(a.container.querySelectorAll(".pizza-piece")).toHaveLength(2);
    cleanup();
    const b = render(stage(state, [clearlyPartial], "CUT"));
    expect(b.container.querySelector(".pizza-pieces")).toBeNull();
    expect(b.container.querySelector(".pizza-cut-guide-lines")).toBeInTheDocument(); // no cut has parted it: guide stays
  });

  it("an uncut pizza (or only partial strokes) is rendered as one body, as before", () => {
    const { container, rerender } = render(stage(state, [], "CUT"));
    expect(container.querySelector(".pizza-pieces")).toBeNull();
    expect(container.querySelectorAll(".pizza-dough-shape")).toHaveLength(1);
    expect(container.querySelectorAll(".pizza-topping")).toHaveLength(toppingCount);
    rerender(stage(state, [partial], "CUT"));
    expect(container.querySelector(".pizza-pieces")).toBeNull();
    expect(container.querySelectorAll(".pizza-dough-shape")).toHaveLength(1);
  });

  it("three through cuts make six pieces, each a full copy of the body, pushed ~1.5px apart", () => {
    const lines = [through(0), through(60), through(120)];
    const { container } = render(stage(state, lines, "CUT"));
    const pieces = container.querySelectorAll<HTMLElement>(".pizza-piece");
    expect(pieces).toHaveLength(6);
    // every layer of the body is in every piece, including both sauce canvases (none is lost)
    expect(container.querySelectorAll(".pizza-dough-shape")).toHaveLength(6);
    expect(container.querySelectorAll(".pizza-sauce-heatmap")).toHaveLength(12);
    // nested clips: one per cut, per piece
    expect(container.querySelectorAll(".pizza-piece-clip")).toHaveLength(18);
    const offsets = [...pieces].map((p) => p.style.transform);
    for (const t of offsets) {
      const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(t)!;
      expect(Math.hypot(Number(m[1]), Number(m[2]))).toBeCloseTo(1.5, 1);
    }
    expect(new Set(offsets).size).toBe(6);
    // the unsplit pizza is not left behind the pieces to fill the gaps
    expect(container.querySelectorAll(".pizza-dough > .pizza-dough-shape")).toHaveLength(0);
  });

  it("each topping is whole in exactly one piece; a topping a cut slices also shows its part in the neighbour", () => {
    const lines = [through(0), through(90)];
    const { container } = render(stage(state, lines, "CUT"));
    expect(container.querySelectorAll(".pizza-topping")).toHaveLength(toppingCount);
    const ids = [...container.querySelectorAll(".pizza-topping")].map((e) => e.getAttribute("data-topping-id"));
    expect(new Set(ids).size).toBe(toppingCount);
    // a cut straight through the middle slices at least one of the reference toppings there
    expect(container.querySelectorAll(".pizza-topping-half").length).toBeGreaterThan(0);
  });

  it("CUT and RESULT draw the same pieces; cuts and the partial groove stay, the flash and guides do not", () => {
    const lines = [through(0), partial, through(90, 5)];
    const inCut = render(stage(state, lines, "CUT"));
    expect(inCut.container.querySelectorAll(".pizza-piece")).toHaveLength(4);
    expect(inCut.container.querySelector(".pizza-cut-flash")).toBeInTheDocument();
    expect(inCut.container.querySelector(".pizza-cut-guide-lines")).toBeNull(); // parted: the angle guide is gone
    cleanup();

    const inResult = render(stage(state, lines, null as unknown as GameState["makingStep"]));
    expect(inResult.container.querySelectorAll(".pizza-piece")).toHaveLength(4);
    expect(inResult.container.querySelectorAll(".pizza-cut-mark--through")).toHaveLength(2);
    expect(inResult.container.querySelector(".pizza-pieces-shade")).toBeNull();
    expect(inResult.container.querySelectorAll(".pizza-cut-mark--through .pizza-cut-line")).toHaveLength(0);
    expect(inResult.container.querySelectorAll(".pizza-cut-mark--partial")).toHaveLength(1); // the miss stays
    expect(inResult.container.querySelector(".pizza-cut-flash")).toBeNull();
    expect(inResult.container.querySelector(".pizza-cut-guide-lines")).toBeNull();
    expect(inResult.container.querySelector(".pizza-cut-hit-zone")).toBeNull();
  });
});
