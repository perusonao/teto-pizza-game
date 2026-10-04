import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { getIngredient } from "../data/ingredients";
import type { HintEmptyKind } from "../logic/discovery/hintTarget";
import type { HintCategory } from "../logic/discovery/selectableHint";
import type { HintSheetView } from "../state/discoveryHint";
import { circledOrdinal, type Hint5BoardEntry, type Hint5Presentation, type Hint5RungKind } from "../logic/discovery/hint5Ladder";
import type { TrialEntryView } from "../logic/discovery/trialNotebook";
import { IngredientGlyph } from "./IngredientGlyph";
import { CHOOSE_RESEARCH_COPY, OPEN_POOL_ACTIONS } from "./openPoolCopy";
import { TrialNotebookSheet } from "./TrialNotebookSheet";
import { RESEARCH_UX_COPY } from "./researchUxCopy";

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
 *
 * Discovery Hint 4.0 DH4-2C (Issue #283, OD-DH4-2-6..10, audit §10-§16): the U3-C sheet supersedes
 * the H3-4 layout and copy above (the 「ヒントを1つもらう」 CTA, the 「？」 rows and their legend, the
 * persistent preference row, the 45dvh cap). See `SelectableHintBody`: a 「わかっていること」 board with
 * a compact 「ヒントをもらう」 footer, and a transient family panel whose cards each ask with
 * 「たずねる」. The cap parity (OD-H3-4-1), the latch, the legacy archive and the anti-spoiler rule
 * are unchanged.
 *
 * Discovery Hint 5.0 H5-3 (Issue #292, Final Design §8, OD-H5-U1 / M3): when the caller passes a
 * `hint5` view (only with the Hint 5.0 flag ON), the SELECTABLE body is replaced by the linear ladder
 * (`Hint5LadderBody`):
 * - the board shows the COMPLETED rungs (names, the total, 「サブトッピング① 🥩 肉系」);
 * - the footer offers exactly ONE next rung, with its fixed label, a fixed description, its normal
 *   P-C price and 「たずねる」.
 *
 * Nothing before a request depends on the target's unbought content or on what the player already
 * knows. The only exception is the archive of the player's own earlier names (「以前のヒント」).
 * 「このヒントはもう知っていたよ！」 is shown only after a request that the reducer completed for
 * 0 Pitz (`HINT5_ALREADY_KNOWN`). With `hint5` absent (the flag OFF, every build) the sheet renders
 * exactly as before.
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
  OPEN_POOL: {
    title: "\u{1F3A8} まだ発見できるピザがあるよ！",
    body: "いろいろな材料の組み合わせで、レシピ発見を試してみよう。",
  },
  COMPLETE: {
    title: "\u{1F3C6} 図鑑コンプリート！",
    body: "ぜんぶのピザを見つけたよ。好きなピザを作ろう！",
  },
};

/** IP-1: how the OPEN_POOL sheet reaches the existing pantry. `open`: the pantry is available on this step (the caller
 *  closes the sheet and opens it). `later`: the pantry exists this round but not on this step (DOUGH). Absent: no pantry. */
export type HintPantryAccess = { kind: "open"; onOpen: () => void } | { kind: "later" };

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

/** H3-4 SELECTABLE copy (OD-H3-4-1..9), revised for the DH4-2C U3-C sheet (OD-DH4-2-6..9, audit
 *  §13-§15). Every string is the same for every target. */
const SELECTABLE_COPY = {
  boardTitle: "わかっていること",
  /** The entry CTA (no price, audit §14) and the family panel's title. */
  askTitle: "ヒントをもらう",
  back: "もどる",
  ask: "たずねる",
  capPaidBadge: "支払いずみ",
  owned: "✓ もらいずみ",
  payOnlyWhenGiven: "Pitzはヒントが出たときだけ使うよ",
  capPaidNote: "このピザのヒント代は上限まで支払いずみ",
  shortNote: "Pitzがたまったら、またためしてね。このまま作ってもOK！",
  legacyTitle: "以前のヒント",
  legacyExplainer: "前のヒント方式で買ったメモ（そのまま残してあるよ）",
  materialDone: "材料ヒントはここまで（Pitzは使っていないよ）",
  moreFamilies: "構成・特徴のヒントもあるよ",
  structureNothingNew: "今は新しくわかることがなかったよ（Pitzは使っていないよ）",
  attributeNothingYet: "今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）。材料がふえると、わかることがあるかも",
  preferenceLegend: "知りたいジャンル",
  anyPreference: "おまかせ",
} as const;

export type HintFamily = "material" | "structure" | "attribute";

/** OD-DH4-2-6 / audit §14: the family cards. The same for every target; a card never shows
 *  availability, granularity or a candidate count. */
const FAMILY_CARDS: Record<HintFamily, { title: string; description: string; notes: readonly string[] }> = {
  material: {
    title: "材料ヒント",
    description: "材料の名前を1つ教えるよ",
    notes: ["えらんだジャンルに無いときは、ほかのジャンルから教えるよ", "もう教えられる材料がないときは、Pitzは使わないよ"],
  },
  structure: { title: "構成ヒント", description: "材料の数を教えるよ", notes: [] },
  attribute: { title: "特徴ヒント", description: "まだわからない材料の「なかま」を教えるよ", notes: [] },
};

/** The no-charge outcome that belongs to each family (audit §15). Each is shown on its own card
 *  only, so a refused request of one family never shows another family's line. */
const NO_CHARGE_OUTCOME: Record<HintFamily, readonly string[]> = {
  material: ["GUIDANCE_ONLY"],
  structure: ["STRUCTURE_GUIDANCE_ONLY", "STRUCTURE_ALREADY_OWNED"],
  attribute: ["ATTRIBUTE_EXISTENCE_ONLY", "ATTRIBUTE_ALREADY_OWNED"],
};
const outcomeFamily = (outcome: string | null | undefined): HintFamily | null =>
  outcome ? ((Object.keys(NO_CHARGE_OUTCOME) as HintFamily[]).find((f) => NO_CHARGE_OUTCOME[f].includes(outcome)) ?? null) : null;

/** The 材料 preference chips. 「おまかせ」 is the existing fallback order (sauce -> cheese -> topping),
 *  which is exactly what a 「ソース」 preference resolves to, so it adds no new authority. */
const PREFERENCE_CHIPS: readonly { id: string; label: string; category: HintCategory }[] = [
  { id: "any", label: SELECTABLE_COPY.anyPreference, category: "sauce" },
  { id: "sauce", label: CATEGORY_LABEL.sauce, category: "sauce" },
  { id: "cheese", label: CATEGORY_LABEL.cheese, category: "cheese" },
  { id: "topping", label: CATEGORY_LABEL.topping, category: "topping" },
];
export function HintSheet({
  view,
  hint5 = null,
  hint5Active = false,
  onUnlock,
  onBuySelectable = () => {},
  onBuyHint5 = () => {},
  notebook = [],
  pantry,
  onChooseResearch,
  researchLabelJa = null,
  onClose,
}: {
  view: HintSheetView;
  /** Hint 5.0 (H5-3): the ladder view model, present only with the Hint 5.0 flag ON. */
  hint5?: Hint5Presentation | null;
  /** Hint 5.0 (H5-4, fail closed): the ladder serves this sheet (the flag is ON and the target is not the
   *  Dex-0 onboarding). With `hint5` null (a target outside the ladder, e.g. a missing taxonomy row),
   *  the sheet then offers nothing to buy: never the 材料 / 構成 / 特徴 body (OD-H5-T-COV, RETIRE). */
  hint5Active?: boolean;
  /** Hint 5.0: request the offered rung, echoing its index. The reducer's PURCHASE_HINT5_RUNG decides. */
  onBuyHint5?: (expectedRungIndex: number) => void;
  /** Unlocks the offered level (`view.next.level`). */
  onUnlock: (level: number) => void;
  /** H3-3 / DH4-2C: one request of `family` (材料 with its preference, or 構成 / 特徴), echoing the
   *  paid count the sheet showed. The reducer's PURCHASE_SELECTABLE_HINT decides. */
  onBuySelectable?: (preference: HintCategory, expectedPaidCount: number, family?: HintFamily) => void;
  /** Notebook N1: the player's own session-only attempts (the notebook display view), read-only. The 「試作ノートを見る」
   *  entry is the same for every view kind and every target; its open state is UI-only (nothing dispatched). */
  notebook?: readonly TrialEntryView[];
  /** IP-1: the way from OPEN_POOL to the existing pantry (UI navigation only; see `HintPantryAccess`). */
  pantry?: HintPantryAccess;
  /** #353: the way from CHOOSE_RESEARCH to the Dex's anonymous Research cards (UI navigation only). */
  onChooseResearch?: () => void;
  /** Research UX Phase 1: the Research Target's already-public label (「？？？ピザ ①」), shown as one context line. Never a
   *  recipe name or id; `null` (no valid target) renders nothing. */
  researchLabelJa?: string | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLLIElement>(null);
  const [preferenceId, setPreferenceId] = useState<string>("any");
  // H3-3: the request CTA's activation latch (see SELECTABLE_BUY_LATCH_MS). The ref blocks a second
  // activation synchronously; the state only mirrors it into `aria-disabled`.
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
  const ladder = view.kind === "SELECTABLE" ? hint5 : null;
  const ladderClosed = view.kind === "SELECTABLE" && !ladder && hint5Active;
  // SELECTABLE: the 「ヒントをもらう」 entry is always enabled (it only opens the family panel; the
  // panel manages its own focus). Hint 5.0: the one rung request, whenever a rung is offered (#360 S3:
  // never gated on the balance, so the sheet cannot tell a fully known rung from an unknown one).
  const ctaEnabled = ladder ? !!ladder.next : ladderClosed ? false : view.kind === "SELECTABLE" ? true : !!next && next.affordable;
  const latch = (): boolean => {
    if (buyLatchRef.current) return false;
    buyLatchRef.current = true;
    setBuyLatched(true);
    buyLatchTimer.current = setTimeout(() => {
      buyLatchRef.current = false;
      setBuyLatched(false);
    }, SELECTABLE_BUY_LATCH_MS);
    return true;
  };
  const stepCount = view.kind === "TARGET" ? view.steps.length : 0;
  const [notebookOpen, setNotebookOpen] = useState(false);
  const notebookEntryRef = useRef<HTMLButtonElement>(null);
  const closeNotebook = () => {
    setNotebookOpen(false);
    // Hand focus back to the entry that opened the notebook (it unmounts with the sheet's own close).
    queueMicrotask(() => notebookEntryRef.current?.focus());
  };

  // Opening lands on the request CTA (or 閉じる); when a request leaves it disabled, focus moves to
  // 閉じる instead of falling back to <body>.
  useEffect(() => {
    (ctaEnabled ? nextRef.current : closeRef.current)?.focus();
  }, [ctaEnabled]);

  useEffect(() => {
    latestRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [stepCount]);

  return (
    <div className="hint-sheet__backdrop" role="presentation" onClick={onClose}>
      <section
        className={`hint-sheet${view.kind === "SELECTABLE" ? " hint-sheet--u3" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-hint-kind={view.kind}
        data-hint-ladder={ladder ? "hint5" : ladderClosed ? "hint5-closed" : undefined}
        // Notebook N1: while the notebook is over this sheet nothing underneath may take focus or a keypress
        // (Shift+Tab / Enter / Escape would otherwise act on the Hint behind it).
        inert={notebookOpen || undefined}
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
          <div className="hint-sheet__header-actions">
            <button ref={notebookEntryRef} type="button" className="hint-sheet__notebook-entry" aria-haspopup="dialog" onClick={() => setNotebookOpen(true)}>
              {"\u{1F4D3}"} 試作ノートを見る
            </button>
            <button ref={closeRef} type="button" className="hint-sheet__close" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>

        {researchLabelJa && (
          <p className="hint-sheet__research" data-hint-research="">
            {RESEARCH_UX_COPY.contextLine(researchLabelJa)}
          </p>
        )}

        {view.kind === "SELECTABLE" && ladder ? (
          <Hint5LadderBody
            view={view}
            ladder={ladder}
            ctaRef={nextRef}
            latched={buyLatched}
            onBuy={(rungIndex) => {
              if (latch()) onBuyHint5(rungIndex);
            }}
          />
        ) : view.kind === "SELECTABLE" && ladderClosed ? (
          <>
            <p className="hint-sheet__caption">{view.existenceText}</p>
            <div className="hint-sheet__footer hint-sheet__footer--selectable hint-sheet__footer--h5">
              <p className="hint-sheet__guidance">{HINT5_COPY.unavailable}</p>
            </div>
          </>
        ) : view.kind === "SELECTABLE" ? (
          <SelectableHintBody
            view={view}
            entryRef={nextRef}
            preferenceId={preferenceId}
            onPreference={setPreferenceId}
            latched={buyLatched}
            onBuy={(family) => {
              if (!latch()) return;
              if (family === "material" || !view.deduction) {
                const category = PREFERENCE_CHIPS.find((p) => p.id === preferenceId)?.category ?? "sauce";
                onBuySelectable(category, view.presentation.paidCount, "material");
              } else {
                onBuySelectable("sauce", view.deduction.paidCount, family);
              }
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
          <div className="hint-sheet__empty" {...(view.kind === "CHOOSE_RESEARCH" ? { "data-choose-research": true } : {})}>
            <p className="hint-sheet__empty-title">{view.kind === "CHOOSE_RESEARCH" ? CHOOSE_RESEARCH_COPY.title : EMPTY_COPY[view.kind].title}</p>
            <p className="hint-sheet__empty-body">{view.kind === "CHOOSE_RESEARCH" ? CHOOSE_RESEARCH_COPY.body : EMPTY_COPY[view.kind].body}</p>
            {view.kind === "CHOOSE_RESEARCH" && onChooseResearch && (
              <div className="hint-sheet__open-pool-actions">
                <button type="button" className="cta-button hint-sheet__pantry-entry" onClick={onChooseResearch}>
                  {CHOOSE_RESEARCH_COPY.button}
                </button>
              </div>
            )}
            {(view.kind === "OPEN_POOL" || view.kind === "CHOOSE_RESEARCH") && (
              <div className="hint-sheet__open-pool-actions" data-open-pool-actions>
                <p className="hint-sheet__empty-body">{OPEN_POOL_ACTIONS.notebook}</p>
                {pantry?.kind === "open" ? (
                  <>
                    <p className="hint-sheet__empty-body">{OPEN_POOL_ACTIONS.pantryOpen}</p>
                    <button type="button" className="cta-button hint-sheet__pantry-entry" onClick={pantry.onOpen}>
                      {OPEN_POOL_ACTIONS.pantryButton}
                    </button>
                  </>
                ) : pantry?.kind === "later" ? (
                  <p className="hint-sheet__empty-body">{OPEN_POOL_ACTIONS.pantryLater}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>
      {/* Rendered beside (not inside) the sheet: the sheet's own transform would re-anchor a fixed child. */}
      {notebookOpen && <TrialNotebookSheet entries={notebook} onBack={closeNotebook} researchLabelJa={researchLabelJa} />}
    </div>
  );
}

type SelectableView = Extract<HintSheetView, { kind: "SELECTABLE" }>;

interface FamilyCta {
  enabled: boolean;
  /** Button label and price badge; `null` badge = none. */
  label: string;
  badge: string | null;
  /** The no-charge outcome line of this family, shown in place of the button. */
  outcomeLine: string | null;
  /** The balance is short for this card's price (and nothing else disables it). */
  short: boolean;
}

/** The request button of one family, from fields the view already carries (own ledger, price,
 *  balance) and the no-charge outcomes this sheet already received -- never from what is left to
 *  sell. `settled`: this family got its no-charge outcome during this sheet session (audit §15:
 *  disabled for the rest of the session). */
function familyCta(view: SelectableView, family: HintFamily, settled: boolean): FamilyCta {
  if (family === "material") {
    const { presentation } = view;
    // OD-H3-4-1: the cap is paid. The same view whether or not anything is left (a legacy buyer gets
    // a real fact here), so it stays a request, never "free" and never "sold out".
    const capPaid = presentation.nextPrice === 0 && !presentation.onboarding;
    if (settled) return { enabled: false, label: SELECTABLE_COPY.ask, badge: null, outcomeLine: SELECTABLE_COPY.materialDone, short: false };
    return {
      enabled: presentation.affordable,
      label: SELECTABLE_COPY.ask,
      badge: capPaid ? SELECTABLE_COPY.capPaidBadge : `${presentation.nextPrice} Pitz`,
      outcomeLine: null,
      short: !presentation.affordable,
    };
  }
  const d = view.deduction!;
  if (family === "structure" ? d.structureOwned : d.attributeOwned) {
    return { enabled: false, label: SELECTABLE_COPY.owned, badge: null, outcomeLine: null, short: false };
  }
  if (settled) {
    const line = family === "structure" ? SELECTABLE_COPY.structureNothingNew : SELECTABLE_COPY.attributeNothingYet;
    return { enabled: false, label: SELECTABLE_COPY.ask, badge: null, outcomeLine: line, short: false };
  }
  return { enabled: d.affordable, label: SELECTABLE_COPY.ask, badge: `${d.nextPrice} Pitz`, outcomeLine: null, short: !d.affordable };
}

/** H3-4 (OD-H3-4-7): whether the scrollable body has more content below / above its viewport.
 *  Re-measured after every render, on scroll, when the body itself is resized (e.g. a safe-area or
 *  toolbar change that fires no window resize) and on window resize; state only changes when it
 *  differs. */
function useScrollCue(ref: RefObject<HTMLElement | null>, mountKey: unknown = null) {
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
    // `mountKey` changes when the scroll element is re-mounted (the board <-> panel step).
  }, [measure, ref, mountKey]);
  return { cue, measure };
}

/** Every fact on the board, as keys: 材料 fact ids, then the 構成 / 特徴 lines. */
function boardKeys(view: SelectableView): string[] {
  return [
    ...view.presentation.rows.flatMap((row) => row.revealed.map((chip) => chip.factId)),
    ...(view.deduction?.structureLines ?? []).map((line) => `structure:${line}`),
    ...(view.deduction?.attributeLines ?? []).map((line) => `attribute:${line}`),
  ];
}

/** 材料 chips grouped by category, catalog order inside a category. Empty categories are omitted
 *  (OD-DH4-2-8: no 「？」 rows). */
function MaterialFacts({ view, fresh }: { view: SelectableView; fresh: ReadonlySet<string> }) {
  const rows = view.presentation.rows.filter((row) => row.revealed.length > 0);
  if (rows.length === 0) return null;
  return (
    <div className="hint-sheet__section" data-hint-section="material">
      <p className="hint-sheet__section-label">材料</p>
      <ul className="hint-sheet__rows">
        {rows.map((row) => (
          <li key={row.category} className="hint-sheet__row" data-hint-category={row.category}>
            <span className="hint-sheet__row-label">{CATEGORY_LABEL[row.category]}</span>
            <span className="hint-sheet__chips">
              {row.revealed.map((chip) => {
                const ingredient = getIngredient(chip.ingredientId);
                return (
                  <span key={chip.factId} className={`hint-sheet__chip${fresh.has(chip.factId) ? " hint-sheet__chip--new" : ""}`}>
                    {ingredient && (
                      <span className="hint-sheet__glyph" aria-hidden="true">
                        <IngredientGlyph ingredient={ingredient} />
                      </span>
                    )}
                    {ingredient?.nameJa ?? chip.ingredientId}
                  </span>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FactSection({ id, label, lines, fresh }: { id: "structure" | "attribute"; label: string; lines: readonly string[]; fresh: ReadonlySet<string> }) {
  if (lines.length === 0) return null;
  return (
    <div className="hint-sheet__section" data-hint-section={id}>
      <p className="hint-sheet__section-label">{label}</p>
      {lines.map((line) => (
        <p key={line} className={`hint-sheet__fact-line${fresh.has(`${id}:${line}`) ? " hint-sheet__fact-line--new" : ""}`}>
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * DH4-2C U3-C (OD-DH4-2-6/7, audit §10-§15). Two steps inside the one dialog:
 * - the BOARD: 「わかっていること」 is the only scroll area; the fixed footer is one
 *   「ヒントをもらう」 button (no price) plus the Pitz line (OD-DH4-2-7: known information first);
 * - the PANEL (transient, replaces board + footer): one card per family -- 材料 always, 構成 / 特徴
 *   only when the view carries `deduction` (the E3 flag) -- each with its own 「たずねる」 request.
 * A request that adds a fact returns to the board (the new fact highlighted); a no-charge outcome
 * stays on its own card, which is then disabled for this sheet session.
 */
function SelectableHintBody({
  view,
  entryRef,
  preferenceId,
  onPreference,
  latched,
  onBuy,
}: {
  view: SelectableView;
  entryRef: RefObject<HTMLButtonElement | null>;
  preferenceId: string;
  onPreference: (id: string) => void;
  /** Right after a request: further activations are ignored. */
  latched: boolean;
  onBuy: (family: HintFamily) => void;
}) {
  const groupName = useId();
  const panelTitleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const { presentation, deduction } = view;
  const [panelOpen, setPanelOpen] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);
  const { cue, measure } = useScrollCue(bodyRef, panelOpen);
  const { cue: cardsCue, measure: measureCards } = useScrollCue(cardsRef, panelOpen);

  // No-charge outcomes received in this sheet session, per family (audit §15). The current outcome
  // counts at once, so the card never flickers back to a request.
  const [settledFamilies, setSettledFamilies] = useState<ReadonlySet<HintFamily>>(() => new Set());
  const currentSettled = outcomeFamily(view.outcome);
  // (Adjusting state while rendering: React re-renders this component at once, before committing.)
  if (currentSettled && !settledFamilies.has(currentSettled)) setSettledFamilies(new Set([...settledFamilies, currentSettled]));
  const isSettled = (f: HintFamily) => f === currentSettled || settledFamilies.has(f);

  // Facts added since the previous render of this open sheet (never on opening it): highlighted,
  // scrolled into view, and a request that added one returns to the board.
  const keys = boardKeys(view);
  const boardKey = keys.join("\n");
  const seenBoard = useRef<string | null>(null);
  // `forKey`: the board the fresh set was computed for. Until the effect below catches up with a new
  // board, the set is stale and announces nothing (see the live region).
  const [freshState, setFreshState] = useState<{ forKey: string | null; ids: ReadonlySet<string> }>(() => ({ forKey: null, ids: new Set() }));
  const fresh = freshState.ids;
  useEffect(() => {
    const before = seenBoard.current;
    seenBoard.current = boardKey;
    if (before === null || before === boardKey) return;
    const known = new Set(before.split("\n"));
    setFreshState({ forKey: boardKey, ids: new Set(boardKey.split("\n").filter((k) => k && !known.has(k))) });
    setPanelOpen(false);
  }, [boardKey]);
  useEffect(() => {
    if (fresh.size > 0) bodyRef.current?.querySelector(".hint-sheet__chip--new, .hint-sheet__fact-line--new")?.scrollIntoView?.({ block: "nearest" });
  }, [fresh]);

  const families: HintFamily[] = deduction ? ["material", "structure", "attribute"] : ["material"];

  // Focus follows the step: opening the panel lands on its first open request (or もどる), leaving
  // it lands on 「ヒントをもらう」. Changing a preference never moves focus.
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if (panelOpen) {
      const first = panelRef.current?.querySelector<HTMLButtonElement>(".hint-sheet__next:not(:disabled)");
      (first ?? backRef.current)?.focus();
    } else {
      entryRef.current?.focus();
    }
  }, [panelOpen, entryRef]);
  // A request that disabled the focused button (a no-charge outcome, もらいずみ) leaves focus on
  // もどる instead of <body>.
  useEffect(() => {
    if (!panelOpen) return;
    const active = document.activeElement;
    if (active === document.body || (active instanceof HTMLButtonElement && active.disabled)) backRef.current?.focus();
  });

  const guided = isSettled("material");
  const walletLine = (
    <p className="hint-sheet__wallet">
      所持 {presentation.pitzBalance} Pitz<span className="hint-sheet__wallet-sep"> ・ </span>
      {SELECTABLE_COPY.payOnlyWhenGiven}
    </p>
  );

  // One live region, mounted across both steps (it is the first child of either return, so React
  // keeps the same element): it announces what a request just brought -- the new facts, which
  // arrive on a freshly mounted board, or a no-charge outcome -- since a live region created
  // together with its text is often not read. It repeats only what the sheet itself now shows.
  const settledLine =
    currentSettled && (currentSettled === "material" || deduction) ? familyCta(view, currentSettled, true).outcomeLine : null;
  const freshText = (freshState.forKey === boardKey ? keys : [])
    .filter((k) => fresh.has(k))
    .map((k) => {
      if (k.startsWith("structure:") || k.startsWith("attribute:")) return k.slice(k.indexOf(":") + 1);
      const chip = presentation.rows.flatMap((row) => row.revealed).find((c) => c.factId === k);
      return chip ? (getIngredient(chip.ingredientId)?.nameJa ?? chip.ingredientId) : "";
    })
    .filter(Boolean)
    .join("、");
  const liveRegion = (
    <p key="hint-live" className="sr-only" role="status" aria-live="polite">
      {settledLine ?? (freshText ? `わかったこと：${freshText}` : "")}
    </p>
  );

  if (panelOpen) {
    return (
      <>
        {liveRegion}
        <div ref={panelRef} className="hint-sheet__panel" role="group" aria-labelledby={panelTitleId}>
          <div className="hint-sheet__panel-head">
            <button ref={backRef} type="button" className="hint-sheet__back" onClick={() => setPanelOpen(false)}>
              {"\u{2039}"} {SELECTABLE_COPY.back}
            </button>
            <p id={panelTitleId} className="hint-sheet__panel-title">
              {SELECTABLE_COPY.askTitle}
            </p>
          </div>
          <div
            className={`hint-sheet__scroll hint-sheet__cards-wrap${cardsCue.above ? " hint-sheet__scroll--above" : ""}${cardsCue.below ? " hint-sheet__scroll--below" : ""}`}
          >
            <div ref={cardsRef} className="hint-sheet__cards" onScroll={measureCards}>
              {families.map((family) => {
                const card = FAMILY_CARDS[family];
                const cta = familyCta(view, family, isSettled(family));
                const capPaid = family === "material" && presentation.nextPrice === 0 && !presentation.onboarding;
                const moreFamilies = family === "material" && guided && !!deduction && (!deduction.structureOwned || !deduction.attributeOwned);
                return (
                  <div key={family} className="hint-sheet__card" data-hint-family={family}>
                    <p className="hint-sheet__card-title">
                      {card.title}
                      <span className="hint-sheet__card-desc">{card.description}</span>
                    </p>
                    {family === "material" && !cta.outcomeLine && (
                      <fieldset className="hint-sheet__prefs">
                        <legend className="hint-sheet__prefs-legend sr-only">{SELECTABLE_COPY.preferenceLegend}</legend>
                        {PREFERENCE_CHIPS.map((chip) => (
                          <label key={chip.id} className={`hint-sheet__pref${preferenceId === chip.id ? " hint-sheet__pref--on" : ""}`}>
                            <input type="radio" name={groupName} value={chip.id} checked={preferenceId === chip.id} onChange={() => onPreference(chip.id)} />
                            {chip.label}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    {cta.outcomeLine ? (
                      <p className="hint-sheet__outcome">
                        {cta.outcomeLine}
                      </p>
                    ) : (
                      <>
                        {card.notes.map((note) => (
                          <p key={note} className="hint-sheet__card-note">
                            {note}
                          </p>
                        ))}
                        {capPaid && <p className="hint-sheet__card-note">{SELECTABLE_COPY.capPaidNote}</p>}
                      </>
                    )}
                    {moreFamilies && <p className="hint-sheet__card-note">{SELECTABLE_COPY.moreFamilies}</p>}
                    {!cta.outcomeLine && (
                      <button
                        type="button"
                        className={`cta-button hint-sheet__next hint-sheet__next--paid${cta.enabled ? "" : " hint-sheet__next--short"}`}
                        disabled={!cta.enabled}
                        aria-disabled={latched || undefined}
                        onClick={() => onBuy(family)}
                      >
                        <span className="hint-sheet__next-label">{cta.label}</span>
                        {cta.badge && (
                          <>
                            {" "}
                            <span className="hint-sheet__price">{cta.badge}</span>
                          </>
                        )}
                      </button>
                    )}
                    {cta.short && <p className="hint-sheet__wallet hint-sheet__wallet-note">{SELECTABLE_COPY.shortNote}</p>}
                  </div>
                );
              })}
            </div>
            <span className="hint-sheet__scroll-cue" aria-hidden="true">
              {"\u{25BE}"} 下にもつづくよ
            </span>
          </div>
          {walletLine}
        </div>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <p className="hint-sheet__caption">{view.existenceText}</p>
      <div
        className={`hint-sheet__scroll${cue.above ? " hint-sheet__scroll--above" : ""}${cue.below ? " hint-sheet__scroll--below" : ""}`}
      >
        <div ref={bodyRef} className="hint-sheet__steps hint-sheet__selectable hint-sheet__board" aria-live="polite" onScroll={measure}>
          <p className="hint-sheet__board-title">{SELECTABLE_COPY.boardTitle}</p>
          <MaterialFacts view={view} fresh={fresh} />
          {deduction && <FactSection id="structure" label="構成" lines={deduction.structureLines} fresh={fresh} />}
          {deduction && <FactSection id="attribute" label="特徴" lines={deduction.attributeLines} fresh={fresh} />}
          {guided && <p className="hint-sheet__guidance">{SELECTABLE_GUIDANCE_TEXT}</p>}
          {view.grandfatheredSteps.length > 0 && (
            // OD-H3-4-4: this player's own Economy 1.0 lines, verbatim. An archive at the end of the
            // board: not a row, chip, price or category.
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
          {"\u{25BE}"} 下にもヒントがあるよ
        </span>
      </div>
      <div className="hint-sheet__footer hint-sheet__footer--selectable">
        {/* A fast second tap of a request that just returned here lands on this button: the request
            latch covers it too, so a double tap never reopens the panel. */}
        <button
          ref={entryRef}
          type="button"
          className="cta-button hint-sheet__entry"
          aria-disabled={latched || undefined}
          onClick={() => {
            if (!latched) setPanelOpen(true);
          }}
        >
          {SELECTABLE_COPY.askTitle}
        </button>
        {walletLine}
      </div>
    </>
  );
}

/** Hint 5.0 copy (H5-3). Every string is fixed per rung KIND, the same for every target. */
const HINT5_COPY = {
  boardTitle: "わかっていること",
  emptyBoard: "ヒントは上から順番に1つずつもらえるよ",
  ask: "たずねる",
  payOnlyWhenGiven: "Pitzはヒントが出たときだけ使うよ",
  shortNote: "Pitzがたまったら、またためしてね。このまま作ってもOK！",
  /** OD-H5-M3: shown only after the reducer completed the requested rung for 0 Pitz. */
  alreadyKnown: "このヒントはもう知っていたよ！（Pitzは使っていないよ）",
  /** OD-360-2: source-neutral (a RESULT ○, a Hint or any other stored fact all land here). */
  legacyTitle: "これまでにわかったこと",
  legacyExplainer: "すでにわかっていたこと（そのまま残してあるよ）",
  classSection: "サブトッピングの分類",
  /** Round 6 (OD-H5-P4-CHEESE / P4b): the answer of a bought empty CHEESE / KEY rung. */
  none: "なし",
  /** H5-4 fail closed: a target outside the ladder (unreachable in production: the taxonomy gates). */
  unavailable: "このピザのヒントは今は出せないよ。作ってためしてみよう！",
} as const;

const HINT5_ROW_LABEL: Record<"SAUCE" | "CHEESE" | "KEY_TOPPING", string> = { SAUCE: "ソース", CHEESE: "チーズ", KEY_TOPPING: "キートッピング" };

/** What a rung discloses: fixed per kind, never about this target. */
const HINT5_RUNG_DESC: Record<Hint5RungKind, string> = {
  SAUCE: "このピザのソースを教えるよ",
  CHEESE: "このピザのチーズを教えるよ",
  KEY_TOPPING: "このピザの主役のトッピングを教えるよ",
  STRUCTURE: "このピザの材料の数を教えるよ",
  SUB_CLASS: "トッピングの「なかま」（分類）を教えるよ。名前は自分で考えてね",
};

function hint5EntryKey(entry: Hint5BoardEntry): string {
  return `${entry.rungIndex}`;
}

/**
 * Hint 5.0 H5-3: the linear ladder body (OD-H5-U1). The board holds COMPLETED rungs only. The footer
 * holds the ONE next rung: its fixed label and description, its normal price and 「たずねる」.
 * Nothing here shows a rung count, what comes later, a sub-topping name or glyph, or a 0 price
 * (M3). An empty fixed rung is offered like any other. Round 6: a bought empty CHEESE / KEY rung shows
 * 「なし」 in its row (「チーズ」 | 「なし」); an empty SAUCE rung stays RESERVED and is never shown as
 * 「なし」 (OD-H5-P4-SAUCE, TQ-1D).
 */
function Hint5LadderBody({
  view,
  ladder,
  ctaRef,
  latched,
  onBuy,
}: {
  view: SelectableView;
  ladder: Hint5Presentation;
  ctaRef: RefObject<HTMLButtonElement | null>;
  latched: boolean;
  onBuy: (rungIndex: number) => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const { cue, measure } = useScrollCue(bodyRef);
  const names = ladder.board.filter((e): e is Extract<Hint5BoardEntry, { ingredientIds: readonly string[] }> => "ingredientIds" in e);
  const structure = ladder.board.filter((e): e is Extract<Hint5BoardEntry, { kind: "STRUCTURE" }> => e.kind === "STRUCTURE");
  const classes = ladder.board.filter((e): e is Extract<Hint5BoardEntry, { kind: "SUB_CLASS" }> => e.kind === "SUB_CLASS");
  // The player's own earlier lines. A line the ladder board already shows (the STRUCTURE total,
  // which the ladder also stores as `meta:ingredient-total`) is not repeated.
  const boardLines = new Set(structure.map((e) => e.lineJa));
  const archiveLines = [...(view.deduction?.structureLines ?? []), ...(view.deduction?.attributeLines ?? []), ...view.grandfatheredSteps.map((s) => s.textJa)].filter(
    (line) => !boardLines.has(line),
  );
  const showArchive = ladder.legacyKnownIngredientIds.length > 0 || archiveLines.length > 0;
  const alreadyKnown = view.outcome === "HINT5_ALREADY_KNOWN";
  // #360 S3: the CTA stays tappable below the normal price. The reducer decides; if it refuses, the rung
  // is still the offered one, so the existing shortage note is shown for that rung only (and only after
  // the tap, never before it: the pre-purchase view carries nothing but the balance).
  const [shortAskedRung, setShortAskedRung] = useState<number | null>(null);
  const showShort = !!ladder.next && !ladder.next.affordable && shortAskedRung === ladder.next.rungIndex;
  // The previous 「もう知っていた」 outcome describes the rung that was just completed, not the refused one.
  const knownShown = alreadyKnown && !showShort;

  // Entries completed since the previous render of this open sheet: highlighted and scrolled into view.
  const keys = ladder.board.map(hint5EntryKey).join(",");
  const seen = useRef<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const before = seen.current;
    seen.current = keys;
    if (before === null || before === keys) return;
    const known = new Set(before.split(","));
    setFresh(new Set(keys.split(",").filter((k) => k && !known.has(k))));
  }, [keys]);
  useEffect(() => {
    if (fresh.size > 0) bodyRef.current?.querySelector(".hint-sheet__h5-entry--new")?.scrollIntoView?.({ block: "nearest" });
  }, [fresh]);
  const isNew = (entry: Hint5BoardEntry) => fresh.has(hint5EntryKey(entry));

  const liveText = knownShown
    ? HINT5_COPY.alreadyKnown
    : ladder.board
        .filter(isNew)
        .map((e) =>
          "ingredientIds" in e
            ? e.none
              ? `${HINT5_ROW_LABEL[e.kind]}：${HINT5_COPY.none}`
              : e.ingredientIds.map((id) => getIngredient(id)?.nameJa ?? "").join("、")
            : e.kind === "STRUCTURE"
              ? e.lineJa
              : `サブトッピング${circledOrdinal(e.ordinal)}は${e.classView.labelJa}`,
        )
        .filter(Boolean)
        .join("、");

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {liveText ? (knownShown ? liveText : `わかったこと：${liveText}`) : ""}
      </p>
      <p className="hint-sheet__caption">{view.existenceText}</p>
      <div className={`hint-sheet__scroll${cue.above ? " hint-sheet__scroll--above" : ""}${cue.below ? " hint-sheet__scroll--below" : ""}`}>
        <div ref={bodyRef} className="hint-sheet__steps hint-sheet__selectable hint-sheet__board" onScroll={measure}>
          <p className="hint-sheet__board-title">{HINT5_COPY.boardTitle}</p>
          {ladder.board.length === 0 && <p className="hint-sheet__card-note">{HINT5_COPY.emptyBoard}</p>}
          {names.length > 0 && (
            <div className="hint-sheet__section" data-hint-section="hint5-names">
              <ul className="hint-sheet__rows">
                {names.map((entry) => (
                  <li key={entry.rungIndex} className={`hint-sheet__row hint-sheet__row--h5 hint-sheet__h5-entry${isNew(entry) ? " hint-sheet__h5-entry--new" : ""}`} data-hint5-rung={entry.kind}>
                    <span className="hint-sheet__row-label">{HINT5_ROW_LABEL[entry.kind]}</span>
                    <span className="hint-sheet__chips">
                      {entry.none && <span className={`hint-sheet__chip hint-sheet__chip--none${isNew(entry) ? " hint-sheet__chip--new" : ""}`}>{HINT5_COPY.none}</span>}
                      {entry.ingredientIds.map((id) => {
                        const ingredient = getIngredient(id);
                        return (
                          <span key={id} className={`hint-sheet__chip${isNew(entry) ? " hint-sheet__chip--new" : ""}`}>
                            {ingredient && (
                              <span className="hint-sheet__glyph" aria-hidden="true">
                                <IngredientGlyph ingredient={ingredient} />
                              </span>
                            )}
                            {ingredient?.nameJa ?? id}
                          </span>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {structure.map((entry) => (
            <div key={entry.rungIndex} className="hint-sheet__section" data-hint-section="hint5-structure">
              <p className="hint-sheet__section-label">構成</p>
              <p className={`hint-sheet__fact-line hint-sheet__h5-entry${isNew(entry) ? " hint-sheet__fact-line--new hint-sheet__h5-entry--new" : ""}`}>{entry.lineJa}</p>
            </div>
          ))}
          {classes.length > 0 && (
            <div className="hint-sheet__section" data-hint-section="hint5-classes">
              <p className="hint-sheet__section-label">{HINT5_COPY.classSection}</p>
              <ul className="hint-sheet__rows">
                {classes.map((entry) => (
                  <li key={entry.rungIndex} className={`hint-sheet__row hint-sheet__row--h5 hint-sheet__h5-entry${isNew(entry) ? " hint-sheet__h5-entry--new" : ""}`} data-hint5-rung="SUB_CLASS">
                    <span className="hint-sheet__row-label">サブトッピング{circledOrdinal(entry.ordinal)}</span>
                    <span className="hint-sheet__chips">
                      <span className={`hint-sheet__chip hint-sheet__chip--class${isNew(entry) ? " hint-sheet__chip--new" : ""}`}>
                        <span className="hint-sheet__class-symbol" aria-hidden="true">
                          {entry.classView.symbol}
                        </span>
                        {entry.classView.labelJa}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {ladder.completeText && <p className="hint-sheet__guidance">{ladder.completeText}</p>}
          {showArchive && (
            <div className="hint-sheet__legacy">
              <p className="hint-sheet__legacy-title">{HINT5_COPY.legacyTitle}</p>
              <p className="hint-sheet__legacy-explainer">{HINT5_COPY.legacyExplainer}</p>
              {ladder.legacyKnownIngredientIds.length > 0 && (
                <p className="hint-sheet__chips hint-sheet__legacy-chips">
                  {ladder.legacyKnownIngredientIds.map((id) => {
                    const ingredient = getIngredient(id);
                    return (
                      <span key={id} className="hint-sheet__chip">
                        {ingredient && (
                          <span className="hint-sheet__glyph" aria-hidden="true">
                            <IngredientGlyph ingredient={ingredient} />
                          </span>
                        )}
                        {ingredient?.nameJa ?? id}
                      </span>
                    );
                  })}
                </p>
              )}
              {archiveLines.map((line) => (
                <p key={line} className="hint-sheet__legacy-line">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
        <span className="hint-sheet__scroll-cue" aria-hidden="true">
          {"\u{25BE}"} 下にもヒントがあるよ
        </span>
      </div>
      <div className="hint-sheet__footer hint-sheet__footer--selectable hint-sheet__footer--h5">
        {knownShown && <p className="hint-sheet__outcome hint-sheet__h5-known">{HINT5_COPY.alreadyKnown}</p>}
        {ladder.next ? (
          <div className="hint-sheet__h5-next" data-hint5-next={ladder.next.kind}>
            <p className="hint-sheet__card-title">
              {ladder.next.labelJa}
              <span className="hint-sheet__card-desc">{HINT5_RUNG_DESC[ladder.next.kind]}</span>
            </p>
            <button
              ref={ctaRef}
              type="button"
              className="cta-button hint-sheet__next hint-sheet__next--paid"
              aria-disabled={latched || undefined}
              onClick={() => {
                if (!latched && !ladder.next!.affordable) setShortAskedRung(ladder.next!.rungIndex);
                onBuy(ladder.next!.rungIndex);
              }}
            >
              <span className="hint-sheet__next-label">{HINT5_COPY.ask}</span> <span className="hint-sheet__price">{ladder.next.price} Pitz</span>
            </button>
            {showShort && (
              <p className="hint-sheet__wallet hint-sheet__wallet-note" role="status">
                {HINT5_COPY.shortNote}
              </p>
            )}
          </div>
        ) : null}
        <p className="hint-sheet__wallet">
          所持 {ladder.pitzBalance} Pitz<span className="hint-sheet__wallet-sep"> ・ </span>
          {HINT5_COPY.payOnlyWhenGiven}
        </p>
      </div>
    </>
  );
}
