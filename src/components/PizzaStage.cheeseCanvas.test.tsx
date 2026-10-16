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
 * #486 (T1 ported from the duplicate PR #488, now for the default-ON Canvas mozzarella): placement / BAKE / CUT / RESULT regression. The Canvas is the standard display
 * (no key stored = Canvas); the stored value "0" (`?cheeseCanvas=0`) is the M1 way back. Derived from PizzaStage.pieces.test.tsx.
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

/** CHEESE_RENDER_MODE is read once at import: load a fresh PizzaStage per stored value (null = nothing stored = the default) */
async function loadStage(stored: string | null) {
  vi.resetModules();
  if (stored === null) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, stored);
  const { resetCanvas2dProbe } = await import("./CheesePoolCanvas");
  resetCanvas2dProbe();
  return (await import("./PizzaStage")).PizzaStage;
}

type StageComponent = Awaited<ReturnType<typeof loadStage>>;
/** RESULT is the stage with no making step (as PizzaStage.pieces.test.tsx draws it); `bakeProgress: null` is the pizza before the bake (placement) */
function stage(Stage: StageComponent, state: GameState, lines: CutLine[], step: "CUT" | "RESULT", bakeProgress: number | null = state.pizza.bakeResult) {
  const makingStep = (step === "CUT" ? "CUT" : null) as unknown as GameState["makingStep"];
  return (
    <Stage
      pizza={{ ...state.pizza, doughShape: createIdealDoughShape() }}
      recipe={state.recipe}
      interactive={false}
      activeIngredient={null}
      bakeProgress={bakeProgress}
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

describe("#486: Canvas mozzarella as the default display (placement / BAKE / CUT / RESULT pieces)", () => {
  const state = bakedMargheritaAtCut();
  const lines = [through(0), through(60), through(120)];
  const mozzarellaToppings = (c: HTMLElement) => c.querySelectorAll(".pizza-topping--mozzarella").length;
  /** nothing stored = the default; "1" = a tester who opted in under T1 keeps the same display */
  const CANVAS_VALUES = [null, "1"] as const;

  it("with the stored value 0 (?cheeseCanvas=0) nothing draws a Canvas: the M1 pieces, before the bake, uncut and cut (CUT and RESULT alike)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    const Stage = await loadStage("0");
    const placed = render(stage(Stage, state, [], "RESULT", null));
    expect(placed.container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
    expect(placed.container.querySelectorAll(".pizza-cheese").length).toBeGreaterThan(0);
    cleanup();
    for (const step of ["CUT", "RESULT"] as const) {
      const { container } = render(stage(Stage, state, lines, step));
      expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      expect(container.querySelectorAll(".pizza-piece")).toHaveLength(6);
      expect(container.querySelectorAll(".pizza-cheese").length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("by default every mozzarella piece is a Canvas: placed (before the bake), baked, uncut and as a six-piece pizza; the other toppings stay as they were and the piece structure is unchanged", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    for (const stored of CANVAS_VALUES) {
      const Stage = await loadStage(stored);
      // placement (no bake yet): the raw lump, one Canvas per placed mozzarella piece, no M1 cheese left in a mozzarella piece
      const placed = render(stage(Stage, state, [], "RESULT", null));
      expect(mozzarellaToppings(placed.container)).toBeGreaterThan(0);
      expect(placed.container.querySelectorAll("canvas.pizza-cheese-canvas")).toHaveLength(mozzarellaToppings(placed.container));
      for (const el of placed.container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).toBeNull();
      cleanup();
      // baked, uncut
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
    }
  });

  it("#421 Codex P2: a cut through only the outer part of a melted Canvas pool still gives the neighbouring piece its copy (M1, drawn at the old size, keeps the default reach)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    const target = state.pizza.toppings.find((t) => t.ingredientId === "mozzarella")!;
    // a horizontal cut 12 dough-percent below the pool's centre: past the default reach (5), inside the melted pool (about 19)
    const cut = [through(0, target.y + 12 - DOUGH_CENTER)];
    const copies = (container: HTMLElement) => container.querySelectorAll(`[data-topping-id="${target.id}"]`).length;
    const M1 = await loadStage("0");
    const m1 = render(stage(M1, state, cut, "RESULT"));
    const m1Copies = copies(m1.container);
    cleanup();
    const Canvas = await loadStage(null);
    const canvas = render(stage(Canvas, state, cut, "RESULT"));
    expect(copies(canvas.container)).toBe(m1Copies + 1);
    cleanup();
  });

  it("every piece falls back to the M1 cheese when the canvases read back blank (no transparent cheese before the bake, on CUT or on RESULT)", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(blank)) as never);
    for (const stored of CANVAS_VALUES) {
      const Stage = await loadStage(stored);
      const placed = render(stage(Stage, state, [], "RESULT", null));
      expect(placed.container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      for (const el of placed.container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
      cleanup();
      for (const step of ["CUT", "RESULT"] as const) {
        const { container } = render(stage(Stage, state, lines, step));
        expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
        expect(container.querySelectorAll(".pizza-piece")).toHaveLength(6);
        for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
        cleanup();
      }
    }
  });

  it("every piece falls back to the M1 cheese when the browser gives no 2D context at all", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => null) as never);
    for (const stored of CANVAS_VALUES) {
      const Stage = await loadStage(stored);
      for (const step of ["CUT", "RESULT"] as const) {
        const { container } = render(stage(Stage, state, lines, step));
        expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
        for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
        cleanup();
      }
    }
  });

  it("every piece falls back to the M1 cheese when drawing throws (no transparent cheese, nothing thrown to the game)", async () => {
    // only the cheese canvases throw (the sauce canvases of the same stage keep a normal fake context and are not under test)
    const throwingCtx = { ...ctxOf(inked), drawImage: () => { throw new Error("draw failed"); } };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((function (this: HTMLCanvasElement) {
      return this.classList.contains("pizza-cheese-canvas") ? throwingCtx : ctxOf(inked);
    }) as never);
    const Stage = await loadStage(null);
    const { container } = render(stage(Stage, state, lines, "RESULT"));
    expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
    for (const el of container.querySelectorAll(".pizza-topping--mozzarella")) expect(el.querySelector(".pizza-cheese")).not.toBeNull();
  });

  it("only a stored 0 is M1 (the kill switch); an unknown stored value (c64, garbage) follows the default, which is Canvas", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctxOf(inked)) as never);
    for (const [stored, expectCanvas] of [["0", false], ["c64", true], ["garbage", true]] as const) {
      const Stage = await loadStage(stored);
      const { container } = render(stage(Stage, state, lines, "RESULT"));
      expect(container.querySelector("canvas.pizza-cheese-canvas") !== null).toBe(expectCanvas);
      cleanup();
    }
  });
});
