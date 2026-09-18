import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { PizzaStage } from "./PizzaStage";
import { RECIPES } from "../data/recipes";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";

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

function noop() {}

function renderStage(bakeProgress: number | null) {
  return render(
    <PizzaStage
      pizza={pizzaWithCheese()}
      recipe={RECIPE}
      interactive={false}
      activeIngredient={null}
      bakeProgress={bakeProgress}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={0}
      makingStep="TOPPING"
      showDoughShape
      onTap={noop}
      onDispenseProgress={noop}
      onDispenseCommit={noop}
      onDoughStretchProgress={noop}
      onDoughStretchCommit={noop}
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
