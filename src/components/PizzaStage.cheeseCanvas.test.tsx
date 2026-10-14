import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { CutLine } from "../logic/cut/types";

/**
 * #486 T1 (ported from the duplicate PR #488): CUT / RESULT regression for the Canvas mozzarella opt-in (plan B; this PR's key value is "1"). Derived from PizzaStage.pieces.test.tsx.
 * Issue #418 (original note): a pizza cut rim to rim is drawn as pieces -- every layer of the pizza body (silhouette,
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


const KEY = "teto-pizza-cheese-canvas";
const inked = () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) });
const blank = () => ({ data: new Uint8ClampedArray(64 * 64 * 4) });
const ctxOf = (readBack: () => unknown) => ({
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  putImageData: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: readBack,
});

/** CHEESE_RENDER_MODE is read once at import: load a fresh PizzaStage per opt-in value */
async function loadStage(optIn: string | null) {
  vi.resetModules();
  if (optIn === null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, optIn);
  const { resetCanvas2dProbe } = await import("./CheesePoolCanvas");
  resetCanvas2dProbe();
  return (await import("./PizzaStage")).PizzaStage;
}

type StageComponent = Awaited<ReturnType<typeof loadStage>>;
/** RESULT is the stage with no making step (as PizzaStage.pieces.test.tsx draws it) */
function stage(Stage: StageComponent, state: GameState, lines: CutLine[], step: "CUT" | "RESULT") {
  const makingStep = (step === "CUT" ? "CUT" : null) as unknown as GameState["makingStep"];
  return (
    <Stage
      pizza={{ ...state.pizza, doughShape: createIdealDoughShape() }}
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

const mozzarellaPieces = (c: HTMLElement) => c.querySelectorAll(".pizza-topping--mozzarella, .pizza-topping-half[data-topping-id]");

beforeEach(() => {
  localStorage.removeItem(KEY);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(KEY);
});

describe("#486 T1: Canvas mozzarella opt-in on CUT / RESULT pieces", () => {
  const state = bakedMargheritaAtCut();
  const lines = [through(0), through(60), through(120)];
  const mozzarellaToppings = (c: HTMLElement) => c.querySelectorAll(".pizza-topping--mozzarella").length;

  it("without the opt-in key nothing draws a Canvas: the M1 pieces, uncut and cut (CUT and RESULT alike)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    const Stage = await loadStage(null);
    for (const step of ["CUT", "RESULT"] as const) {
      const { container } = render(stage(Stage, state, lines, step));
      expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      expect(container.querySelectorAll(".pizza-piece")).toHaveLength(6);
      expect(container.querySelectorAll(".pizza-cheese").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("with the opt-in, every mozzarella piece of an uncut and of a six-piece pizza is a Canvas, the other toppings stay as they were, and the piece structure is unchanged", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    const Stage = await loadStage("1");
    const uncut = render(stage(Stage, state, [], "CUT"));
    expect(mozzarellaToppings(uncut.container)).toBeGreaterThan(0);
    expect(uncut.container.querySelectorAll("canvas.pizza-cheese-canvas")).toHaveLength(mozzarellaToppings(uncut.container));
    expect(uncut.container.querySelectorAll(".pizza-topping")).toHaveLength(state.pizza.toppings.length);
    cleanup();
    for (const step of ["CUT", "RESULT"] as const) {
      const { container } = render(stage(Stage, state, lines, step));
      expect(container.querySelectorAll(".pizza-piece")).toHaveLength(6);
      expect(container.querySelectorAll(".pizza-topping")).toHaveLength(state.pizza.toppings.length);
      // one Canvas per mozzarella piece of the pizza, none for basil, and no leftover M1 cheese span inside a mozzarella piece
      expect(container.querySelectorAll("canvas.pizza-cheese-canvas")).toHaveLength(mozzarellaPieces(container).length);
      expect(container.querySelectorAll(".pizza-topping--basil canvas")).toHaveLength(0);
      for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).toBeNull();
      cleanup();
    }
  });

  it("every piece falls back to the M1 cheese when the canvases read back blank (no transparent cheese on CUT / RESULT)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(blank)) as never);
    const Stage = await loadStage("1");
    for (const step of ["CUT", "RESULT"] as const) {
      const { container } = render(stage(Stage, state, lines, step));
      expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      expect(container.querySelectorAll(".pizza-piece")).toHaveLength(6);
      for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
      cleanup();
    }
  });

  it("every piece falls back to the M1 cheese when the browser gives no 2D context at all", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => null) as never);
    const Stage = await loadStage("1");
    const { container } = render(stage(Stage, state, lines, "RESULT"));
    expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
    for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
  });

  it("a stored value other than 1 (0, c64, anything else) is M1; the kill switch is deleting the key", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    for (const v of ["0", "c64", "garbage"]) {
      const Stage = await loadStage(v);
      const { container } = render(stage(Stage, state, lines, "RESULT"));
      expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      cleanup();
    }
  });
});
