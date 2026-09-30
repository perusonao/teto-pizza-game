import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { getReferencePizza } from "../data/referencePizza";
import { getRecipe, type Recipe } from "../data/recipes";
import { createInitialGameState, gameReducer, type MakingStep } from "../state/gameReducer";
import { PizzaStage } from "./PizzaStage";

/**
 * Cooking Interaction 2.0 OD-CI-1 (Dough Guide Leak Fix): the DOUGH step draws exactly one dashed
 * guide ring (`.dough-target-guide`); the SAUCE step's own `.sauce-target-guide` is shown on the
 * SAUCE step only -- never leaking onto DOUGH / CHEESE / TOPPING / CUT, where it used to draw a
 * second, unrelated ring for every recipe that has a Reference Pizza.
 *
 * `referenceModeEnabled` is derived exactly as App.tsx derives it: `getReferencePizza(recipe.id)
 * !== null && !isMissionActive`. Lunch Rush is `isMissionActive`. Dinner is a recipe-free round
 * (the free-cook sentinel has no Reference), which the real-browser spec
 * (e2e/dough-guide-leak-fix.spec.ts) confirms: no sauce guide on Dinner's SAUCE step.
 */

type Round = "FREE Cooking" | "guided" | "Dinner" | "Lunch Rush";

function referenceModeFor(round: Round, recipe: Recipe): boolean {
  const isMissionActive = round === "Lunch Rush";
  return getReferencePizza(recipe.id) !== null && !isMissionActive;
}

function renderGuides(recipe: Recipe, makingStep: MakingStep, referenceModeEnabled: boolean) {
  const state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
  const { container, unmount } = render(
    <PizzaStage
      pizza={state.pizza}
      recipe={recipe}
      interactive
      activeIngredient={null}
      bakeProgress={null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={referenceModeEnabled}
      resetToken={0}
      makingStepToken={0}
      makingStep={makingStep}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={state.cutState}
      onAddCutLine={() => {}}
    />,
  );
  const counts = {
    dough: container.querySelectorAll(".dough-target-guide").length,
    sauce: container.querySelectorAll(".sauce-target-guide").length,
  };
  unmount();
  return counts;
}

const MARGHERITA = getRecipe("margherita")!;
const CAPRICCIOSA = getRecipe("capricciosa")!;

const ROUNDS: ReadonlyArray<{ round: Round; recipe: Recipe }> = [
  { round: "FREE Cooking", recipe: FREE_COOK_RECIPE },
  { round: "guided", recipe: MARGHERITA },
  { round: "guided", recipe: CAPRICCIOSA },
  { round: "Dinner", recipe: FREE_COOK_RECIPE },
  { round: "Lunch Rush", recipe: MARGHERITA },
];

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

describe("PizzaStage target guides are phase-gated (OD-CI-1)", () => {
  it("the free-cook sentinel has no Reference, so it never shows the sauce guide", () => {
    expect(getReferencePizza(FREE_COOK_RECIPE.id)).toBeNull();
  });

  for (const { round, recipe } of ROUNDS) {
    const label = `${round} / ${recipe.id}`;
    const referenceModeEnabled = referenceModeFor(round, recipe);

    it(`${label}: DOUGH shows exactly one guide ring (dough) and no sauce guide`, () => {
      expect(renderGuides(recipe, "DOUGH", referenceModeEnabled)).toEqual({ dough: 1, sauce: 0 });
    });

    it(`${label}: SAUCE keeps the sauce guide only where reference mode is on, and no dough guide`, () => {
      expect(renderGuides(recipe, "SAUCE", referenceModeEnabled)).toEqual({
        dough: 0,
        sauce: referenceModeEnabled ? 1 : 0,
      });
    });

    it(`${label}: CHEESE / TOPPING / CUT show no guide ring at all`, () => {
      for (const step of ["CHEESE", "TOPPING", "CUT"] as const) {
        expect(renderGuides(recipe, step, referenceModeEnabled)).toEqual({ dough: 0, sauce: 0 });
      }
    });
  }

  it("guided rounds do show the sauce guide on SAUCE; Dinner, Lunch Rush and FREE Cooking do not (pins the matrix)", () => {
    expect(renderGuides(MARGHERITA, "SAUCE", referenceModeFor("guided", MARGHERITA)).sauce).toBe(1);
    expect(renderGuides(FREE_COOK_RECIPE, "SAUCE", referenceModeFor("Dinner", FREE_COOK_RECIPE)).sauce).toBe(0);
    expect(renderGuides(MARGHERITA, "SAUCE", referenceModeFor("Lunch Rush", MARGHERITA)).sauce).toBe(0);
    expect(renderGuides(FREE_COOK_RECIPE, "SAUCE", referenceModeFor("FREE Cooking", FREE_COOK_RECIPE)).sauce).toBe(0);
  });

  it("a non-interactive stage (Reference popover / paused) shows neither guide", () => {
    const state = gameReducer(createInitialGameState(), { type: "BEGIN_PREPARE" });
    const { container } = render(
      <PizzaStage
        pizza={state.pizza}
        recipe={MARGHERITA}
        interactive={false}
        activeIngredient={null}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled
        resetToken={0}
        makingStepToken={0}
        makingStep="SAUCE"
        showDoughShape
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={state.cutState}
        onAddCutLine={() => {}}
      />,
    );
    expect(container.querySelectorAll(".sauce-target-guide, .dough-target-guide")).toHaveLength(0);
  });
});
