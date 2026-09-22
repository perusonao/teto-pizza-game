import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PizzaStage } from "./PizzaStage";
import { RECIPES } from "../data/recipes";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { createCutState } from "../logic/cut/state";
import type { MakingStep } from "../state/gameReducer";

/**
 * M3A Bake Judgment Phase 6: the pizza's own bake visuals (dough color, cheese melt/toast/char,
 * char spots/smoke) must read continuously as `bakeProgress` sweeps 0..100 -- in particular, no
 * jump exactly at `recipe.bakeTarget.start`/`.end`, since that would silently reintroduce the
 * exact "answer reveal at the boundary" problem the Guide fade (BakeOverlay.test.tsx) fixes for
 * the gauge. See ../logic/bakeVisual.ts and its own bakeVisual.test.ts for the underlying pure
 * functions; this file only checks PizzaStage actually wires them in.
 */

const RECIPE = RECIPES.find((r) => r.id === "margherita")!; // bakeTarget: { start: 60, end: 80 }

function pizzaWithCheese(): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
  };
}

/** Gameplay UX PR-E: cheese + a normal (roasting) topping + a green herb (roast-resistant)
 *  topping, so a single render can assert all three curves at once. */
function pizzaWithMixedToppings(): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [
      { id: "t1", ingredientId: "mozzarella", x: 50, y: 50 },
      { id: "t2", ingredientId: "pepperoni", x: 30, y: 40 },
      { id: "t3", ingredientId: "basil", x: 70, y: 60 },
    ],
  };
}

/** No-cheese recipe fixture (marinara-shaped, PR-A): only non-cheese toppings placed. */
function pizzaWithoutCheese(): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [{ id: "t1", ingredientId: "oregano", x: 50, y: 50 }],
  };
}

/** No-topping recipe fixture (quattro-formaggi-shaped, PR-A): only cheese placed. */
function pizzaCheeseOnly(): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce"],
    toppings: [
      { id: "t1", ingredientId: "mozzarella", x: 50, y: 50 },
      { id: "t2", ingredientId: "gorgonzola", x: 30, y: 40 },
    ],
  };
}

function noop() {}

