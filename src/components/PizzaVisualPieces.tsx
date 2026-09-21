import type { CSSProperties, ReactNode } from "react";
import { getIngredient } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { stablePieceRotation } from "../logic/pieceDrag";

export interface PizzaVisualPieceGroup {
  ingredientId: string;
  positions: readonly { x: number; y: number }[];
}

export interface RenderPizzaVisualPiecesOptions {
  pieceGroups: readonly PizzaVisualPieceGroup[];
  /** className for each piece's own positioning wrapper span, given its ingredient id --
   *  lets each Reference context (ReferenceThumbnail/ReferencePreview/PlayerReferencePreview)
   *  keep its own existing class taxonomy (tests and CSS depend on these exact names, see
   *  Issue #167 PR-B's own Result Report §2) while sharing this one rendering implementation. */
  wrapperClassName: (ingredientId: string) => string;
}

/**
 * Issue #167 PR-B: the "モッツァレラ3個とバジル2個" caption-text builder -- byte-identical logic
 * previously duplicated in ReferencePreview.tsx and PlayerReferencePreview.tsx (the same
 * `.map(...).filter(...).join(...)` chain, only the join separator differed). Callers still pick
 * their own separator/suffix -- this only removes the duplicated map/filter step.
 */
export function buildPieceCountLabels(pieceGroups: readonly PizzaVisualPieceGroup[]): string[] {
  return pieceGroups
    .map((group) => {
      const ingredient = getIngredient(group.ingredientId);
      return ingredient ? `${ingredient.nameJa}${group.positions.length}個` : null;
    })
    .filter((text): text is string => text !== null);
}

/**
 * Issue #167 PR-B (Reference Truth): the one piece-layout algorithm every static Reference view
 * shares -- position each piece at its target `{x, y}` (dough-percent, same space PizzaStage's
 * own live toppings use), rotate it by the same deterministic `stablePieceRotation` every
 * renderer already called independently, and draw it via `IngredientPieceVisual` (the physical
 * `.pizza-cheese` shape for cheese, the shared emoji glyph otherwise) -- never a per-file
 * standalone emoji span or a separately hand-rolled scale variable. Previously this exact
 * `.flatMap` loop was written three times (ReferenceThumbnail/ReferencePreview/
 * PlayerReferencePreview), each with its own small drift (only two of the three even routed a
 * non-cheese ingredient through `IngredientPieceVisual` at all -- see the Result Report for the
 * full before/after). PizzaStage's own live topping loop is deliberately NOT routed through
 * this helper: its pieces need per-ingredient landing animations (mozzarella/basil `@keyframes`,
 * App.css) this static, unanimated positioning would fight with -- see PizzaStage.tsx's own
 * topping render for why it still calls `IngredientPieceVisual` directly instead.
 */
export function renderPizzaVisualPieces({
  pieceGroups,
  wrapperClassName,
}: RenderPizzaVisualPiecesOptions): ReactNode[] {
  return pieceGroups.flatMap((group) => {
    const ingredient = getIngredient(group.ingredientId);
    if (!ingredient) return [];
    return group.positions.map((position, index) => {
      const rotationDeg = stablePieceRotation(group.ingredientId, position.x, position.y);
      return (
        <span
          key={`${group.ingredientId}-${index}`}
          className={wrapperClassName(group.ingredientId)}
          style={
            {
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: `translate(-50%, -50%) rotate(${rotationDeg}deg)`,
            } as CSSProperties
          }
        >
          <IngredientPieceVisual ingredient={ingredient} />
        </span>
      );
    });
  });
}
