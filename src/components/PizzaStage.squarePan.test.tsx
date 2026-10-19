import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createInitialSquareDough } from "../logic/pan/squareDough";
import type { MakingStep } from "../state/gameReducer";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";

/**
 * Square-Pan Dough D2-a2 (#537): PizzaStage on a square pan, DOUGH..RESULT. The pan comes from the pizza's explicit `pan: "tray"` (F4-a
 * `effectivePanShape`); a pizza with no `pan` is the round pizza, and everything below must then be exactly what it has always been.
 */
const RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;

function pizzaOf(pan: "tray" | null, withSauce = true): PizzaState {
  const base = createEmptyPizza();
  const pizza: PizzaState = withSauce
    ? { ...base, sauceIds: ["tomato-sauce"], sauceDeposits: [{ x: 50, y: 50, amount: 0.4 } satisfies SauceDeposit] }
    : base;
  return pan === "tray" ? { ...pizza, pan: "tray" } : pizza;
}

interface Extra {
  makingStep?: MakingStep;
  ingredient?: string;
  bakeProgress?: number | null;
  resultCompact?: boolean;
  resultRevealed?: boolean;
  squareDough?: boolean;
  onTap?: (x: number, y: number) => void;
  onDispenseProgress?: (deposits: readonly SauceDeposit[]) => void;
  onDispenseCommit?: (id: string, deposits: SauceDeposit[]) => void;
}

function renderStage(pizza: PizzaState, extra: Extra = {}) {
  return render(
    <PizzaStage
      pizza={pizza}
      recipe={getRecipe("margherita")!}
      interactive
      activeIngredient={getIngredient(extra.ingredient ?? "tomato-sauce")!}
      bakeProgress={extra.bakeProgress ?? null}
      placement={null}
      resultRevealed={extra.resultRevealed ?? false}
      referenceModeEnabled
      resetToken={0}
      makingStepToken={0}
      makingStep={extra.makingStep ?? "SAUCE"}
      showDoughShape
      resultCompact={extra.resultCompact}
      squareDough={extra.squareDough ? { dough: createInitialSquareDough(), onCommit: () => {} } : undefined}
      onTap={extra.onTap ?? (() => {})}
      onDispenseProgress={extra.onDispenseProgress ?? (() => {})}
      onDispenseCommit={extra.onDispenseCommit ?? (() => {})}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={{ lines: [] } as never}
      onAddCutLine={() => {}}
    />,
  );
}

const dough = () => document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]')!;
function press(x: number, y: number) {
  const el = dough();
  el.getBoundingClientRect = () => RECT;
  const point = { clientX: (x / 100) * 300, clientY: (y / 100) * 300 };
  fireEvent.pointerDown(el, { pointerId: 1, isPrimary: true, pointerType: "touch", ...point });
  fireEvent.pointerUp(el, { pointerId: 1, isPrimary: true, pointerType: "touch", ...point });
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PizzaStage surface", () => {
  it("a round pizza is untouched: the round dough shape, the round guide, no square class anywhere", () => {
    const { container } = renderStage(pizzaOf(null));
    expect(dough()).toHaveClass("pizza-dough--has-shape-layer");
    expect(container.querySelector(".pizza-dough-shape")).not.toBeNull();
    expect(container.querySelector(".sauce-target-guide circle")).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/square/);
  });

  it.each<[string, Extra]>([
    ["SAUCE", { makingStep: "SAUCE" }],
    ["CHEESE", { makingStep: "CHEESE", ingredient: "mozzarella" }],
    ["TOPPING", { makingStep: "TOPPING", ingredient: "basil" }],
    ["BAKE", { makingStep: "BAKE", bakeProgress: 50 }],
    ["RESULT", { makingStep: "BAKE", bakeProgress: 50, resultCompact: true, resultRevealed: true }],
  ])("a tray pizza at %s shows the pan's plate and never the round dough shape", (_label, extra) => {
    const { container } = renderStage(pizzaOf("tray"), extra);
    expect(dough()).toHaveClass("pizza-dough--square-pan");
    expect(dough()).not.toHaveClass("pizza-dough--has-shape-layer");
    expect(container.querySelector(".pizza-dough-shape")).toBeNull();
    expect(container.querySelector(".pizza-dough-square")).not.toBeNull();
  });

  it("while the square layer is up (DOUGH) it paints the sheet: no plate, still no round shape", () => {
    const { container } = renderStage(pizzaOf("tray", false), { makingStep: "DOUGH", squareDough: true });
    expect(container.querySelector('[data-testid="square-dough-layer"]')).not.toBeNull();
    expect(container.querySelector(".pizza-dough-square")).toBeNull();
    expect(container.querySelector(".pizza-dough-shape")).toBeNull();
    expect(container.querySelector(".dough-target-guide")).toBeNull();
  });

  it("the sauce guide is the square region, not the round ring", () => {
    const { container } = renderStage(pizzaOf("tray"));
    expect(container.querySelector("svg.square-target-guide rect")).not.toBeNull();
    expect(container.querySelector(".sauce-target-guide")).toBeNull();
  });

  it("the heatmap canvases are clipped to the pan, the overflow markers are not (they live off it)", () => {
    const { container } = renderStage(pizzaOf("tray"));
    const canvases = [...container.querySelectorAll("canvas.pizza-sauce-heatmap")];
    expect(canvases.length).toBeGreaterThan(1);
    const clipped = canvases.filter((c) => c.classList.contains("square-sauce-canvas"));
    expect(clipped.length).toBe(1);
    const round = renderStage(pizzaOf(null));
    expect(round.container.querySelectorAll("canvas.square-sauce-canvas").length).toBe(0);
  });

  it("the explicit pan is what decides: no pan key on the pizza keeps a round pizza round", () => {
    const { container } = renderStage({ ...pizzaOf(null) });
    expect(dough()).not.toHaveClass("pizza-dough--square-pan");
    expect(container.querySelector(".pizza-dough-square")).toBeNull();
  });
});

describe("PizzaStage input on the pan", () => {
  it("a press at the pan's corner places a piece; the same press on a round pizza is outside the dough", () => {
    const onTap = vi.fn();
    renderStage(pizzaOf("tray"), { makingStep: "CHEESE", ingredient: "mozzarella", onTap });
    press(10, 10);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap.mock.calls[0][0]).toBeCloseTo(10, 5);
    cleanup();
    const onTapRound = vi.fn();
    renderStage(pizzaOf(null), { makingStep: "CHEESE", ingredient: "mozzarella", onTap: onTapRound });
    press(10, 10);
    expect(onTapRound).not.toHaveBeenCalled();
  });

  it("a press just past the pan's edge places nothing", () => {
    const onTap = vi.fn();
    renderStage(pizzaOf("tray"), { makingStep: "CHEESE", ingredient: "mozzarella", onTap });
    press(4, 50);
    press(50, 96);
    expect(onTap).not.toHaveBeenCalled();
  });

  it("sauce can be started at the corner of the pan (and not at a round pizza's corner)", () => {
    const onCommit = vi.fn();
    renderStage(pizzaOf("tray", false), { onDispenseCommit: onCommit });
    press(9, 9);
    expect(onCommit).toHaveBeenCalledTimes(1);
    cleanup();
    const onCommitRound = vi.fn();
    renderStage(pizzaOf(null, false), { onDispenseCommit: onCommitRound });
    press(9, 9);
    expect(onCommitRound).not.toHaveBeenCalled();
  });
});
