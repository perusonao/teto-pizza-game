import { useState } from "react";
import { CATEGORY_LABEL, CATEGORY_ORDER, INGREDIENTS, type IngredientCategory } from "../data/ingredients";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { remainingStock, type InventoryState } from "../state/inventory";
import { IngredientGlyph } from "./IngredientGlyph";

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
 * calculation is invented here. Category grouping reuses `Ingredient.category` /
 * `CATEGORY_ORDER` / `CATEGORY_LABEL` (../data/ingredients.ts) rather than a hand-maintained id
 * list, so this stays correct as the catalog grows well past today's 14 ingredients (see the
 * Inventory Screen Result report's 30/62-ingredient scalability verification, mirroring Issue
 * #86's own IngredientTray scalability work).
 */

type CategoryTab = "ALL" | IngredientCategory;

const TAB_ORDER: readonly CategoryTab[] = ["ALL", ...CATEGORY_ORDER];

const TAB_LABEL: Record<CategoryTab, string> = {
  ALL: "すべて",
  ...CATEGORY_LABEL,
};

interface InventoryOverlayProps {
  ownedIngredientIds: readonly string[];
  inventory: InventoryState;
  onClose: () => void;
}

export function InventoryOverlay({ ownedIngredientIds, inventory, onClose }: InventoryOverlayProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL");

  const owned = INGREDIENTS.filter((ingredient) => ownedIngredientIds.includes(ingredient.id));
  const visible =
    activeTab === "ALL" ? owned : owned.filter((ingredient) => ingredient.category === activeTab);

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel inventory-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"\u{1F9FA}"} 在庫</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="dex-overlay__body">
          <p className="inventory-overlay__summary">
            所持 {owned.length}/{INGREDIENTS.length}種
          </p>

          <div className="inventory-tabs" role="tablist" aria-label="材料カテゴリ">
            {TAB_ORDER.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`inventory-tab ${activeTab === tab ? "inventory-tab--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABEL[tab]}
              </button>
            ))}
          </div>

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
  );
}
