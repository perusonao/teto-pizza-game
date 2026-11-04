import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import type { MakingStep } from "../state/gameReducer";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";
import { PizzaThumbnail } from "./PizzaThumbnail";
import { ReferenceThumbnail } from "./ReferenceThumbnail";

/**
 * Pinsa oval dough: PizzaStage draws the multigrain-long-ferment dough as a 3:2 ellipse over the same circular percent space; every
 * other pizza (round, and any pizza on a square tray) is exactly what it has always been.
 */
const RECT = { left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 } as DOMRect;

function pizzaOf(dough?: "material-multigrain-long-ferment", pan?: "tray"): PizzaState {
  const base: PizzaState = {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    sauceDeposits: [{ x: 50, y: 50, amount: 0.4 } satisfies SauceDeposit],
  };
  return { ...base, ...(dough ? { dough } : {}), ...(pan ? { pan } : {}) };
}

interface Extra {
  makingStep?: MakingStep;
  ingredient?: string;
  bakeProgress?: number | null;
  resultCompact?: boolean;
  resultRevealed?: boolean;
  onTap?: (x: number, y: number) => void;
}

function renderStage(pizza: PizzaState, extra: Extra = {}) {
  return render(
    <PizzaStage
      pizza={pizza}
      recipe={getRecipe("margherita")!}
      interactive
      activeIngredient={getIngredient(extra.ingredient ?? "mozzarella")!}
      bakeProgress={extra.bakeProgress ?? null}
      placement={null}
      resultRevealed={extra.resultRevealed ?? false}
      referenceModeEnabled
      resetToken={0}
      makingStepToken={0}
      makingStep={extra.makingStep ?? "CHEESE"}
      showDoughShape
      resultCompact={extra.resultCompact}
      onTap={extra.onTap ?? (() => {})}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
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
  const point = { clientX: (x / 100) * 300, clientY: (y / 100) * 200 };
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

const OTHER = "material-multigrain-long-ferment" as const;

describe("PizzaStage oval outline", () => {
  it("a round pizza carries no oval class and no SVG stretch", () => {
    const { container } = renderStage(pizzaOf());
    expect(dough()).not.toHaveClass("pizza-dough--oval");
    expect(container.querySelectorAll('svg[preserveAspectRatio="none"]').length).toBe(0);
  });

  it.each<[string, Extra]>([
    ["CHEESE", { makingStep: "CHEESE" }],
    ["TOPPING", { makingStep: "TOPPING", ingredient: "basil" }],
    ["BAKE", { makingStep: "TOPPING", ingredient: "basil", bakeProgress: 50 }],
    ["RESULT", { makingStep: "TOPPING", ingredient: "basil", bakeProgress: 50, resultCompact: true, resultRevealed: true }],
  ])("the other dough is an oval at %s", (_label, extra) => {
    renderStage(pizzaOf(OTHER), extra);
    expect(dough()).toHaveClass("pizza-dough--oval");
  });

  it("the sauce guide and the paint trail stretch with the oval box", () => {
    const { container } = renderStage(pizzaOf(OTHER), { makingStep: "SAUCE", ingredient: "tomato-sauce" });
    const stretched = container.querySelectorAll('svg[preserveAspectRatio="none"]');
    expect(stretched.length).toBeGreaterThan(0);
  });

  it("the other dough on a square tray stays square", () => {
    const { container } = renderStage(pizzaOf(OTHER, "tray"));
    expect(dough()).not.toHaveClass("pizza-dough--oval");
    expect(dough()).toHaveClass("pizza-dough--square-pan");
    expect(container.querySelectorAll('svg[preserveAspectRatio="none"]').length).toBe(0);
  });
});

describe("PizzaStage oval input", () => {
  it("accepts a press at the ellipse's rim and refuses one at the box corner", () => {
    const onTap = vi.fn();
    renderStage(pizzaOf(OTHER), { onTap });
    press(50, 50 + 40); // 40% below centre, inside the rim on the short axis
    expect(onTap).toHaveBeenCalledTimes(1);
    press(8, 8); // box corner: outside the ellipse
    press(50, 99); // beyond the short-axis rim
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("the same short-axis press on a round-sized pizza behaves identically (one shared percent space)", () => {
    const onTap = vi.fn();
    renderStage(pizzaOf(), { onTap });
    press(50, 90);
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});

describe("oval thumbnails", () => {
  it("PizzaThumbnail is oval only for a recipe fixed to the other dough", () => {
    const margherita = getRecipe("margherita")!;
    const { container, rerender } = render(<PizzaThumbnail recipe={margherita} />);
    expect(container.querySelector(".pizza-thumbnail--oval")).toBeNull();
    rerender(<PizzaThumbnail recipe={{ ...margherita, doughKind: OTHER }} />);
    expect(container.querySelector(".pizza-thumbnail--oval")).not.toBeNull();
  });

  it("ReferenceThumbnail takes the oval modifier only when asked", () => {
    const a = render(<ReferenceThumbnail sauceIngredientId="tomato-sauce" pieceGroups={[]} />);
    expect(a.container.querySelector(".reference-thumbnail--oval")).toBeNull();
    a.unmount();
    const b = render(<ReferenceThumbnail sauceIngredientId="tomato-sauce" pieceGroups={[]} oval />);
    expect(b.container.querySelector(".reference-thumbnail--oval")).not.toBeNull();
  });
});
