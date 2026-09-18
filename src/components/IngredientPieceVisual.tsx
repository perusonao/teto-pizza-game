import type { CSSProperties } from "react";
import type { Ingredient } from "../data/ingredients";

interface IngredientPieceVisualProps {
  ingredient: Ingredient;
  /** Extra class(es) appended to the rendered piece -- e.g. PizzaStage's bake `meltClass`. */
  className?: string;
  /** Extra inline style merged onto the rendered piece -- e.g. PizzaStage's continuous bake
   *  melt/toast/char transform+filter (see ../logic/bakeVisual.ts). Only meaningful for the
   *  cheese branch today; the emoji branch accepts it for forward-compat but no caller uses
   *  it there yet. */
  style?: CSSProperties;
}

/**
 * Issue #32 Phase 1: the single physical-piece renderer for a placed ingredient, shared by
 * every context that draws one (player pizza toppings, the ingredient tray chip/drag-preview,
 * and the Margherita Reference popover) so they can never independently drift into different
 * representations of the same ingredient (e.g. Reference's old standalone 🧀 emoji vs. the
 * player's physical CSS mozzarella). A "cheese" ingredient renders the shared `.pizza-cheese`
 * physical shape; every other ingredient renders its emoji.
 */
export function IngredientPieceVisual({ ingredient, className, style }: IngredientPieceVisualProps) {
  if (ingredient.category === "cheese") {
    return (
      <span
        className={["pizza-cheese", `pizza-cheese--${ingredient.id}`, className]
          .filter(Boolean)
          .join(" ")}
        style={{ "--cheese-color": ingredient.color, ...style } as CSSProperties}
      />
    );
  }

  return (
    <span
      className={["ingredient-piece-visual__emoji", className].filter(Boolean).join(" ")}
      style={style}
    >
      {ingredient.emoji}
    </span>
  );
}
