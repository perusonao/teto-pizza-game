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

/** H3-4 SELECTABLE copy (OD-H3-4-1..9), revised for the DH4-2C U3-C sheet (OD-DH4-2-6..9, audit
 *  §13-§15). Every string is the same for every target. */
const SELECTABLE_COPY = {
  boardTitle: "わかっていること",
  askTitle: "ヒントをもらう",
  ask: "たずねる",
  capPaidBadge: "支払いずみ",
  owned: "✓ もらいずみ",
  payOnlyWhenGiven: "Pitzはヒントが出たときだけ使うよ",
  capPaidNote: "このピザのヒント代は上限まで支払いずみ",
  noChargeNote: "今回はPitzを使っていないよ",
  shortNote: "Pitzがたまったら、またためしてね。このまま作ってもOK！",
  legacyTitle: "以前のヒント",
  legacyExplainer: "前のヒント方式で買ったメモ（そのまま残してあるよ）",
  materialDone: "材料ヒントはここまで（Pitzは使っていないよ）",
  moreFamilies: "構成・特徴のヒントもあるよ",
  structureNothingNew: "今は新しくわかることがなかったよ（Pitzは使っていないよ）",
  attributeNothingYet: "今はまだ、大きな手がかりが見つからなかったよ（Pitzは使っていないよ）",
  preferenceLegend: "知りたいジャンル",
  anyPreference: "おまかせ",
} as const;

export type HintFamily = "material" | "structure" | "attribute";

/** OD-DH4-2-6 / audit §14: the family cards. The same for every target; a card never shows
 *  availability, granularity or a candidate count. */
const FAMILY_CARDS: Record<HintFamily, { tab: string; title: string; description: string; notes: readonly string[] }> = {
  material: {
    tab: "材料",
    title: "材料ヒント",
    description: "材料の名前を1つ教えるよ",
    // 「Pitzはヒントが出たときだけ使うよ」 (the wallet line) already covers "nothing left -> no charge".
    notes: ["えらんだジャンルに無いときは、ほかのジャンルから教えるよ"],
  },
  structure: { tab: "構成", title: "構成ヒント", description: "材料の数を教えるよ", notes: [] },
  attribute: { tab: "特徴", title: "特徴ヒント", description: "まだわからない材料の「なかま」を教えるよ", notes: [] },
};

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
  onUnlock,
  onBuySelectable = () => {},
  onClose,
}: {
  view: HintSheetView;
  /** Unlocks the offered level (`view.next.level`). */
  onUnlock: (level: number) => void;
  /** H3-3 / DH4-2C: one request of `family` (材料 with its preference, or 構成 / 特徴), echoing the
   *  paid count the sheet showed. The reducer's PURCHASE_SELECTABLE_HINT decides. */
  onBuySelectable?: (preference: HintCategory, expectedPaidCount: number, family?: HintFamily) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const nextRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const latestRef = useRef<HTMLLIElement>(null);
  const [preferenceId, setPreferenceId] = useState<string>("any");
  const [family, setFamily] = useState<HintFamily>("material");
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
  // A family the view no longer offers (the flag is off) falls back to 材料.
  const activeFamily: HintFamily = view.kind === "SELECTABLE" && family !== "material" && !view.deduction ? "material" : family;
  const ctaEnabled = view.kind === "SELECTABLE" ? familyCta(view, activeFamily).enabled : !!next && next.affordable;
  const stepCount = view.kind === "TARGET" ? view.steps.length : 0;

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
            family={activeFamily}
            onFamily={setFamily}
            preferenceId={preferenceId}
            onPreference={setPreferenceId}
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
              if (activeFamily === "material") {
                const category = PREFERENCE_CHIPS.find((p) => p.id === preferenceId)?.category ?? "sauce";
                onBuySelectable(category, view.presentation.paidCount, "material");
              } else {
                onBuySelectable("sauce", view.deduction!.paidCount, activeFamily);
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
          <div className="hint-sheet__empty">
            <p className="hint-sheet__empty-title">{EMPTY_COPY[view.kind].title}</p>
            <p className="hint-sheet__empty-body">{EMPTY_COPY[view.kind].body}</p>
          </div>
        )}
      </section>
    </div>
  );
}

