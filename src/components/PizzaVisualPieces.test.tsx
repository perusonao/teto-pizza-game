import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { renderPizzaVisualPieces } from "./PizzaVisualPieces";
import { PizzaThumbnail } from "./PizzaThumbnail";
import { getRecipe } from "../data/recipes";

/**
 * Topping Visuals 2.0 (#824 PR-1, Owner Q3): the Reference view (ReferenceThumbnail / ReferencePreview / PlayerReferencePreview all render their pieces
 * through `renderPizzaVisualPieces`) and the recipe-card thumbnail keep the EXISTING representation of parmigiano -- the CSS plate -- even though the
 * player's own pizza now draws the placed shavings. `IngredientPieceVisual` defaults to `placed`, so this pins the explicit `surface="selection"`.
 */
afterEach(() => {
  cleanup();
});

describe("renderPizzaVisualPieces (the shared Reference boundary)", () => {
  it("draws parmigiano as the existing CSS plate, not the placed shavings", () => {
    const { container } = render(
      <div>
        {renderPizzaVisualPieces({
          pieceGroups: [{ ingredientId: "parmigiano", positions: [{ x: 40, y: 45 }, { x: 60, y: 55 }] }],
          wrapperClassName: (id) => `reference-piece reference-piece--${id}`,
        })}
      </div>,
    );

    const plates = container.querySelectorAll(".reference-piece--parmigiano > .pizza-cheese.pizza-cheese--parmigiano");
    expect(plates).toHaveLength(2);
    for (const plate of plates) {
      expect(plate.className).toBe("pizza-cheese pizza-cheese--parmigiano");
      expect(plate.innerHTML).toBe("");
    }
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".pizza-cheese--glyph")).toBeNull();
  });

  it("is unchanged for an ingredient with no placed drawing (mozzarella, basil)", () => {
    const { container } = render(
      <div>
        {renderPizzaVisualPieces({
          pieceGroups: [
            { ingredientId: "mozzarella", positions: [{ x: 50, y: 50 }] },
            { ingredientId: "basil", positions: [{ x: 30, y: 30 }] },
          ],
          wrapperClassName: (id) => `reference-piece reference-piece--${id}`,
        })}
      </div>,
    );

    expect(container.querySelector(".pizza-cheese.pizza-cheese--mozzarella")).toBeInTheDocument();
    expect(container.querySelector(".ingredient-piece-visual__emoji")?.textContent).not.toBe("");
  });
});

describe("PizzaThumbnail (recipe card / Dex thumbnail)", () => {
  it("draws a cheese piece such as parmigiano as the existing CSS plate", () => {
    const recipe = getRecipe("quattro-formaggi");
    if (!recipe) throw new Error("Missing quattro-formaggi fixture");
    expect(recipe.requiredIngredients.some((entry) => entry.ingredientId === "parmigiano")).toBe(true);
    const { container } = render(<PizzaThumbnail recipe={recipe} />);

    expect(container.querySelector('svg[data-ingredient-visual="parmigiano-shavings"]')).toBeNull();
    expect(container.querySelector(".pizza-cheese.pizza-cheese--parmigiano")?.className).toBe("pizza-cheese pizza-cheese--parmigiano");
  });
});
