import type { CSSProperties } from "react";
import { getIngredient } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { stablePieceRotation } from "../logic/pieceDrag";

interface ReferenceThumbnailPieceGroup {
  ingredientId: string;
  positions: readonly { x: number; y: number }[];
}

interface ReferenceThumbnailProps {
  sauceIngredientId: string | null;
  pieceGroups: readonly ReferenceThumbnailPieceGroup[];
}

/**
 * Issue #159 P0 (Cooking UI 1-Screen Polish, bullet 5): GameScreen's own small always-visible
 * "見本" thumbnail used to be `<PizzaThumbnail recipe={...} />`, which independently recomputes
 * a *different*, abbreviated piece list straight from `recipe.requiredIngredients` (one dot per
 * required ingredient *type*, ignoring `minCount` -- see PizzaThumbnail.tsx, still correct and
 * unchanged for its own Pizza Select card use) -- while the popover the same thumbnail opens
 * (`ReferencePreview`/`PlayerReferencePreview`) renders the recipe's *real* per-unit piece
 * layout (`referencePizza.pieceGroups`/`getPlayerReferencePizza(recipe).pieceGroups`, one dot
 * per physical piece, `minCount`-expanded). A real-device Fresh Audit (2026-09-21) confirmed
 * this as a real "見本表示が入口によって変わる" bug: the small icon and its own popover could
 * show a different piece count for the same recipe.
 *
 * This component takes the exact same `pieceGroups`/sauce data GameScreen already resolves for
 * the popover (`referencePizza ?? getPlayerReferencePizza(state.recipe)`) and renders it at icon
 * size, so the mini thumbnail and the popover it opens are always built from one shared value --
 * not just "structurally similar" data, but literally the same object read twice. Deliberately
 * separate from `PizzaThumbnail` (Pizza Select's own card preview, out of this issue's "調理画面"
 * scope) rather than changing that shared component's own algorithm, which would also change
 * every Pizza Select card's appearance -- unrelated to and riskier than this issue's own fix.
 */
export function ReferenceThumbnail({ sauceIngredientId, pieceGroups }: ReferenceThumbnailProps) {
  const sauceIngredient = sauceIngredientId ? getIngredient(sauceIngredientId) : null;

  return (
    <div className="reference-thumbnail" aria-hidden="true">
      <div
        className="reference-thumbnail__base"
        style={{ backgroundColor: sauceIngredient?.color ?? "#f0d9a0" }}
      />
      {pieceGroups.flatMap((group) => {
        const ingredient = getIngredient(group.ingredientId);
        if (!ingredient) return [];
        return group.positions.map((position, index) => {
          const rotation = stablePieceRotation(group.ingredientId, position.x, position.y);
          return (
            <span
              key={`${group.ingredientId}-${index}`}
              className="reference-thumbnail__piece"
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
                <span className="reference-thumbnail__piece-emoji">{ingredient.emoji}</span>
              )}
            </span>
          );
        });
      })}
    </div>
  );
}
