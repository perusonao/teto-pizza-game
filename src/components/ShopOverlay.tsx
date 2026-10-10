import { useState } from "react";
import { INGREDIENTS, type Ingredient } from "../data/ingredients";
import {
  familiesPresent,
  filterBySelection,
  majorsPresent,
  resolveSelection,
  SELECTION_ALL,
  type ShelfSelection,
} from "../data/ingredientShelf";
import type { DexState } from "../state/dex";
import { remainingStock, type InventoryState } from "../state/inventory";
import { countsTowardLadder } from "../data/recipes";
import { discoveredRecipeCount } from "../logic/discoveryLadder";
import { totalStars } from "../logic/mastery";
import {
  MATERIAL_PACK_PIZZAS,
  materialOffer,
  materialShopState,
  nextMaterialHint,
  nextStarGateHint,
  type MaterialOffer,
} from "../logic/materialShop";
import { IngredientGlyph } from "./IngredientGlyph";
import { FamilyTag } from "./FamilyTag";
import { ShelfTabs } from "./ShelfTabs";
import { ShopLockedSection } from "./ShopLockedSection";

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
 * - LOCKED materials are never listed by name (#422 PR-B shows them only as anonymous slots, see
 *   ShopLockedSection); one progress line says how many more discoveries bring
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

/** #422 PR-B: how many materials are LOCKED -- `materialShopState` is the only judge. Starters
 *  (UNLIMITED) are never LOCKED, and a material with no `materialOffer` still counts: this is a
 *  count of slots, never a list of materials, so nothing about any one of them can leak. */
function lockedMaterialCount(
  ownedIngredientIds: readonly string[],
  unlockedForShopIngredientIds: readonly string[],
): number {
  return INGREDIENTS.filter(
    (i) => materialShopState(i, ownedIngredientIds, unlockedForShopIngredientIds) === "LOCKED",
  ).length;
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
  const lockedCount = lockedMaterialCount(ownedIngredientIds, unlockedForShopIngredientIds);
  const progress = nextMaterialHint(
    discoveredRecipeCount(dex, countsTowardLadder),
    unlockedForShopIngredientIds,
  );
  const starProgress = nextStarGateHint(
    discoveredRecipeCount(dex, countsTowardLadder),
    totalStars(dex),
    unlockedForShopIngredientIds,
  );
  const [feedback, setFeedback] = useState<ShopFeedback | null>(null);
  // Ingredient Pantry / Category Tabs: a display-only two-tier shelf filter (./ingredientShelf.ts is the authority
  // for ids, order, labels and membership). The tabs are derived from the rows this Shop already lists (NEW /
  // OWNED), never from the catalog, so a shelf that only holds LOCKED materials has no tab, no DOM node and no text.
  // No counts. A tab that is no longer listed (rows changed) safely reads as 「すべて」, derived while rendering.
  const listedIngredients = rows.map((r) => r.ingredient);
  const [selection, setSelection] = useState<ShelfSelection>(SELECTION_ALL);
  const activeSelection = resolveSelection(selection, listedIngredients);
  const shownIds = new Set(filterBySelection(listedIngredients, activeSelection).map((i) => i.id));
  const visibleRows = rows.filter((r) => shownIds.has(r.ingredient.id));

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
          <button type="button" className="dex-overlay__close dex-overlay__close--tap44" onClick={onClose}>
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
                  {"\u{1F373}"} レシピ発見で使ってみよう
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

          {/* Batch 6 PR-3 (OD-B6-PR3-3): one aggregated line, outside the LOCKED slots. A number only -- no
              material, step or gate is nameable from here. */}
          {starProgress && (
            <p className="shop-overlay__progress" data-shop-star-progress="true">
              {"\u2B50"} あと{starProgress.starsNeeded}個で新しい材料が入荷
            </p>
          )}

          {rows.length === 0 && (
            <p className="shop-overlay__empty">新しいピザを発見すると、材料が入荷します</p>
          )}

          {/* #455: the tabs and the list share one wrapper so the tabs stay pinned (CSS `sticky`) while the
              list scrolls and release before the LOCKED section, which the tabs never filter. Shop only: ShelfTabs
              and the Inventory are untouched. */}
          {rows.length > 0 && (
            <div className="shop-overlay__shelf">
              <ShelfTabs
                majors={majorsPresent(listedIngredients)}
                families={familiesPresent(listedIngredients)}
                selection={activeSelection}
                onChange={setSelection}
              />

              {visibleRows.length === 0 && (
                <p className="shop-overlay__empty">このカテゴリで買える材料はまだありません</p>
              )}

              {visibleRows.length > 0 && (
                <div className="shop-overlay__list">
                  {visibleRows.map((row) => {
                    const { ingredient, state, offer } = row;
                    const price = state === "NEW" ? offer.packPrice : offer.refillPrice;
                    const shortfall = Math.max(0, price - pitzBalance);
                    // #378 Option 1 (OD-378-2): the same zero-stock mark for EVERY owned material -- never filtered,
                    // sorted or highlighted by what any Research Entry needs.
                    const outOfStock = state === "OWNED" && (inventory[ingredient.id] ?? 0) <= 0;
                    return (
                      <div
                        key={ingredient.id}
                        className={`shop-item${state === "NEW" ? " shop-item--new" : ""}${outOfStock ? " shop-item--empty" : ""}`}
                        data-ingredient-id={ingredient.id}
                        data-shop-state={state}
                        data-stock-state={outOfStock ? "EMPTY" : undefined}
                      >
                        <div className="shop-item__row">
                          <div className="shop-item__info">
                            <span className="shop-item__emoji">
                              <IngredientGlyph ingredient={ingredient} />
                            </span>
                            <span className="shop-item__name">{ingredient.nameJa}</span>
                            {state === "NEW" && <span className="shop-item__badge">NEW 入荷</span>}
                            {outOfStock && <span className="shop-item__badge shop-item__badge--empty">在庫なし</span>}
                          </div>
                          <span className="shop-item__stock">在庫 {remainingStock(ingredient, inventory)}</span>
                        </div>
                        <FamilyTag ingredientId={ingredient.id} className="shop-item__family" />
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
          )}

          <ShopLockedSection count={lockedCount} />
        </div>
      </div>
    </div>
  );
}
