import { RECIPES } from "../data/recipes";
import { getIngredient } from "../data/ingredients";

interface DexOverlayProps {
  discoveredRecipeIds: string[];
  onClose: () => void;
}

export function DexOverlay({ discoveredRecipeIds, onClose }: DexOverlayProps) {
  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel">
        <div className="dex-overlay__header">
          <h2>レシピ図鑑</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>
        <div className="dex-overlay__list">
          {RECIPES.map((recipe) => {
            const discovered = discoveredRecipeIds.includes(recipe.id);
            return (
              <div key={recipe.id} className={`dex-card ${discovered ? "" : "dex-card--locked"}`}>
                <h3>{discovered ? recipe.nameJa : "？？？"}</h3>
                {discovered ? (
                  <>
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
                  </>
                ) : (
                  <p>まだ発見されていません</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
