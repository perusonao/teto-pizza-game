import type { CSSProperties } from "react";
import type { ReferencePizza } from "../data/referencePizza";
import { getIngredient } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { stablePieceRotation } from "../logic/pieceDrag";
import { SAUCE_TARGET_RADIUS } from "../logic/sauceField";

interface ReferencePreviewProps {
  reference: ReferencePizza;
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

/**
 * Phase 4A-1A: "見本" (Reference) button + compact popover. Shown only during Margherita
 * FREE PREPARE (see App.tsx's `referenceModeEnabled` gating) so the player can check what
 * they're aiming for without a permanent on-screen image crowding the 390x844 layout.
 *
 * The popover renders a small static illustration, not the real interactive PizzaStage --
 * it never accepts pointer input itself, and its full-screen backdrop intercepts every tap
 * while open so a mis-tap can never reach the dough underneath (requirement: "Reference
 * 表示中でも誤操作しないこと"). Opening it also ends any active dispense session outright
 * (see `isOpen`'s doc comment) rather than merely blocking taps on top of a live one.
 */
export function ReferencePreview({
  reference,
  isOpen,
  onOpenChange,
  renderTrigger = true,
}: ReferencePreviewProps) {
  const sauceIngredient = getIngredient(reference.sauce.ingredientId);

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
            aria-label="マルゲリータの見本"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reference-preview__header">
              <h2>マルゲリータ 見本</h2>
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
              <div
                className="reference-mini-pizza__sauce"
                style={{
                  backgroundColor: sauceIngredient?.color ?? "#c73b2e",
                  opacity: 0.35 + reference.sauce.coverage * 0.5,
                  transform: `scale(${0.55 + reference.sauce.coverage * 0.4})`,
                }}
              />
              {reference.pieceGroups.flatMap((group) => {
                const ingredient = getIngredient(group.ingredientId);
                if (!ingredient) return [];
                return group.positions.map((position, index) => (
                  <span
                    key={`${group.ingredientId}-${index}`}
                    className={`reference-mini-pizza__topping reference-mini-pizza__topping--${group.ingredientId}`}
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
              ソースをまんべんなく塗って、モッツァレラ3個とバジル2枚を見本に近く置こう。
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
