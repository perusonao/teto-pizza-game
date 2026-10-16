import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { GameState } from "../state/gameReducer";
import type { PlacedTopping } from "../state/pizzaState";
import { createGuidedInitialState } from "../state/testSupport/guidedRound";
import { createIdealDoughShape } from "../logic/doughShape";
import { resetPreviewToppingScaleForTest } from "../preview/toppingScalePreview";
import { TOPPING_SIZE_SCALE_CANDIDATES, toppingRankScale, toppingSizeClass } from "../data/toppingSizeClass";
import { renderPizzaVisualPieces } from "./PizzaVisualPieces";

/**
 * Issue #479 S2b-1: with the Preview / DEV switch `?toppingScale=a|b`, the six pilot ingredients carry their class multiplier on EVERY on-pizza route
 * (PizzaStage whole spans, Reference wrappers) and the Canvas mozzarella box is `Math.round(70 x multiplier)` px with its bitmap untouched. Without the
 * switch nothing differs from S2a (see ./pieceRankScale.test.tsx).
 */

const PILOT = ["corn", "black-olive", "mushroom", "mozzarella", "bacon", "basil"] as const;
const KEY = "teto-pizza-cheese-canvas";

const toppings: PlacedTopping[] = PILOT.map((ingredientId, i) => ({ id: `t${i}`, ingredientId, x: 30 + (i % 3) * 20, y: 35 + Math.floor(i / 3) * 25 }));

const inked = () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) });
const ctx = () => ({
  createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
  putImageData: vi.fn(),
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: inked,
});

/** a fresh PizzaStage (the Canvas mode and the page-load switch are read at import) for a URL query */
async function stageFor(search: string, canvas: "default" | "m1") {
  window.history.replaceState(null, "", `/${search}`);
  resetPreviewToppingScaleForTest();
  vi.resetModules();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => ctx()) as never);
  if (canvas === "m1") localStorage.setItem(KEY, "0");
  else localStorage.removeItem(KEY);
  const { resetCanvas2dProbe } = await import("./CheesePoolCanvas");
  resetCanvas2dProbe();
  const { resetPreviewToppingScaleForTest: reset } = await import("../preview/toppingScalePreview");
  reset();
  const { PizzaStage } = await import("./PizzaStage");
  const state: GameState = createGuidedInitialState();
  return (
    <PizzaStage
      pizza={{ ...state.pizza, toppings, doughShape: createIdealDoughShape() }}
      recipe={state.recipe}
      interactive={false}
      activeIngredient={null}
      bakeProgress={null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={state.makingStepToken}
      makingStep={null as unknown as GameState["makingStep"]}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={state.cutState}
      onAddCutLine={() => {}}
    />
  );
}

const rankOf = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`.pizza-topping--${id}`)?.style.getPropertyValue("--piece-rank-scale");

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(KEY);
  window.history.replaceState(null, "", "/");
  resetPreviewToppingScaleForTest();
});

