import { useEffect, useRef } from "react";
import { RECIPES, type Recipe } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import { buildRecipeChapters, chapterProgress } from "../state/recipeChapters";
import { recipeDiscoveryState, type RecipeDiscoveryState } from "../state/recipeDiscoveryState";
import { totalStars } from "../logic/mastery";
import { starLabel } from "../logic/scoring";
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
}

/** W1-f: an undiscovered slot says only which kind of "next" it is (L1) -- never the recipe's
 *  name, preview, ingredients or name length. UNKNOWN slots are not talked about (P-4). */
function UndiscoveredSlot({
  slot,
  state,
  onGoFreeCook,
  onOpenShop,
}: {
  slot: number;
  state: Exclude<RecipeDiscoveryState, "DISCOVERED">;
  onGoFreeCook?: () => void;
  onOpenShop?: () => void;
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
        {tag && cta && (
          <button type="button" className="dex-card__tag-cta" onClick={cta}>
            {state === "DISCOVERABLE" ? "フリークッキングで探す" : "ショップを見る"}
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
}: DexOverlayProps) {
  const total = RECIPES.length;
  const discoveredCount = dex.filter((e) => e.discovered).length;
  const isComplete = discoveredCount >= total;
  const mastery = totalStars(dex);
  const inputs = { dex, ownedIngredientIds, unlockedForShopIngredientIds, inventory };
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
      return (
        <UndiscoveredSlot
          key={recipe.id}
          slot={slot}
          state={state === "DISCOVERED" ? "UNKNOWN" : state}
          onGoFreeCook={onGoFreeCook}
          onOpenShop={onOpenShop}
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
