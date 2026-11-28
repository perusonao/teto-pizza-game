import { useEffect, useRef, type ReactNode } from "react";
import { shopCopy } from "../logic/progression/shopCopy";
import { RECIPES, type Recipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import { activeProgressionModel } from "../logic/progression/progressionModel";
import { EMPTY_SHOP_PROGRESS, type ShopProgressState } from "../logic/progression/shopProgress";
import { identifiedAwaitingDexLine, stageUnlockLabel } from "../logic/progression/shopStageView";
import {
  buildRecipeChapters,
  chapterProgress,
  dexDiscoveredCount,
  dexRecipes,
  isChapterCleared,
  menuCountableDex,
} from "../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryState } from "../state/recipeDiscoveryState";
import { totalStars } from "../logic/mastery";
import { starLabel } from "../logic/scoring";
import { researchEntryViews, type ResearchEntryView } from "../state/discoveryHint";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { isResearchStockBlocked } from "../state/researchStockBlock";
import type { TechniqueDexView } from "../logic/techniques/dexView";
import { IngredientGlyph } from "./IngredientGlyph";
import { ShopHintBoard } from "./ShopHintBoard";
import type { ShopHintBoardView, ShopHintItemKind } from "../logic/progression/shopHints";
import { AnonymousLockFrame } from "./AnonymousLockFrame";
import { ANONYMOUS_LOCK_HINTS } from "./anonymousLockHints";

interface DexOverlayProps {
  dex: DexState;
  /** B案 Phase 3b (shop model only): the shop state -- a recipe identified before its stage opened shows as 判明 with the shop form it
   *  joins the menu at, and is not counted as developed. Absent (legacy, older call sites): nothing changes. */
  shop?: ShopProgressState;
  /** Recipe discovered for the very first time this round (drives the NEW badge). */
  newlyDiscoveredId: string | null;
  /** Recipe whose Dex BEST just improved on a repeat play this round (drives the NEW BEST
   *  badge). Mutually exclusive with `newlyDiscoveredId` in practice: a first discovery
   *  shows NEW, not NEW BEST — the caller only sets one of the two per round. */
  newBestRecipeId: string | null;
  onClose: () => void;
  /** Progression 2.0 W1 Discovery 2.0 (W1-f): inputs of the derived discovery state behind an
   *  undiscovered slot's tag. Optional (empty) so older call sites keep compiling. */
  ownedIngredientIds?: readonly string[];
  unlockedForShopIngredientIds?: readonly string[];
  inventory?: InventoryState;
  /** A 🎨-tagged slot's CTA (Free Cooking) and a 🏪-tagged slot's CTA (Shop). */
  onGoFreeCook?: () => void;
  onOpenShop?: () => void;
  /** Discovery Hint 2.0 (#229 229-D): a 🎨 (DISCOVERABLE) slot's 「💡 ヒントを見る」 -- Free Cooking
   *  with the hint sheet on that slot's recipe. When given it replaces the 「レシピ発見へ」
   *  CTA (it starts Free Cooking too). The id travels only through this callback: the slot's DOM
   *  never carries it. */
  onShowHint?: (recipeId: string) => void;
  /** Discovery 3.0 Research Recipe (#346 S2): the stored hint ledger, read only to tell whether
   *  STRUCTURE was bought (the research card then, and only then, shows the ingredient total). */
  discoveryHintFacts?: Readonly<Record<string, readonly string[]>>;
  /** #346 S3: a Research Entry card's 「このピザを研究する」 -- Free Cooking with that entry as the
   *  Research Target. Offered only for an entry that is cookable now (DISCOVERABLE). */
  onResearch?: (recipeId: string) => void;
  /** Cooking Techniques TQ-1D: the 「調理法」 section (../logic/techniques/dexView.ts). A discovered technique shows
   *  its name; an undiscovered one whose affordance is open shows only 「？？？」 and its riddle; the rest are absent. */
  techniqueViews?: readonly TechniqueDexView[];
  /** B案 Phase 3d (shop model only): the research point hints. Every recipe of an open stage (developed or not) gets a 「🔬 ヒント」
   *  fold with its board (what is known, the 「？」 slots, the items for sale). Absent (legacy): nothing renders. */
  shopHint?: {
    boardOf: (recipeId: string) => ShopHintBoardView | null;
    onBuy: (recipeId: string, kind: ShopHintItemKind, expectedPrice: number) => void;
  };
}

/** B案 Phase 3d: one recipe's research point hint fold (closed by default; the summary says how much is known). */
function ShopHintFold({ board, onBuy }: { board: ShopHintBoardView; onBuy: (kind: ShopHintItemKind, expectedPrice: number) => void }) {
  const known =
    board.slots.filter((s) => s.ingredientId !== null).length +
    [board.shape, board.method, board.sauceIds].filter((v) => v !== null).length +
    (board.countRevealed ? 1 : 0);
  return (
    <details className="dex-card__shop-hint" data-testid="dex-shop-hint">
      <summary className="dex-card__shop-hint-summary">
        {"\u{1F52C}"} ヒント{known > 0 ? `（わかったこと ${known}）` : ""}
      </summary>
      <ShopHintBoard board={board} onBuy={onBuy} headingLevel="h4" />
    </details>
  );
}

/** #346 S2/S3: one anonymous Research Entry card. The label is a plain "this card" marker in the
 *  stable anonymous order -- never a name, No.xx or recipe id. S3 adds the research CTA, shown only
 *  for an entry the player can cook right now (the id travels through the callback, never the DOM). */
/** #378 Option 1: the fixed, recipe-agnostic notice of a stock-blocked entry. Never a name, count or missing count. */
export const RESEARCH_STOCK_NOTICE_JA = "研究を続けるには材料の補充が必要";

function ResearchEntryCard({
  view,
  onResearch,
  stockBlocked,
  onOpenShop,
}: {
  view: ResearchEntryView;
  onResearch?: () => void;
  /** #378: the entry cannot start because of stock (`isResearchStockBlocked`); never set together with `onResearch`. */
  stockBlocked?: boolean;
  onOpenShop?: () => void;
}) {
  return (
    <div className="dex-research-card">
      <h3 className="dex-card__research-title">{view.label}</h3>
      <p className="dex-card__research-sub">わかっていること</p>
      <ul className="dex-card__research-facts">
        {view.knownExactIngredientIds.map((id) => (
          <li key={id}>✓ {getIngredient(id)?.nameJa}を使う</li>
        ))}
        {view.classLinesJa.map((line, i) => (
          <li key={`class-${i}`}>{line}</li>
        ))}
        {view.totalIngredientCount !== null && <li>全部で {view.totalIngredientCount} 種類の材料を使う</li>}
      </ul>
      {onResearch && (
        <button
          type="button"
          className="dex-card__tag-cta dex-card__tag-cta--research"
          onClick={onResearch}
          aria-label={`${view.label}を研究する`}
        >
          🔎 このピザを研究する
        </button>
      )}
      {stockBlocked && (
        <>
          <p className="dex-card__research-stock-notice" data-research-stock-blocked="true">
            {RESEARCH_STOCK_NOTICE_JA}
          </p>
          {onOpenShop && (
            <button
              type="button"
              className="dex-card__tag-cta dex-card__tag-cta--shop"
              onClick={onOpenShop}
              aria-label={`${view.label}の材料をお店で補充する`}
            >
              {"\u{1F6D2}"} お店で補充する
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** W1-f: an undiscovered slot says only which kind of "next" it is (L1) -- never the recipe's
 *  name, preview, ingredients or name length. UNKNOWN slots are not talked about (P-4). */
function UndiscoveredSlot({
  slot,
  state,
  onGoFreeCook,
  onOpenShop,
  onShowHint,
  shopHintFold,
}: {
  slot: number;
  state: Exclude<RecipeDiscoveryState, "DISCOVERED">;
  onGoFreeCook?: () => void;
  onOpenShop?: () => void;
  /** 229-D: already bound to this slot's recipe by the parent (a closure, not a prop value). */
  onShowHint?: () => void;
  /** B案 Phase 3d: the slot's research point hint fold (shop model, open stage), already bound by the parent. */
  shopHintFold?: ReactNode;
}) {
  const tag =
    state === "DISCOVERABLE"
      ? ANONYMOUS_LOCK_HINTS.DISCOVERABLE
      : state === "KNOWN_BUT_MISSING_MATERIAL"
        ? ANONYMOUS_LOCK_HINTS.SHOP
        : null;
  const cta = state === "DISCOVERABLE" ? onGoFreeCook : state === "KNOWN_BUT_MISSING_MATERIAL" ? onOpenShop : undefined;
  return (
    <AnonymousLockFrame
      lead={`No.${String(slot).padStart(2, "0")}`}
      hint={tag ?? ANONYMOUS_LOCK_HINTS.UNKNOWN}
      tagged={!!tag}
      dataAttributes={{ "data-dex-state": state }}
    >
      {state === "DISCOVERABLE" && onShowHint ? (
        <button type="button" className="dex-card__tag-cta dex-card__tag-cta--hint" onClick={onShowHint}>
          {"\u{1F4A1}"} ヒントを見る
        </button>
      ) : (
        tag &&
        cta && (
          <button type="button" className="dex-card__tag-cta" onClick={cta}>
            {state === "DISCOVERABLE" ? shopCopy("レシピ発見へ", "メニュー開発へ") : "お店を見る"}
          </button>
        )
      )}
      {shopHintFold}
    </AnonymousLockFrame>
  );
}

/** Discovery 3.0 PR-4b-A (D-2): with more than one DISCOVERABLE unknown, the Dex says only that
 *  "there is still a pizza to find" -- one card, no number, no slot, no per-recipe Hint entrance. */
function AggregatedUnknownCard({ onGoFreeCook }: { onGoFreeCook?: () => void }) {
  return (
    <AnonymousLockFrame
      hint={ANONYMOUS_LOCK_HINTS.AGGREGATED}
      tagged
      dataAttributes={{ "data-dex-state": "DISCOVERABLE", "data-dex-aggregated": "true" }}
    >
      {onGoFreeCook && (
        <button type="button" className="dex-card__tag-cta" onClick={onGoFreeCook}>
          {shopCopy("レシピ発見へ", "メニュー開発へ")}
        </button>
      )}
    </AnonymousLockFrame>
  );
}

export function DexOverlay({
  dex,
  shop,
  newlyDiscoveredId,
  newBestRecipeId,
  onClose,
  ownedIngredientIds = [],
  unlockedForShopIngredientIds = [],
  inventory = {},
  onGoFreeCook,
  onOpenShop,
  onShowHint,
  discoveryHintFacts,
  onResearch,
  techniqueViews = [],
  shopHint,
}: DexOverlayProps) {
  // The Dex and its Hint/Research candidate list read the active catalog and shop stages.
  const total = dexRecipes().length;
  // B案 Phase 3b: counts read the menu (legacy: the Dex itself, the same array).
  const countDex = menuCountableDex(dex, shop);
  const discoveredCount = dexDiscoveredCount(countDex);
  const isComplete = discoveredCount >= total;
  const mastery = totalStars(dex);
  const inputs = { dex, shop, ownedIngredientIds, unlockedForShopIngredientIds, inventory };
  // D-2 / D-3: a state-derived rule (any save). Two or more DISCOVERABLE unknowns collapse into
  // one aggregated card; their own slots then read as plain unknown slots, so neither the count
  // nor which slots they are reaches the DOM. Zero or one keeps the per-slot 🎨 card unchanged.
  const discoverable = new Set(discoverableHintCandidates(inputs).map((recipe) => recipe.id as string));
  const aggregateUnknown = discoverable.size > 1;
  // #346 S2/S3: S1's projection (+ the Hint ledger's own exact / class facts) is the only authority.
  // B案 Phase 3d (3b 論点): under the shop model only the entries of an open stage are listed (a recipe of a closed stage cannot be
  // researched, so its card would only be a dead end). Legacy: every stage reads as open, so the list is unchanged.
  const researchEntries = researchEntryViews({ dex, shop, ownedIngredientIds, discoveryHintFacts });
  // #346 S4 (OD-RX-1): a registered Research Entry is guided by its own card, so the aggregate card is shown
  // only while some aggregated DISCOVERABLE unknown is NOT a Research Entry. It only ever disappears (no
  // slot, count or existence is newly exposed): the aggregated slots above already read as plain unknowns.
  const researchIds = new Set(researchEntries.map((e) => e.recipeId));
  const showAggregateCard = aggregateUnknown && [...discoverable].some((id) => !researchIds.has(id));
  const cookableNow = (recipeId: string) => discoverable.has(recipeId);
  // #378 Option 1: stock is the explicit cause (registered, every finite material owned, one at stock 0).
  const stockBlockedNow = (recipeId: string) => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    return !!recipe && isResearchStockBlocked(recipe, { dex, ownedIngredientIds, inventory });
  };
  // W1-d: opened right after a discovery (Result's 「📖 図鑑を見る」), the Dex lands on the new slot.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const card = bodyRef.current?.querySelector<HTMLElement>(".dex-card--new");
    card?.scrollIntoView?.({ block: "center" });
  }, []);

  function renderSlot(recipe: Recipe, slot: number) {
    const entry = dex.find((e) => e.recipeId === recipe.id && e.discovered);
    const hintBoard = shopHint?.boardOf(recipe.id) ?? null;
    const hintFold =
      shopHint && hintBoard ? (
        <ShopHintFold board={hintBoard} onBuy={(kind, expectedPrice) => shopHint.onBuy(recipe.id, kind, expectedPrice)} />
      ) : null;
    const isNew = !!entry && recipe.id === newlyDiscoveredId;
    const showNewBest = !!entry && recipe.id === newBestRecipeId;
    if (!entry) {
      const state = recipeDiscoveryState(recipe, inputs);
      const shownState = state === "DISCOVERED" || (aggregateUnknown && state === "DISCOVERABLE") ? "UNKNOWN" : state;
      return (
        <UndiscoveredSlot
          key={recipe.id}
          slot={slot}
          state={shownState}
          onGoFreeCook={onGoFreeCook}
          onOpenShop={onOpenShop}
          onShowHint={shownState === "DISCOVERABLE" && onShowHint ? () => onShowHint(recipe.id) : undefined}
          shopHintFold={hintFold}
        />
      );
    }
    // B案 Phase 3b (shop model only): identified before its stage opened -- 判明, joins the menu when the shop grows.
    const awaitingChapter = countDex === dex || countDex.some((e) => e.recipeId === recipe.id) ? null : activeProgressionModel().chapterOf(recipe);
    return (
      <div
        key={recipe.id}
        className={`dex-card ${isNew ? "dex-card--new" : ""}${awaitingChapter !== null ? " dex-card--identified" : ""}`}
        data-dex-identified={awaitingChapter !== null ? "" : undefined}
      >
        <h3>
          <span className="dex-card__no">No.{String(slot).padStart(2, "0")}</span> {recipe.nameJa}
          {awaitingChapter !== null && <span className="dex-card__badge dex-card__badge--identified">判明</span>}
          {isNew && <span className="dex-card__badge">NEW</span>}
          {showNewBest && <span className="dex-card__badge dex-card__badge--best">NEW BEST!</span>}
        </h3>
        {awaitingChapter !== null && (
          <p className="dex-card__identified-line">
            {"\u{1F3EA}"} {identifiedAwaitingDexLine(awaitingChapter)}
          </p>
        )}
        <p>{recipe.description}</p>
        <div className="dex-card__ingredients">
          {recipe.requiredIngredients.map((req) => {
            const ingredient = getIngredient(req.ingredientId);
            return (
              <span key={req.ingredientId} className="dex-card__ingredient">
                {ingredient ? <IngredientGlyph ingredient={ingredient} /> : null} {ingredient?.nameJa}
              </span>
            );
          })}
        </div>
        <div className="dex-card__mastery">
          <span className="dex-card__best-stars">{starLabel(entry.bestStars)}</span>
          <span className="dex-card__best-score">BEST {Math.round(entry.bestScore)}</span>
          <span className="dex-card__times-made">{entry.timesMade}回作成</span>
        </div>
        {hintFold}
      </div>
    );
  }

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel">
        <div className="dex-overlay__header">
          <h2>ピザ図鑑</h2>
          <button type="button" className="dex-overlay__close dex-overlay__close--tap44" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="dex-overlay__body" ref={bodyRef}>
          <div className={`dex-overlay__progress ${isComplete ? "dex-overlay__progress--complete" : ""}`}>
            <div className="dex-overlay__progress-row">
              <p className="dex-overlay__progress-count">
                {isComplete ? `🏆 ${total} / ${total}` : `🍕 ${shopCopy("発見", "メニュー")} ${discoveredCount} / ${total}`}
              </p>
              <p className="dex-overlay__progress-sub">
                {isComplete ? "コンプリート！" : `あと${total - discoveredCount}種類！`}
              </p>
            </div>
            <p className="dex-overlay__mastery-total">{"⭐"} 合計★ {mastery}</p>
          </div>
          {techniqueViews.length > 0 && (
            <section className="dex-overlay__techniques" data-dex-techniques="">
              <h3 className="dex-overlay__chapter-title">{"\u{1F373}"} 調理法</h3>
              <div className="dex-overlay__list">
                {techniqueViews.map((view) =>
                  view.state === "DISCOVERED" ? (
                    <div key={view.id} className="dex-card dex-card--technique" data-technique-state="DISCOVERED">
                      <h3>{view.nameJa}</h3>
                      {view.descriptionJa !== undefined && <p className="dex-card__technique-desc">{view.descriptionJa}</p>}
                    </div>
                  ) : (
                    <div key={view.id} className="dex-card dex-card--technique dex-card--locked" data-technique-state="RIDDLE">
                      <span className="dex-card__lock-icon">🔒</span>
                      <div className="dex-card__lock-text">
                        <p className="dex-card__lock-label">？？？</p>
                        <p className="dex-card__lock-hint">{view.riddleJa}</p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {researchEntries.length > 0 && (
            <section className="dex-overlay__research">
              <h3 className="dex-overlay__chapter-title">🔎 研究中のピザ</h3>
              <div className="dex-overlay__list">
                {researchEntries.map((view) => (
                  <ResearchEntryCard
                    key={view.recipeId}
                    view={view}
                    onResearch={onResearch && cookableNow(view.recipeId) ? () => onResearch(view.recipeId) : undefined}
                    stockBlocked={stockBlockedNow(view.recipeId)}
                    onOpenShop={onOpenShop}
                  />
                ))}
              </div>
            </section>
          )}
          {showAggregateCard && (
            <div className="dex-overlay__list">
              <AggregatedUnknownCard onGoFreeCook={onGoFreeCook} />
            </div>
          )}
          {/* W1-f: the canonical 6 / 9 / 10 chapters (OD-DISC-9), each slot numbered inside its
              chapter (No. = fixed position, not discovery order). */}
          {(() => {
            const model = activeProgressionModel();
            return buildRecipeChapters().map((chapter) => {
            const progress = chapterProgress(chapter, countDex);
            // PR #915 (shop model only): a stage not open yet says what opens it (legacy: every chapter is open, so nothing).
            const unlockLabel =
              model.id === "shop" && !model.isChapterOpen(chapter.chapter, { ...inputs, shop: shop ?? EMPTY_SHOP_PROGRESS })
                ? stageUnlockLabel(chapter.chapter)
                : null;
            return (
              <section key={chapter.chapter} className="dex-overlay__chapter" data-stage-locked={unlockLabel ? "" : undefined}>
                <h3 className="dex-overlay__chapter-title">
                  <span className="dex-overlay__chapter-name">
                    {chapter.titleJa}
                    {unlockLabel && (
                      <span className="dex-overlay__chapter-unlock" data-testid="dex-stage-unlock">
                        {"\u{1F512}"} {unlockLabel}
                      </span>
                    )}
                  </span>
                  <span className="dex-overlay__chapter-count">
                    {progress.discovered}/{progress.total}
                    {isChapterCleared(chapter, countDex) ? " ✓" : ""}
                  </span>
                </h3>
                <div className="dex-overlay__list">
                  {chapter.recipes.map((recipe, index) => renderSlot(recipe, index + 1))}
                </div>
              </section>
            );
            });
          })()}
          <div className="dex-overlay__footer">
            <button type="button" className="cta-button cta-button--primary" aria-label="ピザ図鑑を閉じる" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
