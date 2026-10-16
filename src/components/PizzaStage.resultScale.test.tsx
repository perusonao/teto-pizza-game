import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { buildIdealMargheritaSauceFixture, MARGHERITA_REFERENCE } from "../data/referencePizza";
import { createIdealDoughShape } from "../logic/doughShape";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../logic/pizzaCoordinates";
import type { CutLine } from "../logic/cut/types";
import { computePieceLayout, distanceToConvexPolygon } from "../logic/cut/pieces";
import { toppingFootprintRadiusPercent } from "../logic/cut/toppingFootprint";
import { toppingRankScale } from "../data/toppingSizeClass";
import { resetPreviewResultScaleForTest, RESULT_TOPPING_SCALE } from "../preview/resultScalePreview";
import { PizzaStage } from "./PizzaStage";

/**
 * #514: the RESULT-only topping scale (production 0.75; `?resultScale=` in Preview / DEV compares others) shrinks the toppings drawn on the RESULT's pizza AND the S3 footprint that
 * decides which cut pieces get a sliced copy -- the same multiplier for both. Vitest runs with `import.meta.env.DEV`, so the query is honoured here.
 */
const [MOZZARELLA_GROUP, BASIL_GROUP] = MARGHERITA_REFERENCE.pieceGroups;

function baked(): GameState {
  let state: GameState = createGuidedInitialState();
  state = gameReducer(state, { type: "BEGIN_PREPARE" });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  state = gameReducer(state, { type: "COMMIT_SAUCE_DISPENSE", ingredientId: "tomato-sauce", deposits: buildIdealMargheritaSauceFixture() });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of MOZZARELLA_GROUP.positions) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "mozzarella", x: p.x, y: p.y });
  state = gameReducer(state, { type: "CONFIRM_MAKING_STEP" });
  for (const p of BASIL_GROUP.positions) state = gameReducer(state, { type: "PLACE_TOPPING", ingredientId: "basil", x: p.x, y: p.y });
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

function stage(state: GameState, lines: CutLine[], resultCompact: boolean) {
  return (
    <PizzaStage
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
      makingStep={resultCompact ? (null as unknown as GameState["makingStep"]) : "CUT"}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={{ ...state.cutState, lines }}
      onAddCutLine={() => {}}
      resultCompact={resultCompact}
    />
  );
}

const DOUGH_PX = 196;
function atDoughWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({ width, height: width, top: 0, left: 0, right: width, bottom: width, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}
function setQuery(search: string) {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewResultScaleForTest();
}
const withTopping = (state: GameState, toppings: GameState["pizza"]["toppings"]): GameState => ({ ...state, pizza: { ...state.pizza, toppings } });
const copiesOf = (container: HTMLElement, id: string) => container.querySelectorAll(`.pizza-topping-half[data-topping-id="${id}"]`).length;

beforeEach(() => atDoughWidth(DOUGH_PX));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  setQuery("");
});

describe("RESULT topping scale: production default (0.75)", () => {
  const phase = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".pizza-topping, .pizza-topping-half")].map((el) => el.style.getPropertyValue("--piece-phase-scale"));

  it("is 0.75 and, with no query, sets it on the RESULT's pieces (never on the mozzarella)", () => {
    expect(RESULT_TOPPING_SCALE).toBe(0.75);
    const state = withTopping(baked(), [
      { id: "basil-1", ingredientId: "basil", x: DOUGH_CENTER, y: DOUGH_CENTER + 6 },
      { id: "moz-1", ingredientId: "mozzarella", x: 30, y: 30 },
    ]);
    const { container } = render(stage(state, [through(0)], true));
    for (const el of container.querySelectorAll<HTMLElement>('[data-topping-id="basil-1"]')) expect(el.style.getPropertyValue("--piece-phase-scale")).toBe("0.75");
    for (const el of container.querySelectorAll<HTMLElement>('[data-topping-id="moz-1"]')) expect(el.style.getPropertyValue("--piece-phase-scale")).toBe("");
  });

  it("the CUT screen and every other stage are not scaled (no variable)", () => {
    const { container } = render(stage(baked(), [through(0)], false));
    expect(container.querySelectorAll(".pizza-topping").length).toBeGreaterThan(0);
    expect(phase(container).every((v) => v === "")).toBe(true);
  });

  it("?resultScale=1.0 (Preview) shows the old size: no variable", () => {
    setQuery("?resultScale=1.0");
    const { container } = render(stage(baked(), [through(0)], true));
    expect(phase(container).every((v) => v === "")).toBe(true);
  });
});

describe("RESULT topping scale: the Preview switch", () => {
  it("?resultScale=0.75 sets the variable on the RESULT's basil whole and sliced pieces, never on the mozzarella", () => {
    setQuery("?resultScale=0.75");
    const state = withTopping(baked(), [
      { id: "basil-1", ingredientId: "basil", x: DOUGH_CENTER, y: DOUGH_CENTER + 6 },
      { id: "moz-1", ingredientId: "mozzarella", x: 30, y: 30 },
    ]);
    const { container } = render(stage(state, [through(0)], true));
    const basil = container.querySelectorAll<HTMLElement>('[data-topping-id="basil-1"]');
    expect(basil.length).toBeGreaterThanOrEqual(2); // whole + the sliced part
    for (const el of basil) expect(el.style.getPropertyValue("--piece-phase-scale")).toBe("0.75");
    for (const el of container.querySelectorAll<HTMLElement>('[data-topping-id="moz-1"]')) expect(el.style.getPropertyValue("--piece-phase-scale")).toBe("");
  });

  it("the CUT screen (not resultCompact) is not scaled by the switch", () => {
    setQuery("?resultScale=0.65");
    const { container } = render(stage(baked(), [through(0)], false));
    for (const el of container.querySelectorAll<HTMLElement>(".pizza-topping, .pizza-topping-half")) expect(el.style.getPropertyValue("--piece-phase-scale")).toBe("");
  });

  it("only the four candidates are honoured: 0.7 / 2 / repeated / junk leave the RESULT at the production 0.75", () => {
    for (const q of ["?resultScale=0.7", "?resultScale=2", "?resultScale=0.75&resultScale=0.65", "?resultScale=abc", "?resultScale="]) {
      setQuery(q);
      const { container } = render(stage(withTopping(baked(), [{ id: "basil-1", ingredientId: "basil", x: DOUGH_CENTER, y: DOUGH_CENTER + 6 }]), [through(0)], true));
      for (const el of container.querySelectorAll<HTMLElement>('[data-topping-id="basil-1"]')) expect(el.style.getPropertyValue("--piece-phase-scale"), q).toBe("0.75");
      cleanup();
    }
  });
});