function renderStage(
  bakeProgress: number | null,
  options: { pizza?: PizzaState; resultRevealed?: boolean; makingStep?: MakingStep } = {},
) {
  return render(
    <PizzaStage
      pizza={options.pizza ?? pizzaWithCheese()}
      recipe={RECIPE}
      interactive={false}
      activeIngredient={null}
      bakeProgress={bakeProgress}
      placement={null}
      resultRevealed={options.resultRevealed ?? false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={0}
      makingStep={options.makingStep ?? "TOPPING"}
      showDoughShape
      onTap={noop}
      onDispenseProgress={noop}
      onDispenseCommit={noop}
      onDoughStretchProgress={noop}
      onDoughStretchCommit={noop}
      cutState={createCutState()}
      onAddCutLine={noop}
    />,
  );
}

function doughShapeBackground(): string {
  const el = document.querySelector<HTMLElement>(".pizza-dough-shape");
  if (!el) throw new Error(".pizza-dough-shape missing");
  return el.style.background;
}

function cheeseTransform(): string {
  const el = document.querySelector<HTMLElement>(".pizza-cheese");
  if (!el) throw new Error(".pizza-cheese missing");
  return el.style.getPropertyValue("--bake-melt-scale");
}

function charSpotsOpacity(): number {
  const el = document.querySelector<HTMLElement>(".pizza-char-spots");
  if (!el) throw new Error(".pizza-char-spots missing");
  return Number(el.style.opacity);
}

function toppingEmojiFilter(ingredientId: string): string {
  const wrapper = document.querySelector<HTMLElement>(`.pizza-topping--${ingredientId}`);
  if (!wrapper) throw new Error(`.pizza-topping--${ingredientId} missing`);
  const emoji = wrapper.querySelector<HTMLElement>(".ingredient-piece-visual__emoji");
  if (!emoji) throw new Error(`.ingredient-piece-visual__emoji missing for ${ingredientId}`);
  return emoji.style.filter;
}

function cheeseFilter(): string {
  const el = document.querySelector<HTMLElement>(".pizza-cheese");
  if (!el) throw new Error(".pizza-cheese missing");
  return el.style.filter;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PizzaStage bake visual continuity", () => {
  it("renders no bake-derived styling before BAKE (bakeProgress null)", () => {
    renderStage(null);
    expect(doughShapeBackground()).toBe("");
    expect(document.querySelector(".pizza-char-spots")).toBeNull();
  });

  it("never jumps the dough color at the scoring boundary (start=60/end=80)", () => {
    // Large enough that the underlying continuous RGB lerp (rounded to integer channels in
    // ../logic/bakeVisual.ts) actually produces a different color, not just larger than a
    // hard-cut implementation would ever need to look continuous.
    const epsilon = 3;
    for (const boundary of [60, 80]) {
      const { unmount: unmountBelow } = renderStage(boundary - epsilon);
      const below = doughShapeBackground();
      unmountBelow();

      const { unmount: unmountAt } = renderStage(boundary);
      const at = doughShapeBackground();
      unmountAt();

      const { unmount: unmountAbove } = renderStage(boundary + epsilon);
      const above = doughShapeBackground();
      unmountAbove();

      // A snap would make `below` and `above` identical-looking discrete buckets either side
      // of a hard cut; a continuous function instead produces 3 distinct, closely-spaced colors.
      expect(below).not.toBe(above);
      expect(at).not.toBe(below);
      expect(at).not.toBe(above);
    }
  });

  it("produces a visibly different dough color across under/good/over bake", () => {
    const { unmount: u1 } = renderStage(10); // under
    const under = doughShapeBackground();
    u1();
    const { unmount: u2 } = renderStage(70); // good (target center)
    const good = doughShapeBackground();
    u2();
    const { unmount: u3 } = renderStage(98); // over
    const over = doughShapeBackground();
    u3();

    expect(under).not.toBe(good);
    expect(good).not.toBe(over);
    expect(under).not.toBe(over);
  });

  it("melts cheese continuously with no jump at the scoring boundary", () => {
    const epsilon = 0.05;
    const { unmount: u1 } = renderStage(60 - epsilon);
    const below = Number(cheeseTransform());
    u1();
    const { unmount: u2 } = renderStage(60 + epsilon);
    const above = Number(cheeseTransform());
    u2();
    expect(Math.abs(above - below)).toBeLessThan(0.01);
  });

  it("keeps char/smoke fully transparent well before the burnt end of the range", () => {
    renderStage(85); // past the good zone but nowhere near fully burnt (heat < 1.6)
    expect(charSpotsOpacity()).toBe(0);
  });

  it("ramps char intensity in only once deep into overbake, not at a fixed instant", () => {
    const { unmount: u1 } = renderStage(95);
    const nearCharStart = charSpotsOpacity();
    u1();
    const { unmount: u2 } = renderStage(100);
    const fullyCharred = charSpotsOpacity();
    u2();

    expect(nearCharStart).toBeGreaterThanOrEqual(0);
    expect(fullyCharred).toBeGreaterThan(nearCharStart);
    expect(fullyCharred).toBeLessThanOrEqual(1);
  });
});

/**
 * Gameplay UX PR-E (Finished Pizza Visual 2.0): observable-contract tests for the new explicit
 * per-category topping roast model (../logic/bakeVisual.ts's `toppingVisualFrame`), replacing
 * the accidental `cheeseVisualFrame` reuse the Fresh Audit found (see PizzaStage.tsx's own
 * `toppingPieceStyle` comment). Target = margherita's { start: 60, end: 80 } (heat 1 @ 70).
 */
