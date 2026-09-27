import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
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
 *
 * Discovery Hint 3.0 H3-4 (Issue #238, OD-H3-4-1..10): the final SELECTABLE copy and layout. It is
 * presentation only: every branch reads fields the view already carries (`nextPrice`, `affordable`,
 * `onboarding`, `outcome`, the chips, `grandfatheredSteps`) and nothing about what is left to sell.
 * - CTA 「ヒントを1つもらう {n} Pitz」 (no 🔒, OD-H3-4-9). At a price of 0 (the cap is paid) it reads
 *   「ヒントをたずねる」 + 「支払いずみ」 and stays enabled (OD-H3-4-1): on a fresh save that request is
 *   answered with guidance, but a legacy Economy 1.0 buyer gets a real fact there (cap parity), so
 *   the pre-request view must not tell the two apart.
 * - Only after the reducer answered GUIDANCE_ONLY is the CTA disabled and relabelled (OD-H3-4-3).
 * - A fixed line says Pitz is spent only when a hint is given (OD-H3-4-2).
 * - The preference legend says a category is a wish, not a promise, and 「？」 has a fixed legend
 *   that some categories go unused (OD-H3-4-5/6). Both are the same for every target.
 * - Chips revealed by the last request get a light highlight (a diff of this sheet's own chips).
 * - 「以前のヒント」 is an archive box at the end of the body (OD-H3-4-4).
 * - The body shows a fade + chevron while more content is below or above (OD-H3-4-7).
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

/** How long the Selectable CTA ignores further activations after one purchase request. A
 *  double-click (or key repeat) lands its second click after React re-rendered the sheet with the
 *  new paid count, so the reducer's `expectedPaidCount` check alone cannot catch it. */
export const SELECTABLE_BUY_LATCH_MS = 450;

/** OD-H3-17 generic guidance (H3-4: kept verbatim). */
export const SELECTABLE_GUIDANCE_TEXT = "このピザは、今わかっているヒントを手がかりに考えてみよう！";

/** H3-4 SELECTABLE copy (OD-H3-4-1..9). Every string is the same for every target. */
const SELECTABLE_COPY = {
  legend: "知りたいジャンル（ないときは別のジャンルから1つ）",
  unknownLegend: "？＝まだわからない（使わないジャンルもあるよ）",
  cta: "ヒントを1つもらう",
  ctaCapPaid: "ヒントをたずねる",
  capPaidBadge: "支払いずみ",
  ctaAfterGuidance: "今あるヒントはここまで",
  payOnlyWhenGiven: "Pitzはヒントが出たときだけ使うよ",
  capPaidNote: "このピザのヒント代は上限まで支払いずみ",
  noChargeNote: "今回はPitzを使っていないよ",
  shortNote: "Pitzがたまったら、またためしてね。このまま作ってもOK！",
  legacyTitle: "以前のヒント",
  legacyExplainer: "前のヒント方式で買ったメモ（そのまま残してあるよ）",
} as const;

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
  // H3-3: the Selectable CTA's activation latch (see SELECTABLE_BUY_LATCH_MS). The ref blocks a
  // second activation synchronously; the state only mirrors it into `aria-disabled`.
  const buyLatchRef = useRef(false);
  const buyLatchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [buyLatched, setBuyLatched] = useState(false);
  useEffect(
    () => () => {
      if (buyLatchTimer.current) clearTimeout(buyLatchTimer.current);
    },
    [],
  );
  const next = view.kind === "TARGET" ? view.next : null;
  const ctaEnabled =
    view.kind === "SELECTABLE" ? view.presentation.affordable && view.outcome !== "GUIDANCE_ONLY" : !!next && next.affordable;
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
            latched={buyLatched}
            onBuy={() => {
              if (buyLatchRef.current) return;
              buyLatchRef.current = true;
              setBuyLatched(true);
              buyLatchTimer.current = setTimeout(() => {
                buyLatchRef.current = false;
                setBuyLatched(false);
              }, SELECTABLE_BUY_LATCH_MS);
              onBuySelectable(preference, view.presentation.paidCount);
            }}
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

/** H3-4 (OD-H3-4-7): whether the scrollable body has more content below / above its viewport.
 *  Re-measured after every render, on scroll, when the body itself is resized (e.g. a safe-area or
 *  toolbar change that fires no window resize) and on window resize; state only changes when it
 *  differs. */
function useScrollCue(ref: RefObject<HTMLElement | null>) {
  const [cue, setCue] = useState({ above: false, below: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const above = el.scrollTop > 1;
    const below = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
    setCue((prev) => (prev.above === above && prev.below === below ? prev : { above, below }));
  }, [ref]);
  useEffect(measure);
  useEffect(() => {
    window.addEventListener("resize", measure);
    const el = ref.current;
    const observer = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure, ref]);
  return { cue, measure };
}

function SelectableHintBody({
  view,
  preference,
  onPreference,
  buyRef,
  latched,
  onBuy,
}: {
  view: Extract<HintSheetView, { kind: "SELECTABLE" }>;
  preference: HintCategory;
  onPreference: (category: HintCategory) => void;
  buyRef: RefObject<HTMLButtonElement | null>;
  /** Right after a request: further activations are ignored (focus stays on the CTA). */
  latched: boolean;
  onBuy: () => void;
}) {
  const groupName = useId();
  const guidanceRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const freshChipRef = useRef<HTMLSpanElement>(null);
  const { presentation } = view;
  const guided = view.outcome === "GUIDANCE_ONLY";
  // OD-H3-4-1: the cap is paid. The same view whether or not anything is left (a legacy buyer gets
  // a real fact here), so it stays a request, never "free" and never "sold out".
  const capPaid = presentation.nextPrice === 0 && !presentation.onboarding;
  const { cue, measure } = useScrollCue(bodyRef);

  // Chips revealed since the previous render of this open sheet (never on opening it).
  const chipIds = presentation.rows.flatMap((row) => row.revealed.map((chip) => chip.factId));
  const chipKey = chipIds.join(" ");
  const seenChips = useRef<string | null>(null);
  const [freshChips, setFreshChips] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const before = seenChips.current;
    seenChips.current = chipKey;
    if (before === null || before === chipKey) return;
    const known = new Set(before.split(" "));
    setFreshChips(new Set(chipKey.split(" ").filter((id) => id && !known.has(id))));
  }, [chipKey]);
  useEffect(() => {
    if (freshChips.size > 0) freshChipRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [freshChips]);

  // The body scrolls inside the 45dvh sheet: bring the guidance line into view when it appears.
  useEffect(() => {
    if (view.outcome) guidanceRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [view.outcome]);

  let walletNote: string = SELECTABLE_COPY.payOnlyWhenGiven;
  if (guided) walletNote = SELECTABLE_COPY.noChargeNote;
  else if (capPaid) walletNote = SELECTABLE_COPY.capPaidNote;
  const ctaEnabled = presentation.affordable && !guided;
  let firstFresh = true;
  return (
    <>
      <div
        className={`hint-sheet__scroll${cue.above ? " hint-sheet__scroll--above" : ""}${cue.below ? " hint-sheet__scroll--below" : ""}`}
      >
        <div ref={bodyRef} className="hint-sheet__steps hint-sheet__selectable" aria-live="polite" onScroll={measure}>
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
                      const fresh = freshChips.has(chip.factId);
                      const attachRef = fresh && firstFresh;
                      if (attachRef) firstFresh = false;
                      return (
                        <span
                          key={chip.factId}
                          ref={attachRef ? freshChipRef : undefined}
                          className={`hint-sheet__chip${fresh ? " hint-sheet__chip--new" : ""}`}
                        >
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
          <p className="hint-sheet__unknown-legend">{SELECTABLE_COPY.unknownLegend}</p>
          {guided && (
            <p ref={guidanceRef} className="hint-sheet__guidance">
              {SELECTABLE_GUIDANCE_TEXT}
            </p>
          )}
          {view.grandfatheredSteps.length > 0 && (
            // OD-H3-4-4: this player's own Economy 1.0 lines, verbatim. An archive at the end of the
            // body: not a row, chip, price or category.
            <div className="hint-sheet__legacy">
              <p className="hint-sheet__legacy-title">{SELECTABLE_COPY.legacyTitle}</p>
              <p className="hint-sheet__legacy-explainer">{SELECTABLE_COPY.legacyExplainer}</p>
              {view.grandfatheredSteps.map((step) => (
                <p key={step.level} className="hint-sheet__legacy-line">
                  {step.textJa}
                </p>
              ))}
            </div>
          )}
        </div>
        <span className="hint-sheet__scroll-cue" aria-hidden="true">
          {"\u{25BE}"}
        </span>
      </div>
      <div className="hint-sheet__footer hint-sheet__footer--selectable">
        <fieldset className="hint-sheet__prefs">
          <legend className="hint-sheet__prefs-legend">{SELECTABLE_COPY.legend}</legend>
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
          className={`cta-button hint-sheet__next hint-sheet__next--paid${ctaEnabled ? "" : " hint-sheet__next--short"}`}
          disabled={!ctaEnabled}
          aria-disabled={latched || undefined}
          onClick={onBuy}
        >
          {guided ? (
            <span className="hint-sheet__next-label">{SELECTABLE_COPY.ctaAfterGuidance}</span>
          ) : (
            <>
              <span className="hint-sheet__next-label">{capPaid ? SELECTABLE_COPY.ctaCapPaid : SELECTABLE_COPY.cta}</span>{" "}
              <span className="hint-sheet__price">{capPaid ? SELECTABLE_COPY.capPaidBadge : `${presentation.nextPrice} Pitz`}</span>
            </>
          )}
        </button>
        <p className="hint-sheet__wallet">
          所持 {presentation.pitzBalance} Pitz<span className="hint-sheet__wallet-sep"> ・ </span>
          {walletNote}
        </p>
        {!presentation.affordable && !guided && <p className="hint-sheet__wallet hint-sheet__wallet-note">{SELECTABLE_COPY.shortNote}</p>}
      </div>
    </>
  );
}
