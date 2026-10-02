import { useEffect, useId, useRef } from "react";

/**
 * Issue #358 Slice 3 (OD-358-5): shown when 「🔥 焼く！」 is pressed while the declared research ingredient is not on
 * the player's own pizza. It only states what the player can already see (the ingredient is not used yet, so this
 * attempt would not check it); it reads no recipe, no matcher result and never forbids baking -- 「このまま焼く」
 * proceeds exactly as before.
 */
export interface BakeUnusedConfirmProps {
  ingredientNameJa: string;
  /** 「戻って追加する」 (also Esc / backdrop): stay in PREPARE. */
  onBack: () => void;
  /** 「このまま焼く」: the normal START_BAKE. */
  onBake: () => void;
}

export function BakeUnusedConfirm({ ingredientNameJa, onBack, onBake }: BakeUnusedConfirmProps) {
  const titleId = useId();
  const descId = useId();
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  return (
    <div className="pantry-sheet__backdrop" role="presentation" onClick={onBack}>
      <section
        className="bake-unused-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="bake-unused-confirm"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onBack();
            return;
          }
          if (event.key === "Tab") {
            const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled])")];
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2 id={titleId} className="bake-unused-confirm__title">
          🔬 {ingredientNameJa}をまだ使っていません
        </h2>
        <p id={descId} className="bake-unused-confirm__text">
          このまま焼くと、今回の食材調査は行われません。
        </p>
        <div className="bake-unused-confirm__actions">
          <button ref={backRef} type="button" className="cta-button cta-button--primary" onClick={onBack}>
            戻って追加する
          </button>
          <button type="button" className="cta-button cta-button--secondary" onClick={onBake}>
            このまま焼く
          </button>
        </div>
      </section>
    </div>
  );
}
