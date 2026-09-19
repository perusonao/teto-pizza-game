import { useState } from "react";
import { INGREDIENTS, type Ingredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { ingredientState, recipesUnlockedByIngredient } from "../state/progression";
import { totalStars } from "../logic/mastery";
import type { DexState } from "../state/dex";
import { remainingStock, type InventoryState } from "../state/inventory";

interface ShopOverlayProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  pitzBalance: number;
  /** Economy & Progression 1.0 EP3: read-only, for the OWNED-row restock display (current
   *  stock/CTA affordability) -- ShopOverlay never mutates this itself. */
  inventory: InventoryState;
  onPurchase: (ingredientId: string) => void;
  /** EP3: dispatches RESTOCK_INGREDIENT, a *separate* transaction from `onPurchase`
   *  (PURCHASE_INGREDIENT) -- see gameReducer.ts's RESTOCK_INGREDIENT case / economy.ts's
   *  `restockIngredient` doc comment for why the two are never merged into one handler. */
  onRestock: (ingredientId: string) => void;
  onClose: () => void;
}

/**
 * Shop products (Phase 3C-5, see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 9): every
 * ingredient with a Mastery gate (`unlockCondition`). Starter Set ingredients (see
 * src/data/ingredients.ts's `STARTER_INGREDIENT_IDS`) never appear here -- they're always
 * OWNED and never for sale. Production's first (and currently only) product is Phase 3C-6's
 * `onion` (see docs/design/PIZZA_GAME_PROGRESSION_SSOT.md section 12) -- the empty-state
 * branch below is kept for safety (e.g. a future save with no purchasable ingredients),
 * not because it's expected to trigger today.
 */
const SHOP_PRODUCTS: readonly Ingredient[] = INGREDIENTS.filter((i) => i.unlockCondition);

/** One shop row's derived, presentation-only state -- never a stored/duplicated flag. */
function remainingStarsFor(ingredient: Ingredient, stars: number): number {
  return Math.max(0, (ingredient.unlockCondition?.minTotalStars ?? 0) - stars);
}

/** "解放: 🍕 フガッサ" style label listing the recipe name(s) this ingredient unlocks --
 *  derived purely for display (see `recipesUnlockedByIngredient`'s own doc comment). Empty
 *  when this ingredient doesn't complete any recipe on its own (not expected in production
 *  today, but never crashes if a future ingredient doesn't gate a recipe). */
function unlockedRecipeLabel(
  ingredientId: string,
  dex: DexState,
  ownedIngredientIds: readonly string[],
): string {
  return recipesUnlockedByIngredient(ingredientId, dex, ownedIngredientIds)
    .map((id) => getRecipe(id)?.nameJa)
    .filter((name): name is string => !!name)
    .join("、");
}

/** Local, purely-presentational purchase feedback (Phase 3C-6, SSOT section 7-8): "たまねぎを
 *  仕入れました！" + which recipe it just unlocked. Captured at the moment "購入" is clicked
 *  (before `ownedIngredientIds` actually updates) so the unlocked-recipe list reflects what
 *  the purchase *did*, not the post-purchase state where it would already read as owned/empty.
 *  Deliberately component-local state, not a GameState field -- Shop is the only place this
 *  feedback needs to live, so there's no reason to add another transient reducer flag
 *  alongside `justDiscovered`/`justGotNewBest` for it. */
interface PurchaseFeedback {
  ingredientId: string;
  ingredientNameJa: string;
  unlockedRecipeNames: string[];
}

/** EP3: local, purely-presentational restock feedback ("たまねぎを補充しました！") -- mirrors
 *  `PurchaseFeedback`'s own component-local pattern exactly, kept as a separate type/state
 *  rather than merged into it, since restock has no "unlocked recipe" concept to report and is
 *  a structurally different transaction (see RestockIngredientResult in ../logic/economy.ts). */
interface RestockFeedback {
  ingredientId: string;
  ingredientNameJa: string;
  quantity: number;
  /** Stock immediately before this restock's own dispatch -- lets `showRestockFeedback` below
   *  confirm the credit actually landed (mirrors `showFeedback`'s own "landed in
   *  ownedIngredientIds" gate), so a rejected tap (e.g. insufficient funds slipping through a
   *  stale disabled-button render) never shows a false "補充しました" message. */
  stockBefore: number;
}

