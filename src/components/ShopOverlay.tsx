import { useState } from "react";
import {
  CATEGORY_TAB_LABEL,
  CATEGORY_TAB_ORDER,
  INGREDIENTS,
  type CategoryTab,
  type Ingredient,
} from "../data/ingredients";
import type { DexState } from "../state/dex";
import { remainingStock, type InventoryState } from "../state/inventory";
import { discoveredRecipeCount } from "../logic/discoveryLadder";
import {
  MATERIAL_PACK_PIZZAS,
  materialOffer,
  materialShopState,
  nextMaterialHint,
  type MaterialOffer,
} from "../logic/materialShop";
import { IngredientGlyph } from "./IngredientGlyph";

interface ShopOverlayProps {
  dex: DexState;
  ownedIngredientIds: readonly string[];
  /** Progression 2.0 I4b-4: the Discovery Ladder Shop entitlement (`GameState.
   *  unlockedForShopIngredientIds`). A material listed here but not owned is a NEW row. */
  unlockedForShopIngredientIds: readonly string[];
  pitzBalance: number;
  /** Read-only, for the OWNED-row stock display -- ShopOverlay never mutates this itself. */
  inventory: InventoryState;
  /** PURCHASE_INGREDIENT: the first pack of a NEW material. */
  onPurchase: (ingredientId: string) => void;
  /** RESTOCK_INGREDIENT: one refill pack of an OWNED material -- a *separate* transaction from
   *  `onPurchase` (see gameReducer.ts's RESTOCK_INGREDIENT case). */
  onRestock: (ingredientId: string) => void;
  onClose: () => void;
}

/**
 * Progression 2.0 W1 Integration I4b-4: the material Shop under REC-04 (docs/reports/
 * TETO_PROGRESS2_W1_I4B_Fresh-Audit.md §3 G, implementation default "LOCKED rows are not listed").
 *
 * - NEW: unlocked by the Discovery Ladder, not bought yet, stock 0 -- offers the first pack.
 * - OWNED: bought (or granted by the retired EP4) -- shows stock and offers a refill.
 * - LOCKED materials are never listed; one progress line says how many more discoveries bring
 *   the next material, without naming it. The onboarding starters are never listed.
 *
 * Every price and quantity comes from ../logic/materialShop.ts's `materialOffer`, the same pure
 * function the reducer's purchase/refill transactions use -- nothing is hard-coded here.
 */
interface ShopRow {
  ingredient: Ingredient;
  state: "NEW" | "OWNED";
  offer: MaterialOffer;
}

function shopRows(
  ownedIngredientIds: readonly string[],
  unlockedForShopIngredientIds: readonly string[],
): ShopRow[] {
  const rows: ShopRow[] = [];
  for (const ingredient of INGREDIENTS) {
    const state = materialShopState(ingredient, ownedIngredientIds, unlockedForShopIngredientIds);
    if (state !== "NEW" && state !== "OWNED") continue;
    const offer = materialOffer(ingredient);
    if (!offer) continue;
    rows.push({ ingredient, state, offer });
  }
  // NEW first (the next thing to do), then OWNED; catalog order within each group.
  return [...rows.filter((r) => r.state === "NEW"), ...rows.filter((r) => r.state === "OWNED")];
}

/** "10ピザ分（30個）" -- a scatter pack also names its piece count; a spread (sauce) pack is
 *  simply 10 pizzas' worth (1 use per pizza). */
function packLabelJa(ingredient: Ingredient, offer: MaterialOffer): string {
  return ingredient.placement === "scatter"
    ? `${MATERIAL_PACK_PIZZAS}ピザ分（${offer.packQuantity}個）`
    : `${MATERIAL_PACK_PIZZAS}ピザ分`;
}

/** Progression 2.0 W1 Discovery 2.0 (W1-b, OD-DISC-3): a NEW material's row never names the
 *  recipe it completes -- a recipe's name is revealed only at the moment it is discovered. The row
 *  says only that the material may lead somewhere new (L1). `recipesUnlockedByIngredient`
 *  (../state/progression.ts) is no longer read by the Shop. */
export const SHOP_NEW_MATERIAL_HINT_JA = "\u{1F3A8} 新しいピザのヒントになるかも";

/** Local, presentational purchase/refill feedback. Captured when the button is tapped and shown
 *  only once the reducer's result has actually landed (owned / stock increased), so a rejected
 *  tap never shows a false success message. */
interface ShopFeedback {
  kind: "PURCHASE" | "REFILL";
  ingredientId: string;
  ingredientNameJa: string;
  quantityLabelJa: string;
  stockBefore: number;
}

