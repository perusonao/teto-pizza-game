import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import type { MakingStep } from "../state/gameReducer";
import { createEmptyPizza, type SauceDeposit } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";

/** Issue #489 Phase 2: the remaining-sauce gauge is wired into PizzaStage on the SAUCE step only. */
function renderStage(makingStep: MakingStep, amounts: number[] = [], extra: { resultCompact?: boolean } = {}) {
  const pizza = {
    ...createEmptyPizza(),
    sauceDeposits: amounts.map<SauceDeposit>((amount) => ({ x: 50, y: 50, amount })),
  };
  return render(
    <PizzaStage
      pizza={pizza}
      recipe={getRecipe("margherita")!}
      interactive
      activeIngredient={getIngredient("tomato-sauce")!}
      bakeProgress={null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled
      resetToken={0}
      makingStepToken={0}
      makingStep={makingStep}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={{ lines: [] } as never}
      onAddCutLine={() => {}}
      {...extra}
    />,
  );
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

describe("PizzaStage sauce remaining gauge", () => {
  it("shows a full gauge on the SAUCE step before any sauce", () => {
    renderStage("SAUCE");
    expect(screen.getByRole("meter", { name: "ソースの残り" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("reflects committed deposits", () => {
    renderStage("SAUCE", [0.25, 0.25]);
    expect(screen.getByRole("meter", { name: "ソースの残り" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("is empty once the cap is reached", () => {
    renderStage("SAUCE", [0.6, 0.6]);
    expect(screen.getByRole("meter", { name: "ソースの残り" })).toHaveAttribute("aria-valuenow", "0");
  });

  it.each(["DOUGH", "CHEESE", "TOPPING", "CUT"] as const)("is absent on the %s step", (step) => {
    renderStage(step);
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("is absent in the compact result stage", () => {
    renderStage("SAUCE", [], { resultCompact: true });
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("never takes pointer events and sits outside the dough's hit area", () => {
    const { container } = renderStage("SAUCE");
    const gauge = container.querySelector(".pizza-stage__sauce-gauge")!;
    expect(gauge.closest('[data-pizza-drop-target="true"]')).toBeNull();
  });
});