export function ShopOverlay({
  dex,
  ownedIngredientIds,
  pitzBalance,
  inventory,
  onPurchase,
  onRestock,
  onClose,
}: ShopOverlayProps) {
  const stars = totalStars(dex);
  const [feedback, setFeedback] = useState<PurchaseFeedback | null>(null);
  const [restockFeedback, setRestockFeedback] = useState<RestockFeedback | null>(null);

  function handleBuy(ingredient: Ingredient) {
    const unlockedRecipeNames = recipesUnlockedByIngredient(ingredient.id, dex, ownedIngredientIds)
      .map((id) => getRecipe(id)?.nameJa)
      .filter((name): name is string => !!name);
    onPurchase(ingredient.id);
    setFeedback({ ingredientId: ingredient.id, ingredientNameJa: ingredient.nameJa, unlockedRecipeNames });
    setRestockFeedback(null);
  }

  // EP3: captured before dispatch, same "describe what the action just did" timing as
  // handleBuy above -- restockIngredient's own atomicity means a failed restock (insufficient
  // funds) never changes `inventory`, so `showRestockFeedback` below (gated on the stock
  // actually having grown) never shows a false "補充しました" message for a rejected tap.
  function handleRestock(ingredient: Ingredient) {
    const stockBefore = inventory[ingredient.id] ?? 0;
    onRestock(ingredient.id);
    setRestockFeedback({
      ingredientId: ingredient.id,
      ingredientNameJa: ingredient.nameJa,
      quantity: ingredient.restockQuantity ?? 0,
      stockBefore,
    });
    setFeedback(null);
  }

  // Only shows once the purchase this feedback describes has actually landed in
  // `ownedIngredientIds` -- a disabled/failed buy tap (e.g. insufficient funds slipping through
  // a stale render) never shows a false "仕入れました" message, since that id simply won't be
  // owned yet on the next render.
  const showFeedback = feedback && ownedIngredientIds.includes(feedback.ingredientId);
  // EP3: mirrors showFeedback's own landed-check -- only true once `inventory` actually grew
  // past what it was immediately before this restock's dispatch.
  const showRestockFeedback =
    restockFeedback && (inventory[restockFeedback.ingredientId] ?? 0) > restockFeedback.stockBefore;

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

        {showFeedback && (
          <p className="shop-overlay__feedback">
            {"\u{1F355}"} {feedback.ingredientNameJa}を仕入れました！
            {feedback.unlockedRecipeNames.length > 0 && (
              <>
                <br />
                {"\u{1F355}"} 新しいピザが作れます！「{feedback.unlockedRecipeNames.join("、")}」
              </>
            )}
          </p>
        )}

        {showRestockFeedback && (
          <p className="shop-overlay__feedback">
            {"\u{1F4E6}"} {restockFeedback.ingredientNameJa}を{restockFeedback.quantity}補充しました！
          </p>
        )}

        {SHOP_PRODUCTS.length === 0 && (
          <p className="shop-overlay__empty">新しい素材は、ピザの腕前が上がると入荷します</p>
        )}

        {SHOP_PRODUCTS.length > 0 && (
          <div className="shop-overlay__list">
            {SHOP_PRODUCTS.map((ingredient) => {
              const state = ingredientState(ingredient, ownedIngredientIds, stars);
              const unlocksLabel = unlockedRecipeLabel(ingredient.id, dex, ownedIngredientIds);
              return (
                <div key={ingredient.id} className="shop-item">
                  <div className="shop-item__row">
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
                          onClick={() => handleBuy(ingredient)}
                        >
                          購入
                        </button>
                      </div>
                    )}

                    {/* EP3: every SHOP_PRODUCTS entry has `unlockCondition` by construction (the
                        list's own filter above), so an OWNED row here is always a genuinely
                        finite ingredient -- restock, never a plain "✓ 購入済み" checkmark, is the
                        only OWNED presentation this list ever needs (unlike a hypothetical
                        Starter/unlimited ingredient, which this list structurally never lists at
                        all -- see the "Unlimited" scope note in the EP3 Result report). */}
                    {state === "OWNED" && (
                      <div className="shop-item__restock">
                        <span className="shop-item__stock">
                          在庫 {remainingStock(ingredient, inventory)}
                        </span>
                        <span className="shop-item__restock-qty">+{ingredient.restockQuantity}</span>
                        <span className="shop-item__price">
                          {"\u{1FA99}"} {ingredient.pricePitz} Pitz
                        </span>
                        <button
                          type="button"
                          className="shop-item__restock-button"
                          disabled={pitzBalance < (ingredient.pricePitz ?? Infinity)}
                          onClick={() => handleRestock(ingredient)}
                        >
                          補充する
                        </button>
                      </div>
                    )}
                  </div>
                  {/* "何を買うと何ができるか" preview (SSOT section 8): shown before purchase
                      (LOCKED/AVAILABLE_TO_BUY) so the player can see the payoff up front --
                      never for OWNED, where the recipe is simply already available. */}
                  {state !== "OWNED" && unlocksLabel && (
                    <p className="shop-item__unlocks">
                      これを買うと: {"\u{1F355}"} {unlocksLabel}
                    </p>
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
