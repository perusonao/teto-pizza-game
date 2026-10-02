import { useEffect, useRef } from "react";
import { RECIPES, type Recipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import { buildRecipeChapters, chapterProgress } from "../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryState } from "../state/recipeDiscoveryState";
import { totalStars } from "../logic/mastery";
import { starLabel } from "../logic/scoring";
import { researchEntryViews, type ResearchEntryView } from "../state/discoveryHint";
import { IngredientGlyph } from "./IngredientGlyph";

interface DexOverlayProps {
  dex: DexState;
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
}

/** #346 S2/S3: one anonymous Research Entry card. The label is a plain "this card" marker in the
 *  stable anonymous order -- never a name, No.xx or recipe id. S3 adds the research CTA, shown only
 *  for an entry the player can cook right now (the id travels through the callback, never the DOM). */
function ResearchEntryCard({ view, onResearch }: { view: ResearchEntryView; onResearch?: () => void }) {
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
}: {
  slot: number;
  state: Exclude<RecipeDiscoveryState, "DISCOVERED">;
  onGoFreeCook?: () => void;
  onOpenShop?: () => void;
  /** 229-D: already bound to this slot's recipe by the parent (a closure, not a prop value). */
  onShowHint?: () => void;
}) {
  const tag =
    state === "DISCOVERABLE"
      ? "\u{1F3A8} 今の材料で作れるかも"
      : state === "KNOWN_BUT_MISSING_MATERIAL"
        ? "\u{1F3EA} ショップの材料で作れるかも"
        : null;
  const cta = state === "DISCOVERABLE" ? onGoFreeCook : state === "KNOWN_BUT_MISSING_MATERIAL" ? onOpenShop : undefined;
  return (
    <div className={`dex-card dex-card--locked${tag ? " dex-card--tagged" : ""}`} data-dex-state={state}>
      <span className="dex-card__lock-icon">🔒</span>
      <div className="dex-card__lock-text">
        <p className="dex-card__lock-label">
          <span className="dex-card__no">No.{String(slot).padStart(2, "0")}</span> ？？？
        </p>
        <p className="dex-card__lock-hint">{tag ?? "まだ見ぬピザ"}</p>
        {state === "DISCOVERABLE" && onShowHint ? (
          <button type="button" className="dex-card__tag-cta dex-card__tag-cta--hint" onClick={onShowHint}>
            {"\u{1F4A1}"} ヒントを見る
          </button>
        ) : (
          tag &&
          cta && (
            <button type="button" className="dex-card__tag-cta" onClick={cta}>
              {state === "DISCOVERABLE" ? "レシピ発見へ" : "ショップを見る"}
            </button>
          )
        )}
      </div>
    </div>
  );
}

/** Discovery 3.0 PR-4b-A (D-2): with more than one DISCOVERABLE unknown, the Dex says only that
 *  "there is still a pizza to find" -- one card, no number, no slot, no per-recipe Hint entrance. */
function AggregatedUnknownCard({ onGoFreeCook }: { onGoFreeCook?: () => void }) {
  return (
    <div className="dex-card dex-card--locked dex-card--tagged" data-dex-state="DISCOVERABLE" data-dex-aggregated="true">
      <span className="dex-card__lock-icon">🔒</span>
      <div className="dex-card__lock-text">
        <p className="dex-card__lock-label">？？？</p>
        <p className="dex-card__lock-hint">{"\u{1F3A8}"} まだ発見できるピザがあるよ</p>
        {onGoFreeCook && (
          <button type="button" className="dex-card__tag-cta" onClick={onGoFreeCook}>
            レシピ発見へ
          </button>
        )}
      </div>
    </div>
  );
}

