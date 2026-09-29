import { useState } from "react";
import { CATEGORY_LABEL, INGREDIENTS } from "../data/ingredients";
import { filterByShelf, shelvesPresent, type ShelfFilter } from "../data/ingredientShelf";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { remainingStock, type InventoryState } from "../state/inventory";
import { ingredientCollectionCount } from "../state/materialEntitlement";
import { IngredientGlyph } from "./IngredientGlyph";
import { ShelfChips } from "./ShelfChips";

/**
 * Inventory Screen (next phase after Issue #86 UX-2): a READ-ONLY view of "what do I currently
 * own and how much of it is left," kept deliberately separate from ShopOverlay ("purchase /
 * restock"). Props are data + `onClose` only -- no `onPurchase`/`onRestock`/dispatch of any
 * kind is even accepted, so this component cannot mutate `ownedIngredientIds`/`inventory` no
 * matter what a future edit here tries to wire up; that guarantee is structural (the type
 * signature), not just a convention.
 *
 * Reuses the exact SSOT this game already has for stock (`remainingStock`, ../state/inventory.ts)
 * and ownership (`ownedIngredientIds`, threaded in as a prop from GameState) -- no second stock
 * calculation is invented here. Each card's coarse category label still comes from
 * `CATEGORY_LABEL` (../data/ingredients.ts); that is card metadata, not the filter.
 *
 * Ingredient Category Tabs 1.0 Phase 4: the filter is a display-only shelf chip row
 * (../data/ingredientShelf.ts is the authority; ./ShelfChips.tsx the shared UI). The chips are
 * derived from the OWNED rows this screen lists -- never from the catalog, the Shop entitlement
 * or unbought (NEW) materials -- so a shelf with no owned ingredient has no chip, DOM node or
 * text. No counts. The old 「すべて / ソース / チーズ / トッピング」 tabs are gone.
 */

interface InventoryOverlayProps {
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  onClose: () => void;
}

export function InventoryOverlay({ ownedIngredientIds, inventory, onClose }: InventoryOverlayProps) {
  const [activeShelf, setActiveShelf] = useState<ShelfFilter>("all");

  const owned = INGREDIENTS.filter((ingredient) => ownedIngredientIds.includes(ingredient.id));
  const collection = ingredientCollectionCount(ownedIngredientIds);
  const presentShelves = shelvesPresent(owned);
  // A shelf that is no longer listed reads as 「すべて」 (derived while rendering: no setState in
  // render or in an effect). The stored choice is only ever written by a chip tap.
  const shelfFilter: ShelfFilter =
    activeShelf === "all" || presentShelves.includes(activeShelf) ? activeShelf : "all";
  const shownIds = new Set(filterByShelf(owned, shelfFilter).map((i) => i.id));
  const visible = owned.filter((ingredient) => shownIds.has(ingredient.id));

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel inventory-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"\u{1F9FA}"} 在庫</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="dex-overlay__body inventory-overlay__body">
          <p className="inventory-overlay__summary">
            所持 {collection.owned}/{collection.total}種
          </p>

          <div className="inventory-overlay__shelves">
            <ShelfChips
              shelves={presentShelves}
              active={shelfFilter}
              onChange={setActiveShelf}
              ariaLabel="材料の分類"
            />
          </div>

          <div className="inventory-overlay__list" role="region" aria-label="材料一覧" tabIndex={0}>
            {visible.length === 0 && (
              <p className="inventory-overlay__empty">まだこのカテゴリの材料を持っていません</p>
            )}

            {visible.length > 0 && (
              <div className="inventory-grid">
                {visible.map((ingredient) => {
                  const stock = remainingStock(ingredient, inventory);
                  return (
                    <div key={ingredient.id} className="inventory-card">
                      {ingredient.category === "cheese" ? (
                        <span className="inventory-card__cheese-slot">
                          <IngredientPieceVisual ingredient={ingredient} />
                        </span>
                      ) : (
                        <span className="inventory-card__emoji">
                          <IngredientGlyph ingredient={ingredient} />
                        </span>
                      )}
                      <span className="inventory-card__name">{ingredient.nameJa}</span>
                      <span className="inventory-card__category">{CATEGORY_LABEL[ingredient.category]}</span>
                      <span
                        className={`inventory-card__stock ${stock === 0 ? "inventory-card__stock--zero" : ""}`}
                      >
                        {stock === "UNLIMITED" ? "∞" : `×${stock}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
