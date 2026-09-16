import type { CSSProperties } from "react";
import type { Ingredient } from "../data/ingredients";

interface IngredientPieceVisualProps {
  ingredient: Ingredient;
  /** Extra class(es) appended to the rendered piece -- e.g. PizzaStage's bake `meltClass`. */
  className?: string;
}

/**
 * Issue #32 Phase 1: the single physical-piece renderer for a placed ingredient, shared by
 * every context that draws one (player pizza toppings, the ingredient tray chip/drag-preview,
 * and the Margherita Reference popover) so they can never independently drift into different
 * representations of the same ingredient (e.g. Reference's old standalone 🧀 emoji vs. the
 * player's physical CSS mozzarella). A "cheese" ingredient renders the shared `.pizza-cheese`
 * physical shape; every other ingredient renders its emoji.
 */
export function IngredientPieceVisual({ ingredient, className }: IngredientPieceVisualProps) {
  if (ingredient.category === "cheese") {
    return (
      <span
        className={["pizza-cheese", `pizza-cheese--${ingredient.id}`, className]
          .filter(Boolean)
          .join(" ")}
        style={{ "--cheese-color": ingredient.color } as CSSProperties}
      />
    );
  }

  return (
    <span className={["ingredient-piece-visual__emoji", className].filter(Boolean).join(" ")}>
      {ingredient.emoji}
    </span>
  );
}