describe("PizzaStage with ?toppingScale", () => {
  it("no switch: the six pilot ingredients carry the production value (set B; mozzarella 1)", async () => {
    const { container } = render(await stageFor("", "default"));
    for (const id of PILOT) expect(rankOf(container, id), id).toBe(String(toppingRankScale(id)));
    expect(PILOT.map((id) => rankOf(container, id))).toEqual(["0.7", "0.85", "1", "1", "1.15", "1.3"]);
  });

  it("?toppingScale=c: the corrected ids carry B x correction on the placed piece; the rest equal B", async () => {
    const extra: PlacedTopping[] = ["black-olive", "pepperoni", "bacon", "spinach", "mushroom"].map((ingredientId, i) => ({ id: `c${i}`, ingredientId, x: 30 + i * 8, y: 70 }));
    window.history.replaceState(null, "", "/?toppingScale=c");
    const element = await stageFor("?toppingScale=c", "default");
    const { container } = render(element);
    // the stage under test holds the PILOT toppings; render the extra ids through the Reference route, which shares the same helper
    window.history.replaceState(null, "", "/?toppingScale=c");
    vi.resetModules();
    const { renderPizzaVisualPieces: fresh } = await import("./PizzaVisualPieces");
    const ref = render(<div>{fresh({ pieceGroups: extra.map((t) => ({ ingredientId: t.ingredientId, positions: [{ x: t.x, y: t.y }] })), wrapperClassName: (id) => `w w--${id}` })}</div>);
    const v = (id: string) => ref.container.querySelector<HTMLElement>(`.w--${id}`)!.style.getPropertyValue("--piece-rank-scale");
    expect([v("black-olive"), v("pepperoni"), v("bacon"), v("spinach"), v("mushroom")]).toEqual(["0.722", "0.9", "1.265", "1.43", "1"]);
    expect(rankOf(container, "mozzarella")).toBe("1");
    expect(rankOf(container, "basil")).toBe("1.3");
  });

  for (const [query, key] of [["a", "A"], ["b", "B"]] as const) {
    it(`?toppingScale=${query}: each pilot piece carries the ${key} multiplier of its class`, async () => {
      const { container } = render(await stageFor(`?toppingScale=${query}`, "default"));
      const set = TOPPING_SIZE_SCALE_CANDIDATES[key];
      for (const id of PILOT) expect(Number(rankOf(container, id)), `${key} ${id}`).toBe(id === "mozzarella" ? 1 : set[toppingSizeClass(id)]);
    });

    it(`?toppingScale=${query}: the Canvas mozzarella box stays 70px (exempt), the bitmap grid and aspect are unchanged`, async () => {
      const { container } = render(await stageFor(`?toppingScale=${query}`, "default"));
      const canvas = container.querySelector<HTMLCanvasElement>(".pizza-topping--mozzarella canvas.pizza-cheese-canvas");
      expect(canvas).not.toBeNull();
      expect(canvas!.style.getPropertyValue("--cheese-canvas-size")).toBe("70px");
      expect(canvas!.width).toBe(canvas!.height);
      expect(canvas!.width).toBe(64);
    });

    it(`?toppingScale=${query}: the M1 fallback mozzarella (?cheeseCanvas=0) is rank 1 too`, async () => {
      const { container } = render(await stageFor(`?toppingScale=${query}`, "m1"));
      expect(container.querySelector("canvas.pizza-cheese-canvas")).toBeNull();
      expect(Number(rankOf(container, "mozzarella"))).toBe(1);
      expect(container.querySelector(".pizza-topping--mozzarella .pizza-cheese")).not.toBeNull();
    });
  }

  it("the Canvas box with no switch stays exactly 70px (production: mozzarella size unchanged by S2c)", async () => {
    const { container } = render(await stageFor("", "default"));
    expect(container.querySelector<HTMLCanvasElement>("canvas.pizza-cheese-canvas")!.style.getPropertyValue("--cheese-canvas-size")).toBe("70px");
  });
});

describe("Reference views follow the same switch", () => {
  const groups = PILOT.map((ingredientId, i) => ({ ingredientId, positions: [{ x: 30 + i * 8, y: 50 }] }));

  it("renderPizzaVisualPieces wrappers carry the same value PizzaStage uses for the same ingredient", async () => {
    window.history.replaceState(null, "", "/?toppingScale=a");
    vi.resetModules();
    const { renderPizzaVisualPieces: fresh } = await import("./PizzaVisualPieces");
    const { container } = render(<div>{fresh({ pieceGroups: groups, wrapperClassName: (id) => `w w--${id}` })}</div>);
    for (const id of PILOT) {
      expect(Number(container.querySelector<HTMLElement>(`.w--${id}`)!.style.getPropertyValue("--piece-rank-scale")), id).toBe(
        id === "mozzarella" ? 1 : TOPPING_SIZE_SCALE_CANDIDATES.A[toppingSizeClass(id)],
      );
    }
  });

  it("without the switch the wrappers carry the production value (B; mozzarella 1)", () => {
    window.history.replaceState(null, "", "/");
    resetPreviewToppingScaleForTest();
    const { container } = render(<div>{renderPizzaVisualPieces({ pieceGroups: groups, wrapperClassName: () => "w" })}</div>);
    [...container.querySelectorAll<HTMLElement>(".w")].forEach((w, i) => expect(w.style.getPropertyValue("--piece-rank-scale"), PILOT[i]).toBe(String(toppingRankScale(PILOT[i]))));
  });
});
