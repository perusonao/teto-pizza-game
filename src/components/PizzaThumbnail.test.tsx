import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { getRecipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import { PizzaThumbnail } from "./PizzaThumbnail";

/**
 * Issue #39 PS3: PizzaThumbnail is a small, deterministic pizza preview built purely from a
 * recipe's own `requiredIngredients` -- pins that it (a) picks the recipe's sauce color as
 * its base, (b) renders one non-sauce ingredient per required ingredient, reusing the shared
 * physical `.pizza-cheese` shape for cheese, and (c) never varies across renders of the same
 * recipe (no randomness).
 */
afterEach(() => {
  cleanup();
});

describe("PizzaThumbnail", () => {
  it("colors its base from the recipe's sauce ingredient", () => {
    const margherita = getRecipe("margherita");
    if (!margherita) throw new Error("Missing margherita fixture");
    const tomatoSauce = getIngredient("tomato-sauce");
    if (!tomatoSauce) throw new Error("Missing tomato-sauce fixture");

    const { container } = render(<PizzaThumbnail recipe={margherita} />);
    const reference = document.createElement("div");
    reference.style.backgroundColor = tomatoSauce.color;
    const base = container.querySelector(".pizza-thumbnail__base") as HTMLElement | null;
    expect(base).toBeInTheDocument();
    expect(base?.style.backgroundColor).toBe(reference.style.backgroundColor);
  });

  it("renders the recipe's cheese requirement as the shared .pizza-cheese shape, not an emoji", () => {
    const margherita = getRecipe("margherita");
    if (!margherita) throw new Error("Missing margherita fixture");

    const { container } = render(<PizzaThumbnail recipe={margherita} />);
    expect(container.querySelector(".pizza-cheese.pizza-cheese--mozzarella")).toBeInTheDocument();
  });

  it("renders one piece per non-sauce required ingredient (quattro formaggi: 4 cheeses)", () => {
    const quattro = getRecipe("quattro-formaggi");
    if (!quattro) throw new Error("Missing quattro-formaggi fixture");

    const { container } = render(<PizzaThumbnail recipe={quattro} />);
    expect(container.querySelectorAll(".pizza-thumbnail__piece")).toHaveLength(4);
  });

  it("renders identically across renders of the same recipe (deterministic, no randomness)", () => {
    const bismarck = getRecipe("bismarck");
    if (!bismarck) throw new Error("Missing bismarck fixture");

    const first = render(<PizzaThumbnail recipe={bismarck} />);
    const firstHtml = first.container.innerHTML;
    first.unmount();
    const second = render(<PizzaThumbnail recipe={bismarck} />);
    expect(second.container.innerHTML).toBe(firstHtml);
  });

  it("is purely decorative (aria-hidden), since the card's own aria-label already describes it", () => {
    const funghi = getRecipe("funghi");
    if (!funghi) throw new Error("Missing funghi fixture");

    const { container } = render(<PizzaThumbnail recipe={funghi} />);
    expect(container.querySelector(".pizza-thumbnail")).toHaveAttribute("aria-hidden", "true");
  });

  it("RT-01b: a recipe with 9 non-sauce ingredient types gives every type its own position", () => {
    const margherita = getRecipe("margherita");
    if (!margherita) throw new Error("Missing margherita fixture");
    const types = ["mozzarella", "basil", "garlic", "oregano", "mushroom", "onion", "ham", "bacon", "black-olive"];
    const synthetic = {
      ...margherita,
      requiredIngredients: [
        { ingredientId: "tomato-sauce", minCount: 1 },
        ...types.map((ingredientId) => ({ ingredientId, minCount: 1 })),
      ],
    };
    const { container } = render(<PizzaThumbnail recipe={synthetic} />);
    const pieces = Array.from(container.querySelectorAll<HTMLElement>(".pizza-thumbnail__piece"));
    expect(pieces).toHaveLength(9);
    const keys = pieces.map((p) => `${p.style.left},${p.style.top}`);
    expect(new Set(keys).size).toBe(9);
  });
});