describe("PizzaStage topping roast visual (PR-E)", () => {
  it("applies no bake-derived filter to any topping before BAKE (pre-bake visual state)", () => {
    renderStage(null, { pizza: pizzaWithMixedToppings() });
    expect(toppingEmojiFilter("pepperoni")).toBe("");
    expect(toppingEmojiFilter("basil")).toBe("");
    expect(cheeseFilter()).toBe("");
  });

  it("roasts a normal (non-herb) topping at the ideal bake state", () => {
    renderStage(70, { pizza: pizzaWithMixedToppings() });
    const filter = toppingEmojiFilter("pepperoni");
    expect(filter).toContain("brightness(");
    expect(filter).toContain("saturate(");
    expect(filter).toContain("sepia(");
    // The topping's own baseline drop-shadow must survive being merged with the roast filter --
    // the exact bug the Fresh Audit found (inline style silently dropped it).
    expect(filter).toContain("drop-shadow(");
  });

  it("roasts further (darker/more sepia) when overbaked than at the ideal bake state", () => {
    renderStage(70, { pizza: pizzaWithMixedToppings() });
    const ideal = toppingEmojiFilter("pepperoni");
    cleanup();
    renderStage(100, { pizza: pizzaWithMixedToppings() });
    const overbaked = toppingEmojiFilter("pepperoni");
    expect(overbaked).not.toBe(ideal);
    const sepiaOf = (filter: string) => Number(filter.match(/sepia\(([\d.]+)\)/)?.[1] ?? "0");
    expect(sepiaOf(overbaked)).toBeGreaterThan(sepiaOf(ideal));
  });

  it("keeps a green herb topping (basil) visibly greener/lighter than a normal topping at the same overbaked heat", () => {
    renderStage(100, { pizza: pizzaWithMixedToppings() });
    const basilFilter = toppingEmojiFilter("basil");
    const pepperoniFilter = toppingEmojiFilter("pepperoni");
    const sepiaOf = (filter: string) => Number(filter.match(/sepia\(([\d.]+)\)/)?.[1] ?? "0");
    const brightnessOf = (filter: string) => Number(filter.match(/brightness\(([\d.]+)\)/)?.[1] ?? "1");
    expect(sepiaOf(basilFilter)).toBeLessThan(sepiaOf(pepperoniFilter));
    expect(brightnessOf(basilFilter)).toBeGreaterThan(brightnessOf(pepperoniFilter));
  });

  it("does not apply the topping curve to cheese (cheese keeps its own melt/toast/char curve)", () => {
    renderStage(100, { pizza: pizzaWithMixedToppings() });
    const cheese = cheeseFilter();
    const pepperoni = toppingEmojiFilter("pepperoni");
    expect(cheese).not.toContain("drop-shadow");
    expect(cheese).not.toBe(pepperoni);
  });

  it("renders correctly for a no-cheese recipe fixture (no .pizza-cheese element)", () => {
    renderStage(70, { pizza: pizzaWithoutCheese() });
    expect(document.querySelector(".pizza-cheese")).toBeNull();
    const filter = toppingEmojiFilter("oregano");
    expect(filter).toContain("drop-shadow(");
  });

  it("renders correctly for a no-topping recipe fixture (cheese only, no emoji toppings)", () => {
    renderStage(70, { pizza: pizzaCheeseOnly() });
    expect(document.querySelectorAll(".pizza-cheese").length).toBe(2);
    expect(document.querySelector(".ingredient-piece-visual__emoji")).toBeNull();
  });

  it("preserves the same topping roast at RESULT as at the end of BAKE (BAKE -> RESULT continuity)", () => {
    renderStage(70, { pizza: pizzaWithMixedToppings(), resultRevealed: false });
    const duringBake = toppingEmojiFilter("pepperoni");
    cleanup();
    renderStage(70, { pizza: pizzaWithMixedToppings(), resultRevealed: true });
    const atResult = toppingEmojiFilter("pepperoni");
    expect(atResult).toBe(duringBake);
  });

  it("keeps the CUT overlay present alongside the new topping roast styling", () => {
    renderStage(70, { pizza: pizzaWithMixedToppings(), makingStep: "CUT" });
    expect(document.querySelector(".pizza-cut-layer")).not.toBeNull();
    expect(toppingEmojiFilter("pepperoni")).toContain("drop-shadow(");
  });
});
