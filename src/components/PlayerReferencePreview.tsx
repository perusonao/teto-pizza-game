import type { PlayerPizzaReference } from "../data/playerReference";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createIdealDoughShape } from "../logic/doughShape";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import { buildPieceCountLabels, renderPizzaVisualPieces } from "./PizzaVisualPieces";

interface PlayerReferencePreviewProps {
  reference: PlayerPizzaReference;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Mirrors `ReferencePreview`'s own flag: false when a separate always-visible mini
   *  thumbnail (Issue #47 Finding H) already serves as this popover's trigger. */
  renderTrigger?: boolean;
}

const IDEAL_DOUGH_SHAPE = createIdealDoughShape();
const IDEAL_SAUCE_FIXTURE = buildIdealSauceFixture();

/**
 * Issue #47 Slice B Finding F: player-facing completed-pizza reference for every recipe that
 * has no Scoring 2.0 Reference fixture (`../data/referencePizza.ts` stays Margherita-only --
 * see that file's own scope guard, unchanged by this component). Built purely from
 * `../data/playerReference.ts`, itself derived only from Recipe/Ingredient data -- this
 * component never reads Scoring 2.0 data and nothing in Scoring 2.0 reads it. Unlike
 * `ReferencePreview`'s Margherita panel, this one shows no numeric quantity/coverage bars and
 * carries an explicit disclaimer, so a generated placement guide can never read as a real
 * scoring target.
 *
 * Issue #167 PR-B (Reference Truth): as of B2's own full 15/15 recipe coverage, every shipped
 * recipe now has a `getReferencePizza` fixture, so `GameScreen.tsx` never actually falls back to
 * this component in production today -- it is kept as the deliberate defensive path for any
 * future recipe added without one (rather than crashing on a null Reference), and is still
 * fully exercised by this component's own tests. The sauce swatch used to be a flat, ingredient-
 * color-only circle with no coverage/shape signal at all; it now renders through the same
 * `SauceHeatmapCanvas` pipeline PizzaStage/`ReferencePreview` share, fed the same generic
 * `buildIdealSauceFixture()` geometry (ingredient-agnostic "painted evenly, rim left bare" --
 * see referencePizza.ts's own header comment) -- a real painted-coverage picture instead of an
 * unrelated flat fill, while the disclaimer below still makes clear this placement itself is
 * generated, not an exact scoring target.
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

  const pieceCaption = buildPieceCountLabels(reference.pieceGroups).join("、");

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
              {sauceIngredient && (
                <SauceHeatmapCanvas
                  deposits={IDEAL_SAUCE_FIXTURE}
                  doughShape={IDEAL_DOUGH_SHAPE}
                  color={sauceIngredient.color}
                  className={`player-reference-mini-pizza__sauce ${sauceIngredient.id === "olive-oil" ? "pizza-sauce-heatmap--oil" : ""}`}
                />
              )}
              {renderPizzaVisualPieces({
                pieceGroups: reference.pieceGroups,
                wrapperClassName: () => "player-reference-mini-pizza__piece",
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