type SelectableView = Extract<HintSheetView, { kind: "SELECTABLE" }>;

interface FamilyCta {
  enabled: boolean;
  /** Button label and price badge; `null` badge = none. */
  label: string;
  badge: string | null;
  /** A no-charge outcome line for this family, shown in place of the card note. */
  outcomeLine: string | null;
  affordable: boolean;
}

/** The request button of one family, from fields the view already carries (own ledger, price,
 *  balance, the last outcome) -- never from what is left to sell. */
function familyCta(view: SelectableView, family: HintFamily): FamilyCta {
  if (family === "material") {
    const { presentation } = view;
    const guided = view.outcome === "GUIDANCE_ONLY";
    // OD-H3-4-1: the cap is paid. The same view whether or not anything is left (a legacy buyer gets
    // a real fact here), so it stays a request, never "free" and never "sold out".
    const capPaid = presentation.nextPrice === 0 && !presentation.onboarding;
    return {
      enabled: presentation.affordable && !guided,
      label: SELECTABLE_COPY.ask,
      badge: guided ? null : capPaid ? SELECTABLE_COPY.capPaidBadge : `${presentation.nextPrice} Pitz`,
      outcomeLine: guided ? SELECTABLE_COPY.materialDone : null,
      affordable: presentation.affordable,
    };
  }
  const d = view.deduction!;
  const owned = family === "structure" ? d.structureOwned : d.attributeOwned;
  const outcomeLine =
    family === "structure"
      ? view.outcome === "STRUCTURE_GUIDANCE_ONLY" || view.outcome === "STRUCTURE_ALREADY_OWNED"
        ? SELECTABLE_COPY.structureNothingNew
        : null
      : view.outcome === "ATTRIBUTE_EXISTENCE_ONLY" || view.outcome === "ATTRIBUTE_ALREADY_OWNED"
        ? SELECTABLE_COPY.attributeNothingYet
        : null;
  if (owned) return { enabled: false, label: SELECTABLE_COPY.owned, badge: null, outcomeLine: null, affordable: d.affordable };
  return {
    enabled: d.affordable && outcomeLine === null,
    label: SELECTABLE_COPY.ask,
    badge: outcomeLine === null ? `${d.nextPrice} Pitz` : null,
    outcomeLine,
    affordable: d.affordable,
  };
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

/** 材料 chips grouped by category, catalog order inside a category. Empty categories are omitted
 *  (OD-DH4-2-8: no 「？」 rows). */
function MaterialFacts({ view, freshChips, freshChipRef }: { view: SelectableView; freshChips: ReadonlySet<string>; freshChipRef: RefObject<HTMLSpanElement | null> }) {
  const rows = view.presentation.rows.filter((row) => row.revealed.length > 0);
  if (rows.length === 0) return null;
  const firstFreshId = rows.flatMap((row) => row.revealed).find((chip) => freshChips.has(chip.factId))?.factId ?? null;
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
                const fresh = freshChips.has(chip.factId);
                return (
                  <span key={chip.factId} ref={chip.factId === firstFreshId ? freshChipRef : undefined} className={`hint-sheet__chip${fresh ? " hint-sheet__chip--new" : ""}`}>
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

function FactSection({ id, label, lines }: { id: "structure" | "attribute"; label: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="hint-sheet__section" data-hint-section={id}>
      <p className="hint-sheet__section-label">{label}</p>
      {lines.map((line) => (
        <p key={line} className="hint-sheet__fact-line">
          {line}
        </p>
      ))}
    </div>
  );
}

function SelectableHintBody({
  view,
  family,
  onFamily,
  preferenceId,
  onPreference,
  buyRef,
  latched,
  onBuy,
}: {
  view: SelectableView;
  family: HintFamily;
  onFamily: (family: HintFamily) => void;
  preferenceId: string;
  onPreference: (id: string) => void;
  buyRef: RefObject<HTMLButtonElement | null>;
  /** Right after a request: further activations are ignored (focus stays on the CTA). */
  latched: boolean;
  onBuy: () => void;
}) {
  const groupName = useId();
  const familyGroup = useId();
  const outcomeRef = useRef<HTMLParagraphElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const freshChipRef = useRef<HTMLSpanElement>(null);
  const { presentation, deduction } = view;
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

  const families: HintFamily[] = deduction ? ["material", "structure", "attribute"] : ["material"];
  const cta = familyCta(view, family);
  const card = FAMILY_CARDS[family];
  useEffect(() => {
    if (cta.outcomeLine) outcomeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [cta.outcomeLine]);

  const guided = view.outcome === "GUIDANCE_ONLY";
  const noCharge = cta.outcomeLine !== null;
  const capPaid = family === "material" && presentation.nextPrice === 0 && !presentation.onboarding;
  let walletNote: string = SELECTABLE_COPY.payOnlyWhenGiven;
  if (noCharge) walletNote = SELECTABLE_COPY.noChargeNote;
  else if (capPaid) walletNote = SELECTABLE_COPY.capPaidNote;
  const moreFamilies = guided && family === "material" && !!deduction && (!deduction.structureOwned || !deduction.attributeOwned);
  return (
    <>
      <p className="hint-sheet__caption">{view.existenceText}</p>
      <div
        className={`hint-sheet__scroll${cue.above ? " hint-sheet__scroll--above" : ""}${cue.below ? " hint-sheet__scroll--below" : ""}`}
      >
        <div ref={bodyRef} className="hint-sheet__steps hint-sheet__selectable hint-sheet__board" aria-live="polite" onScroll={measure}>
          <p className="hint-sheet__board-title">{SELECTABLE_COPY.boardTitle}</p>
          <MaterialFacts view={view} freshChips={freshChips} freshChipRef={freshChipRef} />
          {deduction && <FactSection id="structure" label="構成" lines={deduction.structureLines} />}
          {deduction && <FactSection id="attribute" label="特徴" lines={deduction.attributeLines} />}
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
        {/* The family choice itself is the visible heading; the title stays for screen readers. */}
        <p className="hint-sheet__ask-title sr-only">{SELECTABLE_COPY.askTitle}</p>
        {families.length > 1 && (
          <div className="hint-sheet__families" role="radiogroup" aria-label={SELECTABLE_COPY.askTitle}>
            {families.map((f) => (
              <label key={f} className={`hint-sheet__family${family === f ? " hint-sheet__family--on" : ""}`}>
                <input type="radio" name={familyGroup} value={f} checked={family === f} onChange={() => onFamily(f)} />
                {FAMILY_CARDS[f].tab}
              </label>
            ))}
          </div>
        )}
        <div className="hint-sheet__card" data-hint-family={family}>
          <p className="hint-sheet__card-title">
            {card.title}
            <span className="hint-sheet__card-desc">{card.description}</span>
          </p>
          {family === "material" && (
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
            <p ref={outcomeRef} className="hint-sheet__outcome">
              {cta.outcomeLine}
            </p>
          ) : (
            card.notes.map((note) => (
              <p key={note} className="hint-sheet__card-note">
                {note}
              </p>
            ))
          )}
          {moreFamilies && <p className="hint-sheet__card-note">{SELECTABLE_COPY.moreFamilies}</p>}
          <button
            ref={buyRef}
            type="button"
            className={`cta-button hint-sheet__next hint-sheet__next--paid${cta.enabled ? "" : " hint-sheet__next--short"}`}
            disabled={!cta.enabled}
            aria-disabled={latched || undefined}
            onClick={onBuy}
          >
            <span className="hint-sheet__next-label">{cta.label}</span>
            {cta.badge && (
              <>
                {" "}
                <span className="hint-sheet__price">{cta.badge}</span>
              </>
            )}
          </button>
        </div>
        <p className="hint-sheet__wallet">
          所持 {presentation.pitzBalance} Pitz<span className="hint-sheet__wallet-sep"> ・ </span>
          {walletNote}
        </p>
        {!cta.affordable && !noCharge && cta.enabled === false && cta.badge !== null && (
          <p className="hint-sheet__wallet hint-sheet__wallet-note">{SELECTABLE_COPY.shortNote}</p>
        )}
      </div>
    </>
  );
}
