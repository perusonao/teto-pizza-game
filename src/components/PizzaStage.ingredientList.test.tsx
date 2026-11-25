import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createCutState } from "../logic/cut/state";
import { createEmptyPizza, type PizzaState } from "../state/pizzaState";
import { PizzaStage } from "./PizzaStage";
import {
  PIZZA_INGREDIENT_LIST_DISPLAY,
  pizzaIngredientListItems,
} from "./pizzaIngredientList";

const RECIPE = getRecipe("margherita")!;

afterEach(cleanup);

describe("Issue #893: finished-pizza ingredient-list mapping", () => {
  it("assigns every production ingredient id an explicit, distinguishable display", () => {
    expect(PIZZA_INGREDIENT_LIST_DISPLAY.size).toBe(INGREDIENTS.length);

    const identities = INGREDIENTS.map((ingredient) => {
      const display = PIZZA_INGREDIENT_LIST_DISPLAY.get(ingredient.id);
      expect(display, `${ingredient.id} must not fall through to a fallback`).toBeDefined();
      expect(display!.ingredient.id).toBe(ingredient.id);
      expect(display!.nameJa).toBe(ingredient.nameJa);
      return `${display!.ingredient.id} ${display!.nameJa}`;
    });

    expect(new Set(identities).size).toBe(INGREDIENTS.length);
  });

  it("keeps mozzarella and oregano as separate rows and counts each id independently", () => {
    const items = pizzaIngredientListItems(toppings([
      "mozzarella",
      "oregano",
      "mozzarella",
      "oregano",
      "mushroom",
      "ham",
      "artichoke",
    ]));

    expect(items.map(({ ingredientId, count }) => [ingredientId, count])).toEqual([
      ["mozzarella", 2],
      ["oregano", 2],
      ["mushroom", 1],
      ["ham", 1],
      ["artichoke", 1],
    ]);
    expect(items.reduce((sum, item) => sum + item.count, 0)).toBe(7);
  });

  it("reports parmigiano-only pieces with their own id and exact count", () => {
    expect(pizzaIngredientListItems(toppings(["parmigiano", "parmigiano"]))).toEqual([
      expect.objectContaining({ ingredientId: "parmigiano", nameJa: "パルミジャーノ", count: 2 }),
    ]);
  });

  it("does not drop dedicated-SVG clams and reports all three pieces", () => {
    expect(pizzaIngredientListItems(toppings(["clam", "clam", "clam"]))).toEqual([
      expect.objectContaining({ ingredientId: "clam", nameJa: "あさり", count: 3 }),
    ]);
  });

  it("renders the semantic rows on RESULT and keeps decorative smoke out of that list", () => {
    const { container } = renderResult(["tuna", "tuna", "onion"]);
    const list = container.querySelector('[aria-label="ピザの材料"]')!;
    const pizza = container.querySelector('[role="button"][aria-label="ピザ"]')!;

    expect(list).toHaveTextContent("ツナ ×2");
    expect(list).toHaveTextContent("たまねぎ ×1");
    expect(list).not.toHaveTextContent("💨");
    expect(pizza).toHaveAttribute("aria-describedby", list.id);
    expect(container.querySelectorAll('.pizza-smoke-wrap[aria-hidden="true"]')).toHaveLength(2);
  });
});

function toppings(ids: readonly string[]): PizzaState["toppings"] {
  return ids.map((ingredientId, index) => ({
    id: `piece-${index}`,
    ingredientId,
    x: 30 + index,
    y: 40 + index,
  }));
}

function renderResult(ids: readonly string[]) {
  const pizza: PizzaState = {
    ...createEmptyPizza(),
    toppings: toppings(ids),
  };
  const noop = () => {};
  return render(
    <PizzaStage
      pizza={pizza}
      recipe={RECIPE}
      interactive={false}
      activeIngredient={null}
      bakeProgress={70}
      placement={null}
      resultRevealed
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
      cutState={createCutState()}
      onAddCutLine={noop}
    />,
  );
}
