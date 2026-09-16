import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { getRecipeSauceProfile } from "../data/recipeSauceProfiles";
import { createEmptyPizza } from "../state/pizzaState";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { PizzaStage } from "./PizzaStage";

afterEach(cleanup);

describe("IngredientPieceVisual", () => {
  it("maps canonical mozzarella data to the physical white cheese shape", () => {
    const mozzarella = getIngredient("mozzarella");
    if (!mozzarella) throw new Error("Missing mozzarella fixture");

    const { container } = render(<IngredientPieceVisual ingredient={mozzarella} />);
    const piece = container.querySelector('[data-ingredient-piece="mozzarella"]');

    expect(piece).toHaveClass("ingredient-piece-visual", "pizza-cheese--mozzarella");
    expect(piece).not.toHaveTextContent("🧀");
  });

  it("is the renderer used by the playable pizza for mozzarella and canonical basil", () => {
    const recipe = getRecipe("margherita");
    if (!recipe) throw new Error("Missing Margherita fixture");
    const pizza = {
      ...createEmptyPizza(),
      toppings: [
        { id: "mozzarella-player", ingredientId: "mozzarella", x: 35, y: 35 },
        { id: "basil-player", ingredientId: "basil", x: 31, y: 62 },
      ],
    };

    const { container } = render(
      <PizzaStage
        pizza={pizza}
        recipe={recipe}
        interactive={false}
        activeIngredient={null}
        bakeProgress={null}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled
        sauceInteractionProfile={getRecipeSauceProfile("margherita")}
        resetToken={0}
        onTap={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
      />,
    );

    expect(container.querySelector('[data-ingredient-piece="mozzarella"]')).toHaveClass(
      "ingredient-piece-visual",
      "pizza-cheese--mozzarella",
    );
    expect(container.querySelector('[data-ingredient-piece="basil"]')).toHaveClass(
      "ingredient-piece-visual",
      "pizza-topping__emoji",
    );
  });
});