export function ShopOverlay({
  dex,
  ownedIngredientIds,
  unlockedForShopIngredientIds,
  pitzBalance,
  inventory,
  onPurchase,
  onRestock,
  onClose,
}: ShopOverlayProps) {
  const rows = shopRows(ownedIngredientIds, unlockedForShopIngredientIds);
  const progress = nextMaterialHint(discoveredRecipeCount(dex), unlockedForShopIngredientIds);
  const [feedback, setFeedback] = useState<ShopFeedback | null>(null);
  // Visual Polish 1C: a client-side view filter over the already-visible rows only -- it can
  // never reveal a LOCKED material.
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL");
  const visibleRows = activeTab === "ALL" ? rows : rows.filter((r) => r.ingredient.category === activeTab);

  function handleBuy(row: ShopRow) {
    const { ingredient, offer } = row;
    setFeedback({
      kind: "PURCHASE",
      ingredientId: ingredient.id,
      ingredientNameJa: ingredient.nameJa,
      quantityLabelJa: packLabelJa(ingredient, offer),
      stockBefore: inventory[ingredient.id] ?? 0,
    });
    onPurchase(ingredient.id);
  }

  function handleRefill(row: ShopRow) {
    const { ingredient, offer } = row;
    setFeedback({
      kind: "REFILL",
      ingredientId: ingredient.id,
      ingredientNameJa: ingredient.nameJa,
      quantityLabelJa: packLabelJa(ingredient, offer),
      stockBefore: inventory[ingredient.id] ?? 0,
    });
    onRestock(ingredient.id);
  }

  const feedbackLanded =
    feedback !== null &&
    (feedback.kind === "PURCHASE"
      ? ownedIngredientIds.includes(feedback.ingredientId)
      : (inventory[feedback.ingredientId] ?? 0) > feedback.stockBefore);

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel shop-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"\u{1F6D2}"} SHOP</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="dex-overlay__body shop-overlay__body">
          <p className="shop-overlay__balance">
            {"\u{1FA99}"} {pitzBalance} Pitz
          </p>

          {feedback && feedbackLanded && (
            <p className="shop-overlay__feedback" aria-live="polite">
              {feedback.kind === "PURCHASE" ? (
                <>
                  {"\u{1F4E6}"} {feedback.ingredientNameJa}を仕入れました！（{feedback.quantityLabelJa}）
                  <br />
                  {"\u{1F373}"} フリークッキングで使ってみよう
                </>
              ) : (
                <>
                  {"\u{1F4E6}"} {feedback.ingredientNameJa}を補充しました！（{feedback.quantityLabelJa}）
                </>
              )}
            </p>
          )}

          {progress && (
            <p className="shop-overlay__progress">
              {"\u{1F51C}"} あと{progress.discoveriesNeeded}つ発見で新しい材料が入荷
            </p>
          )}

          {rows.length === 0 && (
            <p className="shop-overlay__empty">新しいピザを発見すると、材料が入荷します</p>
          )}

          {rows.length > 0 && (
            <div className="shop-filter-tabs" role="tablist" aria-label="材料カテゴリ">
              {CATEGORY_TAB_ORDER.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  className={`shop-filter-tab ${activeTab === tab ? "shop-filter-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {CATEGORY_TAB_LABEL[tab]}
                </button>
              ))}
            </div>
          )}

          {rows.length > 0 && visibleRows.length === 0 && (
            <p className="shop-overlay__empty">このカテゴリで買える材料はまだありません</p>
          )}

          {visibleRows.length > 0 && (
            <div className="shop-overlay__list">
              {visibleRows.map((row) => {
                const { ingredient, state, offer } = row;
                const price = state === "NEW" ? offer.packPrice : offer.refillPrice;
                const shortfall = Math.max(0, price - pitzBalance);
                return (
                  <div
                    key={ingredient.id}
                    className={`shop-item${state === "NEW" ? " shop-item--new" : ""}`}
                    data-ingredient-id={ingredient.id}
                    data-shop-state={state}
                  >
                    <div className="shop-item__row">
                      <div className="shop-item__info">
                        <span className="shop-item__emoji">
                          <IngredientGlyph ingredient={ingredient} />
                        </span>
                        <span className="shop-item__name">{ingredient.nameJa}</span>
                        {state === "NEW" && <span className="shop-item__badge">NEW 入荷</span>}
                      </div>
                      <span className="shop-item__stock">在庫 {remainingStock(ingredient, inventory)}</span>
                    </div>
                    <div className="shop-item__row">
                      <span className="shop-item__pack">
                        {state === "NEW" ? "" : "+"}
                        {"\u{1F355}"}
                        {packLabelJa(ingredient, offer)}
                      </span>
                      <div className="shop-item__buy">
                        <span className="shop-item__price">
                          {state === "NEW" ? "初回" : "補充"} {"\u{1FA99}"} {price} Pitz
                        </span>
                        {state === "NEW" ? (
                          <button
                            type="button"
                            className="shop-item__buy-button"
                            disabled={shortfall > 0}
                            onClick={() => handleBuy(row)}
                          >
                            仕入れる
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="shop-item__restock-button"
                            disabled={shortfall > 0}
                            onClick={() => handleRefill(row)}
                          >
                            補充する
                          </button>
                        )}
                      </div>
                    </div>
                    {shortfall > 0 && (
                      <p className="shop-item__shortfall">あと {shortfall} Pitz たりません</p>
                    )}
                    {state === "NEW" && <p className="shop-item__unlocks">{SHOP_NEW_MATERIAL_HINT_JA}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
