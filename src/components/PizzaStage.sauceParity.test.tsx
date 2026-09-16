import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { createEmptyPizza } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";

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

describe("PizzaStage recipe sauce interaction parity", () => {
  for (const [recipeId, expectedSauce] of [
    ["margherita", "tomato-sauce"],
    ["genovese", "pesto"],
    ["quattro-formaggi", "olive-oil"],
  ] as const) {
    it(`${recipeId} starts a field dispense on pointerdown/move and commits on pointerup`, () => {
      const recipe = getRecipe(recipeId);
      const ingredient = getIngredient(expectedSauce);
      if (!recipe || !ingredient) throw new Error(`Missing fixture for ${recipeId}`);

      const onTap = vi.fn();
      const onDispenseProgress = vi.fn();
      const onDispenseCommit = vi.fn();
      const { container } = render(
        <PizzaStage
          pizza={createEmptyPizza()}
          recipe={recipe}
          interactive
          activeIngredient={ingredient}
          bakeProgress={null}
          placement={null}
          resultRevealed={false}
          referenceModeEnabled={recipeId === "margherita"}
          sauceInteractionProfile={getRecipeSauceProfile(recipeId)}
          onTap={onTap}
          onDispenseProgress={onDispenseProgress}
          onDispenseCommit={onDispenseCommit}
        />,
      );

      const dough = container.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
      if (!dough) throw new Error("Pizza dough missing");
      dough.getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 }) as DOMRect;

      fireEvent.pointerDown(dough, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 120,
        clientY: 120,
      });
      fireEvent.pointerMove(dough, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 180,
        clientY: 180,
      });
      fireEvent.pointerUp(dough, {
        pointerId: 1,
        pointerType: "touch",
        clientX: 180,
        clientY: 180,
      });

      expect(onDispenseProgress).toHaveBeenCalled();
      expect(onDispenseCommit).toHaveBeenCalledTimes(1);
      expect(onDispenseCommit).toHaveBeenCalledWith(
        expectedSauce,
        expect.arrayContaining([
          expect.objectContaining({ amount: expect.any(Number) }),
        ]),
      );
      expect(onTap).not.toHaveBeenCalled();
    });
  }
});
