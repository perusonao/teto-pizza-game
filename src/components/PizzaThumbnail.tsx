import type { CSSProperties } from "react";
import type { Recipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { stablePieceRotation } from "../logic/pieceDrag";
import { PIECE_RING_POSITIONS } from "../logic/pizzaReferenceLayout";
import { IngredientGlyph } from "./IngredientGlyph";

interface PizzaThumbnailProps {
  recipe: Recipe;
}

/**
 * Issue #39 PS3: a small, deterministic pizza preview for Pizza Select cards, built purely
 * from `recipe.requiredIngredients` + `../data/ingredients` -- the same catalog data Making
 * Game itself reads for that recipe, never a generated/fabricated image. Reuses
 * `IngredientPieceVisual` (cheese renders its shared physical shape) so a card's preview can
 * never visually disagree with what the player actually places for that recipe.
 *
 * Deliberately separate from `data/referencePizza.ts` (the Margherita-only Scoring 2.0
 * Reference fixture used by `ReferencePreview.tsx`) -- this component never reads that data
 * and only Margherita having a fixture there has no effect on this thumbnail rendering for
 * every recipe. The two stay independent responsibilities per Issue #39's scope guard.
 */

/** A recipe's non-sauce ingredients are assigned to `PIECE_RING_POSITIONS` in
 *  `requiredIngredients` order, so the same recipe always renders the same layout. */
const PIECE_POSITIONS = PIECE_RING_POSITIONS;

export function PizzaThumbnail({ recipe }: PizzaThumbnailProps) {
  const sauceIngredient = recipe.requiredIngredients
    .map((req) => getIngredient(req.ingredientId))
    .find((ingredient) => ingredient?.category === "sauce");

  const pieces = recipe.requiredIngredients
    .map((req) => getIngredient(req.ingredientId))
    .filter((ingredient): ingredient is NonNullable<typeof ingredient> => ingredient !== undefined)
    .filter((ingredient) => ingredient.category !== "sauce");

  return (
    <div className="pizza-thumbnail" aria-hidden="true">
      <div
        className="pizza-thumbnail__base"
        style={{ backgroundColor: sauceIngredient?.color ?? "#f0d9a0" }}
      />
      {pieces.map((ingredient, index) => {
        const position = PIECE_POSITIONS[index % PIECE_POSITIONS.length];
        const rotation = stablePieceRotation(ingredient.id, position.x, position.y);
        return (
          <span
            key={ingredient.id}
            className="pizza-thumbnail__piece"
            style={
              {
                left: `${position.x}%`,
                top: `${position.y}%`,
                "--piece-rotation": `${rotation}deg`,
              } as CSSProperties
            }
          >
            {ingredient.category === "cheese" ? (
              <IngredientPieceVisual ingredient={ingredient} />
            ) : (
              <span className="pizza-thumbnail__piece-emoji">
                <IngredientGlyph ingredient={ingredient} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
