import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getIngredient, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createEmptyPizza } from "../state/pizzaState";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { PizzaStage } from "./PizzaStage";

/**
 * Issue #32 Phase 1: pins IngredientPieceVisual's own rendering contract -- a cheese
 * ingredient (mozzarella, etc.) renders the shared physical `.pizza-cheese` shape, everything
 * else renders its emoji -- and that the player's own pizza (PizzaStage) renders a placed
 * mozzarella topping through this exact same component, not a parallel implementation.
 */
afterEach(() => {
  cleanup();
});

describe("IngredientPieceVisual", () => {
  it("renders the shared physical .pizza-cheese shape for a cheese ingredient (mozzarella)", () => {
    const mozzarella = getIngredient("mozzarella");
    if (!mozzarella) throw new Error("Missing mozzarella fixture");

    const { container } = render(<IngredientPieceVisual ingredient={mozzarella} />);

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella");
    expect(piece).toBeInTheDocument();
    expect(piece?.textContent).toBe("");
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });

  it("appends an extra className (e.g. PizzaStage's bake meltClass) onto the cheese piece", () => {
    const mozzarella = getIngredient("mozzarella");
    if (!mozzarella) throw new Error("Missing mozzarella fixture");

    const { container } = render(
      <IngredientPieceVisual ingredient={mozzarella} className="pizza-cheese--melted" />,
    );

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella.pizza-cheese--melted");
    expect(piece).toBeInTheDocument();
  });

  it("renders the emoji for a non-cheese ingredient (basil)", () => {
    const basil = getIngredient("basil");
    if (!basil) throw new Error("Missing basil fixture");

    const { container } = render(<IngredientPieceVisual ingredient={basil} />);

    expect(container.querySelector(".pizza-cheese")).not.toBeInTheDocument();
    const emojiSpan = container.querySelector(".ingredient-piece-visual__emoji");
    expect(emojiSpan).toBeInTheDocument();
    expect(emojiSpan?.textContent).toBe(basil.emoji);
  });
});

describe("Player pizza mozzarella uses the shared IngredientPieceVisual primitive", () => {
  it("a placed mozzarella topping on PizzaStage renders the same .pizza-cheese shape", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("Missing margherita recipe fixture");
    const activeIngredient = getIngredient(STARTER_INGREDIENT_IDS[0]) ?? null;

    const pizza = {
      ...createEmptyPizza(),
      toppings: [{ id: "t1", ingredientId: "mozzarella", x: 50, y: 50 }],
    };

    const { container } = render(
      <PizzaStage
        pizza={pizza}
        recipe={recipe}
        interactive={false}
        activeIngredient={activeIngredient}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={0}
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
      />,
    );

    const piece = container.querySelector(".pizza-cheese.pizza-cheese--mozzarella");
    expect(piece).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u{1F9C0}");
  });
});
