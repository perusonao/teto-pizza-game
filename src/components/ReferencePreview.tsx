import type { CSSProperties } from "react";
import type { ReferencePizza } from "../data/referencePizza";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { getIngredient } from "../data/ingredients";
import { createIdealDoughShape } from "../logic/doughShape";
import { SauceHeatmapCanvas } from "./SauceHeatmapCanvas";
import { buildPieceCountLabels, renderPizzaVisualPieces } from "./PizzaVisualPieces";
import { SAUCE_TARGET_RADIUS } from "../logic/sauceField";

interface ReferencePreviewProps {
  reference: ReferencePizza;
  /** B2 (Reference coverage 7/7): this popover now renders for every recipe with a Scoring
   *  2.0 Reference, not just Margherita -- the recipe's own display name, so the title/aria
   *  label never reads "マルゲリータの見本" while making a different recipe. */
  recipeNameJa: string;
  isOpen: boolean;
  /** Phase 4A-1A (Post-Codex-Fix): controlled, not local state -- App.tsx folds `isOpen`
   *  into PizzaStage's `interactive` prop so opening this popover aborts any in-progress
   *  tomato-sauce dispense session exactly like BAKE does (Codex Broad Review MUST FIX 1/9).
   *  A component-local `useState` here could never reach that effect. */
  onOpenChange: (isOpen: boolean) => void;
  /** Issue #47 Slice B Finding H: false when a separate always-visible mini thumbnail
   *  already serves as this popover's trigger, so this component only owns the popover
   *  panel itself. Defaults to true (unchanged existing behavior) so every pre-existing
   *  caller/test that doesn't pass this prop keeps rendering its own inline 見本 button. */
  renderTrigger?: boolean;
}

const IDEAL_DOUGH_SHAPE = createIdealDoughShape();
const IDEAL_SAUCE_FIXTURE = buildIdealSauceFixture();

/**
 * Phase 4A-1A: "見本" (Reference) button + compact popover. Shown during FREE PREPARE for any
 * recipe with a Scoring 2.0 Reference fixture (see App.tsx's `referenceModeEnabled` gating --
 * originally Margherita-only, now every recipe B2 has covered) so the player can check what
 * they're aiming for without a permanent on-screen image crowding the 390x844 layout.
 *
 * The popover renders a small static illustration, not the real interactive PizzaStage --
 * it never accepts pointer input itself, and its full-screen backdrop intercepts every tap
 * while open so a mis-tap can never reach the dough underneath (requirement: "Reference
 * 表示中でも誤操作しないこと"). Opening it also ends any active dispense session outright
 * (see `isOpen`'s doc comment) rather than merely blocking taps on top of a live one.
 *
 * Issue #167 PR-B (Reference Truth): the sauce circle used to be a flat color scaled/faded by
 * `reference.sauce.coverage` alone (`transform: scale(0.55 + coverage*0.4)`) -- a single number
 * standing in for "how much sauce", with no shape/spread information at all, and visually
 * nothing like PizzaStage's own real painted heatmap. It now renders the exact same
 * deterministic `buildIdealSauceFixture()` deposit sequence `reference.sauce.quantity`/
 * `.coverage` are themselves derived from (see referencePizza.ts's own header comment), through
 * the same `SauceHeatmapCanvas` pipeline PizzaStage's live gesture uses -- the popover's sauce
 * patch is now a real "painted this way" picture, not a proxy shape, and can never silently
 * drift from the numeric bars still shown below it (both read the same fixture/metrics).
 */
export function ReferencePreview({
  reference,
  recipeNameJa,
  isOpen,
  onOpenChange,
  renderTrigger = true,
}: ReferencePreviewProps) {
  const sauceIngredient = getIngredient(reference.sauce.ingredientId);
  const pieceCaption = buildPieceCountLabels(reference.pieceGroups).join("と");

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
            aria-label={`${recipeNameJa}の見本`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reference-preview__header">
              <h2>{recipeNameJa} 見本</h2>
              <button
                type="button"
                className="reference-preview__close"
                onClick={() => onOpenChange(false)}
              >
                閉じる
              </button>
            </div>

            <div className="reference-mini-pizza" aria-hidden="true">
              {/* Human Feel Fix 2 (Target Area Guide, brief section 2): the same
                  SAUCE_TARGET_RADIUS boundary PizzaStage's own guide ring uses, so the
                  Reference popover never shows a different "leave the ear" area than the
                  one the player's own dough guide (and edgeAmount/edgeRatio scoring) uses. */}
              <div
                className="reference-mini-pizza__target-guide"
                style={{ "--target-radius": `${SAUCE_TARGET_RADIUS}%` } as CSSProperties}
              />
              {sauceIngredient && (
                <SauceHeatmapCanvas
                  deposits={IDEAL_SAUCE_FIXTURE}
                  doughShape={IDEAL_DOUGH_SHAPE}
                  color={sauceIngredient.color}
                  className={`reference-mini-pizza__sauce ${sauceIngredient.id === "olive-oil" ? "pizza-sauce-heatmap--oil" : ""}`}
                />
              )}
              {renderPizzaVisualPieces({
                pieceGroups: reference.pieceGroups,
                wrapperClassName: (ingredientId) =>
                  `reference-mini-pizza__topping reference-mini-pizza__topping--${ingredientId}`,
              })}
            </div>

            <p className="reference-preview__caption">
              {sauceIngredient?.nameJa ?? "ソース"}をまんべんなく塗って、{pieceCaption}
              を見本に近く置こう。
            </p>

            <div className="reference-preview__bar-row">
              <span className="reference-preview__bar-label">ソース量の目安</span>
              <div className="reference-preview__bar">
                <div
                  className="reference-preview__bar-fill"
                  style={{ width: `${reference.sauce.quantity * 100}%` }}
                />
              </div>
            </div>
            <div className="reference-preview__bar-row">
              <span className="reference-preview__bar-label">塗り広げの目安</span>
              <div className="reference-preview__bar">
                <div
                  className="reference-preview__bar-fill"
                  style={{ width: `${reference.sauce.coverage * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
