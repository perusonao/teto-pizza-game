import { useEffect, useId, useRef } from "react";
import { getIngredient } from "../data/ingredients";
import type { HintEmptyKind } from "../logic/discovery/hintTarget";
import type { HintSheetView } from "../state/discoveryHint";
import { IngredientGlyph } from "./IngredientGlyph";

/**
 * Discovery Hint 2.0 (Issue #229, 229-B): the Free Cooking hint bottom sheet.
 *
 * Shows the steps revealed so far (H0 first, newest last) and one CTA for the next step; when
 * there is nothing more to reveal the CTA gives way to a short "the rest is yours" line. With
 * no DISCOVERABLE recipe it shows the Shop / refill / complete message instead.
 *
 * Discovery Hint Economy 1.0 (Issue #232, HE-3): from Dex 1 the CTA unlocks the next level for its
 * price (「🔒 次のヒントを解除 5 Pitz」) with the balance under it (「所持 120 Pitz」). It never says
 * what the level reveals, nor how many levels are left. When the balance is short the CTA is
 * disabled in a neutral grey with a calm line -- not an error: 閉じる and cooking on stay open. The
 * Dex-0 Margherita onboarding shows no price at all. The sheet itself never changes Pitz: the CTA
 * reports the offered level and the reducer's PURCHASE_DISCOVERY_HINT decides.
 *
 * Anti-spoiler: everything rendered comes from `HintSheetView`, which carries hint text and
 * ingredient ids only -- no recipe name, id or image reaches the DOM, `aria-*` or `data-*`.
 * Glyphs go through `IngredientGlyph` (the one audited `.emoji` reader), decorative only.
 *
 * Layout: `position: fixed` over the cooking screen (App.css `.hint-sheet*`), so opening it
 * moves nothing underneath. Cooking input is paused by the caller through the existing
 * `isGlobalOverlayOpen` gate, not by anything in here. Closes like the existing overlays
 * (閉じる button, backdrop tap) plus Escape from inside the dialog.
 */
const EMPTY_COPY: Record<HintEmptyKind, { title: string; body: string }> = {
  SHOP_NEW: {
    title: "\u{1F3EA} ショップに入荷した材料で、新しいピザが作れそう！",
    body: "ホームのショップで、新しい材料をチェックしてみよう。",
  },
  REFILL: {
    title: "\u{1F4E6} 材料が足りないみたい。",
    body: "ホームのショップで、持っている材料を補充しよう。",
  },
  COMPLETE: {
    title: "\u{1F3C6} 図鑑コンプリート！",
    body: "ぜんぶのピザを見つけたよ。好きなピザを作ろう！",
  },
};

export function HintSheet({
  view,
  onUnlock,
  onClose,
}: {
  view: HintSheetView;
  /** Unlocks the offered level (`view.next.level`). */
  onUnlock: (level: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLLIElement>(null);
  const next = view.kind === "TARGET" ? view.next : null;
  const ctaEnabled = !!next && next.affordable;
  const stepCount = view.kind === "TARGET" ? view.steps.length : 0;

  // Opening lands on the next-hint CTA (or 閉じる); when the last step removes the CTA, or a
  // purchase leaves the next one unaffordable (disabled), focus moves to 閉じる instead of falling
  // back to <body>.
  useEffect(() => {
    (ctaEnabled ? nextRef.current : closeRef.current)?.focus();
  }, [ctaEnabled]);

  useEffect(() => {
    latestRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [stepCount]);

  return (
    <div className="hint-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className="hint-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-hint-kind={view.kind}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="hint-sheet__header">
          <h2 id={titleId} className="hint-sheet__title">
            {"\u{1F4A1}"} ヒント
          </h2>
          <button ref={closeRef} type="button" className="hint-sheet__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        {view.kind === "TARGET" ? (
          <>
            <ol className="hint-sheet__steps" aria-live="polite">
              {view.steps.map((step, i) => {
                const ingredient = step.namedIngredientId ? getIngredient(step.namedIngredientId) : undefined;
                const latest = i === view.steps.length - 1;
                return (
                  <li
                    key={i}
                    ref={latest ? latestRef : undefined}
                    className={`hint-sheet__step${latest ? " hint-sheet__step--latest" : ""}`}
                  >
                    {ingredient && (
                      <span className="hint-sheet__glyph" aria-hidden="true">
                        <IngredientGlyph ingredient={ingredient} />
                      </span>
                    )}
                    <span className="hint-sheet__text">{step.textJa}</span>
                  </li>
                );
              })}
            </ol>
            <div className="hint-sheet__footer">
              {!next ? (
                <p className="hint-sheet__done">ヒントはここまで！あとは作って試してみよう。</p>
              ) : next.free ? (
                <>
                  <button ref={nextRef} type="button" className="cta-button hint-sheet__next" onClick={() => onUnlock(next.level)}>
                    次のヒントを見る
                  </button>
                  <p className="hint-sheet__wallet hint-sheet__wallet--free">{"\u{2728}"} はじめてのピザはヒント無料！</p>
                </>
              ) : (
                <>
                  <button
                    ref={nextRef}
                    type="button"
                    className={`cta-button hint-sheet__next hint-sheet__next--paid${next.affordable ? "" : " hint-sheet__next--short"}`}
                    disabled={!next.affordable}
                    onClick={() => onUnlock(next.level)}
                  >
                    <span className="hint-sheet__lock" aria-hidden="true">
                      {"\u{1F512}"}
                    </span>
                    <span className="hint-sheet__next-label">{next.affordable ? "次のヒントを解除" : "次のヒント"}</span>{" "}
                    <span className="hint-sheet__price">{next.price} Pitz</span>
                  </button>
                  <p className="hint-sheet__wallet">所持 {view.pitzBalance} Pitz</p>
                  {!next.affordable && <p className="hint-sheet__wallet hint-sheet__wallet-note">たまったら解除できるよ。このまま作ってもOK！</p>}
                </>
              )}
              {stepCount === 1 && <p className="hint-sheet__note">自分で見つけたいときは、閉じてね。</p>}
            </div>
          </>
        ) : (
          <div className="hint-sheet__empty">
            <p className="hint-sheet__empty-title">{EMPTY_COPY[view.kind].title}</p>
            <p className="hint-sheet__empty-body">{EMPTY_COPY[view.kind].body}</p>
          </div>
        )}
      </section>
    </div>
  );
}