export function DexOverlay({
  dex,
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
}: DexOverlayProps) {
  const total = RECIPES.length;
  const discoveredCount = dex.filter((e) => e.discovered).length;
  const isComplete = discoveredCount >= total;
  const mastery = totalStars(dex);
  const inputs = { dex, ownedIngredientIds, unlockedForShopIngredientIds, inventory };
  // D-2 / D-3: a state-derived rule (any save). Two or more DISCOVERABLE unknowns collapse into
  // one aggregated card; their own slots then read as plain unknown slots, so neither the count
  // nor which slots they are reaches the DOM. Zero or one keeps the per-slot 🎨 card unchanged.
  const aggregateUnknown = RECIPES.filter((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE").length > 1;
  // #346 S2/S3: S1's projection (+ the Hint ledger's own exact / class facts) is the only authority.
  const researchEntries = researchEntryViews({ dex, ownedIngredientIds, discoveryHintFacts });
  // #346 S4 (OD-RX-1): a registered Research Entry is guided by its own card, so the aggregate card is shown
  // only while some aggregated DISCOVERABLE unknown is NOT a Research Entry. It only ever disappears (no
  // slot, count or existence is newly exposed): the aggregated slots above already read as plain unknowns.
  const researchIds = new Set(researchEntries.map((e) => e.recipeId));
  const showAggregateCard =
    aggregateUnknown &&
    RECIPES.some((r) => recipeDiscoveryState(r, inputs) === "DISCOVERABLE" && !researchIds.has(r.id));
  const cookableNow = (recipeId: string) => {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    return !!recipe && recipeDiscoveryState(recipe, inputs) === "DISCOVERABLE";
  };
  // W1-d: opened right after a discovery (Result's 「📖 図鑑を見る」), the Dex lands on the new slot.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const card = bodyRef.current?.querySelector<HTMLElement>(".dex-card--new");
    card?.scrollIntoView?.({ block: "center" });
  }, []);

  function renderSlot(recipe: Recipe, slot: number) {
    const entry = dex.find((e) => e.recipeId === recipe.id && e.discovered);
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
        />
      );
    }
    return (
      <div key={recipe.id} className={`dex-card ${isNew ? "dex-card--new" : ""}`}>
        <h3>
          <span className="dex-card__no">No.{String(slot).padStart(2, "0")}</span> {recipe.nameJa}
          {isNew && <span className="dex-card__badge">NEW</span>}
          {showNewBest && <span className="dex-card__badge dex-card__badge--best">NEW BEST!</span>}
        </h3>
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
      </div>
    );
  }

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel">
        <div className="dex-overlay__header">
          <h2>レシピ図鑑</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="dex-overlay__body" ref={bodyRef}>
          <div className={`dex-overlay__progress ${isComplete ? "dex-overlay__progress--complete" : ""}`}>
            <div className="dex-overlay__progress-row">
              <p className="dex-overlay__progress-count">
                {isComplete ? `🏆 ${total} / ${total}` : `🍕 発見 ${discoveredCount} / ${total}`}
              </p>
              <p className="dex-overlay__progress-sub">
                {isComplete ? "コンプリート！" : `あと${total - discoveredCount}種類！`}
              </p>
            </div>
            <p className="dex-overlay__mastery-total">{"⭐"} 合計★ {mastery}</p>
          </div>
          {researchEntries.length > 0 && (
            <section className="dex-overlay__research">
              <h3 className="dex-overlay__chapter-title">🔎 研究中のピザ</h3>
              <div className="dex-overlay__list">
                {researchEntries.map((view) => (
                  <ResearchEntryCard
                    key={view.recipeId}
                    view={view}
                    onResearch={onResearch && cookableNow(view.recipeId) ? () => onResearch(view.recipeId) : undefined}
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
          {buildRecipeChapters().map((chapter) => {
            const progress = chapterProgress(chapter, dex);
            return (
              <section key={chapter.chapter} className="dex-overlay__chapter">
                <h3 className="dex-overlay__chapter-title">
                  {chapter.titleJa}
                  <span className="dex-overlay__chapter-count">
                    {progress.discovered}/{progress.total}
                    {progress.discovered === progress.total ? " ✓" : ""}
                  </span>
                </h3>
                <div className="dex-overlay__list">
                  {chapter.recipes.map((recipe, index) => renderSlot(recipe, index + 1))}
                </div>
              </section>
            );
          })}
          <div className="dex-overlay__footer">
            <button type="button" className="cta-button cta-button--primary" onClick={onClose}>
              {isComplete ? "もう一枚作る" : "次のピザを作る"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
