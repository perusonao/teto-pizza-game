import type { CSSProperties } from "react";
import type { Ingredient } from "../data/ingredients";

interface IngredientPieceVisualProps {
  ingredient: Ingredient;
  /** Presentation-only classes owned by the caller, such as post-bake cheese state. */
  className?: string;
  /** Caller-specific sizing hook; ingredient identity still comes from this primitive. */
  emojiClassName?: string;
}

/**
 * Canonical physical visual for one pizza piece.
 *
 * Position, rotation, animation, interaction, and bake flow deliberately remain with each
 * caller's outer wrapper. This component only prevents the ingredient's physical identity
 * from drifting between the Reference, playable pizza, tray, and drag preview.
 */
export function IngredientPieceVisual({
  ingredient,
  className = "",
  emojiClassName = "pizza-topping__emoji",
}: IngredientPieceVisualProps) {
  if (ingredient.category === "cheese") {
    return (
      <span
        className={`ingredient-piece-visual pizza-cheese pizza-cheese--${ingredient.id} ${className}`.trim()}
        style={{ "--cheese-color": ingredient.color } as CSSProperties}
        data-ingredient-piece={ingredient.id}
      />
    );
  }

  return (
    <span
      className={`ingredient-piece-visual ${emojiClassName} ${className}`.trim()}
      data-ingredient-piece={ingredient.id}
    >
      {ingredient.emoji}
    </span>
  );
}
