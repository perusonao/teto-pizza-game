import { RECIPES } from "../data/recipes";
import { getIngredient } from "../data/ingredients";

interface DexOverlayProps {
  discoveredRecipeIds: string[];
  newlyDiscoveredId: string | null;
  onClose: () => void;
}

export function DexOverlay({ discoveredRecipeIds, newlyDiscoveredId, onClose }: DexOverlayProps) {
  const total = RECIPES.length;
  const discoveredCount = discoveredRecipeIds.length;
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
            const discovered = discoveredRecipeIds.includes(recipe.id);
            const isNew = discovered && recipe.id === newlyDiscoveredId;
            if (!discovered) {
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
