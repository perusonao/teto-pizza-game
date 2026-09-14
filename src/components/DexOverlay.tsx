import { RECIPES } from "../data/recipes";
import { getIngredient } from "../data/ingredients";
import type { DexEntry, DexState } from "../state/dex";

interface DexOverlayProps {
  dex: DexState;
  /** Recipe discovered for the very first time this round (drives the NEW badge). */
  newlyDiscoveredId: string | null;
  /** Recipe whose Dex BEST just improved on a repeat play this round (drives the NEW BEST
   *  badge). Mutually exclusive with `newlyDiscoveredId` in practice: a first discovery
   *  shows NEW, not NEW BEST — the caller only sets one of the two per round. */
  newBestRecipeId: string | null;
  onClose: () => void;
}

const MAX_STARS = 5;

function starLabel(stars: DexEntry["bestStars"]): string {
  return "★".repeat(stars) + "☆".repeat(MAX_STARS - stars);
}

export function DexOverlay({ dex, newlyDiscoveredId, newBestRecipeId, onClose }: DexOverlayProps) {
  const total = RECIPES.length;
  const discoveredCount = dex.filter((e) => e.discovered).length;
  const isComplete = discoveredCount >= total;

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel">
        <div className="dex-overlay__header">
          <h2>レシピ図鑑</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className={`dex-overlay__progress ${isComplete ? "dex-overlay__progress--complete" : ""}`}>
          <p className="dex-overlay__progress-count">
            {isComplete ? `🏆 ${total} / ${total}` : `🍕 発見 ${discoveredCount} / ${total}`}
          </p>
          <p className="dex-overlay__progress-sub">
            {isComplete ? "コンプリート！" : `あと${total - discoveredCount}種類！`}
          </p>
        </div>
        <div className="dex-overlay__list">
          {RECIPES.map((recipe) => {
            const entry = dex.find((e) => e.recipeId === recipe.id && e.discovered);
            const isNew = !!entry && recipe.id === newlyDiscoveredId;
            const showNewBest = !!entry && recipe.id === newBestRecipeId;
            if (!entry) {
              return (
                <div key={recipe.id} className="dex-card dex-card--locked">
                  <span className="dex-card__lock-icon">🔒</span>
                  <div className="dex-card__lock-text">
                    <p className="dex-card__lock-label">？？？</p>
                    <p className="dex-card__lock-hint">まだ見ぬピザ</p>
                  </div>
                </div>
              );
            }
            return (
              <div key={recipe.id} className={`dex-card ${isNew ? "dex-card--new" : ""}`}>
                <h3>
                  {recipe.nameJa}
                  {isNew && <span className="dex-card__badge">NEW</span>}
                  {showNewBest && <span className="dex-card__badge dex-card__badge--best">NEW BEST!</span>}
                </h3>
                <p>{recipe.description}</p>
                <div className="dex-card__ingredients">
                  {recipe.requiredIngredients.map((req) => {
                    const ingredient = getIngredient(req.ingredientId);
                    return (
                      <span key={req.ingredientId} className="dex-card__ingredient">
                        {ingredient?.emoji} {ingredient?.nameJa}
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
          })}
        </div>
        <div className="dex-overlay__footer">
          <button type="button" className="cta-button cta-button--primary" onClick={onClose}>
            {isComplete ? "もう一枚作る" : "次のピザを作る"}
          </button>
        </div>
      </div>
    </div>
  );
}
