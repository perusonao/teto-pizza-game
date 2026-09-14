import { INGREDIENTS, type Ingredient } from "../data/ingredients";
import { ingredientState } from "../state/progression";
import { totalStars } from "../logic/mastery";
import type { DexState } from "../state/dex";

interface ShopOverlayProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  pitzBalance: number;
  onPurchase: (ingredientId: string) => void;
  onClose: () => void;
}

/**
 * Shop products (Phase 3C-5, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 9): every
 * ingredient with a Mastery gate (`unlockCondition`). Starter Set ingredients (see
 * src/data/ingredients.ts's `STARTER_INGREDIENT_IDS`) never appear here -- they're always
 * OWNED and never for sale. Currently empty in production (Phase 3C-5 deliberately adds no new
 * ingredient of its own, per SSOT section 12/scope -- Recipe #7/salami is Phase 3C-6's job) --
 * the empty state below handles that safely rather than assuming at least one product exists.
 */
const SHOP_PRODUCTS: readonly Ingredient[] = INGREDIENTS.filter((i) => i.unlockCondition);

/** One shop row's derived, presentation-only state -- never a stored/duplicated flag. */
function remainingStarsFor(ingredient: Ingredient, stars: number): number {
  return Math.max(0, (ingredient.unlockCondition?.minTotalStars ?? 0) - stars);
}

export function ShopOverlay({
  dex,
  ownedIngredientIds,
  pitzBalance,
  onPurchase,
  onClose,
}: ShopOverlayProps) {
  const stars = totalStars(dex);

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel shop-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"\u{1F6D2}"} SHOP</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <p className="shop-overlay__balance">
          {"\u{1FA99}"} {pitzBalance} Pitz
        </p>

        {SHOP_PRODUCTS.length === 0 && (
          <p className="shop-overlay__empty">新しい素材は、ピザの腕前が上がると入荷します</p>
        )}

        {SHOP_PRODUCTS.length > 0 && (
          <div className="shop-overlay__list">
            {SHOP_PRODUCTS.map((ingredient) => {
              const state = ingredientState(ingredient, ownedIngredientIds, stars);
              return (
                <div key={ingredient.id} className="shop-item">
                  <div className="shop-item__info">
                    <span className="shop-item__emoji">{ingredient.emoji}</span>
                    <span className="shop-item__name">{ingredient.nameJa}</span>
                  </div>

                  {state === "LOCKED" && (
                    <span className="shop-item__status shop-item__status--locked">
                      {"\u{1F512}"} あと★{remainingStarsFor(ingredient, stars)}
                    </span>
                  )}

                  {state === "AVAILABLE_TO_BUY" && (
                    <div className="shop-item__buy">
                      <span className="shop-item__price">
                        {"\u{1FA99}"} {ingredient.pricePitz} Pitz
                      </span>
                      <button
                        type="button"
                        className="shop-item__buy-button"
                        disabled={pitzBalance < (ingredient.pricePitz ?? Infinity)}
                        onClick={() => onPurchase(ingredient.id)}
                      >
                        購入
                      </button>
                    </div>
                  )}

                  {state === "OWNED" && (
                    <span className="shop-item__status shop-item__status--owned">
                      {"✓"} 購入済み
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
