import type { PlayerPizzaReference } from "../data/playerReference";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { stablePieceRotation } from "../logic/pieceDrag";

interface PlayerReferencePreviewProps {
  reference: PlayerPizzaReference;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Mirrors `ReferencePreview`'s own flag: false when a separate always-visible mini
   *  thumbnail (Issue #47 Finding H) already serves as this popover's trigger. */
  renderTrigger?: boolean;
}

/**
 * Issue #47 Slice B Finding F: player-facing completed-pizza reference for every recipe that
 * has no Scoring 2.0 Reference fixture (`../data/referencePizza.ts` stays Margherita-only --
 * see that file's own scope guard, unchanged by this component). Built purely from
 * `../data/playerReference.ts`, itself derived only from Recipe/Ingredient data -- this
 * component never reads Scoring 2.0 data and nothing in Scoring 2.0 reads it. Unlike
 * `ReferencePreview`'s Margherita panel, this one shows no numeric quantity/coverage bars and
 * carries an explicit disclaimer, so a generated placement guide can never read as a real
 * scoring target.
 */
export function PlayerReferencePreview({
  reference,
  isOpen,
  onOpenChange,
  renderTrigger = true,
}: PlayerReferencePreviewProps) {
  const recipe = getRecipe(reference.recipeId);
  const recipeName = recipe?.nameJa ?? "";
  const sauceIngredient = reference.sauceIngredientId ? getIngredient(reference.sauceIngredientId) : null;

  const pieceCaption = reference.pieceGroups
    .map((group) => {
      const ingredient = getIngredient(group.ingredientId);
      return ingredient ? `${ingredient.nameJa}${group.positions.length}個` : null;
    })
    .filter((text): text is string => text !== null)
    .join("、");

  return (
    <>
      {renderTrigger && (
        <button
          type="button"
          className="reference-preview__button"
          onClick={() => onOpenChange(true)}
          aria-haspopup="dialog"
        >
          {"\u{1F4D0}"} 見本
        </button>
      )}

      {isOpen && (
        <div
          className="reference-preview__backdrop"
          role="presentation"
          onClick={() => onOpenChange(false)}
        >
          <div
            className="reference-preview__panel"
            role="dialog"
            aria-label={`${recipeName}の見本`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reference-preview__header">
              <h2>{recipeName} 見本</h2>
              <button
                type="button"
                className="reference-preview__close"
                onClick={() => onOpenChange(false)}
              >
                閉じる
              </button>
            </div>

            <div className="player-reference-mini-pizza" aria-hidden="true">
              <div
                className="player-reference-mini-pizza__sauce"
                style={{ backgroundColor: sauceIngredient?.color ?? "#e2b876" }}
              />
              {reference.pieceGroups.flatMap((group) => {
                const ingredient = getIngredient(group.ingredientId);
                if (!ingredient) return [];
                return group.positions.map((position, index) => (
                  <span
                    key={`${group.ingredientId}-${index}`}
                    className="player-reference-mini-pizza__piece"
                    style={{
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: `translate(-50%, -50%) rotate(${stablePieceRotation(group.ingredientId, position.x, position.y)}deg)`,
                    }}
                  >
                    <IngredientPieceVisual ingredient={ingredient} />
                  </span>
                ));
              })}
            </div>

            <p className="reference-preview__caption">
              {sauceIngredient?.nameJa ?? "ソース"}を生地全体にまんべんなく塗って、
              {pieceCaption}を目安に配置しよう。
            </p>
            <p className="player-reference-preview__disclaimer">
              ※この配置は材料から自動生成したイメージです。採点の基準座標ではありません。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