/** the footprint the stage must use for a basil on the RESULT at scale `s`, and the pieces (other than its own) that touch it, computed from the exact piece outlines */
function expectedCopies(lines: CutLine[], x: number, y: number, s: number): number {
  const layout = computePieceLayout(lines, createIdealDoughShape())!;
  const r = toppingFootprintRadiusPercent(toppingRankScale("basil") * s, DOUGH_PX);
  const touched = layout.pieces.filter((p) => distanceToConvexPolygon(x, y, p.polygon!) <= r).length;
  return Math.max(0, touched - 1);
}

describe("RESULT topping scale: the S3 footprint follows the same multiplier", () => {
  const cases: { name: string; lines: CutLine[]; at: (t: number) => { x: number; y: number } }[] = [
    { name: "a straight cut through the centre", lines: [through(0)], at: (t) => ({ x: DOUGH_CENTER, y: DOUGH_CENTER + t }) },
    {
      name: "an oblique cut (22.5 degrees)",
      lines: [through(22.5)],
      at: (t) => ({ x: DOUGH_CENTER - Math.sin((22.5 * Math.PI) / 180) * t, y: DOUGH_CENTER + Math.cos((22.5 * Math.PI) / 180) * t }),
    },
    { name: "the game's three cuts (0 / 60 / 120)", lines: [through(0), through(60), through(120)], at: (t) => ({ x: DOUGH_CENTER + 20, y: DOUGH_CENTER + t }) },
    { name: "a thin wedge (two cuts 20 degrees apart)", lines: [through(0), through(20)], at: (t) => ({ x: DOUGH_CENTER + 30, y: DOUGH_CENTER + 5 + t * 0.4 }) },
  ];

  for (const c of cases) {
    it(`${c.name}: the copies drawn equal the exact intersection at 1.0 / 0.85 / 0.75 / 0.65, and never grow as the scale shrinks`, () => {
      const distances = [0, 4, 8, 11, 14, 17, 20, 24];
      for (const t of distances) {
        const p = c.at(t);
        const counts = [1, 0.85, 0.75, 0.65].map((s) => {
          setQuery(`?resultScale=${s}`);
          const { container } = render(stage(withTopping(baked(), [{ id: "basil-1", ingredientId: "basil", x: p.x, y: p.y }]), c.lines, true));
          const n = copiesOf(container, "basil-1");
          cleanup();
          expect(n, `${c.name} t=${t} scale=${s}`).toBe(expectedCopies(c.lines, p.x, p.y, s));
          return n;
        });
        for (let i = 1; i < counts.length; i++) expect(counts[i], `${c.name} t=${t}`).toBeLessThanOrEqual(counts[i - 1]);
      }
    });
  }

  it("the scale really changes the outcome somewhere (a basil sliced at 1.0 that 0.65 leaves whole), so the test above is not vacuous", () => {
    const lines = [through(0)];
    const hits = [10, 12, 14, 16, 18, 20].filter((t) => expectedCopies(lines, DOUGH_CENTER, DOUGH_CENTER + t, 1) > expectedCopies(lines, DOUGH_CENTER, DOUGH_CENTER + t, 0.65));
    expect(hits.length).toBeGreaterThan(0);
  });

  it("an unnecessary copy is never made: a basil beyond its scaled footprint stays whole", () => {
    setQuery("?resultScale=0.65");
    const { container } = render(stage(withTopping(baked(), [{ id: "basil-1", ingredientId: "basil", x: DOUGH_CENTER, y: DOUGH_CENTER + 24 }]), [through(0)], true));
    expect(copiesOf(container, "basil-1")).toBe(0);
    expect(container.querySelectorAll('.pizza-topping[data-topping-id="basil-1"]')).toHaveLength(1);
  });
});

describe("the dough is measured again when the stage becomes the RESULT's (#514)", () => {
  it("a basil 14% from a cut is sliced once the stage is resultCompact at 196px, though it was measured at the CUT width first", () => {
    const state = withTopping(baked(), [{ id: "basil-1", ingredientId: "basil", x: DOUGH_CENTER, y: DOUGH_CENTER + 14 }]);
    let width = 328;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ width, height: width, top: 0, left: 0, right: width, bottom: width, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    );
    setQuery("?resultScale=1.0");
    const { container, rerender } = render(stage(state, [through(0)], false));
    expect(copiesOf(container, "basil-1")).toBe(0); // 14% is past the CUT screen's footprint (~12% of the 308px inside a 328px dough)
    width = 196; // the layout changes with the class; no ResizeObserver event in jsdom
    rerender(stage(state, [through(0)], true));
    expect(copiesOf(container, "basil-1")).toBe(1);
  });
});
