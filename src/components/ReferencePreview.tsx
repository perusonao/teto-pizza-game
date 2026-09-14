import { useState } from "react";
import type { ReferencePizza } from "../data/referencePizza";
import { getIngredient } from "../data/ingredients";

interface ReferencePreviewProps {
  reference: ReferencePizza;
}

/**
 * Phase 4A-1A: "見本" (Reference) button + compact popover. Shown only during Margherita
 * FREE PREPARE (see App.tsx's `referenceModeEnabled` gating) so the player can check what
 * they're aiming for without a permanent on-screen image crowding the 390x844 layout.
 *
 * The popover renders a small static illustration, not the real interactive PizzaStage --
 * it never accepts pointer input itself, and its full-screen backdrop intercepts every tap
 * while open so a mis-tap can never reach the dough underneath (requirement: "Reference
 * 表示中でも誤操作しないこと").
 */
export function ReferencePreview({ reference }: ReferencePreviewProps) {
  const [isOpen, setOpen] = useState(false);
  const sauceIngredient = getIngredient(reference.sauce.ingredientId);

  return (
    <>
      <button
        type="button"
        className="reference-preview__button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        {"\u{1F4D0}"} 見本
      </button>

      {isOpen && (
        <div
          className="reference-preview__backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
              >
                閉じる
              </button>
            </div>

            <div className="reference-mini-pizza" aria-hidden="true">
              <div
                className="reference-mini-pizza__sauce"
                style={{
                  backgroundColor: sauceIngredient?.color ?? "#c73b2e",
                  opacity: 0.35 + reference.sauce.coverage * 0.5,
                  transform: `scale(${0.55 + reference.sauce.coverage * 0.4})`,
                }}
              />
              <span className="reference-mini-pizza__topping" style={{ left: "35%", top: "38%" }}>
                {"\u{1F9C0}"}
              </span>
              <span className="reference-mini-pizza__topping" style={{ left: "62%", top: "32%" }}>
                {"\u{1F9C0}"}
              </span>
              <span className="reference-mini-pizza__topping" style={{ left: "50%", top: "62%" }}>
                {"\u{1F9C0}"}
              </span>
              <span className="reference-mini-pizza__topping" style={{ left: "44%", top: "52%" }}>
                {"\u{1F33F}"}
              </span>
              <span className="reference-mini-pizza__topping" style={{ left: "60%", top: "58%" }}>
                {"\u{1F33F}"}
              </span>
            </div>

            <p className="reference-preview__caption">
              トマトソースは生地全体にまんべんなく、ふちを少し残して塗るのが目安だよ。
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
