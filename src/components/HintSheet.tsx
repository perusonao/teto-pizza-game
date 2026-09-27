import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { getIngredient } from "../data/ingredients";
import type { HintEmptyKind } from "../logic/discovery/hintTarget";
import type { HintCategory } from "../logic/discovery/selectableHint";
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
 *
 * Discovery Hint 3.0 (Issue #238, H3-3): every target except the Dex-0 Margherita onboarding renders
 * the `SELECTABLE` view -- the H0 line, three category rows with the facts revealed so far (the free
 * key included), this player's own earlier Economy 1.0 lines (「以前のヒント」), a category
 * preference and one CTA for one more fact at `nextPrice`. The rows and the three preferences are
 * the same for every target, so nothing says how many facts are left or which category has one.
 * The CTA reports `(preference, paidCount)` and the reducer's PURCHASE_SELECTABLE_HINT decides. A
 * request with nothing left to sell shows the generic guidance line only (OD-H3-17).
 * H3-4 TODO: final copy, chip styling, preference control polish, Human Verification.
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

const CATEGORY_LABEL: Record<HintCategory, string> = {
  sauce: "ソース",
  cheese: "チーズ",
  topping: "トッピング",
};

/** OD-H3-17 generic guidance. H3-4 TODO: final copy. */
export const SELECTABLE_GUIDANCE_TEXT = "このピザは、今わかっているヒントを手がかりに考えてみよう！";

export function HintSheet({
  view,
  onUnlock,
  onBuySelectable = () => {},
  onClose,
}: {
  view: HintSheetView;
  /** Unlocks the offered level (`view.next.level`). */
  onUnlock: (level: number) => void;
  /** H3-3: buys one Selectable Hint fact, echoing the paid count the sheet showed. */
  onBuySelectable?: (preference: HintCategory, expectedPaidCount: number) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLLIElement>(null);
  const [preference, setPreference] = useState<HintCategory>("sauce");
  const next = view.kind === "TARGET" ? view.next : null;
  const ctaEnabled = view.kind === "SELECTABLE" ? view.presentation.affordable : !!next && next.affordable;
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

        {view.kind === "SELECTABLE" ? (
          <SelectableHintBody
            view={view}
            preference={preference}
            onPreference={setPreference}
            buyRef={nextRef}
            onBuy={() => onBuySelectable(preference, view.presentation.paidCount)}
          />
        ) : view.kind === "TARGET" ? (
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

function SelectableHintBody({
  view,
  preference,
  onPreference,
  buyRef,
  onBuy,
}: {
  view: Extract<HintSheetView, { kind: "SELECTABLE" }>;
  preference: HintCategory;
  onPreference: (category: HintCategory) => void;
  buyRef: RefObject<HTMLButtonElement | null>;
  onBuy: () => void;
}) {
  const groupName = useId();
  const guidanceRef = useRef<HTMLParagraphElement>(null);
  const { presentation } = view;
  // The body scrolls inside the 45dvh sheet: bring the guidance line into view when it appears.
  useEffect(() => {
    if (view.outcome) guidanceRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [view.outcome]);
  return (
    <>
      <div className="hint-sheet__steps hint-sheet__selectable" aria-live="polite">
        <p className="hint-sheet__step">
          <span className="hint-sheet__text">{view.existenceText}</span>
        </p>
        <ul className="hint-sheet__rows">
          {presentation.rows.map((row) => (
            <li key={row.category} className="hint-sheet__row" data-hint-category={row.category}>
              <span className="hint-sheet__row-label">{CATEGORY_LABEL[row.category]}</span>
              <span className="hint-sheet__chips">
                {row.revealed.length === 0 ? (
                  <span className="hint-sheet__chip hint-sheet__chip--unknown">？</span>
                ) : (
                  row.revealed.map((chip) => {
                    const ingredient = getIngredient(chip.ingredientId);
                    return (
                      <span key={chip.factId} className="hint-sheet__chip">
                        {ingredient && (
                          <span className="hint-sheet__glyph" aria-hidden="true">
                            <IngredientGlyph ingredient={ingredient} />
                          </span>
                        )}
                        {ingredient?.nameJa ?? chip.ingredientId}
                      </span>
                    );
                  })
                )}
              </span>
            </li>
          ))}
        </ul>
        {view.grandfatheredSteps.length > 0 && (
          // H3-4 TODO (H3-2 Result Report §25): final presentation of the legacy lines.
          <div className="hint-sheet__legacy">
            <p className="hint-sheet__legacy-title">以前のヒント</p>
            {view.grandfatheredSteps.map((step) => (
              <p key={step.level} className="hint-sheet__step">
                <span className="hint-sheet__text">{step.textJa}</span>
              </p>
            ))}
          </div>
        )}
        {view.outcome === "GUIDANCE_ONLY" && (
          <p ref={guidanceRef} className="hint-sheet__guidance">
            {SELECTABLE_GUIDANCE_TEXT}
          </p>
        )}
      </div>
      <div className="hint-sheet__footer">
        <fieldset className="hint-sheet__prefs">
          <legend className="hint-sheet__prefs-legend">どれのヒントがほしい？</legend>
          {presentation.preferences.map((category) => (
            <label key={category} className={`hint-sheet__pref${preference === category ? " hint-sheet__pref--on" : ""}`}>
              <input
                type="radio"
                name={groupName}
                value={category}
                checked={preference === category}
                onChange={() => onPreference(category)}
              />
              {CATEGORY_LABEL[category]}
            </label>
          ))}
        </fieldset>
        <button
          ref={buyRef}
          type="button"
          className={`cta-button hint-sheet__next hint-sheet__next--paid${presentation.affordable ? "" : " hint-sheet__next--short"}`}
          disabled={!presentation.affordable}
          onClick={onBuy}
        >
          <span className="hint-sheet__lock" aria-hidden="true">
            {"\u{1F512}"}
          </span>
          <span className="hint-sheet__next-label">{presentation.affordable ? "ヒントを1つ解除" : "ヒント"}</span>{" "}
          <span className="hint-sheet__price">{presentation.nextPrice} Pitz</span>
        </button>
        <p className="hint-sheet__wallet">所持 {presentation.pitzBalance} Pitz</p>
        {!presentation.affordable && <p className="hint-sheet__wallet hint-sheet__wallet-note">たまったら解除できるよ。このまま作ってもOK！</p>}
      </div>
    </>
  );
}
