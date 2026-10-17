import type { CSSProperties } from "react";
import { getIngredient } from "../data/ingredients";
import { stablePieceRotation } from "../logic/pieceDrag";
import type { PlacedTopping } from "../state/pizzaState";
import { IngredientPieceVisual } from "./IngredientPieceVisual";

/**
 * Cooking Steps 2.0 FINISH D2-1 (Issue #294): one piece placed after the bake (`stage === "post"`), drawn as its own
 * element -- never through the pre-bake topping path, so the bake-derived styling (`toppingPieceStyle`, the cheese
 * melt frame, the Canvas mozzarella) cannot reach it. It went on after the oven, so it keeps its fresh look: no
 * `style` is passed to `IngredientPieceVisual`, the same unstyled look PREPARE uses. Position, rotation and size
 * class (and the RESULT phase scale) match a pre-bake piece, so a cut re-draws it the same way (`half` = the sliced part in a neighbouring piece).
 *
 * Nothing renders it until a round places a `stage: "post"` piece, which only a FINISH round can do (D1b); no
 * Production recipe has one yet.
 */
export function PostBakePiece({
  topping,
  half,
  rankScale,
  phaseScale = 1,
}: {
  topping: PlacedTopping;
  half: boolean;
  rankScale: number;
  /** the RESULT-only multiplier (#514); 1 elsewhere, and then no variable is set, as on a pre-bake piece */
  phaseScale?: number;
}) {
  const ingredient = getIngredient(topping.ingredientId);
  if (!ingredient) return null;
  return (
    <span
      className={half ? "pizza-topping-half" : `pizza-topping pizza-topping--${ingredient.id}`}
      data-topping-id={topping.id}
      data-topping-stage="post"
      style={
        {
          left: `${topping.x}%`,
          top: `${topping.y}%`,
          "--piece-rotation": `${stablePieceRotation(topping.ingredientId, topping.x, topping.y)}deg`,
          "--piece-rank-scale": rankScale,
          ...(phaseScale === 1 ? {} : { "--piece-phase-scale": phaseScale }),
        } as CSSProperties
      }
    >
      <IngredientPieceVisual ingredient={ingredient} />
    </span>
  );
}
