import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe, RECIPES } from "../data/recipes";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { SAUCE_RATE_PER_TICK } from "../logic/sauceQuantity";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { createCutState } from "../logic/cut/state";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #32 sauce parity fix: this file used to cover only the 3 profile-matched recipes with
 * a drag gesture. Fresh Audit gaps #1-3 (docs/reports/TETO_ISSUE-32_INTERACTION-CONSISTENCY_
 * Fresh-Audit.md) asked for: every one of the 7 recipes, a pure-tap case per sauce, and --
 * the actual defect fix this file exists to pin -- an off-recipe sauce selection using the
 * exact same incremental dispense/heatmap gesture as the recipe-correct one, never falling
 * back to the legacy one-shot `APPLY_SAUCE`/`onTap` path.
 */

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

const DOUGH_RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;

function renderStage(
  recipeId: (typeof RECIPES)[number]["id"],
  ingredientId: string,
  overrides: { pizza?: PizzaState; referenceModeEnabled?: boolean } = {},
) {
  const recipe = getRecipe(recipeId);
  const ingredient = getIngredient(ingredientId);
  if (!recipe || !ingredient) throw new Error(`Missing fixture for ${recipeId}/${ingredientId}`);

  const onTap = vi.fn();
  const onDispenseProgress = vi.fn();
  const onDispenseCommit = vi.fn();
  const { container } = render(
    <PizzaStage
      pizza={overrides.pizza ?? createEmptyPizza()}
      recipe={recipe}
      interactive
      activeIngredient={ingredient}
      bakeProgress={null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={overrides.referenceModeEnabled ?? recipeId === "margherita"}
      resetToken={0}
      makingStepToken={0}
      makingStep="SAUCE"
      showDoughShape
      onTap={onTap}
      onDispenseProgress={onDispenseProgress}
      onDispenseCommit={onDispenseCommit}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={createCutState()}
      onAddCutLine={() => {}}
    />,
  );

  const dough = container.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () => DOUGH_RECT;

  return { container, dough, onTap, onDispenseProgress, onDispenseCommit };
}

function tap(dough: HTMLElement, pointerId = 1) {
  fireEvent.pointerDown(dough, { pointerId, pointerType: "touch", clientX: 120, clientY: 120 });
  fireEvent.pointerUp(dough, { pointerId, pointerType: "touch", clientX: 120, clientY: 120 });
}

function drag(dough: HTMLElement, pointerId = 1) {
  fireEvent.pointerDown(dough, { pointerId, pointerType: "touch", clientX: 120, clientY: 120 });
  fireEvent.pointerMove(dough, { pointerId, pointerType: "touch", clientX: 180, clientY: 180 });
  fireEvent.pointerUp(dough, { pointerId, pointerType: "touch", clientX: 180, clientY: 180 });
}

describe("PizzaStage recipe sauce interaction parity (golden path: recipe's own sauce)", () => {
  for (const recipe of RECIPES) {
    const expectedSauce = getRecipeSauceProfile(recipe.id).ingredientId;

    it(`${recipe.id} (${expectedSauce}) starts a field dispense on pointerdown/move and commits on pointerup`, () => {
      const { onTap, onDispenseProgress, onDispenseCommit, dough } = renderStage(
        recipe.id,
        expectedSauce,
      );

      drag(dough);

      expect(onDispenseProgress).toHaveBeenCalled();
      expect(onDispenseCommit).toHaveBeenCalledTimes(1);
      expect(onDispenseCommit).toHaveBeenCalledWith(
        expectedSauce,
        expect.arrayContaining([expect.objectContaining({ amount: expect.any(Number) })]),
      );
      expect(onTap).not.toHaveBeenCalled();
    });
  }
});

describe("PizzaStage sauce tap contract: a pure tap deposits one small starter-tick dab, never a full spread", () => {
  for (const [recipeId, sauceId] of [
    ["margherita", "tomato-sauce"],
    ["genovese", "pesto"],
    ["quattro-formaggi", "olive-oil"],
  ] as const) {
    it(`${recipeId}/${sauceId}: tap (pointerdown -> pointerup, no movement) commits exactly one deposit of one tick's worth`, () => {
      const { onTap, onDispenseCommit, dough } = renderStage(recipeId, sauceId);

      tap(dough);

      expect(onTap).not.toHaveBeenCalled();
      expect(onDispenseCommit).toHaveBeenCalledTimes(1);
      const [committedIngredientId, deposits] = onDispenseCommit.mock.calls[0];
      expect(committedIngredientId).toBe(sauceId);
      expect(deposits).toHaveLength(1);
      expect(deposits[0].amount).toBeCloseTo(SAUCE_RATE_PER_TICK);
    });
  }
});

describe("Issue #32 Fresh Audit Finding 1-B fix: an off-recipe sauce uses the same dispense/heatmap gesture, never the legacy instant full-spread APPLY_SAUCE path", () => {
  const offRecipeCases = [
    { label: "off-recipe tomato", recipeId: "genovese", offRecipeSauce: "tomato-sauce" },
    { label: "off-recipe pesto", recipeId: "margherita", offRecipeSauce: "pesto" },
    { label: "off-recipe olive oil", recipeId: "margherita", offRecipeSauce: "olive-oil" },
  ] as const;

  for (const { label, recipeId, offRecipeSauce } of offRecipeCases) {
    it(`${label}: tap commits one small starter-tick dab (never a full-spread onTap/APPLY_SAUCE)`, () => {
      expect(getRecipeSauceProfile(recipeId).ingredientId).not.toBe(offRecipeSauce);
      const { onTap, onDispenseCommit, dough } = renderStage(recipeId, offRecipeSauce);

      tap(dough);

      // The old behavior (Fresh Audit Finding 1-B) called `onTap`, which App.tsx routes to
      // the legacy one-shot `APPLY_SAUCE` action -- instant, full-pizza coverage regardless
      // of where or how the player touched. The fix must never call it for a sauce ingredient.
      expect(onTap).not.toHaveBeenCalled();
      expect(onDispenseCommit).toHaveBeenCalledTimes(1);
      const [committedIngredientId, deposits] = onDispenseCommit.mock.calls[0];
      expect(committedIngredientId).toBe(offRecipeSauce);
      expect(deposits).toHaveLength(1);
      expect(deposits[0].amount).toBeCloseTo(SAUCE_RATE_PER_TICK);
    });

    it(`${label}: drag produces incremental deposits along the stroke, committed atomically on pointerup`, () => {
      const { onTap, onDispenseProgress, onDispenseCommit, dough } = renderStage(
        recipeId,
        offRecipeSauce,
      );

      drag(dough);

      expect(onTap).not.toHaveBeenCalled();
      expect(onDispenseProgress).toHaveBeenCalled();
      expect(onDispenseCommit).toHaveBeenCalledTimes(1);
      expect(onDispenseCommit).toHaveBeenCalledWith(
        offRecipeSauce,
        expect.arrayContaining([expect.objectContaining({ amount: expect.any(Number) })]),
      );
    });
  }
});

describe("Issue #32 Fresh Audit Finding 2-A fix: a committed off-recipe sauce still renders via the field/heatmap, not the flat legacy layer", () => {
  it("a committed off-recipe sauce (non-empty sauceDeposits) renders the heatmap canvas, not the flat .pizza-sauce-layer div", () => {
    const pizza: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["pesto"],
      sauceOrigin: { x: 50, y: 50 },
      sauceDeposits: [{ x: 50, y: 50, amount: 0.05 }],
    };
    const { container } = renderStage("margherita", "tomato-sauce", { pizza });

    expect(container.querySelector(".pizza-sauce-heatmap")).not.toBeNull();
    expect(container.querySelector(".pizza-sauce-layer")).toBeNull();
  });

  it("olive oil's committed heatmap carries the --oil visibility class", () => {
    const pizza: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["olive-oil"],
      sauceOrigin: { x: 50, y: 50 },
      sauceDeposits: [{ x: 50, y: 50, amount: 0.05 }],
    };
    const { container } = renderStage("margherita", "tomato-sauce", { pizza });

    const heatmap = container.querySelector(".pizza-sauce-heatmap");
    expect(heatmap).not.toBeNull();
    expect(heatmap).toHaveClass("pizza-sauce-heatmap--oil");
  });

  it("a legacy one-shot committed sauce (empty sauceDeposits, e.g. a stray APPLY_SAUCE) still renders the flat layer -- the legacy path stays intact for any other caller", () => {
    const pizza: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce"],
      sauceOrigin: { x: 50, y: 50 },
      sauceDeposits: [],
    };
    const { container } = renderStage("margherita", "tomato-sauce", { pizza });

    expect(container.querySelector(".pizza-sauce-layer")).not.toBeNull();
    expect(container.querySelector(".pizza-sauce-heatmap")).toBeNull();
  });
});
